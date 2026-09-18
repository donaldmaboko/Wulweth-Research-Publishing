"""In-app notifications and user notification preferences."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db import get_db
from app.models import Notification, User
from app.routers.common import page_params, paged, pick

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                       params: dict = Depends(page_params), unread_only: bool = False):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Notification.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    return paged([pick(n, "id", "type", "title", "body", "link", "read_at", "created_at") for n in rows], total, params)


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.scalar(select(func.count(Notification.id)).where(
        Notification.user_id == user.id, Notification.read_at.is_(None))) or 0
    return {"count": count}


@router.post("/{nid}/read")
def mark_read(nid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    if not n.read_at:
        n.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))).all()
    for n in rows:
        n.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "updated": len(rows)}


DEFAULT_PREFS = {
    "REQUEST": {"email": True}, "QUOTE": {"email": True}, "PAYMENT": {"email": True},
    "ASSIGNMENT": {"email": True}, "PROJECT": {"email": True}, "MESSAGE": {"email": True},
    "DELIVERABLE": {"email": True}, "QC": {"email": True}, "PAYOUT": {"email": True},
    "MODERATION": {"email": True}, "INTEGRITY": {"email": True}, "OPPORTUNITY": {"email": True},
    "ACCOUNT": {"email": True},
}


class PrefsIn(BaseModel):
    preferences: dict[str, dict]


@router.get("/preferences")
def get_preferences(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    prefs = DEFAULT_PREFS.copy()
    stored = user.notification_prefs or {}
    for key, value in stored.items():
        if key in prefs and isinstance(value, dict):
            prefs[key].update(value)
    return {"preferences": prefs}


@router.put("/preferences")
def update_preferences(payload: PrefsIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    merged = dict(DEFAULT_PREFS)
    for key, value in (payload.preferences or {}).items():
        if key in merged and isinstance(value, dict):
            merged[key].update({k: bool(v) for k, v in value.items() if k in ("email",)})
    user.notification_prefs = merged
    db.commit()
    return {"preferences": merged}
