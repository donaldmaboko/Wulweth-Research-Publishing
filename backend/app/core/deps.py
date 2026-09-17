"""FastAPI dependencies: authentication, RBAC guards, rate limiting, audit."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.db import get_db
from app.models import AuditLog, User

from app.models_enums import STAFF_ROLES, UserRole


def get_client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- Rate limiting (in-memory sliding window; swap for Redis in production) --
_rate_buckets: dict[str, deque] = defaultdict(deque)


def rate_limit(scope: str, max_events: int, per_seconds: int):
    def _dep(request: Request):
        if not settings.rate_limit_enabled:
            return
        key = f"{scope}:{get_client_ip(request)}"
        nowt = time.time()
        bucket = _rate_buckets[key]
        while bucket and bucket[0] < nowt - per_seconds:
            bucket.popleft()
        if len(bucket) >= max_events:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Please slow down.")
        bucket.append(nowt)

    return _dep


# --- Current user -----------------------------------------------------------

def _token_from_request(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    cookie = request.cookies.get(security.SESSION_COOKIE)
    return cookie


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = _token_from_request(request)
    if not token:
        return None
    payload = security.decode_session_token(token)
    if not payload:
        return None
    user = db.get(User, payload["sub"])
    if user is None or user.deleted_at is not None or user.status == "SUSPENDED":
        return None
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_optional_user(request, db)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    return user


def require_roles(*roles: UserRole):
    allowed = {r.value for r in roles}

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action")
        return user

    return _dep


def require_staff(user: User = Depends(get_current_user)) -> User:
    if user.role not in {r.value for r in STAFF_ROLES}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff access required")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in {UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access required")
    return user


def require_professional(user: User = Depends(get_current_user)) -> User:
    if user.role not in {
        UserRole.RESEARCHER.value,
        UserRole.RESEARCH_CONSULTANT.value,
        UserRole.DATA_SPECIALIST.value,
        UserRole.EDITOR.value,
    }:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Research professional account required")
    return user


def is_staff(user: User) -> bool:
    return user.role in {r.value for r in STAFF_ROLES}


def is_admin(user: User) -> bool:
    return user.role in {UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value}


def is_professional(user: User) -> bool:
    return user.role in {
        UserRole.RESEARCHER.value,
        UserRole.RESEARCH_CONSULTANT.value,
        UserRole.DATA_SPECIALIST.value,
        UserRole.EDITOR.value,
    }


# --- Audit trail -------------------------------------------------------------

def audit(
    db: Session,
    request: Request | None,
    actor: User | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip=get_client_ip(request) if request else None,
        user_agent=request.headers.get("user-agent", "")[:300] if request else None,
        metadata_json=metadata or {},
    )
    db.add(entry)
