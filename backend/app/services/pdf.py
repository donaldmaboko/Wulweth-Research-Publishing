"""Branded invoice / quote PDF generation (reportlab)."""
from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#0B2545")
TEAL = colors.HexColor("#0E7C7B")
INK = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")

_BRAND = "Wulweth Research & Publishing"
_TAGLINE = "Where boundless curiosity meets limitless potential"


def _styles() -> dict:
    return {
        "brand": ParagraphStyle("brand", fontName="Times-Bold", fontSize=20, textColor=NAVY, leading=24),
        "tagline": ParagraphStyle("tagline", fontName="Times-Italic", fontSize=9.5, textColor=TEAL, leading=12),
        "doc_title": ParagraphStyle("doc_title", fontName="Helvetica-Bold", fontSize=13, textColor=INK, leading=16),
        "h": ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=8, textColor=colors.white, leading=11),
        "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, textColor=INK, leading=11),
        "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=8.5, textColor=INK, leading=11),
        "muted": ParagraphStyle("muted", fontName="Helvetica", fontSize=8.5, textColor=MUTED, leading=11),
        "total": ParagraphStyle("total", fontName="Helvetica-Bold", fontSize=10, textColor=NAVY, leading=13),
    }


def build_document_pdf(
    *,
    doc_type: str,  # INVOICE | QUOTE
    number: str,
    date: datetime | None,
    client_name: str,
    client_email: str,
    project_tracking: str | None,
    items: list[dict],  # {description, quantity, unit_price, line_total}
    currency: str,
    subtotal: float,
    tax_percent: float,
    tax_amount: float,
    total: float,
    due_date: datetime | None = None,
    status: str | None = None,
    notes: str | None = None,
    footer_note: str = "Wulweth Research & Publishing — professional research services, data services and publishing support.",
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
        title=f"{doc_type.title()} {number}", author=_BRAND,
    )
    st = _styles()
    story = []

    story.append(Paragraph(_BRAND, st["brand"]))
    story.append(Paragraph(_TAGLINE, st["tagline"]))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.2, color=TEAL))
    story.append(Spacer(1, 12))

    meta_left = [
        Paragraph(f"<b>{doc_type.title()} № {number}</b>", st["doc_title"]),
        Spacer(1, 3),
        Paragraph(f"Date: {date.strftime('%d %B %Y') if date else '—'}", st["muted"]),
    ]
    if doc_type == "INVOICE" and due_date:
        meta_left.append(Paragraph(f"Due: {due_date.strftime('%d %B %Y')}", st["muted"]))
    if status:
        meta_left.append(Paragraph(f"Status: {status.replace('_', ' ').title()}", st["muted"]))
    meta_right = [
        Paragraph("<b>Billed to</b>", st["cellb"]),
        Paragraph(client_name, st["cell"]),
        Paragraph(client_email, st["muted"]),
    ]
    if project_tracking:
        meta_right.append(Paragraph(f"Project: {project_tracking}", st["muted"]))
    meta = Table([[meta_left, meta_right]], colWidths=[doc.width * 0.5, doc.width * 0.5])
    meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(meta)
    story.append(Spacer(1, 14))

    header = [Paragraph(x, st["h"]) for x in ["Description", "Qty", f"Unit price ({currency})", f"Amount ({currency})"]]
    rows = [header]
    for it in items:
        rows.append([
            Paragraph(it["description"], st["cell"]),
            Paragraph(f"{it['quantity']:g}", st["cell"]),
            Paragraph(f"{it['unit_price']:,.2f}", st["cell"]),
            Paragraph(f"{it['line_total']:,.2f}", st["cell"]),
        ])
    table = Table(rows, colWidths=[doc.width * 0.52, doc.width * 0.12, doc.width * 0.18, doc.width * 0.18])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 1), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F8FB")]),
    ]))
    story.append(table)
    story.append(Spacer(1, 10))

    totals_rows = [["Subtotal", f"{currency} {subtotal:,.2f}"]]
    if tax_percent:
        totals_rows.append([f"Tax ({tax_percent:g}%)", f"{currency} {tax_amount:,.2f}"])
    totals_rows.append(["Total", f"{currency} {total:,.2f}"])
    totals = Table(totals_rows, colWidths=[doc.width * 0.7, doc.width * 0.3], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, -1), (-1, -1), NAVY),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, TEAL),
    ]))
    story.append(totals)

    if notes:
        story.append(Spacer(1, 14))
        story.append(Paragraph("<b>Notes</b>", st["cellb"]))
        story.append(Paragraph(notes.replace("\n", "<br/>"), st["muted"]))

    story.append(Spacer(1, 22))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#CBD5E1")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(footer_note, st["muted"]))

    doc.build(story)
    return buf.getvalue()
