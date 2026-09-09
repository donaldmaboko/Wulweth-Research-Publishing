import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import { Card, Pill, WulwethMark } from "@/components/ui";
import { PayInvoicePanel } from "@/components/client-actions";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("CLIENT");
  const { id } = await params;

  const inv = get<{
    id: string; number: string; status: string; subtotal_cents: number; total_cents: number;
    created_at: string; due_date: string | null; paid_at: string | null;
  }>("SELECT * FROM invoices WHERE id = ? AND client_id = ?", id, user.id);
  if (!inv) notFound();

  const items = all<{ description: string; amount_cents: number; project_id: string | null }>(
    "SELECT description, amount_cents, project_id FROM invoice_items WHERE invoice_id = ?",
    id
  );
  const payment = get<{ method: string; status: "ESCROWED" | "RELEASED" | "REFUNDED"; reference: string; created_at: string }>(
    "SELECT method, status, reference, created_at FROM payments WHERE invoice_id = ?", id
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/portal/invoices" className="text-sm font-semibold text-ink-600 underline">← All invoices</Link>
        <span className="text-xs text-ink-500">Use your browser&rsquo;s print dialog to save as PDF.</span>
      </div>

      <Card className="p-8 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-900/10 pb-6">
          <div className="flex items-center gap-3">
            <WulwethMark className="h-11 w-11" />
            <div>
              <div className="font-display text-lg font-bold text-ink-950">Wulweth Research &amp; Publishing</div>
              <div className="text-xs text-ink-500">Research marketplace · hello@wulweth.example · VAT —</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-ink-950">INVOICE</div>
            <div className="font-mono text-sm text-ink-600">{inv.number}</div>
            <div className="mt-1 text-xs text-ink-500">Issued {fmtDate(inv.created_at)} · Due {fmtDate(inv.due_date)}</div>
          </div>
        </div>

        <div className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Billed to</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">{user.name}</div>
            <div className="text-sm text-ink-600">{user.email}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Status</div>
            <div className="mt-1">
              {inv.status === "PAID" ? (
                <Pill className="bg-emerald-50 text-emerald-800 ring-emerald-300">Paid {fmtDate(inv.paid_at)}</Pill>
              ) : inv.status === "ISSUED" ? (
                <Pill className="bg-amber-50 text-amber-800 ring-amber-300">Awaiting payment</Pill>
              ) : (
                <Pill>{inv.status}</Pill>
              )}
            </div>
            {payment ? (
              <div className="mt-1 text-xs text-ink-500">
                {payment.method === "CARD" ? "Card payment" : "Bank transfer"} · ref{" "}
                <span className="font-mono">{payment.reference.slice(0, 14)}…</span>
              </div>
            ) : null}
          </div>
        </div>

        <table className="table-base">
          <thead>
            <tr><th>Description</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  {it.description}
                  {it.project_id ? (
                    <Link href={`/portal/projects/${it.project_id}`} className="ml-2 text-xs font-semibold text-ink-600 underline">
                      view project
                    </Link>
                  ) : null}
                </td>
                <td className="text-right font-semibold">{money(it.amount_cents)}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-3 text-sm text-ink-600">Subtotal</td>
              <td className="pt-3 text-right">{money(inv.subtotal_cents)}</td>
            </tr>
            <tr>
              <td className="font-display text-base font-bold text-ink-950">Total due</td>
              <td className="text-right font-display text-base font-bold text-ink-950">{money(inv.total_cents)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 rounded-lg bg-parchment px-4 py-3 text-xs leading-5 text-ink-600 ring-1 ring-ink-900/10">
          Funds are held in escrow by Wulweth Research &amp; Publishing and transferred to the
          assigned researcher — minus the agreed service fee — only after our quality-control desk
          approves the deliverables. Disputes are arbitrated by the Wulweth desk.
          {payment ? <> Payment reference <span className="font-mono">{payment.reference}</span> · {fmtDateTime(payment.created_at)}.</> : null}
        </div>
      </Card>

      {inv.status === "ISSUED" ? (
        <div className="print:hidden">
          <PayInvoicePanel invoiceId={inv.id} amount={inv.total_cents} />
        </div>
      ) : null}
    </div>
  );
}
