"""Organization accounts: profile, team members, membership."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.deps import audit, get_current_user
from app.db import get_db
from app.models import Organization, OrganizationMember, ResearchRequest, User
from app.models_enums import OrgMemberRole, UserRole
from app.routers.common import pick
from app.services.notify import notify

router = APIRouter(tags=["organizations"])


def _my_orgs(db: Session, user: User) -> list[OrganizationMember]:
    return db.scalars(select(OrganizationMember).where(OrganizationMember.user_id == user.id)).all()


def _require_org_admin(db: Session, user: User, org_id: str) -> OrganizationMember:
    member = db.scalar(select(OrganizationMember).where(
        OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user.id))
    if not member or member.member_role not in {OrgMemberRole.OWNER.value, OrgMemberRole.ADMIN.value}:
        raise HTTPException(403, "Organization administrator access required")
    return member


@router.get("/my/organizations")
def my_organizations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = []
    for member in _my_orgs(db, user):
        org = db.get(Organization, member.organization_id)
        if org:
            items.append(pick(org, "id", "name", "org_type", "industry", "website", "description",
                              "country", "city", "verification", "created_at",
                              my_role=member.member_role))
    return {"items": items}


class OrgUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    org_type: str | None = None
    industry: str | None = None
    website: str | None = None
    description: str | None = Field(default=None, max_length=6000)
    country: str | None = None
    city: str | None = None


@router.put("/organizations/{oid}")
def update_organization(oid: str, payload: OrgUpdateIn, request: Request, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    _require_org_admin(db, user, oid)
    org = db.get(Organization, oid)
    if not org:
        raise HTTPException(404, "Organization not found")
    for field, value in payload.model_dump().items():
        if value is not None:
            setattr(org, field, value)
    audit(db, request, user, "organization.updated", "organization", oid)
    db.commit()
    return pick(org, "id", "name", "org_type", "industry", "website", "description", "country", "city", "verification")


@router.get("/organizations/{oid}/members")
def org_members(oid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    member = db.scalar(select(OrganizationMember).where(
        OrganizationMember.organization_id == oid, OrganizationMember.user_id == user.id))
    if not member:
        raise HTTPException(403, "Not a member of this organization")
    members = db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == oid)).all()
    items = []
    for m in members:
        u = db.get(User, m.user_id)
        items.append(pick(m, "id", "member_role", "status", "created_at",
                          name=u.full_name if u else None, email=u.email if u else None,
                          user_id=u.id if u else None))
    return {"items": items}


class InviteMemberIn(BaseModel):
    email: EmailStr
    full_name: str = Field(max_length=200)
    member_role: str = Field(default=OrgMemberRole.MEMBER.value, pattern="^(ADMIN|MANAGER|MEMBER)$")


@router.post("/organizations/{oid}/members", status_code=201)
def invite_member(oid: str, payload: InviteMemberIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    _require_org_admin(db, user, oid)
    org = db.get(Organization, oid)
    invitee = db.scalar(select(User).where(User.email == payload.email.lower()))
    if invitee:
        existing = db.scalar(select(OrganizationMember).where(
            OrganizationMember.organization_id == oid, OrganizationMember.user_id == invitee.id))
        if existing:
            raise HTTPException(409, "This person is already a member")
        db.add(OrganizationMember(organization_id=oid, user_id=invitee.id,
                                  member_role=payload.member_role, invited_by=user.id, status="ACTIVE"))
        notify(db, None, invitee, "ACCOUNT", f"You have been added to {org.name}",
               f"{user.full_name} added you to the organization workspace.", link="/dashboard")
    else:
        import secrets
        temp_password = "Wulweth-" + secrets.token_urlsafe(9)
        invitee = User(email=payload.email.lower(), password_hash=security.hash_password(temp_password),
                       full_name=payload.full_name, role=UserRole.CLIENT.value, status="PENDING",
                       notification_prefs={})
        db.add(invitee)
        db.flush()
        db.add(OrganizationMember(organization_id=oid, user_id=invitee.id,
                                  member_role=payload.member_role, invited_by=user.id, status="ACTIVE"))
        notify(db, None, invitee, "ACCOUNT", f"Join {org.name} on Wulweth",
               f"An account was created for you. Temporary password: {temp_password}\n"
               "Please sign in and change your password immediately.",
               email_subject=f"You have been invited to {org.name} on Wulweth")
    audit(db, request, user, "organization.member_invited", "organization", oid, {"email": payload.email})
    db.commit()
    return {"ok": True, "message": f"{payload.email} is now a member of {org.name}"}
