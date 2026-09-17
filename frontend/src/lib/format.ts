/** Formatting + status vocabulary shared across the platform UI. */

export function money(amount: number | string | null | undefined, currency = "USD"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, string> = {
  REQUEST_SUBMITTED: "Request Submitted",
  UNDER_REVIEW: "Under Review",
  QUOTE_PREPARED: "Quote Prepared",
  AWAITING_CLIENT_APPROVAL: "Awaiting Client Approval",
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  PROFESSIONAL_ASSIGNED: "Professional Assigned",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  QUALITY_REVIEW: "Quality Review",
  REVISION_REQUIRED: "Revision Required",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  PAYMENT_RELEASED: "Payment Released",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  CLARIFICATION_REQUESTED: "Clarification Requested",
  QUOTED: "Quoted",
  CONVERTED: "Converted",
  DECLINED: "Declined",
  SENT: "Sent",
  VIEWED: "Viewed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  ACTIVE: "Active",
  ASSIGNED: "Assigned",
  REMOVED: "Removed",
  IN_REVISION: "In Revision",
  FINAL: "Final",
  PENDING_RELEASE: "Funds Pending Release",
  RELEASED: "Payment Released",
  PAYMENT_PENDING_FUNDS: "Payment Pending",
  NONE: "No Payment Yet",
  OPEN: "Open",
  FILLED: "Filled",
  CLOSED: "Closed",
  PENDING_REVIEW: "Pending Review",
  CLEARED: "Cleared",
  RESTRICTED: "Restricted",
  PUBLISHED: "Published",
  VERIFIED: "Verified",
  UNVERIFIED: "Unverified",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  UNAVAILABLE: "Unavailable",
  LOW: "Low",
  POTENTIAL: "Potential Risk",
  PROHIBITED: "Prohibited",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
  REVIEWING: "Reviewing",
  SUSPENDED: "Suspended",
  HAVE_DATA: "Have Data",
  NEED_SUPPORT: "Needs Data Support",
  NOT_YET: "Not Yet Collected",
  DONE: "Done",
};

export const statusLabel = (status: string | null | undefined) =>
  status ? STATUS_LABELS[status] ?? status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

export const PROJECT_FLOW: string[] = [
  "REQUEST_SUBMITTED",
  "UNDER_REVIEW",
  "QUOTE_PREPARED",
  "AWAITING_CLIENT_APPROVAL",
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "PROFESSIONAL_ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "QUALITY_REVIEW",
  "APPROVED",
  "COMPLETED",
  "PAYMENT_RELEASED",
];

// Tailwind classes per status family
export function statusTone(status: string): string {
  if (["PAYMENT_RELEASED", "COMPLETED", "APPROVED", "PAID", "CONFIRMED", "CLEARED", "VERIFIED", "RELEASED", "RESOLVED", "PUBLISHED"].includes(status))
    return "bg-teal-50 text-teal-700 ring-teal-200";
  if (["IN_PROGRESS", "ACTIVE", "SENT", "VIEWED", "OPEN", "SUBMITTED", "ASSIGNED", "PUBLISHED"].includes(status))
    return "bg-ink-50 text-ink-600 ring-ink-200";
  if (["PAYMENT_PENDING", "AWAITING_CLIENT_APPROVAL", "PENDING", "PENDING_REVIEW", "QUALITY_REVIEW", "DRAFT", "QUOTE_PREPARED", "REQUEST_SUBMITTED", "UNDER_REVIEW", "PROFESSIONAL_ASSIGNED", "REVIEWING", "CLARIFICATION_REQUESTED", "QUOTED", "POTENTIAL"].includes(status))
    return "bg-gold-100/60 text-gold-600 ring-gold-400/40";
  if (["REVISION_REQUIRED", "REJECTED", "DECLINED", "PROHIBITED", "RESTRICTED", "SUSPENDED", "OVERDUE", "EXPIRED", "CLOSED"].includes(status))
    return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["CANCELLED", "VOID", "FAILED", "REMOVED"].includes(status))
    return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-ink-50 text-ink-600 ring-ink-200";
}
