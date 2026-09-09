// ---------------------------------------------------------------------------
// Domain enums & metadata. SQLite stores these as TEXT (see db/schema.sql);
// production PostgreSQL uses native ENUMs (docs/01-database-schema.md).
// ---------------------------------------------------------------------------

export type Role = "CLIENT" | "FREELANCER" | "ADMIN";

export const ROLES: Role[] = ["CLIENT", "FREELANCER", "ADMIN"];

export type ProjectStatus =
  | "PENDING"
  | "QUOTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "PAID_OUT"
  | "CANCELLED";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "PENDING",
  "QUOTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "COMPLETED",
  "PAID_OUT",
  "CANCELLED",
];

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; hint: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    hint: "Request received — awaiting review and quotation by our team.",
    className: "bg-stone-100 text-stone-700 ring-stone-300",
  },
  QUOTED: {
    label: "Quoted",
    hint: "A quote is ready — approve and pay to move into production.",
    className: "bg-amber-50 text-amber-800 ring-amber-300",
  },
  ASSIGNED: {
    label: "Assigned",
    hint: "Matched with a vetted researcher — work is starting.",
    className: "bg-sky-50 text-sky-800 ring-sky-300",
  },
  IN_PROGRESS: {
    label: "In progress",
    hint: "Your researcher is actively working on this project.",
    className: "bg-indigo-50 text-indigo-800 ring-indigo-300",
  },
  UNDER_REVIEW: {
    label: "Under review",
    hint: "Deliverables submitted — our QA team is reviewing before sign-off.",
    className: "bg-violet-50 text-violet-800 ring-violet-300",
  },
  COMPLETED: {
    label: "Completed",
    hint: "Work passed quality control — payout is being arranged.",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  },
  PAID_OUT: {
    label: "Paid out",
    hint: "Delivered, approved and fully settled. Funds released.",
    className: "bg-teal-900/10 text-teal-900 ring-teal-800/30",
  },
  CANCELLED: {
    label: "Cancelled",
    hint: "This project was cancelled.",
    className: "bg-rose-50 text-rose-800 ring-rose-300",
  },
};

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOID";
export type PaymentMethod = "CARD" | "BANK_TRANSFER";
export type PaymentStatus = "ESCROWED" | "RELEASED" | "REFUNDED";
export type DeliverableStatus = "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED";
export type PayoutStatus = "PROCESSING" | "PAID";
export type FeedPostType = "ANNOUNCEMENT" | "TREND" | "JOB" | "COMPLETED_PROJECT";
export type QuoteStatus = "NEW" | "CONVERTED" | "ARCHIVED";

// ---------------------------------------------------------------------------
// The USP: research disciplines — the platform is exclusively for research.
// ---------------------------------------------------------------------------

export const DISCIPLINES = [
  "Medical & Health Research",
  "Social Sciences",
  "STEM",
  "Data Visualization & Analytics",
  "Humanities & Literature",
  "Business & Economics",
  "Environmental Studies",
  "Education Research",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  ESCROWED: { label: "Held in escrow", className: "bg-amber-50 text-amber-800 ring-amber-300" },
  RELEASED: { label: "Released", className: "bg-emerald-50 text-emerald-800 ring-emerald-300" },
  REFUNDED: { label: "Refunded", className: "bg-rose-50 text-rose-800 ring-rose-300" },
};

export const DELIVERABLE_STATUS_META: Record<DeliverableStatus, { label: string; className: string }> = {
  SUBMITTED: { label: "Awaiting QC", className: "bg-amber-50 text-amber-800 ring-amber-300" },
  APPROVED: { label: "QC approved", className: "bg-emerald-50 text-emerald-800 ring-emerald-300" },
  REVISION_REQUESTED: { label: "Revision requested", className: "bg-rose-50 text-rose-800 ring-rose-300" },
};

export const FEED_TYPE_META: Record<FeedPostType, { label: string; className: string }> = {
  ANNOUNCEMENT: { label: "Announcement", className: "bg-indigo-50 text-indigo-800 ring-indigo-300" },
  TREND: { label: "Research trend", className: "bg-sky-50 text-sky-800 ring-sky-300" },
  JOB: { label: "Job posting", className: "bg-emerald-50 text-emerald-800 ring-emerald-300" },
  COMPLETED_PROJECT: { label: "Completed project", className: "bg-stone-100 text-stone-700 ring-stone-300" },
};
