"""Professional payouts: fee configuration, calculation, approval, completion.

A payout can only be created for a project whose payment is confirmed and
whose deliverables passed quality control — the platform never pays out from
uncollected funds.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import audit, get_current_user, require_roles, is_staff
from app.db import get_db
from app.models import (
    Deliverable, Invoice, Payment, PaymentTransaction, PlatformSetting, Project,
    Payout, Service, User,
)
from app.models_enums import (
    DeliverableStatus, FundsStatus, InvoiceStatus, PayoutStatus, ProjectStatus,
    UserRole,
)
from app.routers.common import page_params, paged, pick
from app.services.ids import next_number
from app.services.notify import notify
from app.services.projects_flow import transition_project

router = APIRouter(tags=["payouts"])


def get_fee_percent(db: Session, project: Project) -> float:
    if project.fee_percent is not None:
        return float(project.fee_percent)
    fees = db.get(PlatformSetting, "fees")
    config = (fees.value if fees else {}) or {}
    service = db.get(Service, project.service_id) if project.service_id else None
    if service and service.fee_percent_override is not None:
        return float(service.fee_percent_override)
    if service and isinstance(config.get("per_service"), dict) and service.id in config["per_service"]:
        return float(config["per_service"][service.id])
    return float(config.get("default_percent", settings.default_fee_percent))


@router.get("/payouts")
def list_payouts(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                 params: dict = Depends(page_params), status: str | None = None):
    stmt = select(Payout)
    if user.role not in {r.value for r in {UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER}}:
        stmt = stmt.where(Payout.professional_id == user.id)
    if status:
        stmt = stmt.where(Payout.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Payout.requested_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for po in rows:
        project = db.get(Project, po.project_id) if po.project_id else None
        professional = db.get(User, po.professional_id)
        items.append(pick(po, "id", "payout_number", "gross_amount", "fee_amount", "processing_fee",
                          "net_amount", "currency", "status", "method", "transaction_ref",
                          "requested_at", "approved_at", "completed_at",
                          project=pick(project, "id", "tracking_id", "title") if project else None,
                          professional=pick(professional, "id", "full_name", "role") if professional else None))
    return paged(items, total, params)


class PayoutCreateIn(BaseModel):
    method: str | None = Field(default=None, max_length=40)
    destination: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/projects/{pid}/payout")
def create_payout(pid: str, payload: PayoutCreateIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(require_roles(UserRole.MANAGER, UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN))):
    project = db.get(Project, pid)
    if not project or project.deleted_at:
        raise HTTPException(404, "Project not found")
    if project.funds_status != FundsStatus.PENDING_RELEASE.value:
        raise HTTPException(409, "Payment for this project has not been confirmed")
    if project.status not in {ProjectStatus.APPROVED.value}:
        raise HTTPException(409, "All deliverables must pass quality control before payout")
    if not project.assigned_professional_id:
        raise HTTPException(409, "No professional is assigned to this project")
    existing = db.scalar(select(Payout).where(Payout.project_id == pid, Payout.status != PayoutStatus.FAILED.value))
    if existing:
        raise HTTPException(409, f"A payout already exists for this project ({existing.payout_number})")

    invoice = db.scalar(select(Invoice).where(Invoice.project_id == pid, Invoice.status == InvoiceStatus.PAID.value))
    if not invoice:
        raise HTTPException(409, "No paid invoice found for this project")

    gross = float(invoice.total)
    fee_percent = get_fee_percent(db, project)
    fee = round(gross * fee_percent / 100, 2)
    net = round(gross - fee, 2)

    project.fee_percent = fee_percent
    project.fee_amount = fee
    payout = Payout(payout_number=next_number(db, "payout", "PO"), professional_id=project.assigned_professional_id,
                    project_id=project.id, gross_amount=gross, fee_amount=fee, processing_fee=0,
                    net_amount=net, currency=invoice.currency, status=PayoutStatus.PENDING.value,
                    method=payload.method, destination=payload.destination, notes=payload.notes)
    db.add(payout)
    transition_project(db, project, ProjectStatus.COMPLETED.value, user,
                       note=f"Payout {payout.payout_number} prepared (Wulweth fee {fee_percent:g}%)",
                       trigger="payout_prepared")
    audit(db, request, user, "payout.created", "payout", payout.id,
          {"gross": gross, "fee": fee, "net": net, "project": project.tracking_id})
    professional = db.get(User, payout.professional_id)
    if professional:
        notify(db, None, professional, "PAYOUT", f"Payout pending — {payout.payout_number}",
               f"Project {project.tracking_id} completed. Gross {gross:,.2f} {payout.currency}, "
               f"Wulweth fee {fee:,.2f}, your earnings {net:,.2f}.",
               link="/dashboard/finance?tab=payouts")
    db.commit()
    return pick(payout, "id", "payout_number", "gross_amount", "fee_amount", "net_amount", "currency", "status")


class PayoutCompleteIn(BaseModel):
    transaction_ref: str = Field(min_length=2, max_length=160)
    processing_fee: float = Field(default=0, ge=0)


@router.post("/payouts/{poid}/approve")
def approve_payout(poid: str, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN))):
    payout = db.get(Payout, poid)
    if not payout or payout.status != PayoutStatus.PENDING.value:
        raise HTTPException(404, "Payout not found or not pending")
    payout.status = PayoutStatus.APPROVED.value
    payout.approved_by = user.id
    payout.approved_at = datetime.now(timezone.utc)
    audit(db, request, user, "payout.approved", "payout", payout.id)
    db.commit()
    return pick(payout, "id", "payout_number", "status", "approved_at")


@router.post("/payouts/{poid}/complete")
def complete_payout(poid: str, payload: PayoutCompleteIn, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN))):
    payout = db.get(Payout, poid)
    if not payout or payout.status not in {PayoutStatus.PENDING.value, PayoutStatus.APPROVED.value}:
        raise HTTPException(404, "Payout not found or already completed")
    payout.status = PayoutStatus.COMPLETED.value
    payout.completed_at = datetime.now(timezone.utc)
    payout.transaction_ref = payload.transaction_ref
    payout.processing_fee = payload.processing_fee

    # immutable ledger
    db.add(PaymentTransaction(project_id=payout.project_id, payout_id=payout.id, entry_type="PAYOUT",
                              amount=payout.net_amount, currency=payout.currency, status="RECORDED",
                              description=f"Professional payout {payout.payout_number} (ref {payload.transaction_ref})",
                              actor_id=user.id))
    db.add(PaymentTransaction(project_id=payout.project_id, payout_id=payout.id, entry_type="FEE",
                              amount=payout.fee_amount, currency=payout.currency, status="RECORDED",
                              description=f"Wulweth service fee for {payout.payout_number}", actor_id=user.id))

    project = db.get(Project, payout.project_id) if payout.project_id else None
    if project:
        project.funds_status = FundsStatus.RELEASED.value
        if project.status == ProjectStatus.COMPLETED.value:
            transition_project(db, project, ProjectStatus.PAYMENT_RELEASED.value, user,
                               note=f"Payout {payout.payout_number} completed", trigger="payout_completed")

    professional = db.get(User, payout.professional_id)
    if professional:
        notify(db, None, professional, "PAYOUT", f"Payout completed — {payout.payout_number}",
               f"{payout.currency} {float(payout.net_amount):,.2f} has been sent. Reference: {payload.transaction_ref}",
               link="/dashboard/finance?tab=payouts")
    audit(db, request, user, "payout.completed", "payout", payout.id, {"ref": payload.transaction_ref})
    db.commit()
    return pick(payout, "id", "payout_number", "status", "completed_at", "transaction_ref")


@router.get("/my/earnings")
def my_earnings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payouts = db.scalars(select(Payout).where(Payout.professional_id == user.id).order_by(Payout.requested_at.desc())).all()
    totals = {"paid": 0.0, "pending": 0.0, "fees": 0.0}
    for po in payouts:
        if po.status == PayoutStatus.COMPLETED.value:
            totals["paid"] += float(po.net_amount)
            totals["fees"] += float(po.fee_amount) + float(po.processing_fee or 0)
        else:
            totals["pending"] += float(po.net_amount)
    return {
        "totals": totals,
        "payouts": [pick(po, "id", "payout_number", "gross_amount", "fee_amount", "processing_fee",
                         "net_amount", "currency", "status", "requested_at", "completed_at",
                         project_id=po.project_id) for po in payouts],
    }
