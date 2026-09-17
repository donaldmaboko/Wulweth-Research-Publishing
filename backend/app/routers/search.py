"""Global search across the platform (role-scoped)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, is_staff
from app.db import get_db
from app.models import (
    FeedPost, Opportunity, Project, ResearchRequest, ResearcherProfile, Service, User,
)
from app.models_enums import PostStatus, ProfileStatus, ProjectStatus
from app.routers.common import pick

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def global_search(db: Session = Depends(get_db), user = Depends(get_current_user),
                  q: str = Query(min_length=2, max_length=200)):
    like = f"%{q}%"
    results: dict[str, list] = {"services": [], "professionals": [], "projects": [], "requests": [], "opportunities": [], "feed_posts": []}

    services = db.scalars(select(Service).where(Service.active, or_(Service.name.ilike(like), Service.description.ilike(like), Service.category.ilike(like))).limit(8)).all()
    results["services"] = [pick(s, "id", "name", "category", "slug") for s in services]

    prof_stmt = select(ResearcherProfile).join(User, ResearcherProfile.user_id == User.id).where(
        ResearcherProfile.profile_status == ProfileStatus.PUBLISHED.value)
    prof_stmt = prof_stmt.where(or_(
        User.full_name.ilike(like), ResearcherProfile.professional_title.ilike(like),
        ResearcherProfile.bio.ilike(like), ResearcherProfile.expertise.contains([q])))
    profiles = db.scalars(prof_stmt.limit(8)).all()
    results["professionals"] = [
        pick(p, "id", "professional_title", "verification",
             full_name=db.get(User, p.user_id).full_name)
        for p in profiles
    ]

    if is_staff(user) or user.role in {"CLIENT", "ORGANIZATION"}:
        stmt = select(Project)
        if not is_staff(user):
            stmt = stmt.where(Project.client_id == user.id)
        projects = db.scalars(stmt.where(or_(Project.title.ilike(like), Project.tracking_id.ilike(like))).limit(8)).all()
        results["projects"] = [pick(p, "id", "tracking_id", "title", "status") for p in projects]

        rstmt = select(ResearchRequest)
        if not is_staff(user):
            rstmt = rstmt.where(ResearchRequest.client_id == user.id)
        requests = db.scalars(rstmt.where(or_(ResearchRequest.title.ilike(like), ResearchRequest.tracking_id.ilike(like))).limit(8)).all()
        results["requests"] = [pick(r, "id", "tracking_id", "title", "status") for r in requests]

    opps = db.scalars(select(Opportunity).where(
        Opportunity.status == "OPEN", Opportunity.deleted_at.is_(None),
        Opportunity.visibility == "PUBLIC",
        or_(Opportunity.title.ilike(like), Opportunity.description.ilike(like))).limit(6)).all()
    results["opportunities"] = [pick(o, "id", "title", "discipline") for o in opps]

    posts = db.scalars(select(FeedPost).where(
        FeedPost.status == PostStatus.PUBLISHED.value, FeedPost.deleted_at.is_(None),
        or_(FeedPost.title.ilike(like), FeedPost.body.ilike(like))).limit(6)).all()
    results["feed_posts"] = [pick(p, "id", "title") for p in posts]

    results["total"] = sum(len(v) for v in results.values() if isinstance(v, list))
    return results
