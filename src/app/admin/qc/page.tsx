import Link from "next/link";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDateTime, money } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { QCReviewForm } from "@/components/admin-actions";
import { DELIVERABLE_STATUS_META, type DeliverableStatus } from "@/lib/types";

type QueueItem = {
  d_id: string; d_version: number; d_filename: string; d_note: string | null;
  d_created: string; d_status: DeliverableStatus;
  p_id: string; tracking_id: string; p_title: string; p_status: string;
  discipline: string; agreed_cents: number | null;
  researcher_name: string | null; client_name: string; version_count: number;
};

export default async function QCPage() {
  await requireRole("ADMIN");

  const queue = all<QueueItem>(
    `SELECT d.id AS d_id, d.version AS d_version, d.filename AS d_filename, d.note AS d_note,
            d.created_at AS d_created, d.status AS d_status,
            p.id AS p_id, p.tracking_id, p.title AS p_title, p.status AS p_status,
            p.discipline, p.agreed_cents, r.name AS researcher_name, c.name AS client_name,
            (SELECT count(*) FROM deliverables dd WHERE dd.project_id = p.id) AS version_count
     FROM deliverables d
     JOIN projects p ON p.id = d.project_id
     JOIN users c ON c.id = p.client_id
     LEFT JOIN users r ON r.id = p.researcher_id
     WHERE d.status = 'SUBMITTED'
     ORDER BY d.created_at ASC`
  );

  const history = all<{
    id: string; version: number; status: DeliverableStatus; reviewer_note: string | null;
    tracking_id: string; p_title: string; created_at: string;
  }>(
    `SELECT d.id, d.version, d.status, d.reviewer_note, d.created_at, p.tracking_id, p.title AS p_title
     FROM deliverables d JOIN projects p ON p.id = d.project_id
     WHERE d.status != 'SUBMITTED'
     ORDER BY d.created_at DESC LIMIT 12`
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quality control queue"
        subtitle="Nothing reaches the client — and no researcher gets paid — until this desk signs off."
      />

      {queue.length === 0 ? (
        <EmptyState title="Queue clear" body="Submitted deliverables will appear here for rubric-based review." />
      ) : (
        <div className="space-y-5">
          {queue.map((q) => (
            <Card key={q.d_id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-ink-700">{q.tracking_id}</span>
                <Pill className="bg-violet-50 text-violet-800 ring-violet-300">Awaiting QC</Pill>
                <span className="text-xs text-ink-500">v{q.d_version} of {q.version_count} · {fmtDateTime(q.d_created)}</span>
                <span className="ml-auto text-xs font-semibold text-ink-700">{money(q.agreed_cents)}</span>
              </div>
              <h3 className="mt-2 font-display text-lg font-bold text-ink-950">{q.p_title}</h3>
              <p className="text-sm text-ink-600">
                {q.discipline} · {q.researcher_name ?? "unassigned"} → {q.client_name}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-parchment p-3 ring-1 ring-ink-900/10">
                <a href={`/api/deliverables/${q.d_id}/file`} className="btn-secondary btn-sm">⬇ Open deliverable</a>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{q.d_filename}</span>
              </div>
              {q.d_note ? <p className="mt-2 text-xs text-ink-500">Researcher note: {q.d_note}</p> : null}
              <QCReviewForm deliverableId={q.d_id} />
              <Link href={`/admin/projects/${q.p_id}`} className="mt-2 inline-block text-xs font-semibold text-ink-600 underline">
                Full project file →
              </Link>
            </Card>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-950">Recent QC decisions</h2>
        <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
          <table className="table-base">
            <thead><tr><th>Project</th><th>Version</th><th>Decision</th><th>QC note</th><th>When</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="font-medium">{h.p_title} <span className="font-mono text-xs text-ink-400">{h.tracking_id}</span></td>
                  <td>v{h.version}</td>
                  <td><Pill className={DELIVERABLE_STATUS_META[h.status].className}>{DELIVERABLE_STATUS_META[h.status].label}</Pill></td>
                  <td className="max-w-[280px] truncate text-ink-600">{h.reviewer_note ?? "—"}</td>
                  <td className="text-ink-500">{fmtDateTime(h.created_at)}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-ink-500">No decisions yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
