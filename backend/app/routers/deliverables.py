"""Deliverables, version control and the quality-control workflow.

Version flow:  Version 1 → QC → Revision Required → Version 2 → QC → Approved → Final.
Every version, review and comment is permanently recorded; versions are never
overwritten or deleted.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_staff
from app.db import get_db
from app.models import (
    Deliverable, DeliverableVersion, Document, Project, ProjectAssignment,
    QCComment, QCReview, User,
)
from app.models_enums import (
    AssignmentStatus, DeliverableStatus, DocumentKind, ProjectStatus,
    QCDecision, VersionStatus,
)
from app.routers.common import pick
from app.routers.documents import can_access_document
from app.services import storage
from app.services.notify import notify
from app.services.projects_flow import transition_project

router = APIRouter(tags=["deliverables", "qc"])


def _assigned_professional(db: Session, project: Project, user: User) -> ProjectAssignment | None:
    return db.scalar(select(ProjectAssignment).where(
        ProjectAssignment.project_id == project.id,
        ProjectAssignment.professional_id == user.id,
        ProjectAssignment.status.in_([AssignmentStatus.ASSIGNED.value, AssignmentStatus.ACTIVE.value]),
    ))


def _version_detail(db: Session, v: DeliverableVersion) -> dict:
    reviews = db.scalars(select(QCReview).where(QCReview.deliverable_version_id == v.id).order_by(QCReview.created_at)).all()
    comments = db.scalars(select(QCComment).where(QCComment.version_id == v.id).order_by(QCComment.created_at)).all()
    review_data = []
    for r in reviews:
        reviewer = db.get(User, r.reviewer_id)
        review_data.append(pick(r, "id", "decision", "summary", "checklist", "created_at",
                                reviewer_name=reviewer.full_name if reviewer else None))
    comment_data = []
    for c in comments:
        author = db.get(User, c.author_id)
        comment_data.append(pick(c, "id", "body", "created_at",
                                 author=pick(author, "id", "full_name", "role") if author else None))
    uploader = db.get(User, v.uploaded_by)
    return pick(
        v, "id", "version_number", "notes", "status", "submitted_at",
        uploaded_by_name=uploader.full_name if uploader else None,
        document=pick(v.document, "id", "filename", "size_bytes", "content_type") if v.document else None,
        reviews=review_data, comments=comment_data,
    )


def _deliverable_detail(db: Session, d: Deliverable) -> dict:
    versions = db.scalars(select(DeliverableVersion).where(DeliverableVersion.deliverable_id == d.id)
                          .order_by(DeliverableVersion.version_number)).all()
    return pick(d, "id", "title", "description", "status", "current_version_number", "created_at",
                versions=[_version_detail(db, v) for v in versions])


# ------------------------------ deliverables --------------------------------

class DeliverableIn(BaseModel):
    title: str = Field(max_length=300)
    description: str | None = None


@router.post("/projects/{pid}/deliverables", status_code=201)
def create_deliverable(pid: str, payload: DeliverableIn, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    p = db.get(Project, pid)
    if not p or p.deleted_at:
        raise HTTPException(404, "Project not found")
    if not (is_staff(user) or _assigned_professional(db, p, user)):
        raise HTTPException(403, "Not permitted")
    d = Deliverable(project_id=p.id, title=payload.title, description=payload.description, created_by=user.id)
    db.add(d)
    db.commit()
    return _deliverable_detail(db, d)


@router.get("/projects/{pid}/deliverables")
def list_deliverables(pid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Project, pid)
    if not p or p.deleted_at:
        raise HTTPException(404, "Project not found")
    if not (is_staff(user) or p.client_id == user.id or _assigned_professional(db, p, user)):
        raise HTTPException(403, "Not permitted")
    deliverables = db.scalars(select(Deliverable).where(Deliverable.project_id == p.id).order_by(Deliverable.created_at)).all()
    return {"items": [_deliverable_detail(db, d) for d in deliverables]}


@router.post("/deliverables/{did}/versions", status_code=201)
async def upload_version(
    did: str,
    request: Request,
    file: UploadFile = File(...),
    notes: str | None = Form(None),
    copyright_confirmed: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not copyright_confirmed:
        raise HTTPException(422, "Confirm you hold the rights to this material before submitting")
    d = db.get(Deliverable, did)
    p = db.get(Project, d.project_id) if d else None
    if not d or not p:
        raise HTTPException(404, "Deliverable not found")
    if not (is_staff(user) or _assigned_professional(db, p, user)):
        raise HTTPException(403, "Only the assigned professional or Wulweth staff can submit deliverables")
    if p.status in {ProjectStatus.COMPLETED.value, ProjectStatus.PAYMENT_RELEASED.value, ProjectStatus.CANCELLED.value}:
        raise HTTPException(409, "This project is closed")

    data = await file.read()
    filename = storage.safe_filename(file.filename or "deliverable")
    error = storage.validate_upload(filename, file.content_type, len(data))
    if error:
        raise HTTPException(422, error)

    doc = Document(owner_id=user.id, kind=DocumentKind.DELIVERABLE.value, project_id=p.id,
                   filename=filename, content_type=file.content_type, size_bytes=len(data),
                   storage_key="pending", copyright_confirmed=True)
    db.add(doc)
    db.flush()
    key, sha, scan = storage.store_document(user.id, doc.id, data)
    doc.storage_key, doc.sha256, doc.scan_status = key, sha, scan

    d.current_version_number += 1
    version = DeliverableVersion(
        deliverable_id=d.id, version_number=d.current_version_number, document_id=doc.id,
        uploaded_by=user.id, notes=notes, status=VersionStatus.SUBMITTED.value, copyright_confirmed=True,
    )
    db.add(version)
    d.status = DeliverableStatus.SUBMITTED.value

    # Workflow: first submission moves the project into SUBMITTED; re-submission
    # after a revision request re-enters SUBMITTED for QC.
    if p.status in {ProjectStatus.IN_PROGRESS.value, ProjectStatus.REVISION_REQUIRED.value}:
        transition_project(db, p, ProjectStatus.SUBMITTED.value, user,
                           note=f"Version {version.version_number} of “{d.title}” submitted", notify_client=True)

    for qc_user in db.scalars(select(User).where(User.role == "QC_REVIEWER")).all():
        notify(db, None, qc_user, "QC", f"Deliverable ready for review — {p.tracking_id}",
               f"“{d.title}” version {version.version_number} awaits quality review.",
               link=f"/dashboard/projects/{p.id}")
    notify(db, None, db.get(User, p.client_id), "DELIVERABLE", f"Deliverable submitted — {p.tracking_id}",
           f"“{d.title}” version {version.version_number} was submitted for quality review.",
           link=f"/dashboard/projects/{p.id}")
    audit(db, request, user, "deliverable.version_uploaded", "deliverable_version", version.id,
          {"project": p.tracking_id, "version": version.version_number})
    db.commit()
    return _deliverable_detail(db, d)


@router.get("/deliverables/{did}")
def get_deliverable(did: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d = db.get(Deliverable, did)
    p = db.get(Project, d.project_id) if d else None
    if not d or not p:
        raise HTTPException(404, "Deliverable not found")
    if not (is_staff(user) or p.client_id == user.id or _assigned_professional(db, p, user)):
        raise HTTPException(403, "Not permitted")
    return _deliverable_detail(db, d)


# ------------------------------ quality control -----------------------------

class QCReviewIn(BaseModel):
    decision: str = Field(pattern="^(APPROVED|REVISION_REQUIRED|REJECTED)$")
    summary: str = Field(min_length=5, max_length=8000)
    checklist: dict = {}


@router.get("/qc/queue")
def qc_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in {"QC_REVIEWER", "MANAGER", "ADMIN", "SUPER_ADMIN"}:
        raise HTTPException(403, "Quality-control access required")
    versions = db.scalars(
        select(DeliverableVersion).where(DeliverableVersion.status == VersionStatus.SUBMITTED.value)
        .order_by(DeliverableVersion.submitted_at)
    ).all()
    items = []
    for v in versions:
        d = db.get(Deliverable, v.deliverable_id)
        p = db.get(Project, d.project_id)
        uploader = db.get(User, v.uploaded_by)
        items.append({
            **pick(v, "id", "version_number", "submitted_at", "notes"),
            "deliverable": pick(d, "id", "title"),
            "project": pick(p, "id", "tracking_id", "title", "status"),
            "uploaded_by": uploader.full_name if uploader else None,
            "document": pick(v.document, "id", "filename", "size_bytes") if v.document else None,
        })
    return {"items": items}


@router.post("/qc/versions/{vid}/review")
def submit_qc_review(vid: str, payload: QCReviewIn, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    if user.role not in {"QC_REVIEWER", "MANAGER", "ADMIN", "SUPER_ADMIN"}:
        raise HTTPException(403, "Quality-control access required")
    v = db.get(DeliverableVersion, vid)
    d = db.get(Deliverable, v.deliverable_id) if v else None
    p = db.get(Project, d.project_id) if d else None
    if not v or not d or not p:
        raise HTTPException(404, "Deliverable version not found")
    if v.status not in {VersionStatus.SUBMITTED.value, VersionStatus.UNDER_REVIEW.value}:
        raise HTTPException(409, "This version has already been reviewed")

    review = QCReview(deliverable_version_id=v.id, reviewer_id=user.id,
                      decision=payload.decision, summary=payload.summary, checklist=payload.checklist)
    db.add(review)

    professional = db.get(User, v.uploaded_by)
    client = db.get(User, p.client_id)

    if payload.decision == QCDecision.APPROVED.value:
        v.status = VersionStatus.APPROVED.value
        remaining = db.scalars(select(DeliverableVersion).where(
            DeliverableVersion.deliverable_id == d.id,
            DeliverableVersion.id != v.id,
            DeliverableVersion.status.in_([VersionStatus.SUBMITTED.value, VersionStatus.REVISION_REQUIRED.value]),
        )).all()
        if not remaining:
            d.status = DeliverableStatus.APPROVED.value
            other_pending = db.scalars(select(Deliverable).where(
                Deliverable.project_id == p.id,
                Deliverable.id != d.id,
                Deliverable.status.in_([DeliverableStatus.PENDING.value, DeliverableStatus.SUBMITTED.value, DeliverableStatus.IN_REVISION.value]),
            )).all()
            if not other_pending and p.status in {ProjectStatus.SUBMITTED.value, ProjectStatus.QUALITY_REVIEW.value}:
                transition_project(db, p, ProjectStatus.APPROVED.value, user,
                                   note="All deliverables approved through quality control")
        notify(db, None, client, "QC", f"Deliverable approved — {p.tracking_id}",
               f"“{d.title}” version {v.version_number} passed quality review.", link=f"/dashboard/projects/{p.id}")
        if professional:
            notify(db, None, professional, "QC", f"Quality review passed — {p.tracking_id}",
                   f"“{d.title}” version {v.version_number} was approved.", link=f"/dashboard/projects/{p.id}")
    elif payload.decision == QCDecision.REVISION_REQUIRED.value:
        v.status = VersionStatus.REVISION_REQUIRED.value
        d.status = DeliverableStatus.IN_REVISION.value
        if p.status in {ProjectStatus.SUBMITTED.value, ProjectStatus.QUALITY_REVIEW.value}:
            transition_project(db, p, ProjectStatus.REVISION_REQUIRED.value, user,
                               note=f"Revision requested on “{d.title}” v{v.version_number}")
        if professional:
            notify(db, None, professional, "QC", f"Revision requested — {p.tracking_id}",
                   payload.summary, link=f"/dashboard/projects/{p.id}")
    else:  # REJECTED
        v.status = VersionStatus.REVISION_REQUIRED.value
        d.status = DeliverableStatus.IN_REVISION.value
        if professional:
            notify(db, None, professional, "QC", f"Deliverable rejected — {p.tracking_id}",
                   payload.summary, link=f"/dashboard/projects/{p.id}")

    audit(db, request, user, "qc.review", "deliverable_version", v.id,
          {"decision": payload.decision, "project": p.tracking_id})
    db.commit()
    return _version_detail(db, v)


class QCCommentIn(BaseModel):
    body: str = Field(min_length=2, max_length=8000)


@router.post("/qc/versions/{vid}/comments", status_code=201)
def add_qc_comment(vid: str, payload: QCCommentIn, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    v = db.get(DeliverableVersion, vid)
    d = db.get(Deliverable, v.deliverable_id) if v else None
    p = db.get(Project, d.project_id) if d else None
    if not v or not d or not p:
        raise HTTPException(404, "Deliverable version not found")
    if not (is_staff(user) or p.client_id == user.id or _assigned_professional(db, p, user)):
        raise HTTPException(403, "Not permitted")
    c = QCComment(version_id=v.id, author_id=user.id, body=payload.body)
    db.add(c)
    db.commit()
    author = db.get(User, c.author_id)
    return pick(c, "id", "body", "created_at", author=pick(author, "id", "full_name", "role") if author else None)


@router.post("/qc/versions/{vid}/mark-reviewing")
def mark_reviewing(vid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in {"QC_REVIEWER", "MANAGER", "ADMIN", "SUPER_ADMIN"}:
        raise HTTPException(403, "Quality-control access required")
    v = db.get(DeliverableVersion, vid)
    if not v or v.status != VersionStatus.SUBMITTED.value:
        raise HTTPException(409, "Not available")
    v.status = VersionStatus.UNDER_REVIEW.value
    p_project = db.get(Deliverable, v.deliverable_id)
    project = db.get(Project, p_project.project_id)
    if project.status == ProjectStatus.SUBMITTED.value:
        transition_project(db, project, ProjectStatus.QUALITY_REVIEW.value, user, trigger="qc_started", notify_client=False)
    db.commit()
    return {"ok": True}
