"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, post } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, Spinner, Textarea, useToast } from "@/components/ui";

export default function QCPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    get("/qc/queue").then((d) => setItems(d.items ?? [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Quality Control</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">
          Review submitted deliverable versions against the project brief and Wulweth standards. Approve, request revision or reject with written rationale.
        </p>
      </div>

      {loading ? <div className="py-16 text-center"><Spinner /></div> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title="Review queue" subtitle="Submitted versions awaiting a decision" />
            {items.length === 0 ? (
              <EmptyState title="The QC queue is clear" body="When professionals submit deliverable versions they appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink-600">{v.deliverable?.title} <span className="text-slate-400">· v{v.version_number}</span></p>
                      <p className="text-[12px] text-slate-400">
                        <Link href={`/dashboard/projects/${v.project?.id}?tab=deliverables`} className="font-mono text-teal-700 hover:underline">{v.project?.tracking_id}</Link>
                        {" · "}{v.project?.title} · by {v.uploaded_by}
                      </p>
                      {v.notes && <p className="mt-1 max-w-xl rounded bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-500">{v.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={async () => {
                        try {
                          if (!v.document) { toast.push("No file attached to this version", "error"); return; }
                          const { url } = await post(`/documents/${v.document.id}/download-url`, {});
                          window.open(url, "_blank", "noopener");
                        } catch (err: any) { toast.push(err.message, "error"); }
                      }}>Open file</Button>
                      <Button size="sm" variant="teal" onClick={() => setReviewOpen(v)}>Review</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader title="Review standards" subtitle="Every decision is recorded against the project history." />
            <ul className="space-y-3 px-5 py-4 text-[12.5px] leading-relaxed text-slate-600">
              <li><strong className="text-ink-600">Accuracy</strong> — figures, tables and estimates reconcile with the underlying data.</li>
              <li><strong className="text-ink-600">Completeness</strong> — all agreed deliverables for the version are present.</li>
              <li><strong className="text-ink-600">Brief alignment</strong> — the work answers the agreed objective and scope.</li>
              <li><strong className="text-ink-600">Reproducibility</strong> — syntax or steps documented so results can be reproduced.</li>
              <li><strong className="text-ink-600">Presentation</strong> — clear structure, consistent referencing, professional tone.</li>
              <li><strong className="text-ink-600">Integrity</strong> — no unattributed material; sources properly cited.</li>
            </ul>
            <p className="border-t border-slate-100 px-5 py-3 text-[11.5px] text-slate-400">
              Approving all deliverables moves the project to Approved. Requesting revision returns the version to the professional with your written rationale.
            </p>
          </Card>
        </div>
      )}

      <Modal open={!!reviewOpen} onClose={() => setReviewOpen(null)} title={`QC review — ${reviewOpen?.deliverable?.title ?? ""} v${reviewOpen?.version_number ?? ""}`}>
        <ReviewForm version={reviewOpen} onDone={() => { setReviewOpen(null); load(); }} />
      </Modal>
    </div>
  );
}

function ReviewForm({ version, onDone }: { version: any; onDone: () => void }) {
  const toast = useToast();
  const [decision, setDecision] = useState("APPROVED");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[["APPROVED", "Approve", "bg-teal-600"], ["REVISION_REQUIRED", "Request revision", "bg-gold-500"], ["REJECTED", "Reject", "bg-rose-600"]].map(([val, label, color]) => (
          <button key={val} type="button" onClick={() => setDecision(val)}
            className={`rounded-lg border px-3 py-2.5 text-[12.5px] font-semibold transition-colors ${decision === val ? `${color} border-transparent text-white` : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>
      <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)}
        placeholder={decision === "APPROVED" ? "What was checked and confirmed (accuracy, completeness, alignment with the brief)…" : "What needs to change before approval…"}
        aria-label="Review summary" />
      <p className="text-[12px] text-slate-400">Approving a deliverable moves the project to Approved; requesting revision returns it to the professional as v{((version?.version_number ?? 1)) + 1}.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button variant="teal" loading={busy} disabled={summary.trim().length < 10} onClick={async () => {
          setBusy(true);
          try {
            await post(`/qc/versions/${version.id}/review`, { decision, summary });
            toast.push(`Version ${decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "returned for revision"}`, "success");
            onDone();
          } catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>Submit decision</Button>
      </div>
    </div>
  );
}
