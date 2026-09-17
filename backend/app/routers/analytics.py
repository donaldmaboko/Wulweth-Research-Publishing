"""Analytics: real, system-generated metrics only (never fabricated)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.db import get_db
from app.models import (
    DeliverableVersion, Invoice, ModerationCase, Organization, Payment, Payout,
    Project, ProjectStatusHistory, Quote, Report, ResearchRequest, User,
)
from app.models_enums import (
    FundsStatus, InvoiceStatus, ModerationStatus, PaymentStatus, PayoutStatus,
    PROJECT_TRANSITIONS, ProjectStatus, ReportStatus, RequestStatus, UserRole,
    PROFESSIONAL_ROLES, VersionStatus,
)
from app.routers.common import jdump

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db), user: User = Depends(require_staff)):
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    def count(model, *filters):
        stmt = select(func.count(model.id))
        for f in filters:
            stmt = stmt.where(f)
        return db.scalar(stmt) or 0

    active_statuses = [ProjectStatus.PROFESSIONAL_ASSIGNED.value, ProjectStatus.IN_PROGRESS.value,
                       ProjectStatus.SUBMITTED.value, ProjectStatus.QUALITY_REVIEW.value,
                       ProjectStatus.REVISION_REQUIRED.value, ProjectStatus.APPROVED.value]

    revenue = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.CONFIRMED.value)) or 0
    revenue_30d = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.CONFIRMED.value, Payment.confirmed_at >= month_ago)) or 0
    fees_collected = db.scalar(select(func.coalesce(func.sum(Payout.fee_amount), 0)).where(
        Payout.status == PayoutStatus.COMPLETED.value)) or 0
    professional_earnings = db.scalar(select(func.coalesce(func.sum(Payout.net_amount), 0)).where(
        Payout.status == PayoutStatus.COMPLETED.value)) or 0
    pending_payments = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == PaymentStatus.PENDING.value)) or 0
    pending_payouts = db.scalar(select(func.coalesce(func.sum(Payout.net_amount), 0)).where(
        Payout.status.in_([PayoutStatus.PENDING.value, PayoutStatus.APPROVED.value]))) or 0

    # average duration of completed projects (assignment acceptance -> completion)
    durations = []
    completed = db.scalars(select(Project).where(
        Project.status.in_([ProjectStatus.COMPLETED.value, ProjectStatus.PAYMENT_RELEASED.value]),
        Project.started_at.is_not(None), Project.completed_at.is_not(None))).all()
    for p in completed:
        durations.append((p.completed_at - p.started_at).total_seconds() / 86400)
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None

    # QC revision rate
    total_versions = db.scalar(select(func.count(DeliverableVersion.id)).where(
        DeliverableVersion.version_number == 1)) or 0
    revised = db.scalar(select(func.count(DeliverableVersion.id)).where(
        DeliverableVersion.version_number > 1)) or 0
    revision_rate = round(100 * revised / total_versions, 1) if total_versions else None

    # project volume by month (last 6 months)
    volume = []
    for i in range(5, -1, -1):
        start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
        month_projects = db.scalar(select(func.count(Project.id)).where(
            Project.created_at >= start, Project.created_at < end)) or 0
        month_revenue = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.status == PaymentStatus.CONFIRMED.value,
            Payment.confirmed_at >= start, Payment.confirmed_at < end)) or 0
        volume.append({"month": start.strftime("%b %Y"), "projects": month_projects, "revenue": float(month_revenue)})

    service_demand_rows = db.execute(
        select(Project.service_id, func.count(Project.id))
        .group_by(Project.service_id).order_by(func.count(Project.id).desc()).limit(8)
    ).all()
    from app.models import Service
    service_demand = []
    for service_id, cnt in service_demand_rows:
        s = db.get(Service, service_id) if service_id else None
        service_demand.append({"service": s.name if s else "Unspecified", "category": s.category if s else None, "count": cnt})

    return {
        "users": {
            "total": count(User, User.deleted_at.is_(None)),
            "clients": count(User, User.role == UserRole.CLIENT.value, User.deleted_at.is_(None)),
            "professionals": count(User, User.role.in_({r.value for r in PROFESSIONAL_ROLES}), User.deleted_at.is_(None)),
            "organizations": count(Organization),
        },
        "projects": {
            "total": count(Project, Project.deleted_at.is_(None)),
            "active": count(Project, Project.status.in_(active_statuses), Project.deleted_at.is_(None)),
            "completed": count(Project, Project.status.in_([ProjectStatus.COMPLETED.value, ProjectStatus.PAYMENT_RELEASED.value])),
            "pending_requests": count(ResearchRequest, ResearchRequest.status.in_(
                [RequestStatus.SUBMITTED.value, RequestStatus.UNDER_REVIEW.value, RequestStatus.CLARIFICATION_REQUESTED.value])),
            "qc_queue": count(DeliverableVersion, DeliverableVersion.status == VersionStatus.SUBMITTED.value),
            "avg_duration_days": avg_duration,
            "revision_rate_percent": revision_rate,
        },
        "finance": {
            "revenue_total": float(revenue),
            "revenue_30d": float(revenue_30d),
            "fees_collected": float(fees_collected),
            "professional_earnings": float(professional_earnings),
            "pending_payments": float(pending_payments),
            "pending_payouts": float(pending_payouts),
        },
        "governance": {
            "moderation_pending": count(ModerationCase, ModerationCase.status == ModerationStatus.PENDING_REVIEW.value),
            "reports_open": count(Report, Report.status == ReportStatus.OPEN.value),
        },
        "volume": jdump(volume),
        "service_demand": service_demand,
    }
