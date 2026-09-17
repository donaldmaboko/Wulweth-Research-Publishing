"""Project workflow engine: creation, guarded status transitions, history."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Conversation, ConversationParticipant, Project, ProjectStatusHistory,
    ResearchRequest, User,
)
from app.models_enums import PROJECT_TRANSITIONS, ProjectStatus, UserRole
from app.services.ids import next_number
from app.services.notify import notify

# Statuses a professional may set when working on an assigned project
PROFESSIONAL_TRANSITIONS = {
    (ProjectStatus.PROFESSIONAL_ASSIGNED.value, ProjectStatus.IN_PROGRESS.value),
    (ProjectStatus.IN_PROGRESS.value, ProjectStatus.SUBMITTED.value),
    (ProjectStatus.REVISION_REQUIRED.value, ProjectStatus.IN_PROGRESS.value),
    (ProjectStatus.REVISION_REQUIRED.value, ProjectStatus.SUBMITTED.value),
}

# Statuses triggered by domain events (payment, QC, quotes) rather than by people
SYSTEM_TRANSITIONS = {
    (ProjectStatus.AWAITING_CLIENT_APPROVAL.value, ProjectStatus.PAYMENT_PENDING.value),
    (ProjectStatus.PAYMENT_PENDING.value, ProjectStatus.PAYMENT_CONFIRMED.value),
    (ProjectStatus.SUBMITTED.value, ProjectStatus.QUALITY_REVIEW.value),
    (ProjectStatus.SUBMITTED.value, ProjectStatus.REVISION_REQUIRED.value),
    (ProjectStatus.SUBMITTED.value, ProjectStatus.APPROVED.value),
    (ProjectStatus.QUALITY_REVIEW.value, ProjectStatus.REVISION_REQUIRED.value),
    (ProjectStatus.QUALITY_REVIEW.value, ProjectStatus.APPROVED.value),
    (ProjectStatus.APPROVED.value, ProjectStatus.COMPLETED.value),
    (ProjectStatus.COMPLETED.value, ProjectStatus.PAYMENT_RELEASED.value),
    (ProjectStatus.QUOTE_PREPARED.value, ProjectStatus.AWAITING_CLIENT_APPROVAL.value),
    (ProjectStatus.AWAITING_CLIENT_APPROVAL.value, ProjectStatus.UNDER_REVIEW.value),
}


def open_project_from_request(db: Session, r: ResearchRequest, staff: User) -> Project:
    project = Project(
        tracking_id=next_number(db, "project", "WUL"),
        request_id=r.id,
        client_id=r.client_id,
        organization_id=r.organization_id,
        service_id=r.service_id,
        title=r.title,
        description=r.description,
        deadline=r.deadline,
        currency=r.currency or "USD",
        status=ProjectStatus.UNDER_REVIEW.value,
    )
    db.add(project)
    db.flush()
    record_status(db, project, None, ProjectStatus.UNDER_REVIEW.value, staff, "Project opened from research request")
    ensure_conversation(db, project)
    return project


def record_status(db: Session, project: Project, from_status: str | None, to_status: str,
                  actor: User | None, note: str | None = None, trigger: str | None = None) -> None:
    db.add(ProjectStatusHistory(
        project_id=project.id, from_status=from_status, to_status=to_status,
        changed_by=actor.id if actor else None, note=note, system_trigger=trigger,
    ))


def transition_project(db: Session, project: Project, to_status: str, actor: User | None,
                       note: str | None = None, trigger: str | None = None,
                       notify_client: bool = True) -> Project:
    current = project.status
    allowed_pair = (current, to_status) in SYSTEM_TRANSITIONS or (current, to_status) in PROFESSIONAL_TRANSITIONS
    staff_allowed = to_status in PROJECT_TRANSITIONS.get(current, set())

    if not (allowed_pair or staff_allowed):
        raise HTTPException(409, f"Cannot move project from {current} to {to_status}")

    project.status = to_status
    record_status(db, project, current, to_status, actor, note, trigger)
    if to_status == ProjectStatus.IN_PROGRESS.value and not project.started_at:
        project.started_at = datetime.now(timezone.utc)
    if to_status in {ProjectStatus.COMPLETED.value, ProjectStatus.PAYMENT_RELEASED.value} and not project.completed_at:
        project.completed_at = datetime.now(timezone.utc)

    if notify_client and actor and project.client_id != actor.id:
        client = db.get(User, project.client_id)
        if client:
            label = to_status.replace("_", " ").title()
            notify(db, None, client, "PROJECT", f"Project {project.tracking_id}: {label}",
                   note or None, link=f"/dashboard/projects/{project.id}")
    return project


def ensure_conversation(db: Session, project: Project) -> Conversation:
    convo = db.scalar(select(Conversation).where(Conversation.project_id == project.id))
    if convo:
        return convo
    convo = Conversation(project_id=project.id, subject=f"Project {project.tracking_id} — {project.title[:120]}")
    db.add(convo)
    db.flush()
    participants = {project.client_id, project.assigned_professional_id}
    staff = db.scalars(select(User).where(User.role.in_([UserRole.MANAGER.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))).all()
    for su in staff:
        participants.add(su.id)
    for pid in filter(None, participants):
        db.add(ConversationParticipant(conversation_id=convo.id, user_id=pid))
    return convo
