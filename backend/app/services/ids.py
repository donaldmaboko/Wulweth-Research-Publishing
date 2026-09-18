"""Human-readable identifiers: WUL-2026-000124, INV-2026-0001, ... (atomic counters)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Counter

# Business-facing numbering starts at a stable, professional base.
_BASES = {
    "request": 100,
    "project": 100,
    "quote": 1,
    "invoice": 1,
    "payment": 1,
    "payout": 1,
    "moderation": 1,
    "report": 1,
}


def next_number(db: Session, kind: str, prefix: str) -> str:
    """Increment a named counter row atomically and format `PREFIX-YYYY-NNNNNN`."""
    now_year = datetime.now(timezone.utc).year
    name = f"{kind}:{now_year}"
    row = db.execute(
        text("INSERT INTO counters (name, value) VALUES (:n, 1) "
             "ON CONFLICT (name) DO UPDATE SET value = counters.value + 1 RETURNING value"),
        {"n": name},
    ).scalar()
    base = _BASES.get(kind, 1)
    return f"{prefix}-{now_year}-{(base + row - 1):06d}"
