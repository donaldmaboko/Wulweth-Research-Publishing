import Link from "next/link";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, PageHeader, Stat, StatusPill } from "@/components/ui";
import type { ProjectStatus } from "@/lib/types";

export default async function AdminOverview() {
  await requireRole("ADMIN");

  const escrow = get<{ s: number | null }>(
    "SELECT SUM(amount_cents) AS s FROM payments WHERE status = 'ESCROWED'"
  )?.s ?? 0;
  const released = get<{ s: number | null }>(
    "SELECT SUM(amount_cents) AS s FROM payments WHERE status = 'RELEASED'"
  )?.s ?? 0;
  const feesEarned = get<{ s: number | null }>(
    "SELECT SUM(fee_cents) AS s FROM payouts"
  )?.s ?? 0;
  const newRequests = get<{ c: number }>(
    "SELECT count(*) AS c FROM projects WHERE status = 'PENDING'"
  )?.c ?? 0;
  const newQuotes = get<{ c: number }>(
    "SELECT count(*) AS c FROM quote_requests WHERE status = 'NEW'"
  )?.c ?? 0;
  const qcQueue = get<{ c: number }>(
    "SELECT count(*) AS c FROM projects WHERE status = 'UNDER_REVIEW'"
  )?.c ?? 0;
  const payoutReady = get<{ c: number }>(
    "SELECT count(*) AS c FROM projects WHERE status = 'COMPLETED'"
  )?.c ?? 0;

  const recent = all<{
    id: string; tracking_id: string; title: string; status: ProjectStatus;
    client_name: string; researcher_name: string | null; created_at: string;
  }>(
    `SELECT p.id, p.tracking_id, p.title, p.status, p.created_at,
            c.name AS client_name, r.name AS researcher_name
     FROM projects p
     JOIN users c ON c.id = p.client_id
     LEFT JOIN users r ON r.id = p.researcher_id
     ORDER BY p.created_at DESC LIMIT 8`
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations overview"
        subtitle="Match requests, guard quality, move money. Everything that needs a human is on this screen."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="New requests" value={newRequests} hint="awaiting quote/assignment" href="/admin/requests" />
        <Stat label="Quote briefs" value={newQuotes} hint="public get-a-quote form" href="/admin/requests" />
        <Stat label="QC queue" value={qcQueue} hint="deliverables to review" href="/admin/qc" />
        <Stat label="Payout-ready" value={payoutReady} hint="QC passed, funds in escrow" href="/admin/finance" />
        <Stat label="Held in escrow" value={money(escrow)} hint="client funds in custody" href="/admin/finance" />
        <Stat label="Company fees earned" value={money(feesEarned)} hint={`${money(released)} released to researchers`} href="/admin/finance" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ink-950">Latest projects</h2>
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead>
                <tr><th>Tracking</th><th>Title</th><th>Client</th><th>Researcher</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.tracking_id}</td>
                    <td className="max-w-[240px] truncate font-medium">{p.title}</td>
                    <td className="text-ink-600">{p.client_name}</td>
                    <td className="text-ink-600">{p.researcher_name ?? "—"}</td>
                    <td><StatusPill status={p.status} /></td>
                    <td className="text-right">
                      <Link href={`/admin/projects/${p.id}`} className="text-sm font-semibold text-ink-700 underline">Open</Link>
                    </td>
                  </tr>
                ))}
                {recent.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-ink-500">No projects yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <Card className="h-fit p-6">
          <h2 className="font-display text-lg font-bold text-ink-950">Escrow ledger, in one breath</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-ink-600">
            <li><strong className="text-ink-900">1 · Client pays.</strong> Card/bank funds land in the Wulweth custody balance — <em>not</em> the researcher&rsquo;s.</li>
            <li><strong className="text-ink-900">2 · Work happens.</strong> You match, the researcher delivers, editors QC.</li>
            <li><strong className="text-ink-900">3 · QC passes.</strong> Project is completed; payout becomes possible.</li>
            <li><strong className="text-ink-900">4 · Payout.</strong> You release gross − service fee to the researcher; fee accrues as revenue.</li>
          </ol>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-parchment p-3 ring-1 ring-ink-900/10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Custody now</div>
              <div className="font-display text-lg font-bold text-ink-950">{money(escrow)}</div>
            </div>
            <div className="rounded-lg bg-parchment p-3 ring-1 ring-ink-900/10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Fees earned</div>
              <div className="font-display text-lg font-bold text-ink-950">{money(feesEarned)}</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-500">Ledger updated {fmtDate(new Date().toISOString())} · live from the transactions tables.</p>
        </Card>
      </div>
    </div>
  );
}
