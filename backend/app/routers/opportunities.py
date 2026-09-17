"""Research Opportunities: curated listings — public, private, invitation-only,
direct assignment. Wulweth managers retain matching and assignment control;
professionals may express interest or accept invitations (no open bidding)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import audit, get_current_user, get_optional_user, is_staff, require_professional, require_staff
from app.db import get_db
from app.models import (
    Opportunity, OpportunityInterest, OpportunityInvitation, Organization, User,
)
from app.models_enums import (
    ContentType, InterestStatus, InvitationStatus, ModerationStatus,
    OpportunityStatus, OpportunityVisibility, RiskLevel, UserRole,
    PROFESSIONAL_ROLES,
)
from app.routers.common import page_params, paged, pick
from app.services.ids import next_number
from app.services.integrity import screen_content
from app.services.notify import notify

router = APIRouter(tags=["opportunities"])

PUBLIC_VISIBILITIES = {OpportunityVisibility.PUBLIC.value}


def _visible_to_user(stmt, user: User | None):
    if user and is_staff(user):
        return stmt
    if user:
        return stmt.where(or_(
            Opportunity.visibility == OpportunityVisibility.PUBLIC.value,
            Opportunity.created_by == user.id,
        ))
    return stmt.where(Opportunity.visibility == OpportunityVisibility.PUBLIC.value)


def _opp_dict(db: Session, o: Opportunity, user: User | None = None) -> dict:
    org = db.get(Organization, o.organization_id) if o.organization_id else None
    creator = db.get(User, o.created_by) if o.created_by else None
    interest_count = db.scalar(select(func.count(OpportunityInterest.id)).where(OpportunityInterest.opportunity_id == o.id)) or 0
    data = pick(
        o, "id", "title", "description", "discipline", "required_expertise", "methodology",
        "visibility", "status", "deadline", "expected_timeline", "location", "created_at",
        organization=pick(org, "id", "name", "org_type") if org else None,
        posted_by=creator.full_name if creator else None,
        interest_count=interest_count,
    )
    if user and not is_staff(user):
        data["visibility"] = o.visibility if o.created_by == user.id else data["visibility"]
    return data


@router.get("/opportunities")
def list_opportunities(db: Session = Depends(get_db), user: User | None = Depends(get_optional_user),
                       params: dict = Depends(page_params), discipline: str | None = None,
                       status: str | None = "OPEN", mine: bool = False):
    stmt = select(Opportunity).where(Opportunity.deleted_at.is_(None))
    if mine and user:
        stmt = stmt.where(or_(Opportunity.created_by == user.id, Opportunity.client_id == user.id))
    else:
        stmt = _visible_to_user(stmt, user)
    if discipline:
        stmt = stmt.where(Opportunity.discipline == discipline)
    if status:
        stmt = stmt.where(Opportunity.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Opportunity.created_at.desc())
                      .offset((params["page"] - 1) * params["page_size"]).limit(params["page_size"])).all()
    return paged([_opp_dict(db, o, user) for o in rows], total, params)


class OpportunityIn(BaseModel):
    title: str = Field(min_length=6, max_length=300)
    description: str = Field(min_length=20, max_length=20000)
    discipline: str | None = None
    research_field_id: str | None = None
    service_id: str | None = None
    required_expertise: list[str] = []
    methodology: str | None = None
    visibility: str = OpportunityVisibility.PUBLIC.value
    deadline: datetime | None = None
    expected_timeline: str | None = Field(default=None, max_length=120)
    location: str | None = None


@router.post("/opportunities", status_code=201)
def create_opportunity(payload: OpportunityIn, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    allowed_creators = {UserRole.CLIENT.value, UserRole.ORGANIZATION.value, UserRole.MANAGER.value,
                        UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value}
    if user.role not in allowed_creators:
        raise HTTPException(403, "Only clients, organizations and Wulweth managers can post research opportunities")
    if payload.visibility not in {v.value for v in OpportunityVisibility}:
        raise HTTPException(422, "Invalid visibility")

    result = screen_content(f"{payload.title}\n{payload.description}")
    if result["risk"] == RiskLevel.PROHIBITED.value:
        raise HTTPException(422, "This opportunity conflicts with Wulweth's research integrity policy and was not posted.")

    o = Opportunity(created_by=user.id, client_id=user.id if user.role == UserRole.CLIENT.value else None,
                    **payload.model_dump())
    o.risk_level = result["risk"]
    o.screening_note = ", ".join(result["rules"]) or None
    db.add(o)
    if result["risk"] == RiskLevel.POTENTIAL.value:
        case = ModerationCase(case_number=next_number(db, "moderation", "MOD"),
                              content_type=ContentType.OPPORTUNITY.value, content_id=o.id, author_id=user.id,
                              risk_level=result["risk"], triggered_rules=result["rules"], excerpt=result["excerpt"],
                              status=ModerationStatus.PENDING_REVIEW.value)
        db.add(case)
        db.flush()
        db.select  # no-op keep linters calm
    audit(db, request, user, "opportunity.created", "opportunity", o.id, {"visibility": payload.visibility})
    db.commit()
    return _opp_dict(db, o, user)


@router.get("/opportunities/{oid}")
def get_opportunity(oid: str, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    o = db.get(Opportunity, oid)
    if not o or o.deleted_at:
        raise HTTPException(404, "Opportunity not found")
    visible = is_staff(user) or o.created_by == (user.id if user else None) or \
        (o.visibility == OpportunityVisibility.PUBLIC.value)
    if not visible:
        raise HTTPException(404, "Opportunity not found")
    data = _opp_dict(db, o, user)
    if user and is_staff(user):
        interests = db.scalars(select(OpportunityInterest).where(OpportunityInterest.opportunity_id == oid)).all()
        items = []
        for i in interests:
            u = db.get(User, i.professional_id)
            from app.models import ResearcherProfile
            prof = db.scalar(select(ResearcherProfile).where(ResearcherProfile.user_id == i.professional_id))
            items.append(pick(i, "id", "message", "status", "created_at",
                              professional=pick(u, "id", "full_name", "role", "email") if u else None,
                              verification=prof.verification if prof else None))
        data["interests"] = items
    return data


@router.post("/opportunities/{oid}/express-interest", status_code=201)
def express_interest(oid: str, payload: dict, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(require_professional)):
    o = db.get(Opportunity, oid)
    if not o or o.deleted_at or o.status != OpportunityStatus.OPEN.value:
        raise HTTPException(404, "Opportunity not found")
    if o.visibility not in {OpportunityVisibility.PUBLIC.value} and not is_staff(user):
        if o.created_by != user.id:
            raise HTTPException(403, "This opportunity is not open for expressions of interest")
    existing = db.scalar(select(OpportunityInterest).where(
        OpportunityInterest.opportunity_id == oid, OpportunityInterest.professional_id == user.id))
    if existing:
        raise HTTPException(409, "You have already expressed interest in this opportunity")
    interest = OpportunityInterest(opportunity_id=oid, professional_id=user.id,
                                   message=(payload or {}).get("message"), status=InterestStatus.EXPRESSED.value)
    db.add(interest)
    audit(db, request, user, "opportunity.interest", "opportunity", oid)
    creator = db.get(User, o.created_by)
    if creator:
        notify(db, None, creator, "OPPORTUNITY", f"New expression of interest — {o.title}",
               f"{user.full_name} expressed interest in your opportunity.", link="/dashboard/opportunities")
    db.commit()
    return pick(interest, "id", "status", "created_at")


@router.post("/opportunities/{oid}/close")
def close_opportunity(oid: str, payload: dict, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    o = db.get(Opportunity, oid)
    if not o or o.deleted_at:
        raise HTTPException(404, "Opportunity not found")
    if not (is_staff(user) or o.created_by == user.id):
        raise HTTPException(403, "Not permitted")
    o.status = OpportunityStatus.CLOSED.value if (payload or {}).get("close", True) else OpportunityStatus.OPEN.value
    db.commit()
    return {"ok": True, "status": o.status}


# ------------------------------ invitations ----------------------------------

class InviteIn(BaseModel):
    professional_id: str
    message: str | None = Field(default=None, max_length=4000)


@router.post("/opportunities/{oid}/invite", status_code=201)
def invite_professional(oid: str, payload: InviteIn, request: Request, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    o = db.get(Opportunity, oid)
    if not o or o.deleted_at:
        raise HTTPException(404, "Opportunity not found")
    if not (is_staff(user) or o.created_by == user.id):
        raise HTTPException(403, "Not permitted")
    professional = db.get(User, payload.professional_id)
    if not professional or professional.role not in {r.value for r in PROFESSIONAL_ROLES}:
        raise HTTPException(422, "Select a valid research professional")
    existing = db.scalar(select(OpportunityInvitation).where(
        OpportunityInvitation.opportunity_id == oid, OpportunityInvitation.professional_id == professional.id))
    if existing and existing.status == InvitationStatus.PENDING.value:
        raise HTTPException(409, "An invitation is already pending for this professional")
    inv = OpportunityInvitation(opportunity_id=oid, professional_id=professional.id,
                                invited_by=user.id, message=payload.message)
    db.add(inv)
    notify(db, None, professional, "OPPORTUNITY", f"Invitation — {o.title}",
           payload.message or "You have been invited to consider this research opportunity.",
           link="/dashboard/opportunities?view=invitations",
           email_subject=f"Wulweth research opportunity invitation — {o.title}")
    audit(db, request, user, "opportunity.invited", "opportunity_invitation", inv.id)
    db.commit()
    return pick(inv, "id", "status", "sent_at")


@router.get("/my/invitations")
def my_invitations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    invs = db.scalars(select(OpportunityInvitation).where(OpportunityInvitation.professional_id == user.id)
                      .order_by(OpportunityInvitation.sent_at.desc())).all()
    items = []
    for inv in invs:
        o = db.get(Opportunity, inv.opportunity_id)
        inviter = db.get(User, inv.invited_by)
        items.append(pick(inv, "id", "message", "status", "sent_at",
                          opportunity=pick(o, "id", "title", "discipline", "status", "deadline") if o else None,
                          invited_by=inviter.full_name if inviter else None))
    return {"items": items}


@router.post("/invitations/{iid}/respond")
def respond_invitation(iid: str, payload: dict, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    inv = db.get(OpportunityInvitation, iid)
    if not inv or inv.professional_id != user.id:
        raise HTTPException(404, "Invitation not found")
    if inv.status != InvitationStatus.PENDING.value:
        raise HTTPException(409, "This invitation was already handled")
    response = (payload or {}).get("response")
    if response == "accept":
        inv.status = InvitationStatus.ACCEPTED.value
        o = db.get(Opportunity, inv.opportunity_id)
        creator = db.get(User, o.created_by)
        if creator:
            notify(db, None, creator, "OPPORTUNITY", f"Invitation accepted — {o.title}",
                   f"{user.full_name} accepted your invitation.", link="/dashboard/opportunities")
    elif response == "decline":
        inv.status = InvitationStatus.DECLINED.value
    else:
        raise HTTPException(422, "response must be accept or decline")
    inv.responded_at = datetime.now(timezone.utc)
    audit(db, request, user, "opportunity.invitation_responded", "opportunity_invitation", inv.id,
          {"response": response})
    db.commit()
    return {"ok": True, "status": inv.status}
