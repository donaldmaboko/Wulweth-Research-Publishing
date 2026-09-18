"""Research request intake: drafts, submission, tracking IDs, screening, review."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_staff, require_staff
from app.db import get_db
from app.models import (
    Document, ModerationAction, ModerationCase, OrganizationMember, Project,
    ResearchRequest, Service, User,
)
from app.models_enums import ContentType, ModerationStatus, RequestStatus, RiskLevel, UserRole
from app.routers.common import jdump, page_params, paged, pick
from app.services.ids import next_number
from app.services.integrity import INTEGRITY_EXPLANATION, screen_content
from app.services.notify import notify
from app.services.projects_flow import record_status, transition_project  # noqa: F401

router = APIRouter(tags=["research-requests"])


class RequestIn(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    discipline: str | None = None
    research_field_id: str | None = None
    service_id: str | None = None
    objective: str | None = Field(default=None, max_length=4000)
    description: str | None = Field(default=None, max_length=20000)
    methodology: str | None = Field(default=None, max_length=8000)
    data_availability: str | None = None
    data_description: str | None = None
    expected_deliverables: str | None = Field(default=None, max_length=4000)
    deadline: datetime | None = None
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    currency: str = "USD"
    preferred_expertise: str | None = None
    confidentiality_note: str | None = None
    additional_notes: str | None = None


def _apply(r: ResearchRequest, payload: RequestIn) -> None:
    for field, value in payload.model_dump().items():
        setattr(r, field, value)


def _client_org(db: Session, user: User) -> str | None:
    from app.models import ClientProfile
    cp = db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id))
    if cp and cp.organization_id:
        return cp.organization_id
    om = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == user.id))
    return om.organization_id if om else None


def _can_view(db: Session, user: User, r: ResearchRequest) -> bool:
    return is_staff(user) or r.client_id == user.id


def screen_and_moderate(db: Session, r: ResearchRequest, author: User) -> str:
    """Automated screening + moderation case when needed. Returns risk level."""
    blob = " ".join(filter(None, [r.title, r.objective, r.description, r.methodology, r.expected_deliverables, r.additional_notes]))
    result = screen_content(blob)
    r.risk_level = result["risk"]
    if result["risk"] in {RiskLevel.POTENTIAL.value, RiskLevel.PROHIBITED.value}:
        case = ModerationCase(
            case_number=next_number(db, "moderation", "MOD"),
            content_type=ContentType.RESEARCH_REQUEST.value,
            content_id=r.id,
            author_id=author.id,
            risk_level=result["risk"],
            triggered_rules=result["rules"],
            excerpt=result["excerpt"],
            status=ModerationStatus.PENDING_REVIEW.value,
        )
        db.add(case)
        db.flush()
        db.add(ModerationAction(case_id=case.id, actor_id=None, action="AUTO_FLAGGED",
                                notes=f"Automated screening matched: {', '.join(result['rules']) or 'policy heuristics'}"))
        return case.id
    return ""


@router.get("/research-requests")
def list_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                  params: dict = Depends(page_params), status: str | None = None, q: str | None = None):
    stmt = select(ResearchRequest)
    if not is_staff(user):
        stmt = stmt.where(ResearchRequest.client_id == user.id)
    if status:
        stmt = stmt.where(ResearchRequest.status == status)
    if q:
        stmt = stmt.where(or_(ResearchRequest.title.ilike(f"%{q}%"), ResearchRequest.tracking_id.ilike(f"%{q}%")))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(ResearchRequest.updated_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    return paged([_request_row(db, r) for r in rows], total, params)


def _request_row(db: Session, r: ResearchRequest) -> dict:
    client = db.get(User, r.client_id)
    service = db.get(Service, r.service_id) if r.service_id else None
    return pick(
        r, "id", "tracking_id", "title", "discipline", "status", "risk_level", "currency",
        "budget_min", "budget_max", "deadline", "submitted_at", "created_at", "updated_at",
        client_name=client.full_name if client else None,
        service_name=service.name if service else None,
    )


@router.post("/research-requests", status_code=201)
def create_request(payload: RequestIn, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    if user.role not in {UserRole.CLIENT.value, UserRole.ORGANIZATION.value, UserRole.MANAGER.value,
                         UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value}:
        raise HTTPException(403, "Only client and organization accounts can submit research requests")
    if payload.budget_min and payload.budget_max and payload.budget_min > payload.budget_max:
        raise HTTPException(422, "Minimum budget cannot exceed maximum budget")

    r = ResearchRequest(client_id=user.id, organization_id=_client_org(db, user), status=RequestStatus.DRAFT.value)
    _apply(r, payload)
    db.add(r)
    db.commit()
    audit(db, request, user, "request.draft_created", "research_request", r.id)
    return _detail(db, r)


@router.get("/research-requests/{rid}")
def get_request(rid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at or not _can_view(db, user, r):
        raise HTTPException(404, "Research request not found")
    return _detail(db, r)


def _detail(db: Session, r: ResearchRequest) -> dict:
    service = db.get(Service, r.service_id) if r.service_id else None
    field = None
    if r.research_field_id:
        from app.models import ResearchField
        field = db.get(ResearchField, r.research_field_id)
    docs = db.scalars(select(Document).where(Document.request_id == r.id, Document.status == "ACTIVE")).all()
    client = db.get(User, r.client_id)
    project = db.scalar(select(Project).where(Project.request_id == r.id))
    data = pick(
        r,
        "id", "tracking_id", "title", "discipline", "objective", "description", "methodology",
        "data_availability", "data_description", "expected_deliverables", "deadline",
        "budget_min", "budget_max", "currency", "preferred_expertise", "confidentiality_note",
        "additional_notes", "status", "risk_level", "submitted_at", "review_note", "created_at",
        "updated_at",
        service=pick(service, "id", "name", "category") if service else None,
        research_field=pick(field, "id", "name", "group") if field else None,
        client=pick(client, "id", "full_name", "email", "country") if (is_staff(db.get(User, r.client_id) or client) or True) else None,
        attachments=[pick(d, "id", "filename", "size_bytes", "content_type", "created_at", "scan_status") for d in docs],
        project_id=project.id if project else None,
        project_tracking=project.tracking_id if project else None,
    )
    return data


@router.put("/research-requests/{rid}")
def update_request(rid: str, payload: RequestIn, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at or r.client_id != user.id:
        raise HTTPException(404, "Research request not found")
    if r.status not in {RequestStatus.DRAFT.value, RequestStatus.CLARIFICATION_REQUESTED.value}:
        raise HTTPException(409, "Only drafts or requests awaiting clarification can be edited")
    _apply(r, payload)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _detail(db, r)


@router.post("/research-requests/{rid}/submit")
def submit_request(rid: str, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at or r.client_id != user.id:
        raise HTTPException(404, "Research request not found")
    if r.status not in {RequestStatus.DRAFT.value, RequestStatus.CLARIFICATION_REQUESTED.value}:
        raise HTTPException(409, "This request has already been submitted")

    if not r.title or not r.description or not r.service_id:
        raise HTTPException(422, "A title, description and service are required before submitting")

    case_id = screen_and_moderate(db, r, user)
    if r.risk_level == RiskLevel.PROHIBITED.value:
        # Prohibited: the request is rejected outright (workflow: Prohibited -> Reject).
        # The audit case remains for the moderation team; the draft is not submitted.
        r.status = RequestStatus.CLARIFICATION_REQUESTED.value
        r.review_note = "Submission blocked by automated research-integrity screening."
        db.commit()
        raise HTTPException(422, INTEGRITY_EXPLANATION)

    r.status = RequestStatus.SUBMITTED.value
    r.submitted_at = datetime.now(timezone.utc)
    if not r.tracking_id:
        r.tracking_id = next_number(db, "request", "WUL")

    audit(db, request, user, "request.submitted", "research_request", r.id, {"tracking_id": r.tracking_id})
    notify(db, None, user, "REQUEST", f"Research request {r.tracking_id} submitted",
           "Our team will review your request and identify appropriate expertise.", link=f"/dashboard/requests/{r.id}")
    # staff notification
    for staff_user in db.scalars(select(User).where(User.role.in_([UserRole.MANAGER.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))).all():
        notify(db, None, staff_user, "REQUEST", f"New research request {r.tracking_id}",
               f"{user.full_name} submitted “{r.title}”.", link=f"/dashboard/requests/{r.id}")
    db.commit()
    data = _detail(db, r)
    data["integrity_case"] = case_id or None
    if r.risk_level == RiskLevel.PROHIBITED.value:
        data["integrity_notice"] = INTEGRITY_EXPLANATION
    return data


@router.post("/research-requests/{rid}/withdraw")
def withdraw_request(rid: str, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at or r.client_id != user.id:
        raise HTTPException(404, "Research request not found")
    if r.status not in {RequestStatus.DRAFT.value, RequestStatus.SUBMITTED.value, RequestStatus.UNDER_REVIEW.value,
                        RequestStatus.CLARIFICATION_REQUESTED.value}:
        raise HTTPException(409, "This request can no longer be withdrawn")
    r.status = RequestStatus.DECLINED.value
    r.review_note = (r.review_note or "") + "\nWithdrawn by client."
    audit(db, request, user, "request.withdrawn", "research_request", r.id)
    db.commit()
    return _detail(db, r)


# ------------------------------ staff actions -------------------------------

@router.post("/research-requests/{rid}/start-review")
def start_review(rid: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at:
        raise HTTPException(404, "Research request not found")
    if r.status != RequestStatus.SUBMITTED.value:
        raise HTTPException(409, "Expected status: SUBMITTED")
    r.status = RequestStatus.UNDER_REVIEW.value
    r.reviewed_by = user.id
    audit(db, request, user, "request.review_started", "research_request", r.id)
    db.commit()
    return _detail(db, r)


class ClarifyIn(BaseModel):
    message: str = Field(min_length=5, max_length=4000)


@router.post("/research-requests/{rid}/request-clarification")
def request_clarification(rid: str, payload: ClarifyIn, request: Request, db: Session = Depends(get_db),
                          user: User = Depends(require_staff)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at:
        raise HTTPException(404, "Research request not found")
    r.status = RequestStatus.CLARIFICATION_REQUESTED.value
    r.review_note = payload.message
    audit(db, request, user, "request.clarification_requested", "research_request", r.id)
    notify(db, None, db.get(User, r.client_id), "REQUEST", f"Clarification requested on {r.tracking_id}",
           payload.message, link=f"/dashboard/requests/{r.id}")
    db.commit()
    return _detail(db, r)


class DeclineIn(BaseModel):
    reason: str = Field(min_length=5, max_length=4000)


@router.post("/research-requests/{rid}/decline")
def decline_request(rid: str, payload: DeclineIn, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(require_staff)):
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at:
        raise HTTPException(404, "Research request not found")
    if r.status in {RequestStatus.CONVERTED.value, RequestStatus.DECLINED.value}:
        raise HTTPException(409, "This request is already closed")
    r.status = RequestStatus.DECLINED.value
    r.review_note = payload.reason
    audit(db, request, user, "request.declined", "research_request", r.id, {"reason": payload.reason})
    notify(db, None, db.get(User, r.client_id), "REQUEST", f"Update on your request {r.tracking_id}",
           payload.reason, link=f"/dashboard/requests/{r.id}")
    db.commit()
    return _detail(db, r)


@router.post("/research-requests/{rid}/convert")
def convert_request(rid: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    """Convert a reviewed request into a project (quote is prepared next)."""
    from app.services.projects_flow import open_project_from_request
    r = db.get(ResearchRequest, rid)
    if not r or r.deleted_at:
        raise HTTPException(404, "Research request not found")
    if r.status not in {RequestStatus.UNDER_REVIEW.value, RequestStatus.SUBMITTED.value, RequestStatus.QUOTED.value}:
        raise HTTPException(409, "Only requests under review can be converted")
    project = open_project_from_request(db, r, user)
    r.status = RequestStatus.CONVERTED.value
    r.project_id = project.id
    audit(db, request, user, "request.converted", "project", project.id, {"request": r.tracking_id})
    db.commit()
    return {"project_id": project.id, "tracking_id": project.tracking_id, "status": project.status}
