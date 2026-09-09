import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, PageHeader, Pill, Stat } from "@/components/ui";
import { ConfirmTransferButton, FeeEditor, PayoutConfirmButton, PayoutTriggerButton } from "@/components/admin-actions";
import { PAYMENT_STATUS_META, type PaymentStatus } from "@/lib/types";

type InvoiceRow = {
  id: string; number: string; status: string; total_cents: number; created_at: string;
  client_name: string; pay_status: PaymentStatus | null; pay_method: string | null;
};

type PayoutRow = {
  id: string; gross_cents: number; fee_cents: number; net_cents: number; status: string;
  created_at: string; researcher_name: string; tracking_id: string; p_title: string;
};

type ReadyProject = {
  id: string; tracking_id: string; title: string; agreed_cents: number;
  fee_mode: string; fee_value: number; researcher_name: string; fee_cents: number; net_cents: number;
};

export default async function FinancePage() {
  await requireRole("ADMIN");

  const invoices = all<InvoiceRow>(
    `SELECT i.id, i.number, i.status, i.total_cents, i.created_at, u.name AS client_name,
            pay.status AS pay_status, pay.method AS pay_method
     FROM invoices i
     JOIN users u ON u.id = i.client_id
     LEFT JOIN payments pay ON pay.invoice_id = i.id
     ORDER BY i.created_at DESC LIMIT 50`
  );
  const payouts = all<PayoutRow>(
    `SELECT po.id, po.gross_cents, po.fee_cents, po.net_cents, po.status, po.created_at,
            u.name AS researcher_name, p.tracking_id, p.title AS p_title
     FROM payouts po JOIN users u ON u.id = po.researcher_id JOIN projects p ON p.id = po.project_id
     ORDER BY po.created_at DESC LIMIT 50`
  );
  const ready = all<ReadyProject>(
    `SELECT p.id, p.tracking_id, p.title, p.agreed_cents, s.fee_mode, s.fee_value, u.name AS researcher_name,
            CASE s.fee_mode WHEN 'PERCENT' THEN CAST(ROUND(p.agreed_cents * s.fee_value / 100.0) AS INTEGER) ELSE MIN(s.fee_value, p.agreed_cents) END AS fee_cents,
            p.agreed_cents - CASE s.fee_mode WHEN 'PERCENT' THEN CAST(ROUND(p.agreed_cents * s.fee_value / 100.0) AS INTEGER) ELSE MIN(s.fee_value, p.agreed_cents) END AS net_cents
     FROM projects p
     JOIN services s ON s.id = p.service_id
     JOIN users u ON u.id = p.researcher_id
     WHERE p.status = 'COMPLETED' AND p.agreed_cents IS NOT NULL
       AND p.id NOT IN (SELECT project_id FROM payouts)
     ORDER BY p.updated_at ASC`
  );
  const services = all<{ id: string; name: string; fee_mode: string; fee_value: number }>(
    "SELECT id, name, fee_mode, fee_value FROM services WHERE active = 1 ORDER BY sort_order"
  );

  const escrow = get<{ s: number | null }>("SELECT SUM(amount_cents) AS s FROM payments WHERE status='ESCROWED'")?.s ?? 0;
  const released = get<{ s: number | null }>("SELECT SUM(amount_cents) AS s FROM payments WHERE status='RELEASED'")?.s ?? 0;
  const fees = get<{ s: number | null }>("SELECT SUM(fee_cents) AS s FROM payouts")?.s ?? 0;
  const processing = payouts.filter((p) => p.status === "PROCESSING").reduce((a, p) => a + p.net_cents, 0);

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Held in escrow" value={money(escrow)} hint="client funds in custody" />
        <Stat label="Released to researchers" value={money(released)} hint="lifetime" />
        <Stat label="Company fees earned" value={money(fees)} hint="our take-rate revenue" />
        <Stat label="Payouts processing" value={money(processing)} hint="confirm when settled" />
      </div>

      <section>
        <PageHeader
          title="Payout-ready projects"
          subtitle="QC passed, funds escrowed, no payout yet. Triggering releases the researcher's net and books the company fee."
        />
        {ready.length === 0 ? (
          <Card className="p-5 text-sm text-ink-500">No projects waiting for payout.</Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead>
                <tr><th>Project</th><th>Researcher</th><th>Gross</th><th>Company fee</th><th>Researcher net</th><th /></tr>
              </thead>
              <tbody>
                {ready.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium">{r.title}</div>
                      <div className="font-mono text-xs text-ink-400">{r.tracking_id}</div>
                    </td>
                    <td className="text-ink-600">{r.researcher_name}</td>
                    <td className="font-semibold">{money(r.agreed_cents)}</td>
                    <td className="text-ink-700">{money(r.fee_cents)} <span className="text-xs text-ink-400">({r.fee_mode === "PERCENT" ? `${r.fee_value}%` : "fixed"})</span></td>
                    <td className="font-semibold">{money(r.net_cents)}</td>
                    <td><PayoutTriggerButton projectId={r.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {payouts.length > 0 ? (
        <section>
          <PageHeader title="Payout ledger" />
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead>
                <tr><th>Project</th><th>Researcher</th><th>Gross</th><th>Fee</th><th>Net</th><th>Status</th><th>When</th><th /></tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[220px] truncate font-medium">{p.p_title} <span className="font-mono text-xs text-ink-400">{p.tracking_id}</span></td>
                    <td className="text-ink-600">{p.researcher_name}</td>
                    <td>{money(p.gross_cents)}</td>
                    <td className="text-emerald-800">{money(p.fee_cents)}</td>
                    <td className="font-semibold">{money(p.net_cents)}</td>
                    <td>
                      <Pill className={p.status === "PAID" ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : "bg-amber-50 text-amber-800 ring-amber-300"}>
                        {p.status === "PAID" ? "Settled" : "Processing"}
                      </Pill>
                    </td>
                    <td className="text-ink-500">{fmtDate(p.created_at)}</td>
                    <td>{p.status === "PROCESSING" ? <PayoutConfirmButton payoutId={p.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <PageHeader title="Invoices & payments" subtitle="Every client charge and its escrow state." />
        <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
          <table className="table-base">
            <thead>
              <tr><th>Invoice</th><th>Client</th><th>Total</th><th>Invoice</th><th>Payment</th><th>Method</th><th>Issued</th><th /></tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs font-semibold">{i.number}</td>
                  <td className="text-ink-600">{i.client_name}</td>
                  <td className="font-semibold">{money(i.total_cents)}</td>
                  <td>
                    <Pill className={i.status === "PAID" ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : i.status === "ISSUED" ? "bg-amber-50 text-amber-800 ring-amber-300" : "bg-stone-100 text-stone-600 ring-stone-300"}>
                      {i.status}
                    </Pill>
                  </td>
                  <td>
                    {i.pay_status ? (
                      <Pill className={PAYMENT_STATUS_META[i.pay_status].className}>{PAYMENT_STATUS_META[i.pay_status].label}</Pill>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="text-ink-600">{i.pay_method === "CARD" ? "Card" : i.pay_method === "BANK_TRANSFER" ? "Bank" : "—"}</td>
                  <td className="text-ink-500">{fmtDate(i.created_at)}</td>
                  <td>{i.status === "ISSUED" ? <ConfirmTransferButton invoiceId={i.id} /> : null}</td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-center text-ink-500">No invoices yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-500">“Confirm transfer received” settles bank-transfer invoices into escrow (mock rails for this MVP).</p>
      </section>

      <section>
        <PageHeader
          title="Service fee management"
          subtitle="Set the company take-rate per service — percentage of gross or a fixed amount. Applies to future payouts."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="mb-2 text-sm font-bold text-ink-950">{s.name}</div>
              <FeeEditor serviceId={s.id} mode={s.fee_mode} value={s.fee_value} />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
