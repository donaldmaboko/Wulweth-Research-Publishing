"""Shared enums used across the platform.

Values are persisted as short strings for portability; every write path goes
through Pydantic validation or explicit checks in the routers/services.
"""
from __future__ import annotations

from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover
        return self.value


class UserRole(StrEnum):
    CLIENT = "CLIENT"
    RESEARCHER = "RESEARCHER"
    RESEARCH_CONSULTANT = "RESEARCH_CONSULTANT"
    DATA_SPECIALIST = "DATA_SPECIALIST"
    EDITOR = "EDITOR"
    ORGANIZATION = "ORGANIZATION"
    MANAGER = "MANAGER"
    QC_REVIEWER = "QC_REVIEWER"
    FINANCE = "FINANCE"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


# Roles that perform professional research work
PROFESSIONAL_ROLES = {
    UserRole.RESEARCHER,
    UserRole.RESEARCH_CONSULTANT,
    UserRole.DATA_SPECIALIST,
    UserRole.EDITOR,
}

# Internal (staff) roles
STAFF_ROLES = {
    UserRole.MANAGER,
    UserRole.QC_REVIEWER,
    UserRole.FINANCE,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
}


class UserStatus(StrEnum):
    PENDING = "PENDING"  # email not verified
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class VerificationStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"


class RequestStatus(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED"
    QUOTED = "QUOTED"
    CONVERTED = "CONVERTED"
    DECLINED = "DECLINED"


class ProjectStatus(StrEnum):
    REQUEST_SUBMITTED = "REQUEST_SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    QUOTE_PREPARED = "QUOTE_PREPARED"
    AWAITING_CLIENT_APPROVAL = "AWAITING_CLIENT_APPROVAL"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    PROFESSIONAL_ASSIGNED = "PROFESSIONAL_ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    QUALITY_REVIEW = "QUALITY_REVIEW"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    PAYMENT_RELEASED = "PAYMENT_RELEASED"
    CANCELLED = "CANCELLED"


class FundsStatus(StrEnum):
    NONE = "NONE"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PENDING_RELEASE = "PENDING_RELEASE"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"


class QuoteStatus(StrEnum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    VIEWED = "VIEWED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class InvoiceStatus(StrEnum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    VIEWED = "VIEWED"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    VOID = "VOID"


class PaymentStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentMethod(StrEnum):
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    MOBILE_MONEY = "MOBILE_MONEY"
    OTHER = "OTHER"


class PayoutStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DeliverableStatus(StrEnum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    IN_REVISION = "IN_REVISION"
    APPROVED = "APPROVED"
    FINAL = "FINAL"


class VersionStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    APPROVED = "APPROVED"


class QCDecision(StrEnum):
    APPROVED = "APPROVED"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    REJECTED = "REJECTED"


class MilestoneStatus(StrEnum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class AssignmentStatus(StrEnum):
    ASSIGNED = "ASSIGNED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    REMOVED = "REMOVED"


class DocumentKind(StrEnum):
    REQUEST_ATTACHMENT = "REQUEST_ATTACHMENT"
    PROJECT_DOCUMENT = "PROJECT_DOCUMENT"
    DELIVERABLE = "DELIVERABLE"
    QUALIFICATION = "QUALIFICATION"
    INVOICE_DOCUMENT = "INVOICE_DOCUMENT"
    MESSAGE_ATTACHMENT = "MESSAGE_ATTACHMENT"
    OTHER = "OTHER"


class DocumentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"
    FLAGGED = "FLAGGED"
    REMOVED = "REMOVED"


class RiskLevel(StrEnum):
    LOW = "LOW"
    POTENTIAL = "POTENTIAL"
    PROHIBITED = "PROHIBITED"


class ModerationStatus(StrEnum):
    PENDING_REVIEW = "PENDING_REVIEW"
    CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED"
    CLEARED = "CLEARED"
    REJECTED = "REJECTED"
    RESTRICTED = "RESTRICTED"


class ContentType(StrEnum):
    RESEARCH_REQUEST = "RESEARCH_REQUEST"
    PROJECT_DESCRIPTION = "PROJECT_DESCRIPTION"
    PROFESSIONAL_PROFILE = "PROFESSIONAL_PROFILE"
    PORTFOLIO_ITEM = "PORTFOLIO_ITEM"
    OPPORTUNITY = "OPPORTUNITY"
    FEED_POST = "FEED_POST"
    FEED_COMMENT = "FEED_COMMENT"
    DOCUMENT = "DOCUMENT"


class ModerationActionType(StrEnum):
    OPENED = "OPENED"
    AUTO_FLAGGED = "AUTO_FLAGGED"
    CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED"
    CLEARED = "CLEARED"
    REJECTED = "REJECTED"
    RESTRICTED = "RESTRICTED"
    NOTE_ADDED = "NOTE_ADDED"


class OpportunityVisibility(StrEnum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"
    INVITATION_ONLY = "INVITATION_ONLY"
    DIRECT_ASSIGNMENT = "DIRECT_ASSIGNMENT"


class OpportunityStatus(StrEnum):
    OPEN = "OPEN"
    FILLED = "FILLED"
    CLOSED = "CLOSED"


class InterestStatus(StrEnum):
    EXPRESSED = "EXPRESSED"
    SHORTLISTED = "SHORTLISTED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class InvitationStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    WITHDRAWN = "WITHDRAWN"


class OrgMemberRole(StrEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    MEMBER = "MEMBER"


class ReportKind(StrEnum):
    INTEGRITY = "INTEGRITY"
    COPYRIGHT = "COPYRIGHT"
    SPAM = "SPAM"
    OTHER = "OTHER"


class ReportStatus(StrEnum):
    OPEN = "OPEN"
    REVIEWING = "REVIEWING"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class PostStatus(StrEnum):
    PUBLISHED = "PUBLISHED"
    PENDING_REVIEW = "PENDING_REVIEW"
    REJECTED = "REJECTED"
    REMOVED = "REMOVED"


class Availability(StrEnum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    UNAVAILABLE = "UNAVAILABLE"


class ProfileStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class ReactionType(StrEnum):
    INSIGHTFUL = "INSIGHTFUL"
    HELPFUL = "HELPFUL"
    RECOMMEND = "RECOMMEND"
    CONGRATULATIONS = "CONGRATULATIONS"


class TransactionType(StrEnum):
    CHARGE = "CHARGE"
    PAYOUT = "PAYOUT"
    REFUND = "REFUND"
    FEE = "FEE"


class NotificationType(StrEnum):
    REQUEST = "REQUEST"
    QUOTE = "QUOTE"
    PAYMENT = "PAYMENT"
    ASSIGNMENT = "ASSIGNMENT"
    PROJECT = "PROJECT"
    MESSAGE = "MESSAGE"
    DELIVERABLE = "DELIVERABLE"
    QC = "QC"
    PAYOUT = "PAYOUT"
    MODERATION = "MODERATION"
    INTEGRITY = "INTEGRITY"
    OPPORTUNITY = "OPPORTUNITY"
    ACCOUNT = "ACCOUNT"


# Allowed project status transitions (workflow from the product specification)
PROJECT_TRANSITIONS: dict[str, set[str]] = {
    ProjectStatus.REQUEST_SUBMITTED.value: {
        ProjectStatus.UNDER_REVIEW.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.UNDER_REVIEW.value: {
        ProjectStatus.QUOTE_PREPARED.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.QUOTE_PREPARED.value: {
        ProjectStatus.AWAITING_CLIENT_APPROVAL.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.AWAITING_CLIENT_APPROVAL.value: {
        ProjectStatus.PAYMENT_PENDING.value,
        ProjectStatus.UNDER_REVIEW.value,  # quote rejected -> back to review
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.PAYMENT_PENDING.value: {
        ProjectStatus.PAYMENT_CONFIRMED.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.PAYMENT_CONFIRMED.value: {
        ProjectStatus.PROFESSIONAL_ASSIGNED.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.PROFESSIONAL_ASSIGNED.value: {
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.IN_PROGRESS.value: {
        ProjectStatus.SUBMITTED.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.SUBMITTED.value: {
        ProjectStatus.QUALITY_REVIEW.value,
        ProjectStatus.REVISION_REQUIRED.value,
        ProjectStatus.APPROVED.value,
    },
    ProjectStatus.QUALITY_REVIEW.value: {
        ProjectStatus.REVISION_REQUIRED.value,
        ProjectStatus.APPROVED.value,
    },
    ProjectStatus.REVISION_REQUIRED.value: {
        ProjectStatus.IN_PROGRESS.value,
        ProjectStatus.SUBMITTED.value,
        ProjectStatus.CANCELLED.value,
    },
    ProjectStatus.APPROVED.value: {
        ProjectStatus.COMPLETED.value,
    },
    ProjectStatus.COMPLETED.value: {
        ProjectStatus.PAYMENT_RELEASED.value,
    },
}
