"""Authentication: registration, login, email verification, password reset."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.core.deps import audit, get_client_ip, get_current_user, rate_limit
from app.db import get_db
from app.models import AuthEvent, Organization, OrganizationMember, ResearcherProfile, User
from app.models_enums import UserRole, UserStatus
from app.services import notify
from app.services.ids import next_number  # noqa: F401  (kept for symmetry)

router = APIRouter(prefix="/auth", tags=["auth"])

PROFESSIONAL_SIGNUP_ROLES = {
    UserRole.RESEARCHER.value,
    UserRole.RESEARCH_CONSULTANT.value,
    UserRole.DATA_SPECIALIST.value,
    UserRole.EDITOR.value,
}


class RegisterIn(BaseModel):
    account_type: str = Field(pattern="^(client|professional|organization)$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=200)
    role: str | None = None  # required when account_type == professional
    professional_title: str | None = Field(default=None, max_length=200)
    organization_name: str | None = Field(default=None, max_length=200)
    organization_type: str | None = None
    country: str | None = Field(default=None, max_length=80)
    accept_terms: bool

    @field_validator("accept_terms")
    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the Terms of Service and Privacy Policy")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _set_session_cookie(response: Response, user: User) -> None:
    token = security.create_session_token(user.id, user.role)
    response.set_cookie(
        security.SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def _issue_action_event(db: Session, request: Request, user: User, kind: str, ttl_minutes: int) -> str:
    token, token_hash, expires = security.make_action_token(kind, user.email, ttl_minutes)
    db.add(AuthEvent(
        user_id=user.id, email=user.email, event=kind, token_hash=token_hash,
        expires_at=datetime.fromtimestamp(expires, tz=timezone.utc), ip=get_client_ip(request),
    ))
    return token


@router.post("/register", status_code=201)
def register(payload: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    role = UserRole.CLIENT.value
    if payload.account_type == "professional":
        if payload.role not in PROFESSIONAL_SIGNUP_ROLES:
            raise HTTPException(422, "Select a professional role (Researcher, Research Consultant, Data Specialist or Editor)")
        role = payload.role
    elif payload.account_type == "organization":
        if not payload.organization_name:
            raise HTTPException(422, "Organization name is required")
        role = UserRole.ORGANIZATION.value

    user = User(
        email=payload.email.lower(),
        password_hash=security.hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=role,
        professional_title=payload.professional_title,
        country=payload.country,
        status=UserStatus.PENDING.value,
        notification_prefs={},
    )
    db.add(user)
    db.flush()

    db.add(UserRoleLink(user_id=user.id, role_id=role))

    if role == UserRole.ORGANIZATION.value:
        org = Organization(
            name=payload.organization_name.strip(),
            org_type=payload.organization_type,
            country=payload.country,
            created_by=user.id,
        )
        db.add(org)
        db.flush()
        db.add(OrganizationMember(
            organization_id=org.id, user_id=user.id, member_role="OWNER", status="ACTIVE"
        ))

    if role in PROFESSIONAL_SIGNUP_ROLES:
        db.add(ResearcherProfile(
            user_id=user.id,
            professional_title=payload.professional_title,
            languages=["English"],
        ))

    token = _issue_action_event(db, request, user, "verify-email", ttl_minutes=60 * 48)
    verify_link = f"{settings.public_url}/verify-email?token={token}"
    notify.send_email(
        db, user.email,
        "Verify your Wulweth Research & Publishing account",
        f"Welcome to Wulweth Research & Publishing.\n\nConfirm your email address: {verify_link}\n\n"
        "If you did not create this account you can ignore this message.",
        template="verify-email",
    )
    audit(db, request, user, "auth.register", "user", user.id, {"role": role})
    db.commit()
    _set_session_cookie(response, user)
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role,
        "status": user.status, "verification_required": True,
        "message": "Account created. Check your email to verify your address.",
        "dev_verification_link": None if settings.is_production else verify_link,
    }


@router.post("/login")
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db),
          _rl: None = Depends(rate_limit("login", 10, 60))):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not security.verify_password(payload.password, user.password_hash) or user.deleted_at:
        audit(db, request, None, "auth.login_failed", "user", None, {"email": payload.email})
        db.commit()
        raise HTTPException(401, "Invalid email or password")
    if user.status == UserStatus.SUSPENDED.value:
        raise HTTPException(403, "This account is suspended. Contact support@wulweth.example.")

    user.last_login_at = datetime.now(timezone.utc)
    audit(db, request, user, "auth.login", "user", user.id)
    db.commit()
    _set_session_cookie(response, user)
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role,
        "status": user.status, "email_verified": bool(user.email_verified_at),
    }


@router.post("/logout")
def logout(response: Response, request: Request):
    response.delete_cookie(security.SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role,
        "status": user.status, "professional_title": user.professional_title,
        "country": user.country, "city": user.city, "phone": user.phone,
        "email_verified": bool(user.email_verified_at),
        "notification_prefs": user.notification_prefs or {},
    }


@router.post("/verify-email")
def verify_email(payload: dict, request: Request, db: Session = Depends(get_db)):
    token = (payload or {}).get("token", "")
    event = db.scalar(
        select(AuthEvent).where(AuthEvent.token_hash == security.token_hash(token), AuthEvent.event == "verify-email")
    )
    if not event or event.used_at or (event.expires_at and event.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(400, "This verification link is invalid or has expired")
    user = db.get(User, event.user_id) if event.user_id else None
    if not user:
        raise HTTPException(400, "Account not found")
    user.email_verified_at = datetime.now(timezone.utc)
    user.status = UserStatus.ACTIVE.value
    event.used_at = datetime.now(timezone.utc)
    audit(db, request, user, "auth.email_verified", "user", user.id)
    db.commit()
    return {"ok": True, "email": user.email}


@router.post("/resend-verification")
def resend_verification(request: Request, background: BackgroundTasks,
                        db: Session = Depends(get_db), user: User = Depends(get_current_user),
                        _rl: None = Depends(rate_limit("resend", 3, 300))):
    if user.email_verified_at:
        return {"ok": True, "message": "Email already verified"}
    token = _issue_action_event(db, request, user, "verify-email", ttl_minutes=60 * 48)
    link = f"{settings.public_url}/verify-email?token={token}"
    notify.send_email(db, user.email, "Verify your Wulweth account", f"Confirm your email: {link}")
    db.commit()
    return {"ok": True, "dev_verification_link": None if settings.is_production else link}


class ForgotIn(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
def forgot_password(payload: ForgotIn, request: Request, db: Session = Depends(get_db),
                    _rl: None = Depends(rate_limit("forgot", 5, 300))):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    # Always return ok to avoid account enumeration
    if user and not user.deleted_at:
        token = _issue_action_event(db, request, user, "reset-password", ttl_minutes=60)
        link = f"{settings.public_url}/reset-password?token={token}"
        notify.send_email(
            db, user.email, "Reset your Wulweth password",
            f"Reset your password using this link (valid for 1 hour):\n{link}\n\n"
            "If you did not request this, you can safely ignore it.",
            template="reset-password",
        )
        db.commit()
        return {"ok": True, "dev_reset_link": None if settings.is_production else link}
    db.commit()
    return {"ok": True, "dev_reset_link": None}


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


@router.post("/reset-password")
def reset_password(payload: ResetIn, request: Request, db: Session = Depends(get_db),
                   _rl: None = Depends(rate_limit("reset", 10, 300))):
    event = db.scalar(
        select(AuthEvent).where(AuthEvent.token_hash == security.token_hash(payload.token), AuthEvent.event == "reset-password")
    )
    if not event or event.used_at or (event.expires_at and event.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(400, "This reset link is invalid or has expired")
    user = db.get(User, event.user_id) if event.user_id else None
    if not user:
        raise HTTPException(400, "Account not found")
    user.password_hash = security.hash_password(payload.password)
    event.used_at = datetime.now(timezone.utc)
    audit(db, request, user, "auth.password_reset", "user", user.id)
    db.commit()
    return {"ok": True}


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/change-password")
def change_password(payload: ChangePasswordIn, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if not security.verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = security.hash_password(payload.new_password)
    audit(db, request, user, "auth.password_changed", "user", user.id)
    db.commit()
    return {"ok": True}
