"""User profile, preferences, data export and account deletion (privacy controls)."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user
from app.db import get_db
from app.models import (
    Document, Invoice, Notification, Project, ResearchRequest, User,
)
from app.routers.common import pick

router = APIRouter(tags=["users"])


class ProfileIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=80)
    timezone: str | None = Field(default=None, max_length=60)
    bio: str | None = Field(default=None, max_length=4000)
    language: str | None = None


@router.put("/my/profile")
def update_profile(payload: ProfileIn, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    for field, value in payload.model_dump().items():
        if value is not None:
            setattr(user, field, value)
    audit(db, request, user, "user.profile_updated", "user", user.id)
    db.commit()
    return pick(user, "id", "email", "full_name", "role", "phone", "country", "city", "timezone", "bio")


@router.get("/my/export")
def export_my_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """GDPR-style data export: everything Wulweth holds about this account."""
    requests = db.scalars(select(ResearchRequest).where(ResearchRequest.client_id == user.id)).all()
    projects = db.scalars(select(Project).where(
        (Project.client_id == user.id) | (Project.assigned_professional_id == user.id))).all()
    invoices = db.scalars(select(Invoice).where(Invoice.client_id == user.id)).all()
    docs = db.scalars(select(Document).where(Document.owner_id == user.id)).all()
    notifications = db.scalars(select(Notification).where(Notification.user_id == user.id)).all()

    payload = {
        "account": pick(user, "id", "email", "full_name", "role", "status", "country", "city",
                        "phone", "timezone", "created_at", "email_verified_at", "notification_prefs"),
        "research_requests": [pick(r, "tracking_id", "title", "status", "created_at") for r in requests],
        "projects": [pick(p, "tracking_id", "title", "status", "created_at", "completed_at") for p in projects],
        "invoices": [pick(i, "invoice_number", "total", "currency", "status", "created_at") for i in invoices],
        "documents": [pick(d, "filename", "size_bytes", "created_at") for d in docs],
        "notifications": [pick(n, "title", "created_at") for n in notifications],
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    content = json.dumps(payload, indent=2, default=str)
    return Response(content, media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="wulweth-data-export.json"'})


@router.post("/my/delete-account")
def delete_account(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Soft-deletes the account; financial records are retained for audit/compliance."""
    user.deleted_at = datetime.now(timezone.utc)
    user.status = "SUSPENDED"
    user.email = f"deleted+{user.id[:8]}@wulweth.example"
    audit(db, request, user, "user.account_deleted", "user", user.id)
    db.commit()
    return {"ok": True, "message": "Your account has been deactivated. Financial records are retained as required by law."}
