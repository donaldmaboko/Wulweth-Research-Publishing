"""Wulweth Research & Publishing — relational model (PostgreSQL).

Conventions:
- UUID primary keys (native UUID on PostgreSQL).
- Timestamps are timezone-aware (created_at / updated_at); soft deletion via
  deleted_at where historical data must be retained.
- Money is Numeric(12,2) with CHECK constraints guarding non-negative amounts.
- Status columns are short strings validated in application code / Pydantic.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now, nullable=False
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Identity & access
# ---------------------------------------------------------------------------

class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False, index=True)  # primary role
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    professional_title: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    country: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(80))
    language: Mapped[str] = mapped_column(String(40), default="English")
    timezone: Mapped[str | None] = mapped_column(String(60))
    bio: Mapped[str | None] = mapped_column(Text)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notification_prefs: Mapped[dict] = mapped_column(JSONB, default=dict)

    roles = relationship("UserRoleLink", back_populates="user", cascade="all, delete-orphan", foreign_keys="UserRoleLink.user_id")
    researcher_profile = relationship("ResearcherProfile", back_populates="user", uselist=False)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    description: Mapped[str | None] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[str] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )


class UserRoleLink(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    granted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    user = relationship("User", back_populates="roles", foreign_keys=[user_id])


class AuthEvent(Base):
    """Password resets, email verifications, suspicious-auth audit trail."""
    __tablename__ = "auth_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    event: Mapped[str] = mapped_column(String(40), nullable=False)
    token_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------

class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    org_type: Mapped[str | None] = mapped_column(String(60))  # Company / NGO / University / Government / Healthcare / Research Institution
    industry: Mapped[str | None] = mapped_column(String(120))
    website: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(80))
    verification: Mapped[str] = mapped_column(String(20), default="UNVERIFIED")
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_member"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    member_role: Mapped[str] = mapped_column(String(20), default="MEMBER")
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    invited_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


class ClientProfile(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"))
    display_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------------------
# Research taxonomy & services
# ---------------------------------------------------------------------------

class ResearchField(Base, TimestampMixin):
    """Discipline taxonomy: group (e.g. Health Sciences) + field (e.g. Epidemiology)."""
    __tablename__ = "research_fields"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    group: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Service(Base, TimestampMixin):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    category: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    deliverables_examples: Mapped[list] = mapped_column(JSONB, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    fee_percent_override: Mapped[float | None] = mapped_column(Float)


# ---------------------------------------------------------------------------
# Research professionals
# ---------------------------------------------------------------------------

class ResearcherProfile(Base, TimestampMixin):
    __tablename__ = "researcher_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    professional_title: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
    disciplines: Mapped[list] = mapped_column(JSONB, default=list)       # discipline groups
    research_field_ids: Mapped[list] = mapped_column(JSONB, default=list)
    expertise: Mapped[list] = mapped_column(JSONB, default=list)         # free-text expertise areas
    methodologies: Mapped[list] = mapped_column(JSONB, default=list)
    statistical_methods: Mapped[list] = mapped_column(JSONB, default=list)
    software: Mapped[list] = mapped_column(JSONB, default=list)
    industries: Mapped[list] = mapped_column(JSONB, default=list)
    languages: Mapped[list] = mapped_column(JSONB, default=list)
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    publications_count: Mapped[int] = mapped_column(Integer, default=0)
    availability: Mapped[str] = mapped_column(String(20), default="PART_TIME")
    location: Mapped[str | None] = mapped_column(String(160))
    verification: Mapped[str] = mapped_column(String(20), default="UNVERIFIED")
    verification_note: Mapped[str | None] = mapped_column(Text)
    profile_status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    services_offer_slugs: Mapped[list] = mapped_column(JSONB, default=list)

    user = relationship("User", back_populates="researcher_profile")
    qualifications = relationship("Qualification", back_populates="profile", cascade="all, delete-orphan")
    publications = relationship("Publication", back_populates="profile", cascade="all, delete-orphan")
    portfolio = relationship("PortfolioItem", back_populates="profile", cascade="all, delete-orphan")


class ResearcherExpertise(Base):
    __tablename__ = "researcher_expertise"
    __table_args__ = (UniqueConstraint("profile_id", "research_field_id", name="uq_profile_field"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("researcher_profiles.id", ondelete="CASCADE"), index=True)
    research_field_id: Mapped[str] = mapped_column(ForeignKey("research_fields.id"), index=True)
    level: Mapped[str] = mapped_column(String(20), default="ADVANCED")  # CORE | ADVANCED | FAMILIAR


class Qualification(Base, TimestampMixin):
    __tablename__ = "qualifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("researcher_profiles.id", ondelete="CASCADE"), index=True)
    degree: Mapped[str] = mapped_column(String(200), nullable=False)
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    field_of_study: Mapped[str | None] = mapped_column(String(200))
    year: Mapped[int | None] = mapped_column(Integer)
    document_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("documents.id", ondelete="SET NULL"))
    verification: Mapped[str] = mapped_column(String(20), default="UNVERIFIED")
    verified_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profile = relationship("ResearcherProfile", back_populates="qualifications")


class Publication(Base, TimestampMixin):
    __tablename__ = "publications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("researcher_profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    journal: Mapped[str | None] = mapped_column(String(300))
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    pub_type: Mapped[str | None] = mapped_column(String(60))  # Journal Article / Conference Paper / Report / Book Chapter
    doi: Mapped[str | None] = mapped_column(String(160))
    url: Mapped[str | None] = mapped_column(String(400))
    description: Mapped[str | None] = mapped_column(Text)

    profile = relationship("ResearcherProfile", back_populates="publications")


class PortfolioItem(Base, TimestampMixin):
    __tablename__ = "portfolio_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("researcher_profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    discipline: Mapped[str | None] = mapped_column(String(160))
    methods: Mapped[list] = mapped_column(JSONB, default=list)
    year: Mapped[int | None] = mapped_column(Integer)
    link: Mapped[str | None] = mapped_column(String(400))
    moderation_status: Mapped[str] = mapped_column(String(30), default="PUBLISHED")

    profile = relationship("ResearcherProfile", back_populates="portfolio")


class VerificationRecord(Base):
    __tablename__ = "verification_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    record_type: Mapped[str] = mapped_column(String(40))  # EMAIL / QUALIFICATION / IDENTITY / EMPLOYMENT
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    notes: Mapped[str | None] = mapped_column(Text)
    document_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("documents.id", ondelete="SET NULL"))
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------------------
# Research requests & projects
# ---------------------------------------------------------------------------

def _ck_nonneg(*cols: str) -> CheckConstraint:
    return CheckConstraint(" AND ".join(f"{c} >= 0" for c in cols), name="ck_nonneg_" + "_".join(cols))


class ResearchRequest(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "research_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    # Assigned when the request is submitted (drafts have no tracking ID yet)
    tracking_id: Mapped[str | None] = mapped_column(String(40), unique=True, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    discipline: Mapped[str | None] = mapped_column(String(120), index=True)
    research_field_id: Mapped[str | None] = mapped_column(ForeignKey("research_fields.id"))
    service_id: Mapped[str | None] = mapped_column(ForeignKey("services.id"))
    objective: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    methodology: Mapped[str | None] = mapped_column(Text)
    data_availability: Mapped[str | None] = mapped_column(String(60))  # HAVE_DATA / NEED_SUPPORT / NOT_YET
    data_description: Mapped[str | None] = mapped_column(Text)
    expected_deliverables: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    budget_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    budget_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    preferred_expertise: Mapped[str | None] = mapped_column(Text)
    confidentiality_note: Mapped[str | None] = mapped_column(Text)
    additional_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="DRAFT", index=True)
    risk_level: Mapped[str | None] = mapped_column(String(20))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id", use_alter=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    review_note: Mapped[str | None] = mapped_column(Text)


class Project(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tracking_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    request_id: Mapped[str | None] = mapped_column(ForeignKey("research_requests.id", ondelete="SET NULL"))
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"))
    service_id: Mapped[str | None] = mapped_column(ForeignKey("services.id"))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="REQUEST_SUBMITTED", index=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    quoted_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    fee_percent: Mapped[float | None] = mapped_column(Float)
    fee_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    funds_status: Mapped[str] = mapped_column(String(30), default="NONE", index=True)
    assigned_professional_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confidentiality_level: Mapped[str] = mapped_column(String(20), default="STANDARD")

    assignments = relationship("ProjectAssignment", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan")
    status_history = relationship("ProjectStatusHistory", back_populates="project", cascade="all, delete-orphan")


class ProjectAssignment(Base, TimestampMixin):
    __tablename__ = "project_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    professional_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    assigned_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role_on_project: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="ASSIGNED")
    note: Mapped[str | None] = mapped_column(Text)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project = relationship("Project", back_populates="assignments")
    professional = relationship("User", foreign_keys=[professional_id])


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    position: Mapped[int] = mapped_column(Integer, default=0)

    project = relationship("Project", back_populates="milestones")


class ProjectStatusHistory(Base):
    __tablename__ = "project_status_history"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(40))
    to_status: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    system_trigger: Mapped[str | None] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    project = relationship("Project", back_populates="status_history")


# ---------------------------------------------------------------------------
# Documents & deliverables
# ---------------------------------------------------------------------------

class Document(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    kind: Mapped[str] = mapped_column(String(40), default="OTHER")
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    request_id: Mapped[str | None] = mapped_column(ForeignKey("research_requests.id", ondelete="CASCADE"), index=True)
    profile_id: Mapped[str | None] = mapped_column(String(36), index=True)
    filename: Mapped[str] = mapped_column(String(400), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(160))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING / CLEAN / INFECTED
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    copyright_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)


class DocumentPermission(Base):
    __tablename__ = "document_permissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str | None] = mapped_column(String(40))
    level: Mapped[str] = mapped_column(String(20), default="READ")  # READ | MANAGE


class Deliverable(Base, TimestampMixin):
    __tablename__ = "deliverables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    current_version_number: Mapped[int] = mapped_column(Integer, default=0)

    versions = relationship("DeliverableVersion", back_populates="deliverable", cascade="all, delete-orphan")


class DeliverableVersion(Base):
    __tablename__ = "deliverable_versions"
    __table_args__ = (UniqueConstraint("deliverable_id", "version_number", name="uq_deliverable_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    deliverable_id: Mapped[str] = mapped_column(ForeignKey("deliverables.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="RESTRICT"))
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="SUBMITTED")
    copyright_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    deliverable = relationship("Deliverable", back_populates="versions")
    document = relationship("Document")


class QCReview(Base):
    __tablename__ = "qc_reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    deliverable_version_id: Mapped[str] = mapped_column(
        ForeignKey("deliverable_versions.id", ondelete="CASCADE"), index=True
    )
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(30), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    checklist: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    version = relationship("DeliverableVersion")
    reviewer = relationship("User")


class QCComment(Base):
    __tablename__ = "qc_comments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    version_id: Mapped[str] = mapped_column(ForeignKey("deliverable_versions.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    author = relationship("User")


# ---------------------------------------------------------------------------
# Commercial: quotes, invoices, payments, payouts
# ---------------------------------------------------------------------------

class Quote(Base, TimestampMixin):
    __tablename__ = "quotes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    quote_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    request_id: Mapped[str | None] = mapped_column(ForeignKey("research_requests.id", ondelete="SET NULL"))
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    prepared_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_percent: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan", order_by="QuoteItem.position")


class QuoteItem(Base):
    __tablename__ = "quote_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    quote_id: Mapped[str] = mapped_column(ForeignKey("quotes.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[str | None] = mapped_column(ForeignKey("services.id"))
    description: Mapped[str] = mapped_column(String(400), nullable=False)
    deliverables_text: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)

    quote = relationship("Quote", back_populates="items")


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    invoice_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    quote_id: Mapped[str | None] = mapped_column(ForeignKey("quotes.id", ondelete="SET NULL"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    issued_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_percent: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", index=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.position")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(400), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)

    invoice = relationship("Invoice", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    method: Mapped[str] = mapped_column(String(30), default="BANK_TRANSFER")
    provider: Mapped[str] = mapped_column(String(30), default="manual")  # manual | stripe
    provider_ref: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    confirmed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    _ck = _ck_nonneg("amount")


class PaymentTransaction(Base):
    """Immutable financial ledger."""
    __tablename__ = "payment_transactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str | None] = mapped_column(String(36), index=True)
    payment_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("payments.id", ondelete="SET NULL"))
    payout_id: Mapped[str | None] = mapped_column(String(36))
    entry_type: Mapped[str] = mapped_column(String(30), nullable=False)  # CHARGE / FEE / PAYOUT / REFUND
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    status: Mapped[str] = mapped_column(String(20), default="RECORDED")
    provider: Mapped[str | None] = mapped_column(String(30))
    provider_ref: Mapped[str | None] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    _ck = _ck_nonneg("amount")


class Payout(Base):
    __tablename__ = "payouts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    payout_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    professional_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    gross_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    fee_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    processing_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    method: Mapped[str | None] = mapped_column(String(40))
    destination: Mapped[str | None] = mapped_column(String(200))
    transaction_ref: Mapped[str | None] = mapped_column(String(160))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("gross_amount >= 0 AND net_amount >= 0 AND fee_amount >= 0", name="ck_payout_amounts_nonneg"),
    )


# ---------------------------------------------------------------------------
# Communication
# ---------------------------------------------------------------------------

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True)
    subject: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_convo_participant"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str | None] = mapped_column(Text)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)

    sender = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


# ---------------------------------------------------------------------------
# Research feed
# ---------------------------------------------------------------------------

class FeedCategory(Base, TimestampMixin):
    __tablename__ = "feed_categories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class FeedPost(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "feed_posts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("feed_categories.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PUBLISHED", index=True)
    risk_level: Mapped[str | None] = mapped_column(String(20))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author = relationship("User")
    category = relationship("FeedCategory")


class FeedComment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "feed_comments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    post_id: Mapped[str] = mapped_column(ForeignKey("feed_posts.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PUBLISHED")

    author = relationship("User")


class FeedReaction(Base):
    __tablename__ = "feed_reactions"
    __table_args__ = (UniqueConstraint("post_id", "user_id", "reaction", name="uq_post_user_reaction"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    post_id: Mapped[str] = mapped_column(ForeignKey("feed_posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reaction: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------------------
# Opportunities, matching & invitations
# ---------------------------------------------------------------------------

class Opportunity(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "opportunities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    client_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"))
    discipline: Mapped[str | None] = mapped_column(String(120), index=True)
    research_field_id: Mapped[str | None] = mapped_column(ForeignKey("research_fields.id"))
    service_id: Mapped[str | None] = mapped_column(ForeignKey("services.id"))
    required_expertise: Mapped[list] = mapped_column(JSONB, default=list)
    methodology: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(30), default="PUBLIC", index=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_timeline: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(160))
    risk_level: Mapped[str | None] = mapped_column(String(20))
    screening_note: Mapped[str | None] = mapped_column(Text)


class OpportunityInterest(Base):
    __tablename__ = "opportunity_interests"
    __table_args__ = (UniqueConstraint("opportunity_id", "professional_id", name="uq_opp_interest"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    professional_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="EXPRESSED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class OpportunityInvitation(Base):
    __tablename__ = "opportunity_invitations"
    __table_args__ = (UniqueConstraint("opportunity_id", "professional_id", name="uq_opp_invitation"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    professional_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    invited_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------------------
# Moderation, integrity, copyright
# ---------------------------------------------------------------------------

class ModerationCase(Base):
    __tablename__ = "moderation_cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    content_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    author_id: Mapped[str | None] = mapped_column(String(36), index=True)
    risk_level: Mapped[str] = mapped_column(String(20), default="POTENTIAL")
    triggered_rules: Mapped[list] = mapped_column(JSONB, default=list)
    excerpt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_REVIEW", index=True)
    assigned_to: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    decided_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    decision_reason: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    actions = relationship("ModerationAction", back_populates="case", cascade="all, delete-orphan")


class ModerationAction(Base):
    __tablename__ = "moderation_actions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("moderation_cases.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    case = relationship("ModerationCase", back_populates="actions")


class Report(Base):
    """User-submitted reports: research integrity, copyright, spam."""
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), index=True)  # INTEGRITY / COPYRIGHT / SPAM / OTHER
    reporter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    content_type: Mapped[str | None] = mapped_column(String(40))
    content_id: Mapped[str | None] = mapped_column(String(36), index=True)
    content_url: Mapped[str | None] = mapped_column(String(400))
    details: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Review(Base):
    """Structured post-project feedback (professionalism-focused, not public star ratings)."""
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("project_id", "author_id", name="uq_review_project_author"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    subject_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    professionalism: Mapped[int | None] = mapped_column(Integer)
    communication: Mapped[int | None] = mapped_column(Integer)
    quality: Mapped[int | None] = mapped_column(Integer)
    timeliness: Mapped[int | None] = mapped_column(Integer)
    expertise: Mapped[int | None] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text)
    private_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str | None] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(60), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_by: Mapped[str | None] = mapped_column(String(36))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Counter(Base):
    """Atomic counters for human-readable identifiers (WUL-2026-000124 …)."""
    __tablename__ = "counters"
    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)


class EmailLog(Base):
    __tablename__ = "email_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    to_email: Mapped[str] = mapped_column(String(320), index=True)
    subject: Mapped[str] = mapped_column(String(400))
    body: Mapped[str | None] = mapped_column(Text)
    template: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="SENT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# Convenience indexes for common filters
Index("ix_projects_client_status", Project.client_id, Project.status)
Index("ix_requests_client_status", ResearchRequest.client_id, ResearchRequest.status)
Index("ix_notifications_user_unread", Notification.user_id, Notification.read_at)
