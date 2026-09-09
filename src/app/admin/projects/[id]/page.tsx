import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import {
  DELIVERABLE_STATUS_META, PAYMENT_STATUS_META,
  type DeliverableStatus, type PaymentStatus, type ProjectStatus,
} from "@/lib/types";
import { Card, Pill, StatusPill } from "@/components/ui";
import { AssignPanel, PayoutTriggerButton, QCReviewForm } from "@/components/admin-actions";

type Deliverable = {
  id: string; version: number; filename: string; note: string | null;
  status: DeliverableStatus; reviewer_note: string | null; created_at: string; size_bytes: number;
};

export default async function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const p = get<{
    id: string; tracking_id: string; title: string; description: string; status: ProjectStatus;
    discipline: string; deadline: string | null; budget_cents: number | null; agreed_cents: number | null;
    created_at: string; service_name: string; fee_mode: string; fee_value: number;
    client_name: string; client_email: string;
    researcher_name: string | null; researcher_email: string | null;
  }>(
    `SELECT p.*, s.name AS service_name, s.fee_mode, s.fee_value,
            c.name AS client_name, c.email AS client_email,
            r.name AS researcher_name, r.email AS researcher_email
     FROM projects p
     JOIN services s ON s.id = p.service_id
     JOIN users c ON c.id = p.client_id
     LEFT JOIN users r ON r.id = p.researcher_id
     WHERE p.id = ?`,
    id
  );
  if (!p) notFound();

  const researchers = all<{ id: string; name: string; verified: number; disciplines: string | null; headline: string | null }>(
    "SELECT id, name, verified, disciplines, headline FROM users WHERE role = 'FREELANCER' ORDER BY verified DESC, name"
  );
  const deliverables = all<Deliverable>(
    "SELECT id, version, filename, note, status, reviewer_note, created_at, size_bytes FROM deliverables WHERE project_id = ? ORDER BY version DESC",
    id
  );
  const payment = get<{ status: PaymentStatus; method: string; amount_cents: number }>(
    `SELECT pay.status, pay.method, pay.amount_cents FROM payments pay
     JOIN invoices i ON i.id = pay.invoice_id
     JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE ii.project_id = ?`,
    id
  );
  const payout = get<{ id: string; gross_cents: number; fee_cents: number; net_cents: number; status: string }>(
    "SELECT id, gross_cents, fee_cents, net_cents, status FROM payouts WHERE project_id = ?",
    id
  );

  const feePreview = p.agreed_cents != null
    ? (p.fee_mode === "PERCENT" ? Math.round((p.agreed_cents * p.fee_value) / 100) : Math.min(p.fee_value, p.agreed_cents))
    : null;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink-700">{p.tracking_id}</span>
              <StatusPill status={p.status} />
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink-950">{p.title}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {p.service_name} · {p.discipline} · opened {fmtDate(p.created_at)}
              {p.deadline ? ` · due ${fmtDate(p.deadline)}` : ""}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Client: {p.client_name} ({p.client_email})
              {p.researcher_name ? ` · Researcher: ${p.researcher_name} (${p.researcher_email})` : " · Unassigned"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Agreed / fee</div>
            <div className="font-display text-2xl font-bold text-ink-950">{money(p.agreed_cents)}</div>
            {feePreview != null ? (
              <div className="text-xs text-ink-500">
                company fee {money(feePreview)} ({p.fee_mode === "PERCENT" ? `${p.fee_value}%` : "fixed"}) · net {money(p.agreed_cents! - feePreview)}
              </div>
            ) : null}
            {p.budget_cents != null ? (
              <div className="text-xs text-ink-400">client budget ≈ {money(p.budget_cents)}</div>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Brief</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-ink-700">{p.description}</p>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Deliverables &amp; QC</h2>
            {deliverables.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">Nothing submitted yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {deliverables.map((d) => {
                  const meta = DELIVERABLE_STATUS_META[d.status];
                  return (
                    <li key={d.id} className="rounded-lg bg-parchment p-4 ring-1 ring-ink-900/10">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-ink-900">v{d.version}</span>
                        <Pill className={meta.className}>{meta.label}</Pill>
                        <span className="ml-auto text-xs text-ink-500">{fmtDateTime(d.created_at)} · {(d.size_bytes / 1024).toFixed(0)} KB</span>
                      </div>
                      <a href={`/api/deliverables/${d.id}/file`} className="mt-1 block truncate text-sm font-medium text-ink-900 underline">
                        {d.filename}
                      </a>
                      {d.note ? <p className="mt-1 text-xs text-ink-500">Researcher note: {d.note}</p> : null}
                      {d.reviewer_note ? <p className="mt-1 text-xs text-ink-600">QC note: {d.reviewer_note}</p> : null}
                      {d.status === "SUBMITTED" && p.status === "UNDER_REVIEW" ? (
                        <QCReviewForm deliverableId={d.id} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Dispatch</h2>
            <p className="mb-3 mt-1 text-xs text-ink-500">
              Match by discipline (★ = researcher lists {p.discipline}), set the agreed price, or
              push to the public feed pool for researchers to claim.
            </p>
            <AssignPanel
              projectId={p.id}
              status={p.status}
              agreedCents={p.agreed_cents}
              researchers={researchers}
              discipline={p.discipline}
            />
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Money state</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-600">Payment</dt>
                <dd>
                  {payment ? (
                    <Pill className={PAYMENT_STATUS_META[payment.status].className}>
                      {PAYMENT_STATUS_META[payment.status].label} · {money(payment.amount_cents)}
                    </Pill>
                  ) : (
                    <span className="text-ink-400">not funded</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-600">Payout</dt>
                <dd>
                  {payout ? (
                    <Pill className={payout.status === "PAID" ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : "bg-amber-50 text-amber-800 ring-amber-300"}>
                      {payout.status === "PAID" ? "Settled" : "Processing"} · net {money(payout.net_cents)}
                    </Pill>
                  ) : (
                    <span className="text-ink-400">not triggered</span>
                  )}
                </dd>
              </div>
            </dl>
            {p.status === "COMPLETED" && payment?.status === "ESCROWED" && !payout ? (
              <div className="mt-4">
                <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 ring-1 ring-emerald-200">
                  QC passed and funds are in escrow. Triggering pays the researcher{" "}
                  <strong>{money(p.agreed_cents! - feePreview!)}</strong> and books{" "}
                  <strong>{money(feePreview!)}</strong> as company fee.
                </p>
                <PayoutTriggerButton projectId={p.id} />
              </div>
            ) : null}
            <Link href="/admin/finance" className="mt-4 inline-block text-xs font-semibold text-ink-600 underline">
              Open finance ledger →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
