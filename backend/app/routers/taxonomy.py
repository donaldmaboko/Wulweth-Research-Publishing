"""Public taxonomy: research disciplines and the service catalogue."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ResearchField, Service
from app.routers.common import jdump

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/research-fields")
def list_research_fields(db: Session = Depends(get_db)):
    fields = db.scalars(select(ResearchField).where(ResearchField.active).order_by(ResearchField.group, ResearchField.name)).all()
    grouped: dict[str, list] = defaultdict(list)
    for f in fields:
        grouped[f.group].append(jdump({
            "id": f.id, "name": f.name, "slug": f.slug, "description": f.description,
        }))
    return {"groups": [{"group": g, "fields": fs} for g, fs in grouped.items()]}


@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    services = db.scalars(select(Service).where(Service.active).order_by(Service.category, Service.name)).all()
    grouped: dict[str, list] = defaultdict(list)
    for s in services:
        grouped[s.category].append(jdump({
            "id": s.id, "name": s.name, "slug": s.slug, "description": s.description,
            "deliverables_examples": s.deliverables_examples or [],
        }))
    order = ["Research Design", "Statistical Analysis", "Data Services", "Literature and Evidence", "Research Consulting", "Publishing Support"]
    cats = [c for c in order if c in grouped] + [c for c in grouped if c not in order]
    return {"categories": [{"category": c, "services": grouped[c]} for c in cats]}


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Real system counts only — the platform never fabricates statistics."""
    from sqlalchemy import func
    from app.models import FeedPost, Project, ResearcherProfile, User

    return {
        "published_professionals": db.scalar(select(func.count(ResearcherProfile.id)).where(ResearcherProfile.profile_status == "PUBLISHED")) or 0,
        "verified_professionals": db.scalar(select(func.count(ResearcherProfile.id)).where(ResearcherProfile.verification == "VERIFIED")) or 0,
        "discipline_groups": db.scalar(select(func.count(func.distinct(ResearchField.group)))) or 0,
        "services": db.scalar(select(func.count(Service.id)).where(Service.active)) or 0,
        "completed_projects": db.scalar(select(func.count(Project.id)).where(Project.status.in_(["COMPLETED", "PAYMENT_RELEASED"]))) or 0,
        "feed_posts": db.scalar(select(func.count(FeedPost.id)).where(FeedPost.status == "PUBLISHED")) or 0,
    }
