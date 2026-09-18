"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/format";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, Spinner, Tabs, Textarea, useToast } from "@/components/ui";

export default function ModerationPage() {
  const [tab, setTab] = useState("cases");
  const [cases, setCases] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([get("/moderation/cases"), get("/moderation/reports")]).then(([c, r]) => {
      if (c.status === "fulfilled") setCases((c.value.items ?? []).filter((x: any) => x.status === "PENDING_REVIEW"));
      if (r.status === "fulfilled") setReports((r.value.items ?? []).filter((x: any) => x.status === "OPEN"));
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Moderation &amp; Research Integrity</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">
          Review flagged research requests and copyright reports, and keep the platform aligned with the Research Integrity Policy.
        </p>
      </div>

      <Alert tone="info" title="Wulweth supports legitimate research">
        Requests for contract cheating, plagiarism or fabricated data are declined at intake with a policy-based explanation.
        Statistical analysis, data preparation and manuscript support of a client&rsquo;s own work are fully supported.
      </Alert>

      <Tabs tabs={[
        { id: "cases", label: "Integrity screening", count: cases.length },
        { id: "reports", label: "Copyright reports", count: reports.length },
      ]} active={tab} onChange={setTab} />

      {loading ? <div className="py-16 text-center"><Spinner /></div> : tab === "cases" ? (
        <Card>
          <CardHeader title="Flagged screenings" subtitle="Automated pipeline results requiring human review — every decision is recorded with a full audit trail." />
          {cases.length === 0 ? <EmptyState title="No screenings awaiting review" body="Requests that trigger integrity heuristics appear here for a human decision." /> : (
            <ul className="divide-y divide-slate-100">
              {cases.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink-600">{c.case_number} · {statusLabel(c.content_type)}</p>
                    <p className="text-[12px] text-slate-400">
                      raised by {c.author ?? "automated screen"} · {formatDate(c.created_at)} ·{" "}
                      <Badge className={c.risk_level === "PROHIBITED" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-gold-100/60 text-gold-600 ring-gold-400/40"}>
                        {c.risk_level === "PROHIBITED" ? "Prohibited" : "Potential risk"}
                      </Badge>
                    </p>
                    <p className="mt-1 max-w-2xl rounded bg-slate-50 px-2.5 py-1.5 text-[12.5px] italic text-slate-500">“{c.excerpt}”</p>
                    {c.triggered_rules?.length > 0 && (
                      <p className="mt-1 text-[11.5px] text-slate-400">Triggered rules: {c.triggered_rules.join(", ")}</p>
                    )}
                  </div>
                  <Button size="sm" variant="teal" onClick={() => setDetail(c)}>Review</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Copyright reports" subtitle="Reports raised under the Copyright & IP Policy" />
          {reports.length === 0 ? <EmptyState title="No open reports" /> : (
            <ul className="divide-y divide-slate-100">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink-600">{r.reference} · {statusLabel(r.kind)}</p>
                    <p className="text-[12px] text-slate-400">{formatDate(r.created_at)} · reporter {r.reporter?.full_name ?? "—"} · {statusLabel(r.content_type)}</p>
                    <p className="mt-1 max-w-2xl rounded bg-slate-50 px-2.5 py-1.5 text-[12.5px] text-slate-500">{r.details}</p>
                  </div>
                  <ReportResolveButton report={r} onDone={load} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Integrity review — ${detail?.case_number ?? ""}`}>
        {detail && <DecisionForm screening={detail} onDone={() => { setDetail(null); load(); }} />}
      </Modal>
    </div>
  );
}

function ReportResolveButton({ report, onDone }: { report: any; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="w-56">
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note…" aria-label="Resolution note" />
      <Button size="sm" className="mt-1.5 w-full" variant="teal" loading={busy} disabled={note.trim().length < 4}
        onClick={async () => {
          setBusy(true);
          try { await post(`/moderation/reports/${report.id}/review`, { status: "RESOLVED", resolution_note: note }); toast.push("Report resolved", "success"); onDone(); }
          catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>Resolve</Button>
    </div>
  );
}

function DecisionForm({ screening, onDone }: { screening: any; onDone: () => void }) {
  const toast = useToast();
  const [decision, setDecision] = useState("CLEARED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-3.5 text-[12.5px] leading-relaxed text-slate-600">
        <p className="font-semibold text-ink-600">Flagged content ({statusLabel(screening.content_type)})</p>
        <p className="mt-1 italic">“{screening.excerpt}”</p>
        {screening.triggered_rules?.length > 0 && <p className="mt-2 text-slate-400">Rules: {screening.triggered_rules.join(", ")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[["CLEARED", "Clear — legitimate research support", "bg-teal-600"], ["VIOLATION_CONFIRMED", "Violation confirmed — decline & explain", "bg-rose-600"]].map(([val, label, color]) => (
          <button key={val} type="button" onClick={() => setDecision(val)}
            className={`rounded-lg border px-3 py-2.5 text-left text-[12.5px] font-semibold transition-colors ${decision === val ? `${color} border-transparent text-white` : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rationale — recorded in the audit trail…" aria-label="Decision rationale" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button variant={decision === "CLEARED" ? "teal" : "danger"} loading={busy} disabled={reason.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            try {
              await post(`/moderation/cases/${screening.id}/decide`, { decision, reason });
              toast.push("Decision recorded with full audit trail", "success");
              onDone();
            } catch (err: any) { toast.push(err.message, "error"); }
            finally { setBusy(false); }
          }}>Record decision</Button>
      </div>
    </div>
  );
}
