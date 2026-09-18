"""Moderation & research integrity administration: case queue, decisions, reports."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, require_staff
from app.db import get_db
from app.models import (
    FeedPost, ModerationAction, ModerationCase, Opportunity, PortfolioItem,
    ResearchRequest, Report, User,
)
from app.models_enums import (
    ModerationActionType, ModerationStatus, PostStatus, ReportKind, ReportStatus,
    RequestStatus, RiskLevel,
)
from app.routers.common import page_params, paged, pick
from app.services.notify import notify

router = APIRouter(prefix="/moderation", tags=["moderation", "integrity"])


def _content_label(db: Session, case: ModerationCase) -> dict:
    from app.models_enums import ContentType
    title, link = None, None
    if case.content_type == ContentType.RESEARCH_REQUEST.value:
        r = db.get(ResearchRequest, case.content_id)
        if r:
            title, link = r.title, f"/dashboard/requests/{r.id}"
    elif case.content_type == ContentType.FEED_POST.value:
        p = db.get(FeedPost, case.content_id)
        if p:
            title, link = p.title, f"/feed/{p.id}"
    elif case.content_type == ContentType.OPPORTUNITY.value:
        o = db.get(Opportunity, case.content_id)
        if o:
            title, link = o.title, "/dashboard/opportunities"
    elif case.content_type == ContentType.PORTFOLIO_ITEM.value:
        item = db.get(PortfolioItem, case.content_id)
        if item:
            title, link = item.title, None
    return {"title": title, "link": link}


@router.get("/cases")
def list_cases(db: Session = Depends(get_db), user: User = Depends(require_staff),
               params: dict = Depends(page_params), status: str | None = None,
               risk: str | None = None):
    stmt = select(ModerationCase)
    if status:
        stmt = stmt.where(ModerationCase.status == status)
    if risk:
        stmt = stmt.where(ModerationCase.risk_level == risk)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(ModerationCase.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for case in rows:
        author = db.get(User, case.author_id) if case.author_id else None
        items.append(pick(case, "id", "case_number", "content_type", "content_id", "risk_level",
                          "triggered_rules", "excerpt", "status", "created_at", "decided_at",
                          author=pick(author, "id", "full_name", "email", "role") if author else None,
                          content=_content_label(db, case)))
    return paged(items, total, params)


@router.get("/cases/{cid}")
def get_case(cid: str, db: Session = Depends(get_db), user: User = Depends(require_staff)):
    case = db.get(ModerationCase, cid)
    if not case:
        raise HTTPException(404, "Case not found")
    actions = db.scalars(select(ModerationAction).where(ModerationAction.case_id == cid).order_by(ModerationAction.created_at)).all()
    actor_names = {}
    for a in actions:
        if a.actor_id and a.actor_id not in actor_names:
            actor_names[a.actor_id] = db.get(User, a.actor_id).full_name
    return pick(case, "id", "case_number", "content_type", "content_id", "risk_level", "triggered_rules",
                "excerpt", "status", "decision_reason", "created_at", "decided_at",
                author=pick(db.get(User, case.author_id), "id", "full_name", "email", "role") if case.author_id else None,
                content=_content_label(db, case),
                actions=[pick(a, "id", "action", "notes", "created_at", actor=actor_names.get(a.actor_id)) for a in actions])


class DecisionIn(BaseModel):
    decision: str = Field(pattern="^(CLEARED|REJECTED|RESTRICTED|CLARIFICATION_REQUESTED)$")
    reason: str = Field(min_length=5, max_length=8000)


def _apply_content_decision(db: Session, case: ModerationCase, decision: str) -> None:
    """Synchronise the underlying content with the moderation decision."""
    from app.models_enums import ContentType
    if case.content_type == ContentType.RESEARCH_REQUEST.value:
        r = db.get(ResearchRequest, case.content_id)
        if r:
            if decision == ModerationStatus.REJECTED.value:
                r.status = RequestStatus.DECLINED.value
                r.review_note = case.decision_reason
            elif decision == ModerationStatus.CLEARED.value and r.status == RequestStatus.SUBMITTED.value:
                pass  # continues through normal review
    elif case.content_type == ContentType.FEED_POST.value:
        p = db.get(FeedPost, case.content_id)
        if p:
            if decision == ModerationStatus.REJECTED.value:
                p.status = PostStatus.REJECTED.value
            elif decision == ModerationStatus.RESTRICTED.value:
                p.status = PostStatus.REMOVED.value
            elif decision == ModerationStatus.CLEARED.value and p.status == PostStatus.PENDING_REVIEW.value:
                p.status = PostStatus.PUBLISHED.value
                p.published_at = datetime.now(timezone.utc)


@router.post("/cases/{cid}/decide")
def decide_case(cid: str, payload: DecisionIn, request: Request, db: Session = Depends(get_db),
                user: User = Depends(require_staff)):
    case = db.get(ModerationCase, cid)
    if not case:
        raise HTTPException(404, "Case not found")
    if case.status not in {ModerationStatus.PENDING_REVIEW.value, ModerationStatus.CLARIFICATION_REQUESTED.value}:
        raise HTTPException(409, "This case has already been decided")

    case.status = payload.decision
    case.decided_by = user.id
    case.decided_at = datetime.now(timezone.utc)
    case.decision_reason = payload.reason
    db.add(ModerationAction(case_id=cid, actor_id=user.id, action=payload.decision, notes=payload.reason))
    _apply_content_decision(db, case, payload.decision)

    if case.author_id:
        author = db.get(User, case.author_id)
        titles = {"CLEARED": "Content approved", "REJECTED": "Content not approved",
                  "RESTRICTED": "Content restricted", "CLARIFICATION_REQUESTED": "Clarification requested"}
        notify(db, None, author, "MODERATION" if payload.decision != "CLARIFICATION_REQUESTED" else "INTEGRITY",
               f"{titles[payload.decision]} — case {case.case_number}", payload.reason, link="/dashboard")
    audit(db, request, user, "moderation.decision", "moderation_case", cid,
          {"decision": payload.decision})
    db.commit()
    return {"ok": True, "status": case.status}


@router.get("/reports")
def list_reports(db: Session = Depends(get_db), user: User = Depends(require_staff),
                 params: dict = Depends(page_params), kind: str | None = None, status: str | None = None):
    stmt = select(Report)
    if kind:
        stmt = stmt.where(Report.kind == kind)
    if status:
        stmt = stmt.where(Report.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Report.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for report in rows:
        reporter = db.get(User, report.reporter_id) if report.reporter_id else None
        items.append(pick(report, "id", "reference", "kind", "content_type", "content_id", "content_url",
                          "details", "status", "resolution_note", "created_at",
                          reporter=pick(reporter, "id", "full_name", "email") if reporter else None))
    return paged(items, total, params)


class ReportReviewIn(BaseModel):
    status: str = Field(pattern="^(REVIEWING|RESOLVED|DISMISSED)$")
    resolution_note: str | None = Field(default=None, max_length=8000)


@router.post("/reports/{rid}/review")
def review_report(rid: str, payload: ReportReviewIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(require_staff)):
    report = db.get(Report, rid)
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = payload.status
    report.resolution_note = payload.resolution_note
    report.reviewed_by = user.id
    report.reviewed_at = datetime.now(timezone.utc)
    audit(db, request, user, "report.reviewed", "report", rid, {"status": payload.status})
    db.commit()
    return pick(report, "id", "reference", "status", "resolution_note", "reviewed_at")


@router.get("/integrity/policy-summary")
def integrity_policy_summary():
    """The public statement of what Wulweth will and will not facilitate."""
    return {
        "prohibited": [
            "Plagiarism and contract cheating",
            "Exam or assignment completion for dishonest submission",
            "Thesis or dissertation ghostwriting intended to be submitted as another person's own work",
            "Fabricated data, results or references",
            "Falsification or manipulation of findings",
            "Forged academic documents and impersonation",
            "Copyright infringement and unauthorized reproduction",
            "Circumvention of plagiarism or AI detection tools",
        ],
        "legitimate": [
            "Statistical consultation and analysis",
            "Data cleaning, management and visualization",
            "Research design and methodology consultation",
            "Questionnaire development and sampling consultation",
            "Literature searching and evidence mapping",
            "Research editing, proofreading and journal formatting",
            "Manuscript preparation and publication support",
        ],
    }
