import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill, Stat } from "@/components/ui";
import type { ProjectStatus } from "@/lib/types";

type Payout = {
  id: string; gross_cents: number; fee_cents: number; net_cents: number; status: string;
  created_at: string; paid_at: string | null; tracking_id: string; p_title: string;
};

export default async function EarningsPage() {
  const user = await requireRole("FREELANCER");

  const payouts = all<Payout>(
    `SELECT po.id, po.gross_cents, po.fee_cents, po.net_cents, po.status, po.created_at, po.paid_at,
            p.tracking_id, p.title AS p_title
     FROM payouts po JOIN projects p ON p.id = po.project_id
     WHERE po.researcher_id = ? ORDER BY po.created_at DESC`,
    user.id
  );
  const escrowed = all<{
    id: string; tracking_id: string; title: string; agreed_cents: number; status: ProjectStatus; deadline: string | null;
  }>(
    `SELECT p.id, p.tracking_id, p.title, p.agreed_cents, p.status, p.deadline
     FROM projects p
     WHERE p.researcher_id = ? AND p.agreed_cents IS NOT NULL
       AND p.id NOT IN (SELECT project_id FROM payouts)
       AND p.status IN ('ASSIGNED','IN_PROGRESS','UNDER_REVIEW','COMPLETED')
     ORDER BY p.deadline ASC NULLS LAST`,
    user.id
  );

  const paid = payouts.filter((p) => p.status === "PAID").reduce((a, p) => a + p.net_cents, 0);
  const processing = payouts.filter((p) => p.status === "PROCESSING").reduce((a, p) => a + p.net_cents, 0);
  const escrow = escrowed.reduce((a, p) => a + (p.agreed_cents ?? 0), 0);
  const feesPaid = payouts.reduce((a, p) => a + p.fee_cents, 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paid out (net)" value={money(paid)} hint="lifetime settlements" />
        <Stat label="Processing" value={money(processing)} hint="transfer initiated" />
        <Stat label="In pipeline (gross)" value={money(escrow)} hint="escrowed client funds on your projects" />
        <Stat label="Service fees paid" value={money(feesPaid)} hint="Wulweth take-rate to date" />
      </div>

      <section>
        <PageHeader
          title="Payout ledger"
          subtitle="Every settlement, with the fee split shown line by line. Payouts trigger after QC approval."
        />
        {payouts.length === 0 ? (
          <EmptyState title="No payouts yet" body="Complete your first engagement — settlements appear here with full fee transparency." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead><tr><th>Project</th><th>Gross</th><th>Service fee</th><th>Net to you</th><th>Status</th><th>Triggered</th><th>Settled</th></tr></thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[260px] truncate font-medium">{p.p_title} <span className="font-mono text-xs text-ink-400">{p.tracking_id}</span></td>
                    <td>{money(p.gross_cents)}</td>
                    <td className="text-ink-500">−{money(p.fee_cents)}</td>
                    <td className="font-semibold">{money(p.net_cents)}</td>
                    <td>
                      <Pill className={p.status === "PAID" ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : "bg-amber-50 text-amber-800 ring-amber-300"}>
                        {p.status === "PAID" ? "Paid" : "Processing"}
                      </Pill>
                    </td>
                    <td className="text-ink-500">{fmtDate(p.created_at)}</td>
                    <td className="text-ink-500">{fmtDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-950">In the pipeline (escrow-protected)</h2>
        {escrowed.length === 0 ? (
          <Card className="p-5 text-sm text-ink-500">No funded projects right now.</Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead><tr><th>Project</th><th>Value (gross)</th><th>Stage</th><th>Deadline</th></tr></thead>
              <tbody>
                {escrowed.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[300px] truncate font-medium">{p.title} <span className="font-mono text-xs text-ink-400">{p.tracking_id}</span></td>
                    <td className="font-semibold">{money(p.agreed_cents)}</td>
                    <td className="text-ink-600">
                      {p.status === "COMPLETED" ? "QC passed — payout due" : "Work / QC in progress"}
                    </td>
                    <td className="text-ink-500">{fmtDate(p.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
