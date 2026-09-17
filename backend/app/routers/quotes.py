"""Quotes: preparation by Wulweth managers, client approval workflow."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_staff
from app.db import get_db
from app.models import Invoice, InvoiceItem, Project, Quote, QuoteItem, ResearchRequest, User
from app.models_enums import InvoiceStatus, ProjectStatus, QuoteStatus, RequestStatus
from app.routers.common import pick
from app.services.ids import next_number
from app.services.notify import notify
from app.services.projects_flow import transition_project

router = APIRouter(tags=["quotes"])


def _recalc(q: Quote) -> None:
    subtotal = sum(float(i.line_total or 0) for i in q.items)
    tax = round(subtotal * float(q.tax_percent or 0) / 100, 2)
    q.subtotal = subtotal
    q.tax_amount = tax
    q.total = round(subtotal + tax, 2)


def quote_dict(q: Quote, db: Session | None = None) -> dict:
    project = db.get(Project, q.project_id) if (db and q.project_id) else None
    return pick(
        q, "id", "quote_number", "client_id", "currency", "subtotal", "tax_percent",
        "tax_amount", "total", "valid_until", "notes", "status", "sent_at", "viewed_at",
        "decided_at", "rejection_reason", "created_at", "project_id", "request_id",
        items=[pick(i, "id", "description", "deliverables_text", "quantity", "unit_price", "line_total") for i in q.items],
        project=pick(project, "id", "tracking_id", "title") if project else None,
    )


class QuoteItemIn(BaseModel):
    description: str = Field(max_length=400)
    deliverables_text: str | None = None
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(ge=0)


class QuoteIn(BaseModel):
    items: list[QuoteItemIn]
    tax_percent: float = Field(default=0, ge=0, le=100)
    valid_days: int = Field(default=30, ge=1, le=180)
    notes: str | None = None


def _can_view(db: Session, user: User, q: Quote) -> bool:
    return is_staff(user) or q.client_id == user.id


@router.post("/projects/{pid}/quotes", status_code=201)
def create_quote(pid: str, payload: QuoteIn, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(403, "Wulweth staff prepare quotes")
    p = db.get(Project, pid)
    if not p or p.deleted_at:
        raise HTTPException(404, "Project not found")
    if p.status not in {ProjectStatus.UNDER_REVIEW.value, ProjectStatus.QUOTE_PREPARED.value,
                        ProjectStatus.AWAITING_CLIENT_APPROVAL.value, ProjectStatus.REQUEST_SUBMITTED.value}:
        raise HTTPException(409, "A quote can no longer be prepared at this stage")
    if not payload.items:
        raise HTTPException(422, "Add at least one line item")

    q = Quote(quote_number="PENDING", project_id=p.id, request_id=p.request_id, client_id=p.client_id,
              prepared_by=user.id, currency=p.currency, tax_percent=payload.tax_percent,
              valid_until=datetime.now(timezone.utc) + timedelta(days=payload.valid_days),
              notes=payload.notes, status=QuoteStatus.DRAFT.value)
    db.add(q)
    db.flush()
    q.quote_number = next_number(db, "quote", "QT")
    for idx, item in enumerate(payload.items):
        db.add(QuoteItem(quote_id=q.id, description=item.description, deliverables_text=item.deliverables_text,
                         quantity=item.quantity, unit_price=item.unit_price,
                         line_total=round(item.quantity * item.unit_price, 2), position=idx))
    db.flush()  # items must be persisted before _recalc reads q.items (session uses autoflush=False)
    _recalc(q)
    p.quoted_amount = q.total
    if p.status in {ProjectStatus.UNDER_REVIEW.value, ProjectStatus.REQUEST_SUBMITTED.value}:
        transition_project(db, p, ProjectStatus.QUOTE_PREPARED.value, user, note=f"Quote {q.quote_number} prepared",
                           notify_client=False)
    audit(db, request, user, "quote.created", "quote", q.id, {"project": p.tracking_id, "total": float(q.total)})
    db.commit()
    return quote_dict(q, db)


@router.get("/quotes")
def list_quotes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Quote)
    if not is_staff(user):
        stmt = stmt.where(Quote.client_id == user.id)
    quotes = db.scalars(stmt.order_by(Quote.created_at.desc()).limit(200)).all()
    items = []
    for q in quotes:
        project = db.get(Project, q.project_id) if q.project_id else None
        items.append(pick(q, "id", "quote_number", "total", "currency", "status", "created_at", "valid_until",
                          project=pick(project, "id", "tracking_id", "title") if project else None))
    return {"items": items}


@router.get("/quotes/{qid}")
def get_quote(qid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.get(Quote, qid)
    if not q or not _can_view(db, user, q):
        raise HTTPException(404, "Quote not found")
    # auto mark viewed when client opens a sent quote
    if q.status == QuoteStatus.SENT.value and q.client_id == user.id:
        q.status = QuoteStatus.VIEWED.value
        q.viewed_at = datetime.now(timezone.utc)
        db.commit()
    return quote_dict(q, db)


@router.put("/quotes/{qid}")
def update_quote(qid: str, payload: QuoteIn, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(403, "Wulweth staff prepare quotes")
    q = db.get(Quote, qid)
    if not q or q.status not in {QuoteStatus.DRAFT.value}:
        raise HTTPException(404, "Only draft quotes can be edited")
    for item in list(q.items):
        db.delete(item)
    for idx, item in enumerate(payload.items):
        db.add(QuoteItem(quote_id=q.id, description=item.description, deliverables_text=item.deliverables_text,
                         quantity=item.quantity, unit_price=item.unit_price,
                         line_total=round(item.quantity * item.unit_price, 2), position=idx))
    q.tax_percent = payload.tax_percent
    q.notes = payload.notes
    q.valid_until = datetime.now(timezone.utc) + timedelta(days=payload.valid_days)
    db.flush()
    _recalc(q)
    audit(db, request, user, "quote.updated", "quote", q.id)
    db.commit()
    return quote_dict(q, db)


@router.post("/quotes/{qid}/send")
def send_quote(qid: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_staff(user):
        raise HTTPException(403, "Wulweth staff send quotes")
    q = db.get(Quote, qid)
    if not q or q.status != QuoteStatus.DRAFT.value:
        raise HTTPException(404, "Quote not found or already sent")
    q.status = QuoteStatus.SENT.value
    q.sent_at = datetime.now(timezone.utc)
    p = db.get(Project, q.project_id) if q.project_id else None
    if p and p.status == ProjectStatus.QUOTE_PREPARED.value:
        transition_project(db, p, ProjectStatus.AWAITING_CLIENT_APPROVAL.value, user,
                           note=f"Quote {q.quote_number} sent for approval")
    notify(db, None, db.get(User, q.client_id), "QUOTE", f"Quote {q.quote_number} ready for review",
           f"Total: {q.currency} {float(q.total):,.2f}", link="/dashboard/finance?tab=quotes")
    audit(db, request, user, "quote.sent", "quote", q.id)
    db.commit()
    return quote_dict(q, db)


@router.post("/quotes/{qid}/approve")
def approve_quote(qid: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.get(Quote, qid)
    if not q or q.client_id != user.id:
        raise HTTPException(404, "Quote not found")
    if q.status not in {QuoteStatus.SENT.value, QuoteStatus.VIEWED.value}:
        raise HTTPException(409, "Only a sent quote can be approved")
    if q.valid_until and q.valid_until < datetime.now(timezone.utc):
        q.status = QuoteStatus.EXPIRED.value
        db.commit()
        raise HTTPException(409, "This quote has expired. Ask Wulweth to re-issue it.")
    q.status = QuoteStatus.APPROVED.value
    q.decided_at = datetime.now(timezone.utc)

    p = db.get(Project, q.project_id) if q.project_id else None
    if p:
        p.quoted_amount = q.total
        if p.status == ProjectStatus.AWAITING_CLIENT_APPROVAL.value:
            transition_project(db, p, ProjectStatus.PAYMENT_PENDING.value, user,
                               note=f"Quote {q.quote_number} approved by client", trigger="quote_approved")
        if not db.scalar(select(Invoice).where(Invoice.quote_id == q.id)):
            _create_invoice_from_quote(db, q, user)
    audit(db, request, user, "quote.approved", "quote", q.id)
    for staff_user in db.scalars(select(User).where(User.role.in_(["MANAGER", "ADMIN", "SUPER_ADMIN", "FINANCE"]))).all():
        notify(db, None, staff_user, "QUOTE", f"Quote approved — {q.quote_number}",
               f"{user.full_name} approved the quote; an invoice has been prepared.",
               link="/dashboard/finance?tab=payments")
    db.commit()
    return quote_dict(q, db)


@router.post("/quotes/{qid}/reject")
def reject_quote(qid: str, payload: dict, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    q = db.get(Quote, qid)
    if not q or q.client_id != user.id:
        raise HTTPException(404, "Quote not found")
    if q.status not in {QuoteStatus.SENT.value, QuoteStatus.VIEWED.value}:
        raise HTTPException(409, "Only a sent quote can be rejected")
    q.status = QuoteStatus.REJECTED.value
    q.decided_at = datetime.now(timezone.utc)
    q.rejection_reason = (payload or {}).get("reason")
    p = db.get(Project, q.project_id) if q.project_id else None
    if p and p.status == ProjectStatus.AWAITING_CLIENT_APPROVAL.value:
        transition_project(db, p, ProjectStatus.UNDER_REVIEW.value, user,
                           note=f"Quote {q.quote_number} rejected — returned for review")
    audit(db, request, user, "quote.rejected", "quote", q.id, {"reason": q.rejection_reason})
    for staff_user in db.scalars(select(User).where(User.role.in_(["MANAGER", "ADMIN", "SUPER_ADMIN"]))).all():
        notify(db, None, staff_user, "QUOTE", f"Quote rejected — {q.quote_number}",
               (q.rejection_reason or "")[:200], link="/dashboard/requests")
    db.commit()
    return quote_dict(q, db)


def _create_invoice_from_quote(db: Session, q: Quote, issuer: User) -> Invoice:
    from app.services.ids import next_number
    invoice = Invoice(
        invoice_number=next_number(db, "invoice", "INV"),
        quote_id=q.id, project_id=q.project_id, client_id=q.client_id, issued_by=issuer.id,
        currency=q.currency, subtotal=q.subtotal, tax_percent=q.tax_percent,
        tax_amount=q.tax_amount, total=q.total, status=InvoiceStatus.DRAFT.value,
        due_date=datetime.now(timezone.utc) + timedelta(days=14),
        notes="Payable within 14 days. Payment instructions are provided once the invoice is sent.",
    )
    db.add(invoice)
    db.flush()
    for idx, item in enumerate(q.items):
        db.add(InvoiceItem(invoice_id=invoice.id, description=item.description,
                           quantity=item.quantity, unit_price=item.unit_price,
                           line_total=item.line_total, position=idx))
    db.commit()
    return invoice
