"""Structured post-project feedback (professionalism, communication, quality,
timeliness, expertise). Feedback informs the platform's quality signals; the
platform is deliberately not centred on public star ratings."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_staff
from app.db import get_db
from app.models import Project, ProjectAssignment, Review, User
from app.models_enums import ProjectStatus, UserRole
from app.routers.common import pick

router = APIRouter(tags=["reviews"])


def _clamp(v: int | None) -> int | None:
    if v is None:
        return None
    return max(1, min(5, v))


class ReviewIn(BaseModel):
    project_id: str
    professionalism: int | None = Field(default=None, ge=1, le=5)
    communication: int | None = Field(default=None, ge=1, le=5)
    quality: int | None = Field(default=None, ge=1, le=5)
    timeliness: int | None = Field(default=None, ge=1, le=5)
    expertise: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=4000)
    private_note: str | None = Field(default=None, max_length=4000)


@router.post("/reviews", status_code=201)
def create_review(payload: ReviewIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    project = db.get(Project, payload.project_id)
    if not project or project.deleted_at:
        raise HTTPException(404, "Project not found")
    if project.status not in {ProjectStatus.APPROVED.value, ProjectStatus.COMPLETED.value,
                              ProjectStatus.PAYMENT_RELEASED.value}:
        raise HTTPException(409, "Feedback can be shared once deliverables are approved")

    if project.client_id == user.id:
        subject = project.assigned_professional_id
    elif project.assigned_professional_id == user.id:
        subject = project.client_id  # professionals can give feedback on client collaboration too
    else:
        raise HTTPException(403, "Only the client or the assigned professional can leave feedback")

    existing = db.scalar(select(Review).where(Review.project_id == project.id, Review.author_id == user.id))
    if existing:
        raise HTTPException(409, "You have already shared feedback for this project")

    review = Review(project_id=project.id, author_id=user.id, subject_user_id=subject,
                    professionalism=_clamp(payload.professionalism), communication=_clamp(payload.communication),
                    quality=_clamp(payload.quality), timeliness=_clamp(payload.timeliness),
                    expertise=_clamp(payload.expertise), comment=payload.comment,
                    private_note=payload.private_note)
    db.add(review)
    audit(db, request, user, "review.created", "review", review.id, {"project": project.tracking_id})
    db.commit()
    return pick(review, "id", "project_id", "professionalism", "communication", "quality",
                "timeliness", "expertise", "comment", "created_at")


@router.get("/projects/{pid}/reviews")
def project_reviews(pid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, pid)
    if not project or not (is_staff(user) or project.client_id == user.id or project.assigned_professional_id == user.id):
        raise HTTPException(404, "Project not found")
    reviews = db.scalars(select(Review).where(Review.project_id == pid)).all()
    items = []
    for r in reviews:
        author = db.get(User, r.author_id)
        items.append(pick(r, "id", "professionalism", "communication", "quality", "timeliness",
                          "expertise", "comment", "created_at",
                          author_name=author.full_name if author else None))
    return {"items": items}


@router.get("/professionals/{user_id}/feedback")
def professional_feedback(user_id: str, db: Session = Depends(get_db),
                          user: User = Depends(get_current_user)):
    """Aggregate structured feedback for a professional (visible to staff and the
    professional; highlights qualitative strengths rather than star averages)."""
    if not (is_staff(user) or user.id == user_id):
        raise HTTPException(403, "Not permitted")
    reviews = db.scalars(select(Review).where(Review.subject_user_id == user_id)).all()
    if not reviews:
        return {"count": 0, "summary": None, "comments": []}
    dims = ["professionalism", "communication", "quality", "timeliness", "expertise"]
    summary = {}
    for dim in dims:
        values = [getattr(r, dim) for r in reviews if getattr(r, dim) is not None]
        summary[dim] = round(sum(values) / len(values), 1) if values else None
    comments = [{"comment": r.comment, "project_id": r.project_id, "created_at": r.created_at.isoformat()}
                for r in reviews if r.comment]
    return {"count": len(reviews), "summary": summary, "comments": comments}
