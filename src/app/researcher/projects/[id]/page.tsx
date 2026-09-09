import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { daysUntil, fmtDate, fmtDateTime, money } from "@/lib/format";
import {
  DELIVERABLE_STATUS_META, type DeliverableStatus, type ProjectStatus,
} from "@/lib/types";
import { Card, Pill, StatusPill } from "@/components/ui";
import { StartWorkButton, UploadDeliverableForm } from "@/components/researcher-actions";

type Deliverable = {
  id: string; version: number; filename: string; size_bytes: number; note: string | null;
  status: DeliverableStatus; reviewer_note: string | null; created_at: string;
};

export default async function ResearcherProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FREELANCER");
  const { id } = await params;

  const p = get<{
    id: string; tracking_id: string; title: string; description: string; status: ProjectStatus;
    discipline: string; deadline: string | null; agreed_cents: number | null; created_at: string;
    service_name: string; client_name: string; fee_mode: string; fee_value: number;
  }>(
    `SELECT p.*, s.name AS service_name, s.fee_mode, s.fee_value, c.name AS client_name
     FROM projects p JOIN services s ON s.id = p.service_id JOIN users c ON c.id = p.client_id
     WHERE p.id = ? AND p.researcher_id = ?`,
    id, user.id
  );
  if (!p) notFound();

  const deliverables = all<Deliverable>(
    "SELECT id, version, filename, size_bytes, note, status, reviewer_note, created_at FROM deliverables WHERE project_id = ? ORDER BY version DESC",
    id
  );
  const payout = get<{ net_cents: number; fee_cents: number; status: string }>(
    "SELECT net_cents, fee_cents, status FROM payouts WHERE project_id = ?", id
  );
  const nextVersion = (deliverables[0]?.version ?? 0) + 1;
  const fee = p.agreed_cents != null
    ? (p.fee_mode === "PERCENT" ? Math.round((p.agreed_cents * p.fee_value) / 100) : Math.min(p.fee_value, p.agreed_cents))
    : null;
  const left = daysUntil(p.deadline);
  const canSubmit = ["ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW"].includes(p.status);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink-700">{p.tracking_id}</span>
              <StatusPill status={p.status} />
              {left != null && ["ASSIGNED", "IN_PROGRESS"].includes(p.status) ? (
                <span className={`pill ${left < 0 ? "bg-rose-50 text-rose-700 ring-rose-300" : left <= 7 ? "bg-amber-50 text-amber-800 ring-amber-300" : "bg-ink-50 text-ink-600 ring-ink-200"}`}>
                  {left < 0 ? `${-left}d overdue` : `${left}d to deadline`}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink-950">{p.title}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {p.service_name} · {p.discipline} · client {p.client_name} · assigned {fmtDate(p.created_at)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Your net</div>
            <div className="font-display text-2xl font-bold text-ink-950">
              {money(payout?.net_cents ?? (fee != null && p.agreed_cents != null ? p.agreed_cents - fee : null))}
            </div>
            <div className="text-xs text-ink-500">
              gross {money(p.agreed_cents)} − fee {money(fee ?? payout?.fee_cents ?? null)}
              {payout ? ` · ${payout.status.toLowerCase()}` : ""}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-950">Brief</h2>
              {p.status === "ASSIGNED" ? <StartWorkButton projectId={p.id} /> : null}
            </div>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-ink-700">{p.description}</p>
          </Card>

          {canSubmit ? (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold text-ink-950">Submit a deliverable</h2>
              <p className="mb-3 mt-1 text-xs text-ink-500">
                Version control: every upload becomes v{nextVersion}. The QC desk reviews the newest;
                clients download after approval. Use the note to summarize changes.
              </p>
              <UploadDeliverableForm projectId={p.id} nextVersion={nextVersion} />
            </Card>
          ) : (
            <Card className="p-6 text-sm text-ink-500">
              Submissions are closed for this project ({p.status.toLowerCase()}).
            </Card>
          )}
        </div>

        <Card className="h-fit p-6">
          <h2 className="font-display text-lg font-bold text-ink-950">Version history</h2>
          {deliverables.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No submissions yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {deliverables.map((d) => {
                const meta = DELIVERABLE_STATUS_META[d.status];
                return (
                  <li key={d.id} className="rounded-lg bg-parchment p-3 ring-1 ring-ink-900/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-ink-900">v{d.version}</span>
                      <Pill className={meta.className}>{meta.label}</Pill>
                      <span className="ml-auto text-[11px] text-ink-500">{fmtDateTime(d.created_at)}</span>
                    </div>
                    <a href={`/api/deliverables/${d.id}/file`} className="mt-1 block truncate text-sm font-medium text-ink-800 underline">
                      {d.filename}
                    </a>
                    <div className="text-[11px] text-ink-500">{(d.size_bytes / 1024).toFixed(0)} KB{d.note ? ` · ${d.note}` : ""}</div>
                    {d.reviewer_note ? (
                      <p className="mt-1.5 rounded bg-white px-2 py-1.5 text-xs leading-5 text-ink-700 ring-1 ring-ink-900/10">
                        <strong>QC:</strong> {d.reviewer_note}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-5 rounded-lg bg-ink-950 p-4 text-xs leading-5 text-ink-200">
            <strong className="text-gold-200">Payment guarantee.</strong> The client&rsquo;s funds sit
            in escrow before you start. Your net is released automatically once QC approves —
            typically within 2 business days.
          </div>
          <Link href="/researcher/earnings" className="mt-3 inline-block text-xs font-semibold text-ink-600 underline">
            Earnings ledger →
          </Link>
        </Card>
      </div>
    </div>
  );
}
