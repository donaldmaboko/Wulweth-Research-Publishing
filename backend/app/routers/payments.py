"""Payments: confirmation (finance), ledger entries, Stripe webhook stub."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, require_roles
from app.db import get_db
from app.models import Invoice, Payment, PaymentTransaction, Project, User
from app.models_enums import (
    FundsStatus, InvoiceStatus, PaymentStatus, ProjectStatus, UserRole,
)
from app.routers.common import page_params, paged, pick
from app.services.notify import notify
from app.services.projects_flow import transition_project

router = APIRouter(tags=["payments"])


@router.get("/payments")
def list_payments(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                  params: dict = Depends(page_params), status: str | None = None):
    stmt = select(Payment)
    if user.role not in {r.value for r in {UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER}}:
        stmt = stmt.where(Payment.client_id == user.id)
    if status:
        stmt = stmt.where(Payment.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Payment.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for p in rows:
        invoice = db.get(Invoice, p.invoice_id)
        items.append(pick(p, "id", "reference", "amount", "currency", "method", "provider", "status",
                          "created_at", "confirmed_at",
                          invoice=pick(invoice, "id", "invoice_number") if invoice else None))
    return paged(items, total, params)


class ConfirmIn(BaseModel):
    provider_ref: str | None = None
    note: str | None = None


@router.post("/payments/{pid}/confirm")
def confirm_payment(pid: str, payload: ConfirmIn, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN))):
    """Finance confirms receipt of funds (bank transfer / card settlement)."""
    payment = db.get(Payment, pid)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != PaymentStatus.PENDING.value:
        raise HTTPException(409, "This payment was already processed")
    if payment.provider == "stripe":
        # In production the Stripe webhook is the source of truth; manual
        # confirmation is an override for reconciliation edge cases.
        pass

    payment.status = PaymentStatus.CONFIRMED.value
    payment.confirmed_by = user.id
    payment.confirmed_at = datetime.now(timezone.utc)
    payment.provider_ref = payload.provider_ref or payment.reference

    invoice = db.get(Invoice, payment.invoice_id)
    invoice.amount_paid = float(invoice.amount_paid) + float(payment.amount)
    if float(invoice.amount_paid) >= float(invoice.total) - 0.001:
        invoice.status = InvoiceStatus.PAID.value
        invoice.paid_at = datetime.now(timezone.utc)

    # immutable ledger entries
    db.add(PaymentTransaction(project_id=payment.project_id, payment_id=payment.id,
                              entry_type="CHARGE", amount=payment.amount, currency=payment.currency,
                              status="RECORDED", provider=payment.provider, provider_ref=payment.provider_ref,
                              description=f"Client payment {payment.reference} for invoice {invoice.invoice_number}",
                              actor_id=user.id))

    project = db.get(Project, payment.project_id) if payment.project_id else None
    if project and project.status == ProjectStatus.PAYMENT_PENDING.value:
        transition_project(db, project, ProjectStatus.PAYMENT_CONFIRMED.value, user,
                           note=f"Payment {payment.reference} confirmed", trigger="payment_confirmed")
    if project:
        project.funds_status = FundsStatus.PENDING_RELEASE.value

    client = db.get(User, payment.client_id)
    if client:
        notify(db, None, client, "PAYMENT", f"Payment received — {invoice.invoice_number}",
               "Thank you. Your payment has been confirmed and work is being coordinated.",
               link="/dashboard/finance?tab=invoices")
    professional = db.get(User, project.assigned_professional_id) if project and project.assigned_professional_id else None
    if professional:
        notify(db, None, professional, "PAYMENT", f"Payment confirmed — {project.tracking_id}",
               "Funds are secured for this project. You can proceed with the work.",
               link=f"/dashboard/projects/{project.id}")
    audit(db, request, user, "payment.confirmed", "payment", payment.id,
          {"invoice": invoice.invoice_number, "amount": float(payment.amount)})
    db.commit()
    return pick(payment, "id", "reference", "amount", "currency", "status", "confirmed_at")


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook endpoint reserved for the Stripe integration (signature-checked in
    production; a no-op placeholder keeps the deployment contract stable)."""
    payload = await request.body()
    return {"received": True, "bytes": len(payload)}
