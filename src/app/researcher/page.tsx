import Link from "next/link";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { daysUntil, fmtDate, money } from "@/lib/format";
import { Card, EmptyState, Stat, StatusPill } from "@/components/ui";
import { StartWorkButton } from "@/components/researcher-actions";
import type { ProjectStatus } from "@/lib/types";

type Assignment = {
  id: string; tracking_id: string; title: string; status: ProjectStatus; discipline: string;
  deadline: string | null; agreed_cents: number | null; service_name: string; client_name: string;
  qc_note: string | null;
};

export default async function ResearcherDashboard() {
  const user = await requireRole("FREELANCER");

  const assignments = all<Assignment>(
    `SELECT p.id, p.tracking_id, p.title, p.status, p.discipline, p.deadline, p.agreed_cents,
            s.name AS service_name, c.name AS client_name,
            (SELECT d.reviewer_note FROM deliverables d WHERE d.project_id = p.id AND d.reviewer_note IS NOT NULL ORDER BY d.version DESC LIMIT 1) AS qc_note
     FROM projects p
     JOIN services s ON s.id = p.service_id
     JOIN users c ON c.id = p.client_id
     WHERE p.researcher_id = ? AND p.status NOT IN ('CANCELLED')
     ORDER BY CASE p.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'ASSIGNED' THEN 1 WHEN 'UNDER_REVIEW' THEN 2 ELSE 3 END,
              p.deadline ASC NULLS LAST`,
    user.id
  );

  const paid = get<{ s: number | null }>(
    "SELECT SUM(net_cents) AS s FROM payouts WHERE researcher_id = ? AND status = 'PAID'", user.id
  )?.s ?? 0;
  const processing = get<{ s: number | null }>(
    "SELECT SUM(net_cents) AS s FROM payouts WHERE researcher_id = ? AND status = 'PROCESSING'", user.id
  )?.s ?? 0;
  const pendingEscrow = get<{ s: number | null }>(
    `SELECT SUM(p.agreed_cents) AS s FROM projects p
     WHERE p.researcher_id = ? AND p.status = 'COMPLETED'`,
    user.id
  )?.s ?? 0;

  const working = assignments.filter((a) => ["ASSIGNED", "IN_PROGRESS"].includes(a.status));
  const review = assignments.filter((a) => a.status === "UNDER_REVIEW");
  const done = assignments.filter((a) => ["COMPLETED", "PAID_OUT"].includes(a.status));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paid out (net)" value={money(paid)} hint="settled to your account" href="/researcher/earnings" />
        <Stat label="Processing" value={money(processing)} hint="transfer initiated" href="/researcher/earnings" />
        <Stat label="Awaiting payout" value={money(pendingEscrow)} hint="QC passed, funds escrowed" />
        <Stat label="Active engagements" value={working.length} hint="assigned or in progress" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink-950">Active work</h2>
          <Link href="/researcher/jobs" className="btn-secondary btn-sm">Browse the job feed →</Link>
        </div>
        {working.length === 0 ? (
          <EmptyState
            title="No active engagements"
            body="New assignments from the desk (and anything you claim from the job feed) appear here."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {working.map((a) => {
              const left = daysUntil(a.deadline);
              return (
                <Card key={a.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink-700">{a.tracking_id}</span>
                    <StatusPill status={a.status} />
                    {left != null && left <= 7 ? (
                      <span className={`pill ${left < 0 ? "bg-rose-50 text-rose-700 ring-rose-300" : "bg-amber-50 text-amber-800 ring-amber-300"}`}>
                        {left < 0 ? `${-left}d overdue` : `${left}d to deadline`}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold leading-6 text-ink-950">{a.title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{a.service_name} · {a.discipline}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="text-ink-500">Your net: </span>
                      <strong>{money(a.agreed_cents != null ? Math.round(a.agreed_cents * 0.85) : null)}</strong>
                      <span className="text-xs text-ink-400"> (after fee)</span>
                    </div>
                    <div className="flex gap-2">
                      {a.status === "ASSIGNED" ? <StartWorkButton projectId={a.id} /> : null}
                      <Link href={`/researcher/projects/${a.id}`} className="btn-primary btn-sm">Open workspace</Link>
                    </div>
                  </div>
                  {a.qc_note && a.status === "IN_PROGRESS" ? (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ring-1 ring-amber-200">
                      Latest QC note: {a.qc_note}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {review.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold text-ink-950">With the QC desk</h2>
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead><tr><th>Project</th><th>Client</th><th>Deadline</th><th>Fee</th><th>Status</th><th /></tr></thead>
              <tbody>
                {review.map((a) => (
                  <tr key={a.id}>
                    <td className="max-w-[260px] truncate font-medium">{a.title} <span className="font-mono text-xs text-ink-400">{a.tracking_id}</span></td>
                    <td className="text-ink-600">{a.client_name}</td>
                    <td className="text-ink-600">{fmtDate(a.deadline)}</td>
                    <td className="font-semibold">{money(a.agreed_cents)}</td>
                    <td><StatusPill status={a.status} /></td>
                    <td className="text-right"><Link href={`/researcher/projects/${a.id}`} className="text-sm font-semibold text-ink-700 underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold text-ink-950">Recently completed</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {done.slice(0, 6).map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-ink-500">{a.tracking_id}</span>
                  <StatusPill status={a.status} />
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-semibold text-ink-900">{a.title}</div>
                <Link href={`/researcher/projects/${a.id}`} className="mt-2 inline-block text-xs font-semibold text-ink-600 underline">Workspace →</Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
