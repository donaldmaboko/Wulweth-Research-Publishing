import Link from "next/link";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { QuoteConvertForm } from "@/components/admin-actions";

type QReq = {
  id: string; ref: string; name: string; email: string; organisation: string | null;
  discipline: string; details: string; budget_cents: number | null; deadline: string | null;
  created_at: string; service_name: string | null; service_id: string | null;
};

type PReq = {
  id: string; tracking_id: string; title: string; discipline: string; created_at: string;
  client_name: string; client_email: string; budget_cents: number | null;
  service_name: string;
};

export default async function AdminRequestsPage() {
  await requireRole("ADMIN");
  const services = all<{ id: string; name: string }>("SELECT id, name FROM services ORDER BY sort_order");

  const quotes = all<QReq>(
    `SELECT q.*, s.name AS service_name FROM quote_requests q
     LEFT JOIN services s ON s.id = q.service_id
     WHERE q.status = 'NEW' ORDER BY q.created_at DESC`
  );
  const pending = all<PReq>(
    `SELECT p.id, p.tracking_id, p.title, p.discipline, p.created_at, p.budget_cents,
            u.name AS client_name, u.email AS client_email, s.name AS service_name
     FROM projects p JOIN users u ON u.id = p.client_id JOIN services s ON s.id = p.service_id
     WHERE p.status = 'PENDING' ORDER BY p.created_at DESC`
  );

  return (
    <div className="space-y-10">
      <section>
        <PageHeader
          title="Incoming research requests"
          subtitle="Structured requests from signed-in clients. Scope a price, then assign a researcher or post to the pool."
        />
        {pending.length === 0 ? (
          <EmptyState title="Queue is clear" body="New client requests land here." />
        ) : (
          <div className="space-y-4">
            {pending.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink-700">{p.tracking_id}</span>
                    <span className="pill bg-amber-50 text-amber-800 ring-amber-300">Awaiting quote</span>
                  </div>
                  <span className="text-xs text-ink-500">{fmtDate(p.created_at)}</span>
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-ink-950">{p.title}</h3>
                <p className="text-sm text-ink-600">
                  {p.service_name} · {p.discipline}
                  {p.budget_cents ? ` · client budget ≈ ${money(p.budget_cents)}` : ""}
                </p>
                <p className="mt-1 text-xs text-ink-500">Client: {p.client_name} ({p.client_email})</p>
                <Link href={`/admin/projects/${p.id}`} className="btn-primary btn-sm mt-3">Open &amp; dispatch →</Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <PageHeader
          title="Public quote briefs"
          subtitle="Submitted via the Get a Quote form (guests included). Convert to priced projects — accounts are provisioned automatically."
        />
        {quotes.length === 0 ? (
          <EmptyState title="No open briefs" />
        ) : (
          <div className="space-y-4">
            {quotes.map((q) => (
              <Card key={q.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-ink-700">{q.ref}</span>
                  <span className="text-xs text-ink-500">{fmtDate(q.created_at)}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-ink-950">
                  {q.service_name ?? "General request"} · {q.discipline}
                </h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-600">{q.details}</p>
                <p className="mt-2 text-xs text-ink-500">
                  {q.name} · {q.email}{q.organisation ? ` · ${q.organisation}` : ""}
                  {q.budget_cents ? ` · budget ≈ ${money(q.budget_cents)}` : ""}
                  {q.deadline ? ` · deadline ${fmtDate(q.deadline)}` : ""}
                </p>
                <QuoteConvertForm quoteId={q.id} services={services} defaultServiceId={q.service_id} />
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
