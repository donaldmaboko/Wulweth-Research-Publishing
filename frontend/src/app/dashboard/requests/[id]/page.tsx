"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, isStaff, post } from "@/lib/api";
import { formatDate, money, statusLabel } from "@/lib/format";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Modal, Select, StatusBadge, Textarea, useToast } from "@/components/ui";
import { DocumentList, DocumentUpload } from "@/components/dashboard";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [r, setR] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [clarifyMsg, setClarifyMsg] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const load = useCallback(() => {
    get(`/research-requests/${id}`).then((data) => {
      setR(data);
      setDocs(data.attachments ?? []);
    }).catch(() => setR(null));
  }, [id]);

  useEffect(load, [load]);

  if (!r) return <p className="py-20 text-center text-sm text-slate-400">Request not found.</p>;
  const staff = isStaff(user);

  async function action(fn: () => Promise<any>, successMessage: string, redirect?: string) {
    setBusy(true);
    try {
      await fn();
      toast.push(successMessage, "success");
      if (redirect) router.push(redirect); else load();
    } catch (err: any) {
      toast.push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[24px] font-semibold">{r.title}</h1>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            {r.tracking_id ? <>Tracking ID <span className="font-mono font-semibold text-ink-600">{r.tracking_id}</span> · </> : <span>Draft · </span>}
            {r.client ? `by ${r.client.full_name}` : ""} {r.submitted_at ? `· submitted ${formatDate(r.submitted_at)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {staff && r.status === "SUBMITTED" && (
            <Button variant="secondary" loading={busy} onClick={() => action(() => post(`/research-requests/${r.id}/start-review`), "Review started")}>Start review</Button>
          )}
          {staff && ["SUBMITTED", "UNDER_REVIEW"].includes(r.status) && (
            <>
              <Button variant="secondary" onClick={() => setClarifyOpen(true)}>Request clarification</Button>
              <Button variant="secondary" className="text-rose-600" onClick={() => setDeclineOpen(true)}>Decline</Button>
              <Button loading={busy} onClick={() => action(async () => {
                const res = await post<any>(`/research-requests/${r.id}/convert`);
                return res;
              }, "Project opened — prepare the quote next")}>Open project</Button>
            </>
          )}
          {staff && ["UNDER_REVIEW", "SUBMITTED"].includes(r.status) && (
            <Button variant="teal" onClick={() => setQuoteOpen(true)}>Prepare quote</Button>
          )}
        </div>
      </div>

      {r.risk_level === "PROHIBITED" && (
        <Alert tone="error" title="This request conflicts with the Research Integrity Policy">
          The automated screen identified content Wulweth cannot support (for example, work to be submitted as someone&rsquo;s own
          or fabricated data). The desk will contact you about legitimate alternatives — such as statistical analysis or
          manuscript support for your own research.
        </Alert>
      )}
      {r.risk_level === "POTENTIAL" && (
        <Alert tone="warning" title="Research-integrity review pending">
          Automated screening flagged this request for review. The desk must clear it before work proceeds.
        </Alert>
      )}
      {r.status === "CLARIFICATION_REQUESTED" && r.review_note && (
        <Alert tone="warning" title="Clarification requested by the Wulweth desk">
          <p>{r.review_note}</p>
          {r.client?.id === user?.id && (
            <Link href={`/dashboard/requests/new?draft=${r.id}`} className="link mt-1 inline-block">Edit and resubmit your request →</Link>
          )}
        </Alert>
      )}

      {r.project_tracking && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-[13px] text-slate-500">This request became a project.</p>
            <p className="font-mono text-[14px] font-semibold text-ink-600">{r.project_tracking}</p>
          </div>
          <Link href={`/dashboard/projects/${r.project_id}`}><Button size="sm">Open project workspace</Button></Link>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="p-6">
            <dl className="space-y-4 text-[13.5px]">
              <div><dt className="font-semibold text-ink-600">Objective</dt><dd className="mt-1 whitespace-pre-line text-slate-600">{r.objective ?? "—"}</dd></div>
              <div><dt className="font-semibold text-ink-600">Description</dt><dd className="mt-1 whitespace-pre-line text-slate-600">{r.description ?? "—"}</dd></div>
              {r.methodology && <div><dt className="font-semibold text-ink-600">Methodology</dt><dd className="mt-1 whitespace-pre-line text-slate-600">{r.methodology}</dd></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><dt className="font-semibold text-ink-600">Data availability</dt><dd className="mt-1 text-slate-600">{statusLabel(r.data_availability ?? "")} {r.data_description ? `— ${r.data_description}` : ""}</dd></div>
                <div><dt className="font-semibold text-ink-600">Expected deliverables</dt><dd className="mt-1 whitespace-pre-line text-slate-600">{r.expected_deliverables ?? "—"}</dd></div>
              </div>
              {(r.preferred_expertise || r.confidentiality_note || r.additional_notes) && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  {r.preferred_expertise && <div><dt className="font-semibold text-ink-600">Preferred expertise</dt><dd className="mt-1 text-slate-600">{r.preferred_expertise}</dd></div>}
                  {r.confidentiality_note && <div><dt className="font-semibold text-ink-600">Confidentiality</dt><dd className="mt-1 text-slate-600">{r.confidentiality_note}</dd></div>}
                  {r.additional_notes && <div><dt className="font-semibold text-ink-600">Additional notes</dt><dd className="mt-1 text-slate-600">{r.additional_notes}</dd></div>}
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Attachments" />
            <div className="px-5 py-3">
              <DocumentList docs={docs} onChanged={load} />
              {r.client?.id === user?.id && ["DRAFT", "CLARIFICATION_REQUESTED"].includes(r.status) && (
                <div className="mt-3 border-t border-slate-100 pt-4">
                  <DocumentUpload context={{ request_id: r.id }} kind="REQUEST_ATTACHMENT" compact onUploaded={load} />
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">At a glance</h3>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-slate-500">Service</dt><dd className="text-right font-medium text-ink-600">{r.service?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Discipline</dt><dd className="font-medium text-ink-600">{r.discipline ?? "—"}</dd></div>
              {r.research_field && <div className="flex justify-between"><dt className="text-slate-500">Field</dt><dd className="font-medium text-ink-600">{r.research_field.name}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">Budget</dt><dd className="font-medium text-ink-600">{r.budget_min ? `${money(r.budget_min, r.currency)} – ${money(r.budget_max, r.currency)}` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Deadline</dt><dd className="font-medium text-ink-600">{formatDate(r.deadline)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Integrity risk</dt><dd>{r.risk_level ? <Badge className={r.risk_level === "LOW" ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-gold-100/60 text-gold-600 ring-gold-400/40"}>{r.risk_level}</Badge> : "—"}</dd></div>
            </dl>
          </Card>
          {r.client?.id === user?.id && ["DRAFT", "CLARIFICATION_REQUESTED"].includes(r.status) && (
            <Card className="p-5">
              <h3 className="text-[13.5px] font-semibold text-ink-600">This is {r.status === "DRAFT" ? "a draft" : "awaiting clarification"}</h3>
              <p className="mt-1 text-[12.5px] text-slate-500">You can update it and resubmit.</p>
              <Link href={`/dashboard/requests/new?draft=${r.id}`} className="mt-3 block rounded-lg bg-ink-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-ink-700">Edit request</Link>
            </Card>
          )}
        </aside>
      </div>

      {/* clarification modal */}
      <Modal open={clarifyOpen} onClose={() => setClarifyOpen(false)} title="Request clarification">
        <p className="text-[13px] text-slate-500">The client will be asked to update and resubmit the request.</p>
        <Textarea className="mt-3" rows={4} value={clarifyMsg} onChange={(e) => setClarifyMsg(e.target.value)} placeholder="What would you like clarified?" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setClarifyOpen(false)}>Cancel</Button>
          <Button loading={busy} disabled={clarifyMsg.trim().length < 5}
            onClick={async () => { await action(() => post(`/research-requests/${r.id}/request-clarification`, { message: clarifyMsg }), "Clarification requested"); setClarifyOpen(false); }}>
            Send request
          </Button>
        </div>
      </Modal>

      {/* decline modal */}
      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline request">
        <p className="text-[13px] text-slate-500">Explain the decision to the client. For integrity concerns, point to legitimate alternatives where possible.</p>
        <Textarea className="mt-3" rows={4} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason…" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeclineOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={declineReason.trim().length < 5}
            onClick={async () => { await action(() => post(`/research-requests/${r.id}/decline`, { reason: declineReason }), "Request declined"); setDeclineOpen(false); }}>
            Decline request
          </Button>
        </div>
      </Modal>

      {staff && <QuoteBuilder open={quoteOpen} onClose={() => setQuoteOpen(false)} request={r} onDone={() => { setQuoteOpen(false); load(); }} />}
    </div>
  );
}

function QuoteBuilder({ open, onClose, request, onDone }: { open: boolean; onClose: () => void; request: any; onDone: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: "", deliverables_text: "" }]);
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState("30");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && request.project_id) setProjectId(request.project_id);
  }, [open, request]);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (i.quantity || 0), 0);
  const taxAmount = subtotal * (parseFloat(tax) || 0) / 100;

  async function create() {
    setBusy(true);
    try {
      let pid = projectId;
      if (!pid) {
        const res = await post<any>(`/research-requests/${request.id}/convert`);
        pid = res.project_id;
      }
      await post(`/projects/${pid}/quotes`, {
        items: items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: parseFloat(i.unit_price), deliverables_text: i.deliverables_text || null })),
        tax_percent: parseFloat(tax) || 0,
        valid_days: parseInt(validDays) || 30,
        notes: notes || null,
      });
      toast.push("Quote prepared — send it from the project workspace", "success");
      onDone();
    } catch (err: any) {
      toast.push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Prepare quote" wide>
      <p className="text-[13px] text-slate-500">
        For <span className="font-medium text-ink-600">{request.title}</span>. Creating the quote moves the project to <em>Quote Prepared</em>; you can then send it for client approval.
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_90px_130px_32px]">
            <Input placeholder="Line description (service + scope)" value={item.description}
              onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
            <Input type="number" min="1" step="1" aria-label="Quantity" value={item.quantity}
              onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))} />
            <Input type="number" min="0" step="50" aria-label="Unit price" placeholder="Unit price" value={item.unit_price}
              onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} />
            {items.length > 1 && (
              <button type="button" aria-label="Remove line" className="rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                <svg className="mx-auto h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.296a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
              </button>
            )}
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: "", deliverables_text: "" }])}>+ Add line</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Tax %"><Input type="number" min="0" max="100" step="0.5" value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
        <Field label="Valid for (days)"><Input type="number" min="1" max="180" value={validDays} onChange={(e) => setValidDays(e.target.value)} /></Field>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px]">
          <p className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-medium text-ink-600">{money(subtotal)}</span></p>
          <p className="flex justify-between text-slate-500"><span>Tax</span><span className="font-medium text-ink-600">{money(taxAmount)}</span></p>
          <p className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-ink-600"><span>Total</span><span>{money(subtotal + taxAmount)}</span></p>
        </div>
      </div>
      <Field label="Notes for the client">
        <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assumptions, inclusions, revision rounds…" />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="teal" loading={busy} disabled={items.some((i) => !i.description || !i.unit_price)} onClick={create}>Create quote</Button>
      </div>
    </Modal>
  );
}
