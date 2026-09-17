"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth";
import { get, isStaff, isProfessional, post, qs } from "@/lib/api";
import { formatDate, money, statusLabel } from "@/lib/format";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Spinner, StatusBadge, Table, Tabs, Td, useToast } from "@/components/ui";

const TABS = [
  { id: "quotes", label: "Quotes" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "payouts", label: "Payouts" },
];

function FinanceInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState(searchParams.get("tab") ?? (isProfessional(user) ? "payouts" : "quotes"));
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<any>(null);
  const [payoutModal, setPayoutModal] = useState<any>(null);

  const staff = isStaff(user);
  const professional = isProfessional(user);

  const load = useCallback(() => {
    setLoading(true);
    const jobs: Promise<any>[] = [get("/quotes"), get("/invoices"), get("/payments"), get("/payouts")];
    if (professional) jobs.push(get("/my/earnings"));
    Promise.allSettled(jobs).then(([q, i, p, po, e]) => {
      if (q.status === "fulfilled") setQuotes(q.value.items ?? []);
      if (i.status === "fulfilled") setInvoices(i.value.items ?? []);
      if (p.status === "fulfilled") setPayments(p.value.items ?? []);
      if (po.status === "fulfilled") setPayouts(po.value.items ?? []);
      if (e && e.status === "fulfilled") setEarnings(e.value);
      setLoading(false);
    });
  }, [professional]);

  useEffect(() => { load(); }, [load]);

  const visibleTabs = TABS.filter((t) => {
    if (professional && t.id === "quotes") return false;
    if (professional && t.id === "invoices") return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">
          {professional ? "Earnings & Payouts" : staff ? "Finance & Payouts" : "Quotes, Invoices & Payments"}
        </h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">
          {professional
            ? "Your project earnings — gross, Wulweth fee and net payout per completed engagement."
            : staff
            ? "Confirm client payments, manage invoices and process professional payouts."
            : "Approve quotes, view and pay invoices, and track payment status."}
        </p>
      </div>

      {professional && earnings && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Lifetime earnings</p><p className="mt-1 font-display text-[26px] font-semibold text-teal-600">{money(earnings.totals.paid)}</p></Card>
          <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Pending payouts</p><p className="mt-1 font-display text-[26px] font-semibold text-gold-500">{money(earnings.totals.pending)}</p></Card>
          <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Platform fees (paid)</p><p className="mt-1 font-display text-[26px] font-semibold text-ink-600">{money(earnings.totals.fees)}</p></Card>
        </div>
      )}

      <Tabs tabs={visibleTabs.map((t) => ({ ...t, count: t.id === "quotes" ? quotes.length : t.id === "invoices" ? invoices.length : t.id === "payments" ? payments.length : payouts.length }))} active={tab} onChange={setTab} />

      {loading && <div className="py-16 text-center"><Spinner /></div>}

      {!loading && tab === "quotes" && (
        <Card>
          {quotes.length === 0 ? <EmptyState title="No quotes yet" body="When the desk prepares a quote for your request it appears here for approval." /> : (
            <Table head={["Quote", "Project", "Total", "Valid until", "Status", ""]}>
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[12px] text-slate-500">{q.quote_number}</Td>
                  <Td className="text-slate-600">{q.project?.title ?? "—"}</Td>
                  <Td className="font-semibold text-ink-600">{money(q.total, q.currency)}</Td>
                  <Td className="text-slate-500">{formatDate(q.valid_until)}</Td>
                  <Td><StatusBadge status={q.status} /></Td>
                  <Td>
                    {["SENT", "VIEWED"].includes(q.status) ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="teal" onClick={async () => {
                          try { await post(`/quotes/${q.id}/approve`); toast.push("Quote approved — an invoice is being prepared", "success"); load(); }
                          catch (err: any) { toast.push(err.message, "error"); }
                        }}>Approve</Button>
                        <Button size="sm" variant="secondary" className="text-rose-600" onClick={async () => {
                          try { await post(`/quotes/${q.id}/reject`, { reason: "Declined by client" }); toast.push("Quote rejected — the desk will follow up", "info"); load(); }
                          catch (err: any) { toast.push(err.message, "error"); }
                        }}>Reject</Button>
                      </div>
                    ) : <span className="text-[12px] text-slate-300">—</span>}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {!loading && tab === "invoices" && (
        <Card>
          {invoices.length === 0 ? <EmptyState title="No invoices yet" /> : (
            <Table head={["Invoice", "Project", "Total", "Due", "Status", ""]}>
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[12px] text-slate-500">{inv.invoice_number}</Td>
                  <Td className="text-slate-600">{inv.project?.title ?? "—"}</Td>
                  <Td className="font-semibold text-ink-600">{money(inv.total, inv.currency)}</Td>
                  <Td className="text-slate-500">{formatDate(inv.due_date)}</Td>
                  <Td><StatusBadge status={inv.status} /></Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener">
                        <Button size="sm" variant="secondary">PDF</Button>
                      </a>
                      {!staff && !professional && user && !["PAID", "VOID"].includes(inv.status) && (
                        <Button size="sm" variant="teal" onClick={async () => {
                          try {
                            const res = await post<any>(`/invoices/${inv.id}/pay`, { method: "BANK_TRANSFER" });
                            setPayModal(res);
                          } catch (err: any) { toast.push(err.message, "error"); }
                        }}>Pay</Button>
                      )}
                      {staff && inv.status === "DRAFT" && (
                        <Button size="sm" onClick={async () => { await post(`/invoices/${inv.id}/send`); toast.push("Invoice sent to client", "success"); load(); }}>Send</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {!loading && tab === "payments" && (
        <Card>
          {payments.length === 0 ? <EmptyState title="No payments yet" /> : (
            <Table head={["Reference", "Invoice", "Amount", "Method", "Status", staff ? "" : ""]}>
              {payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[12px] text-slate-500">{pay.reference}</Td>
                  <Td className="text-slate-600">{pay.invoice?.invoice_number ?? "—"}</Td>
                  <Td className="font-semibold text-ink-600">{money(pay.amount, pay.currency)}</Td>
                  <Td className="text-slate-500">{pay.method.replaceAll("_", " ")}{pay.provider === "stripe" ? " · Stripe" : ""}</Td>
                  <Td><StatusBadge status={pay.status} /></Td>
                  <Td>
                    {staff && pay.status === "PENDING" && (
                      <Button size="sm" variant="teal" onClick={async () => {
                        try { await post(`/payments/${pay.id}/confirm`, { provider_ref: pay.reference }); toast.push("Payment confirmed — funds secured for the project", "success"); load(); }
                        catch (err: any) { toast.push(err.message, "error"); }
                      }}>Confirm received</Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {!loading && tab === "payouts" && (
        <Card>
          {staff && (
            <div className="border-b border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">
              A payout can be prepared once a project is QC-approved and its payment confirmed. Wulweth&rsquo;s fee is calculated per the fee configuration.
            </div>
          )}
          {payouts.length === 0 ? <EmptyState title="No payouts yet" /> : (
            <Table head={["Payout", staff ? "Professional" : "Project", "Gross", "Wulweth fee", "Net", "Status", ""]}>
              {payouts.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-[12px] text-slate-500">{po.payout_number}</Td>
                  <Td className="text-slate-600">{staff ? po.professional?.full_name : po.project?.title ?? "—"}</Td>
                  <Td className="text-slate-600">{money(po.gross_amount, po.currency)}</Td>
                  <Td className="text-rose-500">−{money(po.fee_amount, po.currency)}</Td>
                  <Td className="font-semibold text-teal-700">{money(po.net_amount, po.currency)}</Td>
                  <Td><StatusBadge status={po.status} /></Td>
                  <Td>
                    {staff && po.status === "PENDING" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={async () => { await post(`/payouts/${po.id}/approve`); toast.push("Payout approved", "success"); load(); }}>Approve</Button>
                        <Button size="sm" variant="teal" onClick={() => setPayoutModal(po)}>Complete</Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* pay instructions modal */}
      <Modal open={!!payModal} onClose={() => { setPayModal(null); load(); }} title="Payment instructions">
        {payModal && (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-500">Reference: <span className="font-mono font-semibold text-ink-600">{payModal.payment.reference}</span></p>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-[13.5px] leading-relaxed text-slate-600">{payModal.instructions}</div>
            <Alert tone="info">Your payment is confirmed by Wulweth finance once the transfer is received. The project funds status will show <strong>Funds Pending Release</strong>.</Alert>
            <div className="flex justify-end"><Button onClick={() => { setPayModal(null); load(); }}>Done</Button></div>
          </div>
        )}
      </Modal>

      {/* complete payout modal */}
      <Modal open={!!payoutModal} onClose={() => setPayoutModal(null)} title="Complete payout">
        {payoutModal && (
          <PayoutCompleteForm payout={payoutModal} onDone={() => { setPayoutModal(null); load(); }} />
        )}
      </Modal>
    </div>
  );
}

function PayoutCompleteForm({ payout, onDone }: { payout: any; onDone: () => void }) {
  const toast = useToast();
  const [ref, setRef] = useState("");
  const [fee, setFee] = useState("0");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-500">
        {payout.payout_number} — net {money(payout.net_amount, payout.currency)} to the professional.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink-600">Transaction reference</label>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. TRX-99001" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink-600">Processing fee (if any)</label>
          <Input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button variant="teal" loading={busy} disabled={ref.trim().length < 2} onClick={async () => {
          setBusy(true);
          try {
            await post(`/payouts/${payout.id}/complete`, { transaction_ref: ref, processing_fee: parseFloat(fee) || 0 });
            toast.push("Payout completed and recorded in the ledger", "success");
            onDone();
          } catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>Mark payout completed</Button>
      </div>
    </div>
  );
}

export default function FinancePage() {
  return <Suspense fallback={<div className="py-24 text-center"><Spinner /></div>}><FinanceInner /></Suspense>;
}
