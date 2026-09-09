import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { daysUntil, fmtDate, fmtDateTime, money } from "@/lib/format";
import {
  DELIVERABLE_STATUS_META, PAYMENT_STATUS_META, PROJECT_STATUS_META,
  type DeliverableStatus, type PaymentStatus, type ProjectStatus,
} from "@/lib/types";
import { Card, Pill, StatusPill } from "@/components/ui";
import { GenerateInvoiceButton, PayInvoicePanel, ReviewForm } from "@/components/client-actions";

const TIMELINE: ProjectStatus[] = [
  "PENDING", "QUOTED", "ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "PAID_OUT",
];

type Deliverable = {
  id: string; version: number; filename: string; size_bytes: number; note: string | null;
  status: DeliverableStatus; reviewer_note: string | null; created_at: string;
};

export default async function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("CLIENT");
  const { id } = await params;

  const p = get<{
    id: string; tracking_id: string; title: string; description: string; status: ProjectStatus;
    discipline: string; deadline: string | null; agreed_cents: number | null; created_at: string;
    service_name: string; researcher_name: string | null; researcher_headline: string | null;
    researcher_verified: number;
  }>(
    `SELECT p.*, s.name AS service_name, u.name AS researcher_name, u.headline AS researcher_headline,
            u.verified AS researcher_verified
     FROM projects p JOIN services s ON s.id = p.service_id
     LEFT JOIN users u ON u.id = p.researcher_id
     WHERE p.id = ? AND p.client_id = ?`,
    id, user.id
  );
  if (!p) notFound();

  const deliverables = all<Deliverable>(
    "SELECT id, version, filename, size_bytes, note, status, reviewer_note, created_at FROM deliverables WHERE project_id = ? ORDER BY version DESC",
    id
  );
  const invoice = get<{ id: string; number: string; status: string; total_cents: number }>(
    `SELECT i.id, i.number, i.status, i.total_cents FROM invoices i
     JOIN invoice_items ii ON ii.invoice_id = i.id WHERE ii.project_id = ?`,
    id
  );
  const payment = invoice
    ? get<{ status: PaymentStatus; method: string; created_at: string }>(
        "SELECT status, method, created_at FROM payments WHERE invoice_id = ?", invoice.id
      )
    : undefined;
  const review = get("SELECT id FROM reviews WHERE project_id = ?", id);

  const currentIdx = TIMELINE.indexOf(p.status);
  const statusMeta = PROJECT_STATUS_META[p.status];
  const left = daysUntil(p.deadline);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink-700">{p.tracking_id}</span>
              <StatusPill status={p.status} />
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950">{p.title}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {p.service_name} · {p.discipline} · requested {fmtDate(p.created_at)}
              {p.deadline ? ` · deadline ${fmtDate(p.deadline)}` : ""}
              {left != null && left <= 14 && ["ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW"].includes(p.status) ? (
                <span className={left < 0 ? "text-rose-600" : "text-amber-700"}> ({left < 0 ? `${-left}d overdue` : `${left}d left`})</span>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Agreed price</div>
            <div className="font-display text-2xl font-bold text-ink-950">{money(p.agreed_cents)}</div>
          </div>
        </div>

        {/* status timeline */}
        <ol className="mt-6 grid grid-cols-7 gap-1.5">
          {TIMELINE.map((s, i) => {
            const done = p.status !== "CANCELLED" && currentIdx >= i && currentIdx !== -1;
            return (
              <li key={s} title={PROJECT_STATUS_META[s].hint}>
                <div className={`h-1.5 rounded-full ${done ? "bg-gold-500" : "bg-ink-100"}`} />
                <div className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wide ${done ? "text-ink-800" : "text-ink-300"}`}>
                  {PROJECT_STATUS_META[s].label}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 rounded-lg bg-parchment px-3 py-2 text-xs text-ink-600 ring-1 ring-ink-900/10">
          {statusMeta.hint}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Brief</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-ink-700">{p.description}</p>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Deliverables</h2>
            <p className="mt-1 text-xs text-ink-500">
              Version-controlled uploads from your researcher. Downloads unlock after QC approval.
            </p>
            {deliverables.length === 0 ? (
              <p className="mt-4 text-sm text-ink-500">No deliverables submitted yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {deliverables.map((d) => {
                  const meta = DELIVERABLE_STATUS_META[d.status];
                  const downloadable = d.status === "APPROVED";
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-parchment px-4 py-3 ring-1 ring-ink-900/10">
                      <span className="font-display text-sm font-bold text-ink-900">v{d.version}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{d.filename}</span>
                        <span className="block text-xs text-ink-500">
                          {fmtDateTime(d.created_at)} · {(d.size_bytes / 1024).toFixed(0)} KB
                          {d.note ? ` · ${d.note}` : ""}
                        </span>
                        {d.reviewer_note ? (
                          <span className="mt-1 block rounded bg-white px-2 py-1 text-xs text-ink-600 ring-1 ring-ink-900/10">
                            QC note: {d.reviewer_note}
                          </span>
                        ) : null}
                      </span>
                      <Pill className={meta.className}>{meta.label}</Pill>
                      {downloadable ? (
                        <a href={`/api/deliverables/${d.id}/file`} className="btn-secondary btn-sm">Download</a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {["COMPLETED", "PAID_OUT"].includes(p.status) && !review ? (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold text-ink-950">Rate this engagement</h2>
              <p className="mb-3 mt-1 text-xs text-ink-500">
                Reviews inform researcher matching and (anonymized) showcase on our feed.
              </p>
              <ReviewForm projectId={p.id} />
            </Card>
          ) : null}
          {review ? (
            <Card className="p-6 text-sm text-emerald-800">✔ Thank you — your review has been recorded.</Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Your researcher</h2>
            {p.researcher_name ? (
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-950 font-display text-base font-bold text-gold-300">
                  {p.researcher_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink-950">
                    {p.researcher_name}
                    {p.researcher_verified ? <span className="pill bg-emerald-50 text-emerald-800 ring-emerald-300">✔ Vetted</span> : null}
                  </div>
                  <div className="text-xs text-ink-500">{p.researcher_headline}</div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-ink-600">
                Being matched now — our desk assigns a discipline expert once funding is secured.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-ink-950">Payment</h2>
            {!invoice && p.status === "QUOTED" ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-6 text-ink-600">
                  Quote ready: <strong>{money(p.agreed_cents)}</strong>. Generate an invoice to fund
                  this project (you can bundle several quoted projects on one invoice).
                </p>
                <GenerateInvoiceButton projectId={p.id} />
              </div>
            ) : !invoice ? (
              <p className="mt-2 text-sm text-ink-500">Awaiting our quote — no invoice yet.</p>
            ) : invoice.status === "ISSUED" ? (
              <div className="mt-3">
                <p className="mb-3 text-sm text-ink-600">
                  Invoice <span className="font-mono text-xs">{invoice.number}</span> awaiting payment.
                </p>
                <PayInvoicePanel invoiceId={invoice.id} amount={invoice.total_cents} />
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-600">Invoice {invoice.number}</span>
                  <Link href={`/portal/invoices/${invoice.id}`} className="font-semibold text-ink-800 underline">View receipt</Link>
                </div>
                {payment ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-600">{PAYMENT_STATUS_META[payment.status].label}</span>
                      <Pill className={PAYMENT_STATUS_META[payment.status].className}>
                        {payment.method === "CARD" ? "Card" : "Bank transfer"}
                      </Pill>
                    </div>
                    <p className="rounded-lg bg-parchment px-3 py-2 text-xs leading-5 text-ink-600 ring-1 ring-ink-900/10">
                      {payment.status === "ESCROWED"
                        ? "Your funds are held by Wulweth. The researcher is paid only after QC approval."
                        : "Funds have been released to the researcher. Engagement settled."}
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
