"""Administration: users, platform settings, audit logs, staff management."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import security
from app.core.deps import audit, get_current_user, is_admin, require_admin, require_roles
from app.db import get_db
from app.models import (
    AuditLog, Organization, OrganizationMember, Project, ResearcherProfile, User,
    UserRoleLink,
)
from app.models_enums import UserRole, UserStatus, PROFESSIONAL_ROLES
from app.routers.common import page_params, paged, pick
from app.services.notify import notify

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def list_users(db: Session = Depends(get_db), user: User = Depends(require_admin),
               params: dict = Depends(page_params), role: str | None = None, q: str | None = None,
               status: str | None = None):
    stmt = select(User).where(User.deleted_at.is_(None))
    if role:
        stmt = stmt.where(User.role == role)
    if status:
        stmt = stmt.where(User.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(User.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for u in rows:
        profile = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == u.id)) if u.role in {r.value for r in PROFESSIONAL_ROLES} else None
        items.append(pick(u, "id", "email", "full_name", "role", "status", "country", "created_at",
                          "last_login_at", "email_verified_at",
                          professional_title=u.professional_title or (profile.professional_title if profile else None),
                          verification=profile.verification if profile else None))
    return paged(items, total, params)


class StaffCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(max_length=200)
    role: str = Field(pattern="^(MANAGER|QC_REVIEWER|FINANCE|ADMIN)$")
    professional_title: str | None = None


@router.post("/users/staff", status_code=201)
def create_staff(payload: StaffCreateIn, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(require_admin)):
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    staff = User(email=payload.email.lower(), password_hash=security.hash_password(payload.password),
                 full_name=payload.full_name, role=payload.role, status=UserStatus.ACTIVE.value,
                 email_verified_at=datetime.now(timezone.utc), professional_title=payload.professional_title)
    db.add(staff)
    db.flush()
    db.add(UserRoleLink(user_id=staff.id, role_id=payload.role, granted_by=user.id))
    audit(db, request, user, "admin.staff_created", "user", staff.id, {"role": payload.role})
    notify(db, None, staff, "ACCOUNT", "Your Wulweth staff account is ready",
           "Sign in and change your password from your profile settings.", link="/dashboard")
    db.commit()
    return pick(staff, "id", "email", "full_name", "role", "status")


class UserUpdateIn(BaseModel):
    role: str | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|SUSPENDED)$")


@router.put("/users/{uid}")
def update_user(uid: str, payload: UserUpdateIn, request: Request, db: Session = Depends(get_db),
                user: User = Depends(require_admin)):
    target = db.get(User, uid)
    if not target or target.deleted_at:
        raise HTTPException(404, "User not found")
    if target.id == user.id and payload.status == "SUSPENDED":
        raise HTTPException(422, "You cannot suspend your own account")
    if payload.role:
        allowed = {r.value for r in UserRole}
        if payload.role not in allowed:
            raise HTTPException(422, "Unknown role")
        target.role = payload.role
        db.add(UserRoleLink(user_id=target.id, role_id=payload.role, granted_by=user.id))
    if payload.status:
        target.status = payload.status
    audit(db, request, user, "admin.user_updated", "user", target.id,
          {"role": payload.role, "status": payload.status})
    db.commit()
    return pick(target, "id", "email", "full_name", "role", "status")


@router.get("/audit-logs")
def audit_logs(db: Session = Depends(get_db), user: User = Depends(require_admin),
               params: dict = Depends(page_params), action: str | None = None, q: str | None = None):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"{action}%"))
    if q:
        stmt = stmt.where(AuditLog.action.ilike(f"%{q}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(AuditLog.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for log in rows:
        actor = db.get(User, log.actor_id) if log.actor_id else None
        items.append(pick(log, "id", "action", "entity_type", "entity_id", "ip", "created_at",
                          metadata_json=log.metadata_json,
                          actor=actor.full_name if actor else "System"))
    return paged(items, total, params)


@router.get("/settings")
def get_settings_all(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    from app.models import PlatformSetting
    rows = db.scalars(select(PlatformSetting)).all()
    return {"settings": [pick(r, "key", "value", "updated_at") for r in rows]}


class SettingIn(BaseModel):
    key: str = Field(max_length=80)
    value: dict


@router.put("/settings")
def update_setting(payload: SettingIn, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(require_admin)):
    from app.models import PlatformSetting
    row = db.get(PlatformSetting, payload.key)
    if not row:
        row = PlatformSetting(key=payload.key)
        db.add(row)
    row.value = payload.value
    row.updated_by = user.id
    audit(db, request, user, "admin.setting_updated", "platform_setting", payload.key, payload.value)
    db.commit()
    return pick(row, "key", "value", "updated_at")


@router.get("/organizations")
def list_organizations(db: Session = Depends(get_db), user: User = Depends(require_admin),
                       params: dict = Depends(page_params)):
    stmt = select(Organization).where(Organization.deleted_at.is_(None))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Organization.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for org in rows:
        members = db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org.id)).all()
        member_data = []
        for m in members:
            u = db.get(User, m.user_id)
            member_data.append(pick(m, "id", "member_role", "status", "user_id",
                                    name=u.full_name if u else None, email=u.email if u else None))
        items.append(pick(org, "id", "name", "org_type", "industry", "country", "verification", "created_at",
                          members=member_data))
    return paged(items, total, params)


class OrgVerifyIn(BaseModel):
    verification: str = Field(pattern="^(VERIFIED|UNVERIFIED|PENDING)$")
    note: str | None = None


@router.post("/organizations/{oid}/verification")
def verify_organization(oid: str, payload: OrgVerifyIn, request: Request, db: Session = Depends(get_db),
                        user: User = Depends(require_admin)):
    org = db.get(Organization, oid)
    if not org:
        raise HTTPException(404, "Organization not found")
    org.verification = payload.verification
    audit(db, request, user, "admin.org_verification", "organization", oid, {"verification": payload.verification})
    db.commit()
    return pick(org, "id", "name", "verification")
