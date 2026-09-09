import Link from "next/link";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";

type Quote = {
  id: string; ref: string; discipline: string; details: string; status: string;
  budget_cents: number | null; deadline: string | null; created_at: string;
  service_name: string | null; project_id: string | null;
};

export default async function MyQuotesPage() {
  const user = await requireRole("CLIENT");

  const quotes = all<Quote>(
    `SELECT q.id, q.ref, q.discipline, q.details, q.status, q.budget_cents, q.deadline,
            q.created_at, q.project_id, s.name AS service_name
     FROM quote_requests q LEFT JOIN services s ON s.id = q.service_id
     WHERE lower(q.email) = lower(?)
     ORDER BY q.created_at DESC`,
    user.email
  );

  return (
    <div>
      <PageHeader
        title="My quote requests"
        subtitle="Quote briefs submitted with this email address — including before you had an account."
      />
      {quotes.length === 0 ? (
        <EmptyState
          title="No quote requests yet"
          body="Use the public Get a Quote form, or submit a structured request from 'New research request'."
        />
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => (
            <Card key={q.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-700">{q.ref}</span>
                  <span className={`pill ${q.status === "NEW" ? "bg-amber-50 text-amber-800 ring-amber-300"
                    : q.status === "CONVERTED" ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                    : "bg-stone-100 text-stone-600 ring-stone-300"}`}>
                    {q.status === "NEW" ? "With our desk" : q.status === "CONVERTED" ? "Converted to project" : q.status}
                  </span>
                </div>
                <span className="text-xs text-ink-500">{fmtDate(q.created_at)}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-ink-950">
                {q.service_name ?? "General research request"} · {q.discipline}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink-600">{q.details}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
                {q.budget_cents ? <span>Indicative budget {money(q.budget_cents)}</span> : null}
                {q.deadline ? <span>Deadline {fmtDate(q.deadline)}</span> : null}
              </div>
              {q.project_id ? (
                <Link href={`/portal/projects/${q.project_id}`} className="btn-secondary btn-sm mt-3">
                  Open the project →
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
