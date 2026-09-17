"""Research Feed: professional posts, comments, reactions, categories, reports."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, get_optional_user, is_staff
from app.db import get_db
from app.models import FeedCategory, FeedComment, FeedPost, FeedReaction, ModerationAction, ModerationCase, Report, User
from app.models_enums import (
    ContentType, ModerationStatus, PostStatus, ReactionType, ReportKind, RiskLevel,
)
from app.routers.common import jdump, page_params, paged, pick
from app.services.ids import next_number
from app.services.integrity import screen_content
from app.services.notify import notify

router = APIRouter(tags=["feed"])


def _post_dict(db: Session, post: FeedPost, user: User | None = None) -> dict:
    reactions = db.scalars(select(FeedReaction).where(FeedReaction.post_id == post.id)).all()
    counts: dict[str, int] = {}
    mine: list[str] = []
    for r in reactions:
        counts[r.reaction] = counts.get(r.reaction, 0) + 1
        if user and r.user_id == user.id:
            mine.append(r.reaction)
    comments = db.scalar(select(func.count(FeedComment.id)).where(
        FeedComment.post_id == post.id, FeedComment.status == "PUBLISHED")) or 0
    return pick(post, "id", "title", "body", "status", "published_at", "created_at",
                author=pick(post.author, "id", "full_name", "role", "professional_title") if post.author else None,
                category=pick(post.category, "id", "name", "slug") if post.category else None,
                reactions=counts, my_reactions=mine, comment_count=comments)


@router.get("/feed/categories")
def categories(db: Session = Depends(get_db)):
    cats = db.scalars(select(FeedCategory).order_by(FeedCategory.name)).all()
    return {"items": [pick(c, "id", "name", "slug", "description") for c in cats]}


@router.get("/feed")
def list_feed(db: Session = Depends(get_db), user: User | None = Depends(get_optional_user),
              params: dict = Depends(page_params), category: str | None = None, q: str | None = None,
              mine: bool = False):
    stmt = select(FeedPost).where(FeedPost.deleted_at.is_(None))
    if mine and user:
        stmt = stmt.where(FeedPost.author_id == user.id)
    else:
        stmt = stmt.where(FeedPost.status == PostStatus.PUBLISHED.value)
    if category:
        cat = db.scalar(select(FeedCategory).where(FeedCategory.slug == category))
        stmt = stmt.where(FeedPost.category_id == (cat.id if cat else "-"))
    if q:
        stmt = stmt.where((FeedPost.title + " " + FeedPost.body).ilike(f"%{q}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(FeedPost.published_at.desc().nullslast(), FeedPost.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    return paged([_post_dict(db, p, user) for p in rows], total, params)


class PostIn(BaseModel):
    title: str = Field(min_length=4, max_length=300)
    body: str = Field(min_length=10, max_length=20000)
    category_id: str | None = None


@router.post("/feed", status_code=201)
def create_post(payload: PostIn, request: Request, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    result = screen_content(f"{payload.title}\n{payload.body}")
    status = PostStatus.PUBLISHED.value
    if result["risk"] == RiskLevel.PROHIBITED.value:
        raise HTTPException(422, "This post conflicts with Wulweth's research integrity and copyright policies and was not published.")
    if result["risk"] == RiskLevel.POTENTIAL.value:
        status = PostStatus.PENDING_REVIEW.value

    post = FeedPost(author_id=user.id, title=payload.title, body=payload.body,
                    category_id=payload.category_id, status=status, risk_level=result["risk"])
    if status == PostStatus.PUBLISHED.value:
        post.published_at = datetime.now(timezone.utc)
    db.add(post)
    db.flush()
    if result["risk"] != RiskLevel.LOW.value:
        case = ModerationCase(
            case_number=next_number(db, "moderation", "MOD"),
            content_type=ContentType.FEED_POST.value, content_id=post.id, author_id=user.id,
            risk_level=result["risk"], triggered_rules=result["rules"], excerpt=result["excerpt"],
            status=ModerationStatus.PENDING_REVIEW.value if status == PostStatus.PENDING_REVIEW.value else ModerationStatus.PENDING_REVIEW.value,
        )
        db.add(case)
        db.flush()
        db.add(ModerationAction(case_id=case.id, action="AUTO_FLAGGED",
                                notes=f"Automated screening matched: {', '.join(result['rules'])}"))
        if status == PostStatus.PENDING_REVIEW.value:
            for staff_user in db.scalars(select(User).where(User.role.in_(["MANAGER", "ADMIN", "SUPER_ADMIN"]))).all():
                notify(db, None, staff_user, "MODERATION", f"Feed post held for review — {case.case_number}",
                       payload.title[:140], link="/dashboard/moderation")
    audit(db, request, user, "feed.post_created", "feed_post", post.id, {"status": status})
    db.commit()
    data = _post_dict(db, post, user)
    data["status"] = status
    return data


@router.get("/feed/{pid}")
def get_post(pid: str, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    post = db.get(FeedPost, pid)
    if not post or post.deleted_at:
        raise HTTPException(404, "Post not found")
    if post.status != PostStatus.PUBLISHED.value and not (is_staff(user) or (user and post.author_id == user.id)):
        raise HTTPException(404, "Post not found")
    comments = db.scalars(select(FeedComment).where(
        FeedComment.post_id == pid, FeedComment.status == "PUBLISHED").order_by(FeedComment.created_at)).all()
    data = _post_dict(db, post, user)
    data["comments"] = [pick(c, "id", "body", "created_at",
                             author=pick(c.author, "id", "full_name", "role", "professional_title") if c.author else None)
                        for c in comments]
    return data


class CommentIn(BaseModel):
    body: str = Field(min_length=2, max_length=8000)


@router.post("/feed/{pid}/comments", status_code=201)
def add_comment(pid: str, payload: CommentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post = db.get(FeedPost, pid)
    if not post or post.status != PostStatus.PUBLISHED.value:
        raise HTTPException(404, "Post not found")
    result = screen_content(payload.body)
    status = PostStatus.PUBLISHED.value
    if result["risk"] == RiskLevel.PROHIBITED.value:
        raise HTTPException(422, "This comment conflicts with Wulweth's research integrity policy and was not published.")
    if result["risk"] == RiskLevel.POTENTIAL.value:
        status = PostStatus.PENDING_REVIEW.value
    c = FeedComment(post_id=pid, author_id=user.id, body=payload.body, status=status)
    db.add(c)
    db.commit()
    author = db.get(User, c.author_id)
    return pick(c, "id", "body", "created_at", "status",
                author=pick(author, "id", "full_name", "role", "professional_title") if author else None)


class ReactionIn(BaseModel):
    reaction: str = Field(pattern="^(INSIGHTFUL|HELPFUL|RECOMMEND|CONGRATULATIONS)$")


@router.post("/feed/{pid}/react")
def react(pid: str, payload: ReactionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post = db.get(FeedPost, pid)
    if not post or post.status != PostStatus.PUBLISHED.value:
        raise HTTPException(404, "Post not found")
    existing = db.scalar(select(FeedReaction).where(
        FeedReaction.post_id == pid, FeedReaction.user_id == user.id, FeedReaction.reaction == payload.reaction))
    if existing:
        db.delete(existing)
        db.commit()
        return {"reacted": False, "reaction": payload.reaction}
    db.add(FeedReaction(post_id=pid, user_id=user.id, reaction=payload.reaction))
    db.commit()
    return {"reacted": True, "reaction": payload.reaction}


class ReportIn(BaseModel):
    kind: str = Field(pattern="^(INTEGRITY|COPYRIGHT|SPAM|OTHER)$")
    content_type: str | None = None
    content_id: str | None = None
    content_url: str | None = None
    details: str = Field(min_length=10, max_length=8000)


@router.post("/reports", status_code=201)
def create_report(payload: ReportIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    report = Report(reference=next_number(db, "report", "RPT"), kind=payload.kind,
                    reporter_id=user.id, content_type=payload.content_type,
                    content_id=payload.content_id, content_url=payload.content_url, details=payload.details)
    db.add(report)
    audit(db, request, user, "report.created", "report", report.id, {"kind": payload.kind})
    for staff_user in db.scalars(select(User).where(User.role.in_(["MANAGER", "ADMIN", "SUPER_ADMIN"]))).all():
        notify(db, None, staff_user, "INTEGRITY" if payload.kind == "INTEGRITY" else "MODERATION",
               f"New {payload.kind.lower()} report {report.reference}",
               payload.details[:140], link="/dashboard/moderation")
    db.commit()
    return pick(report, "id", "reference", "kind", "status", "created_at")


@router.delete("/feed/{pid}")
def delete_own_post(pid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post = db.get(FeedPost, pid)
    if not post or post.author_id != user.id:
        raise HTTPException(404, "Post not found")
    post.deleted_at = datetime.now(timezone.utc)
    post.status = PostStatus.REMOVED.value
    db.commit()
    return {"ok": True}
