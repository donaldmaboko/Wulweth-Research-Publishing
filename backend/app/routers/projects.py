"""Projects: workspace, workflow transitions, milestones, assignment, matching."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_staff, require_staff
from app.db import get_db
from app.models import (
    Conversation, Deliverable, DeliverableVersion, Document, Invoice, Organization,
    Project, ProjectAssignment, ProjectMilestone, ProjectStatusHistory, Quote,
    ResearchRequest, ResearcherProfile, Service, User,
)
from app.models_enums import (
    AssignmentStatus, DeliverableStatus, InvoiceStatus, MilestoneStatus,
    PROFESSIONAL_ROLES, ProjectStatus, UserRole, VersionStatus,
)
from app.routers.common import jdump, page_params, paged, pick
from app.services.notify import notify
from app.services.projects_flow import ensure_conversation, transition_project

router = APIRouter(tags=["projects"])


def _can_access(db: Session, user: User, p: Project) -> bool:
    if is_staff(user):
        return True
    if p.client_id == user.id:
        return True
    if p.assigned_professional_id == user.id:
        return True
    # organization members can view their org projects
    if p.organization_id:
        from app.models import OrganizationMember
        member = db.scalar(select(OrganizationMember).where(
            OrganizationMember.organization_id == p.organization_id, OrganizationMember.user_id == user.id))
        if member:
            return True
    return False


def workspace_dict(db: Session, p: Project) -> dict:
    client = db.get(User, p.client_id)
    professional = db.get(User, p.assigned_professional_id) if p.assigned_professional_id else None
    org = db.get(Organization, p.organization_id) if p.organization_id else None
    service = db.get(Service := __import__("app.models", fromlist=["Service"]).Service, p.service_id) if p.service_id else None
    request = db.get(ResearchRequest := __import__("app.models", fromlist=["ResearchRequest"]).ResearchRequest, p.request_id) if p.request_id else None

    deliverables = db.scalars(select(Deliverable).where(Deliverable.project_id == p.id).order_by(Deliverable.created_at)).all()
    deliverable_data = []
    for d in deliverables:
        versions = db.scalars(select(DeliverableVersion).where(DeliverableVersion.deliverable_id == d.id).order_by(DeliverableVersion.version_number.desc())).all()
        deliverable_data.append(pick(
            d, "id", "title", "description", "status", "current_version_number", "created_at",
            versions=[pick(v, "id", "version_number", "notes", "status", "submitted_at", "uploaded_by",
                           document=pick(v.document, "id", "filename", "size_bytes", "content_type")) for v in versions],
        ))

    documents = db.scalars(select(Document).where(Document.project_id == p.id, Document.status == "ACTIVE")
                           .order_by(Document.created_at.desc())).all()
    history = db.scalars(select(ProjectStatusHistory).where(ProjectStatusHistory.project_id == p.id)
                         .order_by(ProjectStatusHistory.created_at)).all()
    history_data = []
    for h in history:
        actor = db.get(User, h.changed_by) if h.changed_by else None
        history_data.append(pick(h, "id", "from_status", "to_status", "note", "system_trigger", "created_at",
                                 changed_by_name=actor.full_name if actor else None))
    assignments = db.scalars(select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)).all()
    assignment_data = []
    for a in assignments:
        u = db.get(User, a.professional_id)
        assignment_data.append(pick(a, "id", "status", "role_on_project", "note", "assigned_at", "accepted_at",
                                    professional=pick(u, "id", "full_name", "role", "professional_title") if u else None))

    convo = db.scalar(select(Conversation).where(Conversation.project_id == p.id))
    quote = db.scalar(select(Quote).where(Quote.project_id == p.id).order_by(Quote.created_at.desc()))
    invoice = db.scalar(select(Invoice).where(Invoice.project_id == p.id).order_by(Invoice.created_at.desc()))

    return pick(
        p, "id", "tracking_id", "title", "description", "status", "deadline", "currency",
        "quoted_amount", "fee_percent", "fee_amount", "funds_status", "started_at", "completed_at",
        "created_at", "updated_at", "confidentiality_level",
        client=pick(client, "id", "full_name", "email", "country", "professional_title") if client else None,
        organization=pick(org, "id", "name", "org_type") if org else None,
        professional=pick(professional, "id", "full_name", "role", "professional_title", "email") if professional else None,
        service=pick(service, "id", "name", "category") if service else None,
        request=pick(request, "id", "tracking_id", "objective", "methodology", "expected_deliverables",
                     "preferred_expertise", "data_availability", "data_description", "budget_min", "budget_max") if request else None,
        deliverables=deliverable_data,
        documents=[pick(d, "id", "filename", "size_bytes", "content_type", "kind", "created_at",
                        owner=db.get(User, d.owner_id).full_name) for d in documents],
        status_history=history_data,
        assignments=assignment_data,
        conversation_id=convo.id if convo else None,
        quote=pick(quote, "id", "quote_number", "total", "currency", "status", "valid_until") if quote else None,
        invoice=pick(invoice, "id", "invoice_number", "total", "currency", "status", "due_date") if invoice else None,
    )


from app.models import ResearchRequest, Service  # noqa: F401  (explicit re-import)


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                  params: dict = Depends(page_params), status: str | None = None, q: str | None = None):
    stmt = select(Project)
    if not is_staff(user):
        stmt = stmt.where(or_(Project.client_id == user.id, Project.assigned_professional_id == user.id))
    if status:
        stmt = stmt.where(Project.status == status)
    if q:
        stmt = stmt.where(or_(Project.title.ilike(f"%{q}%"), Project.tracking_id.ilike(f"%{q}%")))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Project.updated_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for p in rows:
        professional = db.get(User, p.assigned_professional_id) if p.assigned_professional_id else None
        items.append(pick(p, "id", "tracking_id", "title", "status", "deadline", "currency", "quoted_amount",
                          "funds_status", "updated_at", "created_at",
                          professional_name=professional.full_name if professional else None))
    return paged(items, total, params)


@router.get("/projects/{pid}")
def get_project(pid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Project, pid)
    if not p or p.deleted_at or not _can_access(db, user, p):
        raise HTTPException(404, "Project not found")
    return workspace_dict(db, p)


class StatusIn(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=2000)


@router.post("/projects/{pid}/status")
def change_status(pid: str, payload: StatusIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    p = db.get(Project, pid)
    if not p or p.deleted_at or not _can_access(db, user, p):
        raise HTTPException(404, "Project not found")
    if not is_staff(user):
        # professionals may advance their own work states
        if p.assigned_professional_id != user.id or (p.status, payload.status) not in {
            (ProjectStatus.PROFESSIONAL_ASSIGNED.value, ProjectStatus.IN_PROGRESS.value),
            (ProjectStatus.IN_PROGRESS.value, ProjectStatus.SUBMITTED.value),
            (ProjectStatus.REVISION_REQUIRED.value, ProjectStatus.IN_PROGRESS.value),
        }:
            raise HTTPException(403, "Only Wulweth staff can change project status")
    transition_project(db, p, payload.status, user, payload.note or None)
    audit(db, request, user, "project.status_changed", "project", p.id,
          {"to": payload.status, "note": payload.note})
    db.commit()
    return workspace_dict(db, p)


class MilestoneIn(BaseModel):
    title: str = Field(max_length=250)
    description: str | None = None
    due_date: datetime | None = None
    status: str = MilestoneStatus.PENDING.value
    position: int = 0


@router.post("/projects/{pid}/milestones", status_code=201)
def add_milestone(pid: str, payload: MilestoneIn, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    p = db.get(Project, pid)
    if not p or p.deleted_at:
        raise HTTPException(404, "Project not found")
    m = ProjectMilestone(project_id=p.id, **payload.model_dump())
    db.add(m)
    db.commit()
    return pick(m, "id", "title", "description", "due_date", "status", "position")


@router.put("/projects/{pid}/milestones/{mid}")
def update_milestone(pid: str, mid: str, payload: MilestoneIn, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    m = db.get(ProjectMilestone, mid)
    p = db.get(Project, pid) if m else None
    if not m or not p or m.project_id != pid:
        raise HTTPException(404, "Milestone not found")
    allowed = is_staff(user) or p.assigned_professional_id == user.id
    if not allowed:
        raise HTTPException(403, "Not permitted")
    for field, value in payload.model_dump().items():
        setattr(m, field, value)
    db.commit()
    return pick(m, "id", "title", "description", "due_date", "status", "position")


@router.delete("/projects/{pid}/milestones/{mid}")
def delete_milestone(pid: str, mid: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    m = db.get(ProjectMilestone, mid)
    if not m or m.project_id != pid:
        raise HTTPException(404, "Milestone not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ------------------------------ assignment ----------------------------------

class AssignIn(BaseModel):
    professional_id: str
    role_on_project: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=2000)


@router.post("/projects/{pid}/assign")
def assign_professional(pid: str, payload: AssignIn, request: Request, db: Session = Depends(get_db),
                        user: User = Depends(require_staff)):
    p = db.get(Project, pid)
    if not p or p.deleted_at:
        raise HTTPException(404, "Project not found")
    if p.status not in {ProjectStatus.PAYMENT_CONFIRMED.value, ProjectStatus.PROFESSIONAL_ASSIGNED.value}:
        raise HTTPException(409, "Professionals are assigned after payment confirmation. Current status: "
                                  + p.status.replace("_", " ").title())
    professional = db.get(User, payload.professional_id)
    if not professional or professional.role not in {r.value for r in PROFESSIONAL_ROLES}:
        raise HTTPException(422, "Select a valid research professional")
    existing = db.scalar(select(ProjectAssignment).where(
        ProjectAssignment.project_id == p.id, ProjectAssignment.status.in_([AssignmentStatus.ASSIGNED.value, AssignmentStatus.ACTIVE.value])))
    if existing:
        raise HTTPException(409, "This project already has an assigned professional")

    a = ProjectAssignment(project_id=p.id, professional_id=professional.id, assigned_by=user.id,
                          role_on_project=payload.role_on_project, note=payload.note)
    db.add(a)
    p.assigned_professional_id = professional.id
    ensure_conversation(db, p)
    if p.status == ProjectStatus.PAYMENT_CONFIRMED.value:
        transition_project(db, p, ProjectStatus.PROFESSIONAL_ASSIGNED.value, user,
                           note=f"Assigned to {professional.full_name}", trigger="assignment")
    else:
        record_status(db, p, p.status, p.status, user, f"Reassignment attempted: {professional.full_name}")
    audit(db, request, user, "project.assigned", "project", p.id,
          {"professional": professional.id, "assignment": a.id})
    notify(db, None, professional, "ASSIGNMENT", f"New assignment offer — {p.tracking_id}",
           payload.note or f"You have been invited to take on “{p.title}”.",
           link=f"/dashboard/projects/{p.id}",
           email_subject=f"Wulweth assignment offer — {p.tracking_id}")
    notify(db, None, db.get(User, p.client_id), "ASSIGNMENT", f"Professional assigned to {p.tracking_id}",
           f"{professional.full_name} has been assigned to your project.",
           link=f"/dashboard/projects/{p.id}")
    db.commit()
    return workspace_dict(db, p)


@router.post("/assignments/{aid}/accept")
def accept_assignment(aid: str, request: Request, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    a = db.get(ProjectAssignment, aid)
    if not a or a.professional_id != user.id:
        raise HTTPException(404, "Assignment not found")
    if a.status != AssignmentStatus.ASSIGNED.value:
        raise HTTPException(409, "This assignment was already handled")
    a.status = AssignmentStatus.ACTIVE.value
    a.accepted_at = datetime.now(timezone.utc)
    p = db.get(Project, a.project_id)
    if p.status == ProjectStatus.PROFESSIONAL_ASSIGNED.value:
        transition_project(db, p, ProjectStatus.IN_PROGRESS.value, user,
                           note=f"{user.full_name} accepted the assignment", trigger="assignment_accepted")
    audit(db, request, user, "assignment.accepted", "project_assignment", a.id)
    db.commit()
    return {"ok": True, "project_id": p.id, "status": p.status}


@router.post("/assignments/{aid}/decline")
def decline_assignment(aid: str, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    a = db.get(ProjectAssignment, aid)
    if not a or a.professional_id != user.id:
        raise HTTPException(404, "Assignment not found")
    if a.status != AssignmentStatus.ASSIGNED.value:
        raise HTTPException(409, "This assignment was already handled")
    a.status = AssignmentStatus.REMOVED.value
    p = db.get(Project, a.project_id)
    p.assigned_professional_id = None
    audit(db, request, user, "assignment.declined", "project_assignment", a.id)
    for staff_user in db.scalars(select(User).where(User.role.in_([UserRole.MANAGER.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]))).all():
        notify(db, None, staff_user, "ASSIGNMENT", f"{user.full_name} declined {p.tracking_id}",
               "Reassign a professional for this project.", link=f"/dashboard/projects/{p.id}")
    db.commit()
    return {"ok": True}


# ------------------------------ matching aid --------------------------------

@router.get("/projects/{pid}/suggested-professionals")
def suggested_professionals(pid: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    """Decision-support for manual matching (intelligent matching arrives later)."""
    p = db.get(Project, pid)
    if not p or p.deleted_at:
        raise HTTPException(404, "Project not found")
    request = db.get(ResearchRequest, p.request_id) if p.request_id else None
    keywords: list[str] = []
    if request:
        keywords += [request.discipline] if request.discipline else []
    profiles = db.scalars(select(ResearcherProfile).where(ResearcherProfile.profile_status.in_(["PUBLISHED", "DRAFT"]))).all()
    scored = []
    for prof in profiles:
        u = db.get(User, prof.user_id)
        score = 0
        hay = " ".join([
            *(prof.disciplines or []), *(prof.expertise or []), *(prof.methodologies or []),
            *(prof.statistical_methods or []), *(prof.software or []), prof.professional_title or "",
            u.full_name,
        ]).lower()
        for kw in filter(None, keywords):
            if kw.lower() in hay:
                score += 4
        title_words = [w for w in (p.title or "").lower().replace(",", " ").split() if len(w) > 4]
        score += min(6, sum(2 for w in title_words if w in hay))
        if request and request.methodology:
            for method in (request.methodology.lower().replace(",", " ").split()):
                if len(method) > 4 and method in hay:
                    score += 2
        if prof.verification == "VERIFIED":
            score += 3
        if prof.availability != "UNAVAILABLE":
            score += 2
        score += min(4, prof.years_experience // 3)
        active = db.scalar(select(func.count(ProjectAssignment.id)).where(
            ProjectAssignment.professional_id == prof.user_id, ProjectAssignment.status == AssignmentStatus.ACTIVE.value)) or 0
        score -= active
        if score > 0:
            scored.append({"score": score, "profile": {
                "user_id": u.id, "full_name": u.full_name, "professional_title": prof.professional_title,
                "verification": prof.verification, "availability": prof.availability,
                "years_experience": prof.years_experience, "disciplines": prof.disciplines,
                "expertise": (prof.expertise or [])[:6], "software": prof.software,
                "active_projects": active,
            }})
    scored.sort(key=lambda s: -s["score"])
    return {"items": scored[:12]}
