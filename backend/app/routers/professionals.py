"""Research Expertise directory (public) + professional profile management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, is_admin, is_staff, require_admin, require_roles
from app.db import get_db
from app.models import (
    PortfolioItem, Publication, Qualification, ResearchField, ResearcherProfile,
    Service, User, UserRoleLink,
)
from app.models_enums import ProfileStatus, UserRole, VerificationStatus
from app.routers.common import jdump, page_params, paged, pick
from app.services.integrity import screen_content
from app.services.notify import notify

router = APIRouter(tags=["professionals"])


def profile_dict(db: Session, p: ResearcherProfile, detailed: bool = False, own: bool = False) -> dict:
    user = p.user
    fields = db.scalars(select(ResearchField).where(ResearchField.id.in_(p.research_field_ids or ["-"]))).all()
    data = pick(
        p,
        "id", "professional_title", "bio", "disciplines", "expertise", "methodologies",
        "statistical_methods", "software", "industries", "languages", "years_experience",
        "publications_count", "availability", "location", "verification",
        full_name=user.full_name if p.profile_status == "PUBLISHED" or own else None,
        country=user.country,
        research_fields=[pick(f, "id", "name", "group") for f in fields],
        service_slugs=p.services_offer_slugs or [],
    )
    if detailed:
        data["qualifications"] = [
            pick(q, "id", "degree", "institution", "field_of_study", "year", "verification")
            for q in db.scalars(select(Qualification).where(Qualification.profile_id == p.id)).all()
        ]
        data["publications"] = [
            pick(pub, "id", "title", "journal", "year", "pub_type", "doi", "url", "description")
            for pub in db.scalars(select(Publication).where(Publication.profile_id == p.id).order_by(Publication.year.desc())).all()
        ]
        data["portfolio"] = [
            pick(item, "id", "title", "description", "discipline", "methods", "year", "link")
            for item in db.scalars(select(PortfolioItem).where(PortfolioItem.profile_id == p.id, PortfolioItem.moderation_status == "PUBLISHED")).all()
        ]
    return data


# ------------------------------ public directory ----------------------------

@router.get("/professionals")
def search_professionals(
    db: Session = Depends(get_db),
    params: dict = Depends(page_params),
    q: str | None = None,
    discipline: str | None = None,
    field_id: str | None = None,
    methodology: str | None = None,
    software: str | None = None,
    availability: str | None = None,
    country: str | None = None,
    verified_only: bool = False,
):
    stmt = select(ResearcherProfile).join(User, ResearcherProfile.user_id == User.id).where(
        ResearcherProfile.profile_status == ProfileStatus.PUBLISHED.value,
        User.status == "ACTIVE",
    )
    if verified_only:
        stmt = stmt.where(ResearcherProfile.verification == VerificationStatus.VERIFIED.value)
    if discipline:
        stmt = stmt.where(ResearcherProfile.disciplines.contains([discipline]))
    if field_id:
        stmt = stmt.where(ResearcherProfile.research_field_ids.contains([field_id]))
    if methodology:
        stmt = stmt.where(ResearcherProfile.methodologies.contains([methodology]))
    if software:
        stmt = stmt.where(ResearcherProfile.software.contains([software]))
    if availability:
        stmt = stmt.where(ResearcherProfile.availability == availability)
    if country:
        stmt = stmt.where(User.country == country)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            User.full_name.ilike(like),
            ResearcherProfile.professional_title.ilike(like),
            ResearcherProfile.bio.ilike(like),
            ResearcherProfile.expertise.contains([q]),
        ))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(ResearcherProfile.verification.desc(), User.full_name).offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    return paged([profile_dict(db, p) for p in rows], total, params)


@router.get("/professionals/{profile_id}")
def get_public_profile(profile_id: str, db: Session = Depends(get_db),
                       user: User | None = Depends(get_current_user)):
    p = db.get(ResearcherProfile, profile_id)
    own = user is not None and user.id == p.user_id if p else False
    if not p or (p.profile_status != ProfileStatus.PUBLISHED.value and not (own or is_staff(user))):
        raise HTTPException(404, "Professional profile not found")
    return profile_dict(db, p, detailed=True, own=own)


# ------------------------------ own profile ---------------------------------

class ProfileIn(BaseModel):
    professional_title: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=6000)
    disciplines: list[str] = []
    research_field_ids: list[str] = []
    expertise: list[str] = []
    methodologies: list[str] = []
    statistical_methods: list[str] = []
    software: list[str] = []
    industries: list[str] = []
    languages: list[str] = []
    years_experience: int = Field(default=0, ge=0, le=70)
    availability: str = "PART_TIME"
    location: str | None = None
    services_offer_slugs: list[str] = []
    profile_status: str | None = Field(default=None, pattern="^(DRAFT|PUBLISHED|HIDDEN)$")


def _screen_profile_text(p: ProfileIn) -> tuple[str, list]:
    blob = " ".join(filter(None, [p.bio, *(p.expertise or []), *(p.methodologies or [])]))
    result = screen_content(blob)
    return result["risk"], result["rules"]


@router.put("/my/profile")
def upsert_my_profile(payload: ProfileIn, request: Request, db: Session = Depends(get_db),
                      user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                       UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    if not p:
        p = ResearcherProfile(user_id=user.id)
        db.add(p)
        db.flush()

    if payload.profile_status == ProfileStatus.PUBLISHED.value:
        if not payload.professional_title or not (payload.bio or "").strip() or not payload.expertise:
            raise HTTPException(422, "Add a professional title, biography and at least one area of expertise before publishing your profile")
        if p.verification != VerificationStatus.VERIFIED.value:
            # Publishable as "unverified" only after review; require staff action for verification badge
            pass
        risk, rules = _screen_profile_text(payload)
        if risk == "PROHIBITED":
            raise HTTPException(422, "Your profile could not be published: it appears to describe services outside Wulweth's research integrity policy. Review the Research Integrity policy and edit your text.")
        if risk == "POTENTIAL":
            payload.profile_status = "DRAFT"

    for field, value in payload.model_dump().items():
        if field == "profile_status":
            if value:
                p.profile_status = value
        else:
            setattr(p, field, value if value is not None else getattr(p, field))

    user.professional_title = p.professional_title
    audit(db, request, user, "profile.updated", "researcher_profile", p.id)
    db.commit()
    return profile_dict(db, p, own=True)


@router.get("/my/profile")
def get_my_profile(db: Session = Depends(get_db),
                   user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                    UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    if not p:
        p = ResearcherProfile(user_id=user.id, languages=["English"])
        db.add(p)
        db.commit()
    return profile_dict(db, p, detailed=True, own=True)


class QualificationIn(BaseModel):
    degree: str = Field(max_length=200)
    institution: str = Field(max_length=200)
    field_of_study: str | None = None
    year: int | None = Field(default=None, ge=1950, le=2100)


@router.post("/my/qualifications", status_code=201)
def add_qualification(payload: QualificationIn, db: Session = Depends(get_db),
                      user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                          UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    if not p:
        raise HTTPException(404, "Create your profile first")
    q = Qualification(profile_id=p.id, **payload.model_dump())
    db.add(q)
    db.commit()
    return pick(q, "id", "degree", "institution", "field_of_study", "year", "verification")


@router.delete("/my/qualifications/{qid}")
def delete_qualification(qid: str, db: Session = Depends(get_db),
                         user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                             UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    q = db.get(Qualification, qid)
    if not p or not q or q.profile_id != p.id:
        raise HTTPException(404, "Not found")
    db.delete(q)
    db.commit()
    return {"ok": True}


class PublicationIn(BaseModel):
    title: str = Field(max_length=400)
    journal: str | None = None
    year: int | None = Field(default=None, ge=1950, le=2100)
    pub_type: str | None = None
    doi: str | None = None
    url: str | None = None
    description: str | None = None


@router.post("/my/publications", status_code=201)
def add_publication(payload: PublicationIn, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                        UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    if not p:
        raise HTTPException(404, "Create your profile first")
    pub = Publication(profile_id=p.id, **payload.model_dump())
    db.add(pub)
    db.flush()
    p.publications_count = db.scalar(select(func.count(Publication.id)).where(Publication.profile_id == p.id)) or 0
    db.commit()
    return pick(pub, "id", "title", "journal", "year", "pub_type", "doi", "url")


@router.delete("/my/publications/{pid}")
def delete_publication(pid: str, db: Session = Depends(get_db),
                       user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                           UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    pub = db.get(Publication, pid)
    if not p or not pub or pub.profile_id != p.id:
        raise HTTPException(404, "Not found")
    db.delete(pub)
    p.publications_count = db.scalar(select(func.count(Publication.id)).where(Publication.profile_id == p.id)) or 0
    db.commit()
    return {"ok": True}


class PortfolioIn(BaseModel):
    title: str = Field(max_length=300)
    description: str | None = None
    discipline: str | None = None
    methods: list[str] = []
    year: int | None = Field(default=None, ge=1950, le=2100)
    link: str | None = None


@router.post("/my/portfolio", status_code=201)
def add_portfolio_item(payload: PortfolioIn, db: Session = Depends(get_db),
                       user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                           UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    if not p:
        raise HTTPException(404, "Create your profile first")
    result = screen_content(" ".join(filter(None, [payload.title, payload.description])))
    if result["risk"] == "PROHIBITED":
        raise HTTPException(422, "This portfolio entry conflicts with Wulweth's research integrity policy and was not saved.")
    item = PortfolioItem(profile_id=p.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return pick(item, "id", "title", "description", "discipline", "methods", "year", "link")


@router.delete("/my/portfolio/{item_id}")
def delete_portfolio_item(item_id: str, db: Session = Depends(get_db),
                          user: User = Depends(require_roles(UserRole.RESEARCHER, UserRole.RESEARCH_CONSULTANT,
                                                              UserRole.DATA_SPECIALIST, UserRole.EDITOR))):
    p = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == user.id))
    item = db.get(PortfolioItem, item_id)
    if not p or not item or item.profile_id != p.id:
        raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ------------------------------ verification (staff) -------------------------

@router.get("/admin/profiles")
def admin_list_profiles(db: Session = Depends(get_db), params: dict = Depends(page_params),
                        user: User = Depends(require_admin), verification: str | None = None,
                        status_filter: str | None = None):
    stmt = select(ResearcherProfile)
    if verification:
        stmt = stmt.where(ResearcherProfile.verification == verification)
    if status_filter:
        stmt = stmt.where(ResearcherProfile.profile_status == status_filter)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(ResearcherProfile.updated_at.desc()).offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    return paged([profile_dict(db, p, detailed=True, own=True) for p in rows], total, params)


@router.post("/admin/profiles/{profile_id}/verification")
def set_verification(profile_id: str, payload: dict, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(require_admin)):
    p = db.get(ResearcherProfile, profile_id)
    if not p:
        raise HTTPException(404, "Profile not found")
    decision = (payload or {}).get("verification")
    if decision not in {VerificationStatus.VERIFIED.value, VerificationStatus.FAILED.value,
                        VerificationStatus.PENDING.value, VerificationStatus.UNVERIFIED.value}:
        raise HTTPException(422, "Invalid verification status")
    p.verification = decision
    p.verification_note = (payload or {}).get("note")
    audit(db, request, user, "profile.verification_set", "researcher_profile", p.id, {"verification": decision})
    notify(db, None, p.user, "ACCOUNT", "Profile verification updated",
           f"Your qualification verification status is now: {decision}.", link="/dashboard/profile")
    db.commit()
    return profile_dict(db, p, own=True)
