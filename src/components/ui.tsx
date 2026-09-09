import Link from "next/link";
import type { ReactNode } from "react";
import { PROJECT_STATUS_META, type ProjectStatus } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status] ?? PROJECT_STATUS_META.PENDING;
  return <span className={`pill ${meta.className}`}>{meta.label}</span>;
}

export function Pill({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`pill ${className}`}>{children}</span>;
}

export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="card h-full p-4 transition hover:border-ink-900/20">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-ink-950">{value}</div>
      {hint ? <div className="mt-1 text-xs text-ink-500">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-10 text-center">
      <div className="font-display text-lg font-semibold text-ink-800">{title}</div>
      {body ? <div className="max-w-md text-sm text-ink-500">{body}</div> : null}
    </div>
  );
}

export function WulwethMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="9" className="fill-ink-950" />
      <path
        d="M8 12l4.2 15L20 14.5 27.8 27 32 12"
        fill="none"
        stroke="#ddbd72"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="31.5" r="2" className="fill-gold-400" />
    </svg>
  );
}
