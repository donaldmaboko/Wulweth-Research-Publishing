"""Shared router utilities: pagination, serialization."""
from __future__ import annotations

import decimal
from datetime import datetime

from fastapi import Query


def page_params(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return {"page": page, "page_size": page_size}


def jdump(value):
    """Recursively convert SQLAlchemy rows / values into JSON-safe structures."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (list, tuple)):
        return [jdump(v) for v in value]
    if isinstance(value, dict):
        return {k: jdump(v) for k, v in value.items()}
    return value


def pick(obj, *fields, **overrides) -> dict:
    data = {f: jdump(getattr(obj, f, None)) for f in fields}
    for key, value in overrides.items():
        data[key] = jdump(value() if callable(value) else value)
    return data


def paged(items: list, total: int, params: dict) -> dict:
    return {
        "items": items,
        "total": total,
        "page": params["page"],
        "page_size": params["page_size"],
        "pages": max(1, -(-total // params["page_size"])),
    }
