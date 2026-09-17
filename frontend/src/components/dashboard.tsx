"use client";

import { useCallback, useRef, useState } from "react";
import { api, get, post } from "@/lib/api";
import { fileSize, statusLabel } from "@/lib/format";
import { Alert, Badge, Button, StatusBadge } from "@/components/ui";

/* --------------------------- project flow timeline -------------------------- */

export function StatusTimeline({ history, status }: { history: any[]; status: string }) {
  return (
    <ol className="space-y-0">
      {history.map((h, i) => (
        <li key={h.id ?? i} className="relative flex gap-3 pb-5 last:pb-0">
          {i < history.length - 1 && <span className="absolute left-[9px] top-5 h-full w-0.5 bg-slate-200" aria-hidden="true" />}
          <span className="relative mt-1 h-[18px] w-[18px] flex-none rounded-full border-2 border-teal-500 bg-teal-50" aria-hidden="true">
            <span className="absolute inset-[3px] rounded-full bg-teal-500" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink-600">{statusLabel(h.to_status)}</p>
            <p className="text-[12px] text-slate-400">
              {h.created_at ? new Date(h.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
              {h.changed_by_name ? ` · ${h.changed_by_name}` : h.system_trigger ? ` · ${h.system_trigger.replaceAll("_", " ").toLowerCase()}` : ""}
            </p>
            {h.note && <p className="mt-0.5 text-[12.5px] italic text-slate-500">{h.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------ document upload ----------------------------- */

export function DocumentUpload({ onUploaded, context, contextId, kind = "PROJECT_DOCUMENT", compact = false }: {
  onUploaded?: (doc: any) => void;
  context: { project_id?: string; request_id?: string };
  contextId?: string;
  kind?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyright, setCopyright] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    if (!copyright) { setError("Please confirm your rights to this material first."); return; }
    setError(null); setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      form.append("copyright_confirmed", "true");
      if (context.project_id) form.append("project_id", context.project_id);
      if (context.request_id) form.append("request_id", context.request_id);
      const doc = await api("/documents/upload", { method: "POST", body: form });
      onUploaded?.(doc);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [copyright, context, kind, onUploaded]);

  return (
    <div>
      <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40 ${compact ? "px-4 py-4" : "px-6 py-8"}`}>
        <svg className="mb-2 h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
        <span className="text-[13px] font-medium text-ink-600">{uploading ? "Uploading & scanning…" : "Click to upload a document"}</span>
        <span className="mt-0.5 text-[11.5px] text-slate-400">Documents, data files, images or archives · max 25 MB</span>
        <input ref={inputRef} type="file" className="sr-only" disabled={uploading}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} aria-label="Choose file to upload" />
      </label>
      <label className="mt-2 flex items-start gap-2 text-[12px] text-slate-500">
        <input type="checkbox" checked={copyright} onChange={(e) => setCopyright(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" required />
        <span>I confirm I own this material, have permission to use it, hold a valid licence, or it is public-domain / otherwise authorized. <a href="/policies/copyright" target="_blank" className="link">Copyright policy</a></span>
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

/* ------------------------------ document list ------------------------------- */

export function DocumentList({ docs, onChanged }: { docs: any[]; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(id: string) {
    const { url } = await post<{ url: string }>(`/documents/${id}/download-url`);
    window.open(url, "_blank", "noopener");
  }

  return (
    <ul className="divide-y divide-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-ink-50 text-ink-400">
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink-600">{d.filename}</p>
              <p className="text-[11.5px] text-slate-400">
                {fileSize(d.size_bytes)} · {d.owner_name ?? "You"} · {d.created_at ? new Date(d.created_at).toLocaleDateString("en-GB") : ""}
                {d.scan_status === "INFECTED" && <span className="ml-1 font-semibold text-rose-600">· blocked by malware scan</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-none gap-1">
            <Button variant="ghost" size="sm" onClick={() => download(d.id)} disabled={d.scan_status === "INFECTED"}>Download</Button>
            {onChanged && (
              <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-50" disabled={busy === d.id}
                onClick={async () => { setBusy(d.id); try { await api(`/documents/${d.id}`, { method: "DELETE" }); onChanged(); } finally { setBusy(null); } }}>
                Remove
              </Button>
            )}
          </div>
        </li>
      ))}
      {docs.length === 0 && <li className="py-6 text-center text-[13px] text-slate-400">No documents yet.</li>}
    </ul>
  );
}

/* --------------------------- deliverable versioning ------------------------- */

export function DeliverableVersions({ deliverable, onRefresh, canUpload, projectId }: {
  deliverable: any; onRefresh: () => void; canUpload: boolean; projectId: string;
}) {
  const [openUpload, setOpenUpload] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h4 className="text-[14.5px] font-semibold text-ink-600">{deliverable.title}</h4>
          <p className="text-[12px] text-slate-400">{deliverable.versions.length} version{deliverable.versions.length === 1 ? "" : "s"} · {statusLabel(deliverable.versions.at(-1)?.status ?? deliverable.status)}</p>
        </div>
        {canUpload && <Button size="sm" variant={deliverable.status === "IN_REVISION" ? "teal" : "secondary"} onClick={() => setOpenUpload(!openUpload)}>
          {deliverable.status === "IN_REVISION" ? "Upload revision" : "New version"}
        </Button>}
      </div>
      {openUpload && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <VersionUpload deliverableId={deliverable.id} onDone={() => { setOpenUpload(false); onRefresh(); }} />
        </div>
      )}
      <div className="space-y-4 px-5 py-4">
        {deliverable.versions.map((v: any) => (
          <div key={v.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-600 font-display text-[12px] font-bold text-white">v{v.version_number}</span>
                <div>
                  <p className="text-[13px] font-semibold text-ink-600">{statusLabel(v.status)}</p>
                  <p className="text-[11.5px] text-slate-400">Uploaded by {v.uploaded_by_name} · {v.submitted_at ? new Date(v.submitted_at).toLocaleDateString("en-GB") : ""}</p>
                </div>
              </div>
              {v.document && (
                <Button size="sm" variant="secondary" onClick={async () => {
                  const { url } = await post<{ url: string }>(`/documents/${v.document.id}/download-url`);
                  window.open(url, "_blank", "noopener");
                }}>Open file</Button>
              )}
            </div>
            {v.notes && <p className="mt-2.5 rounded-md bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">{v.notes}</p>}
            {v.reviews?.map((r: any) => (
              <div key={r.id} className={`mt-3 rounded-md px-3 py-2.5 text-[12.5px] ring-1 ring-inset ${r.decision === "APPROVED" ? "bg-teal-50/70 ring-teal-200" : "bg-gold-100/40 ring-gold-400/40"}`}>
                <p className="font-semibold text-ink-600">QC · {statusLabel(r.decision)} — {r.reviewer_name}</p>
                <p className="mt-1 leading-relaxed text-slate-600">{r.summary}</p>
              </div>
            ))}
            {v.comments?.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {v.comments.map((c: any) => (
                  <li key={c.id} className="text-[12.5px] text-slate-600"><span className="font-semibold text-ink-600">{c.author?.full_name}:</span> {c.body}</li>
                ))}
              </ul>
            )}
            <CommentForm versionId={v.id} onDone={onRefresh} />
          </div>
        ))}
        {deliverable.versions.length === 0 && <p className="text-[13px] text-slate-400">No versions submitted yet.</p>}
      </div>
    </div>
  );
}

function VersionUpload({ deliverableId, onDone }: { deliverableId: string; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [copyright, setCopyright] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(file: File) {
    if (!copyright) { setError("Confirm your rights to the material first."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("notes", notes);
      form.append("copyright_confirmed", "true");
      await api(`/deliverables/${deliverableId}/versions`, { method: "POST", body: form });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-ink-600 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white"
        onChange={(e) => e.target.files?.[0] && submit(e.target.files[0])} disabled={busy} aria-label="Deliverable file" />
      <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px]" rows={2} placeholder="What changed in this version?"
        value={notes} onChange={(e) => setNotes(e.target.value)} />
      <label className="flex items-start gap-2 text-[12px] text-slate-500">
        <input type="checkbox" checked={copyright} onChange={(e) => setCopyright(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
        <span>I confirm I hold the rights to this deliverable material.</span>
      </label>
      {busy && <p className="text-[12.5px] text-slate-400">Uploading, scanning and submitting…</p>}
      {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function CommentForm({ versionId, onDone }: { versionId: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-3 flex gap-2" onSubmit={async (e) => {
      e.preventDefault();
      if (body.trim().length < 2) return;
      setBusy(true);
      try { await post(`/qc/versions/${versionId}/comments`, { body }); setBody(""); onDone(); } finally { setBusy(false); }
    }}>
      <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" placeholder="Add a comment on this version…"
        value={body} onChange={(e) => setBody(e.target.value)} aria-label="Comment" />
      <Button size="sm" variant="secondary" type="submit" disabled={busy || body.trim().length < 2}>Post</Button>
    </form>
  );
}
