"""Secure project-based messaging with read status and attachments."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user
from app.db import get_db
from app.models import (
    Conversation, ConversationParticipant, Document, Message, Project, User,
)
from app.routers.common import pick
from app.services.notify import notify

router = APIRouter(tags=["messages"])


def _participant(db: Session, conversation_id: str, user_id: str) -> ConversationParticipant | None:
    return db.scalar(select(ConversationParticipant).where(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id))


def _conversations_for(db: Session, user: User) -> list[Conversation]:
    parts = db.scalars(select(ConversationParticipant).where(ConversationParticipant.user_id == user.id)).all()
    convos = []
    for part in parts:
        convo = db.get(Conversation, part.conversation_id)
        if convo:
            convos.append(convo)
    return convos


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = []
    for convo in _conversations_for(db, user):
        project = db.scalar(select(Project).where(Project.id == convo.project_id))
        last = db.scalar(select(Message).where(Message.conversation_id == convo.id)
                         .order_by(Message.created_at.desc()))
        unread = 0
        part = _participant(db, convo.id, user.id)
        if part:
            msgs = db.scalars(select(Message).where(
                Message.conversation_id == convo.id,
                Message.created_at > (part.last_read_at or part.created_at if hasattr(part, "created_at") else part.last_read_at),
                Message.sender_id != user.id)).all()
            unread = len(msgs)
        items.append(pick(convo, "id", "subject", "created_at",
                          project=pick(project, "id", "tracking_id", "title", "status") if project else None,
                          last_message=pick(last, "body", "created_at") if last else None,
                          unread=unread))
    items.sort(key=lambda c: (c.get("last_message") or {}).get("created_at") or "", reverse=True)
    return {"items": items}


@router.get("/conversations/{cid}")
def get_conversation(cid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    convo = db.get(Conversation, cid)
    if not convo or not _participant(db, cid, user.id):
        raise HTTPException(404, "Conversation not found")
    project = db.get(Project, convo.project_id)
    messages = db.scalars(select(Message).where(Message.conversation_id == cid).order_by(Message.created_at)).all()
    items = []
    for m in messages:
        sender = db.get(User, m.sender_id)
        doc = db.get(Document, m.document_id) if m.document_id else None
        items.append(pick(m, "id", "body", "created_at",
                          sender=pick(sender, "id", "full_name", "role") if sender else None,
                          attachment=pick(doc, "id", "filename", "size_bytes", "content_type") if doc else None))
    # mark read
    part = _participant(db, cid, user.id)
    if part:
        part.last_read_at = datetime.now(timezone.utc)
    db.commit()
    return pick(convo, "id", "subject",
                project=pick(project, "id", "tracking_id", "title", "status") if project else None,
                messages=items)


class MessageIn(BaseModel):
    body: str | None = Field(default=None, max_length=8000)
    document_id: str | None = None


@router.post("/conversations/{cid}/messages", status_code=201)
def post_message(cid: str, payload: MessageIn, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    convo = db.get(Conversation, cid)
    if not convo or not _participant(db, cid, user.id):
        raise HTTPException(404, "Conversation not found")
    if not payload.body and not payload.document_id:
        raise HTTPException(422, "Message cannot be empty")
    if payload.document_id:
        doc = db.get(Document, payload.document_id)
        if not doc or doc.owner_id != user.id:
            raise HTTPException(422, "Attach one of your own uploaded documents")
    m = Message(conversation_id=cid, sender_id=user.id, body=payload.body, document_id=payload.document_id)
    db.add(m)
    db.flush()
    part = _participant(db, cid, user.id)
    if part:
        part.last_read_at = datetime.now(timezone.utc)

    # notify other participants (project-scoped messaging supports admin oversight)
    project = db.get(Project, convo.project_id)
    parts = db.scalars(select(ConversationParticipant).where(ConversationParticipant.conversation_id == cid)).all()
    seen = set()
    for other in parts:
        if other.user_id == user.id or other.user_id in seen:
            continue
        seen.add(other.user_id)
        recipient = db.get(User, other.user_id)
        if recipient:
            notify(db, None, recipient, "MESSAGE", f"New message — {project.tracking_id}",
                   (payload.body or "Sent an attachment")[:140], link=f"/dashboard/projects/{project.id}?tab=messages",
                   email_subject=f"New message on Wulweth project {project.tracking_id}")
    audit(db, request, user, "message.sent", "conversation", cid)
    db.commit()
    sender = db.get(User, m.sender_id)
    return pick(m, "id", "body", "created_at", sender=pick(sender, "id", "full_name", "role"))
