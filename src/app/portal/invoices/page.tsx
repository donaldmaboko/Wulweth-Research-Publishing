import Link from "next/link";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { BundleInvoiceBuilder, type BundleProject } from "@/components/client-actions";

type Invoice = {
  id: string; number: string; status: string; total_cents: number;
  created_at: string; due_date: string | null; items: string;
};

export default async function InvoicesPage() {
  const user = await requireRole("CLIENT");

  const invoices = all<Invoice & { items: string }>(
    `SELECT i.*, GROUP_CONCAT(ii.description, ' | ') AS items
     FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.client_id = ? GROUP BY i.id ORDER BY i.created_at DESC`,
    user.id
  );

  const bundleable = all<BundleProject>(
    `SELECT id, tracking_id, title, agreed_cents FROM projects
     WHERE client_id = ? AND status = 'QUOTED' AND agreed_cents IS NOT NULL
       AND id NOT IN (SELECT project_id FROM invoice_items)
     ORDER BY created_at DESC`,
    user.id
  );

  return (
    <div className="space-y-8">
      <section>
        <PageHeader
          title="Generate an invoice"
          subtitle="Bundle one or more quoted projects into a single invoice, then pay by card or bank transfer."
        />
        <Card className="p-6">
          <BundleInvoiceBuilder projects={bundleable} />
        </Card>
      </section>

      <section>
        <PageHeader title="All invoices & receipts" />
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" body="Invoices appear here once quotes are issued. Every payment produces a downloadable receipt." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead>
                <tr><th>Invoice</th><th>Items</th><th>Issued</th><th>Due</th><th>Total</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs font-semibold">{i.number}</td>
                    <td className="max-w-[300px] truncate text-ink-600">{i.items ?? "—"}</td>
                    <td className="text-ink-600">{fmtDate(i.created_at)}</td>
                    <td className="text-ink-600">{fmtDate(i.due_date)}</td>
                    <td className="font-semibold">{money(i.total_cents)}</td>
                    <td>
                      <span className={`pill ${i.status === "PAID" ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                        : i.status === "ISSUED" ? "bg-amber-50 text-amber-800 ring-amber-300"
                        : "bg-stone-100 text-stone-600 ring-stone-300"}`}>
                        {i.status === "PAID" ? "Paid" : i.status === "ISSUED" ? "Awaiting payment" : i.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link href={`/portal/invoices/${i.id}`} className="text-sm font-semibold text-ink-700 underline">Open</Link>
                    </td>
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
