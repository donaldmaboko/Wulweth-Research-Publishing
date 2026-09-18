"""Invoices: generation from quotes, branded PDF, client payment initiation."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_staff
from app.db import get_db
from app.models import Invoice, InvoiceItem, Payment, Project, Quote, User
from app.models_enums import InvoiceStatus, PaymentStatus, ProjectStatus
from app.routers.common import page_params, paged, pick
from app.services.notify import notify
from app.services.payments import get_provider
from app.services.pdf import build_document_pdf
from app.services.projects_flow import transition_project

router = APIRouter(tags=["invoices"])


def invoice_dict(inv: Invoice, db: Session | None = None) -> dict:
    project = db.get(Project, inv.project_id) if (db and inv.project_id) else None
    client = db.get(User, inv.client_id) if db else None
    payments = db.scalars(select(Payment).where(Payment.invoice_id == inv.id).order_by(Payment.created_at.desc())).all() if db else []
    return pick(
        inv, "id", "invoice_number", "currency", "subtotal", "tax_percent", "tax_amount",
        "total", "amount_paid", "status", "due_date", "issued_at", "paid_at", "notes",
        "created_at", "project_id", "quote_id",
        client=pick(client, "id", "full_name", "email") if client else None,
        project=pick(project, "id", "tracking_id", "title") if project else None,
        items=[pick(i, "id", "description", "quantity", "unit_price", "line_total") for i in inv.items],
        payments=[pick(p, "id", "reference", "amount", "status", "method", "created_at", "confirmed_at") for p in payments],
    )


@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                  params: dict = Depends(page_params), status: str | None = None):
    stmt = select(Invoice)
    if not is_staff(user):
        stmt = stmt.where(Invoice.client_id == user.id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    total = db.scalar(select(Invoice.__table__.c, ).statement.with_only_columns(Invoice.__table__.c.id.count()).select_from(stmt.subquery()).scalar_subquery()) if False else None
    from sqlalchemy import func
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Invoice.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    items = []
    for inv in rows:
        project = db.get(Project, inv.project_id) if inv.project_id else None
        items.append(pick(inv, "id", "invoice_number", "total", "currency", "status", "due_date", "created_at",
                          project=pick(project, "id", "tracking_id", "title") if project else None))
    return paged(items, total, params)


@router.get("/invoices/{iid}")
def get_invoice(iid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    inv = db.get(Invoice, iid)
    if not inv or not (is_staff(user) or inv.client_id == user.id):
        raise HTTPException(404, "Invoice not found")
    if inv.status == InvoiceStatus.SENT.value and inv.client_id == user.id:
        inv.status = InvoiceStatus.VIEWED.value
        db.commit()
    return invoice_dict(inv, db)


@router.post("/invoices/{iid}/send")
def send_invoice(iid: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(403, "Wulweth staff send invoices")
    inv = db.get(Invoice, iid)
    if not inv or inv.status not in {InvoiceStatus.DRAFT.value, InvoiceStatus.VIEWED.value}:
        raise HTTPException(409, "Only a draft invoice can be sent")
    inv.status = InvoiceStatus.SENT.value
    inv.issued_at = datetime.now(timezone.utc)
    notify(db, None, db.get(User, inv.client_id), "PAYMENT", f"Invoice {inv.invoice_number} issued",
           f"Amount due: {inv.currency} {float(inv.total):,.2f} by "
           f"{inv.due_date.strftime('%d %b %Y') if inv.due_date else 'on receipt'}.",
           link="/dashboard/finance?tab=invoices")
    audit(db, request, user, "invoice.sent", "invoice", inv.id)
    db.commit()
    return invoice_dict(inv, db)


@router.get("/invoices/{iid}/pdf")
def invoice_pdf(iid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    inv = db.get(Invoice, iid)
    if not inv or not (is_staff(user) or inv.client_id == user.id):
        raise HTTPException(404, "Invoice not found")
    client = db.get(User, inv.client_id)
    project = db.get(Project, inv.project_id) if inv.project_id else None
    pdf = build_document_pdf(
        doc_type="INVOICE",
        number=inv.invoice_number,
        date=inv.issued_at or inv.created_at,
        client_name=client.full_name if client else "Client",
        client_email=client.email if client else "",
        project_tracking=project.tracking_id if project else None,
        items=[{"description": i.description, "quantity": float(i.quantity),
                "unit_price": float(i.unit_price), "line_total": float(i.line_total)} for i in inv.items],
        currency=inv.currency, subtotal=float(inv.subtotal), tax_percent=float(inv.tax_percent),
        tax_amount=float(inv.tax_amount), total=float(inv.total),
        due_date=inv.due_date,
        status=inv.status,
        notes=inv.notes,
    )
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{inv.invoice_number}.pdf"'})


class PayIn(BaseModel):
    method: str = Field(default="BANK_TRANSFER", pattern="^(BANK_TRANSFER|CARD|MOBILE_MONEY|OTHER)$")


@router.post("/invoices/{iid}/pay")
def initiate_payment(iid: str, payload: PayIn, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    inv = db.get(Invoice, iid)
    if not inv or inv.client_id != user.id:
        raise HTTPException(404, "Invoice not found")
    if inv.status in {InvoiceStatus.PAID.value, InvoiceStatus.VOID.value}:
        raise HTTPException(409, "This invoice is already settled")
    from app.services.ids import next_number
    reference = next_number(db, "payment", "PAY")
    provider = get_provider()
    instructions = provider.create_payment(inv.invoice_number, float(inv.total), inv.currency, reference)
    payment = Payment(reference=reference, invoice_id=inv.id, project_id=inv.project_id,
                      client_id=user.id, amount=inv.total, currency=inv.currency,
                      method=payload.method, provider=instructions.provider, status=PaymentStatus.PENDING.value)
    db.add(payment)
    audit(db, request, user, "payment.initiated", "payment", payment.id, {"invoice": inv.invoice_number})
    db.commit()
    return {
        "payment": pick(payment, "id", "reference", "amount", "currency", "status", "method"),
        "instructions": instructions.instructions,
        "redirect_url": instructions.redirect_url,
    }
