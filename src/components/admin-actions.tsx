"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function call(url: string, method: string, body?: unknown, after?: () => void) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) setMsg({ kind: "err", text: json.error ?? "Failed." });
      else setMsg({ kind: "ok", text: json.message ?? "Done." });
      router.refresh();
      after?.();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    }
    setBusy(false);
  }
  return { call, busy, msg };
}

function Msg({ msg }: { msg: { kind: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`mt-2 rounded-lg px-3 py-2 text-xs ring-1 ${
      msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
        : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
      {msg.text}
    </p>
  );
}

// --------------------------------------------------------- assign / quote

type Researcher = {
  id: string; name: string; verified: number; disciplines: string | null; headline: string | null;
};

export function AssignPanel({
  projectId, status, agreedCents, researchers, discipline,
}: {
  projectId: string; status: string; agreedCents: number | null;
  researchers: Researcher[]; discipline: string;
}) {
  const { call, busy, msg } = useAction();
  const [price, setPrice] = useState(agreedCents != null ? String(agreedCents / 100) : "");
  const [researcherId, setResearcherId] = useState("");

  const match = (r: Researcher) => (r.disciplines ?? "").split(",").map((s) => s.trim()).includes(discipline);
  const sorted = [...researchers].sort((a, b) => Number(match(b)) - Number(match(a)));

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
        <div>
          <label className="label">Researcher (expertise-matched first)</label>
          <select className="input" value={researcherId} onChange={(e) => setResearcherId(e.target.value)}>
            <option value="">Choose…</option>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>
                {match(r) ? "★ " : ""}{r.name}{r.verified ? " · vetted" : ""} — {r.disciplines ?? "no disciplines listed"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Agreed $</label>
          <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1200" inputMode="decimal" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn-primary btn-sm" disabled={busy || !researcherId} type="button"
          onClick={() => call(`/api/projects/${projectId}/assign`, "POST", { researcherId, agreedPrice: price || undefined })}
        >
          Assign researcher
        </button>
        <button
          className="btn-secondary btn-sm" disabled={busy} type="button"
          onClick={() => call(`/api/projects/${projectId}/assign`, "POST", { agreedPrice: price || undefined })}
        >
          Save price only (→ quoted)
        </button>
        <button
          className="btn-secondary btn-sm" disabled={busy} type="button"
          onClick={() => call(`/api/projects/${projectId}/assign`, "POST", { sendToPool: true, agreedPrice: price || undefined })}
        >
          Post to feed pool
        </button>
      </div>
      {status === "PENDING" && agreedCents == null ? (
        <p className="mt-2 text-xs text-ink-500">Set a price (and optionally assign) to move this request forward.</p>
      ) : null}
      <Msg msg={msg} />
    </div>
  );
}

// ------------------------------------------------------- quote conversion

export function QuoteConvertForm({
  quoteId, services, defaultServiceId,
}: {
  quoteId: string; services: { id: string; name: string }[]; defaultServiceId: string | null;
}) {
  const { call, busy, msg } = useAction();
  const [price, setPrice] = useState("");
  const [serviceId, setServiceId] = useState(defaultServiceId ?? "");

  return (
    <div className="mt-3 rounded-lg bg-parchment p-3 ring-1 ring-ink-900/10">
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
        <input className="input" placeholder="Quote $ e.g. 1450" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
        <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Service…</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button
          className="btn-primary btn-sm" disabled={busy || !price} type="button"
          onClick={() => call(`/api/quotes/${quoteId}/convert`, "POST", { agreedPrice: price, serviceId })}
        >
          {busy ? "Converting…" : "Convert to project"}
        </button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

// -------------------------------------------------------------------- QC

export function QCReviewForm({ deliverableId }: { deliverableId: string }) {
  const { call, busy, msg } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="mt-2">
      <textarea
        className="input" rows={2} placeholder="QC note to researcher / client (rubric: methodology, sourcing, statistics, style)"
        value={note} onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy} type="button"
          onClick={() => call(`/api/deliverables/${deliverableId}/qc`, "POST", { action: "approve", note })}>
          ✔ Approve &amp; complete
        </button>
        <button className="btn-danger btn-sm" disabled={busy} type="button"
          onClick={() => call(`/api/deliverables/${deliverableId}/qc`, "POST", { action: "revise", note })}>
          ↺ Request revision
        </button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

// ---------------------------------------------------------------- payout

export function PayoutTriggerButton({ projectId }: { projectId: string }) {
  const { call, busy, msg } = useAction();
  return (
    <div>
      <button className="btn-gold btn-sm" disabled={busy} type="button"
        onClick={() => call("/api/payouts", "POST", { projectId })}>
        {busy ? "Processing…" : "Trigger payout"}
      </button>
      <Msg msg={msg} />
    </div>
  );
}

export function PayoutConfirmButton({ payoutId }: { payoutId: string }) {
  const { call, busy, msg } = useAction();
  return (
    <div>
      <button className="btn-secondary btn-sm" disabled={busy} type="button"
        onClick={() => call(`/api/payouts/${payoutId}/confirm`, "POST")}>
        Mark settled
      </button>
      <Msg msg={msg} />
    </div>
  );
}

// ------------------------------------------------------------------ fees

export function FeeEditor({ serviceId, mode, value }: { serviceId: string; mode: string; value: number }) {
  const { call, busy, msg } = useAction();
  const [m, setM] = useState(mode);
  const [v, setV] = useState(mode === "PERCENT" ? String(value) : (value / 100).toFixed(2));

  return (
    <div>
      <div className="flex items-center gap-2">
        <select className="input max-w-[110px]" value={m} onChange={(e) => setM(e.target.value)}>
          <option value="PERCENT">%</option>
          <option value="FIXED">$ fixed</option>
        </select>
        <input className="input max-w-[100px]" value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" />
        <button className="btn-secondary btn-sm" disabled={busy} type="button"
          onClick={() => call(`/api/services/${serviceId}/fee`, "PATCH", { mode: m, value: v })}>
          Save
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        {m === "PERCENT" ? `Company keeps ${v || 0}% of each payout` : `Company keeps ${money(Math.round(parseFloat(v || "0") * 100))} per payout`}
      </p>
      <Msg msg={msg} />
    </div>
  );
}

// ------------------------------------------------------------------ feed

export function FeedComposer({ projects }: { projects: { id: string; title: string }[] }) {
  const { call, busy, msg } = useAction();
  const [type, setType] = useState("ANNOUNCEMENT");
  const [published, setPublished] = useState(true);

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget).entries());
      call("/api/feed", "POST", { ...f, published, type }, () => (e.target as HTMLFormElement).reset());
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="TREND">Research trend</option>
            <option value="JOB">Job posting (claimable)</option>
            <option value="COMPLETED_PROJECT">Completed project showcase</option>
          </select>
        </div>
        {type === "JOB" || type === "COMPLETED_PROJECT" ? (
          <div>
            <label className="label">Linked project</label>
            <select className="input" name="projectId">
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      <div>
        <label className="label">Title</label>
        <input className="input" name="title" required placeholder="e.g. PRISMA 2020: what changed for systematic reviews" />
      </div>
      <div>
        <label className="label">Body</label>
        <textarea className="input" name="body" required rows={5} placeholder="Write the dispatch…" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" className="accent-gold-600" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publish immediately (uncheck to keep as draft)
      </label>
      <button className="btn-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Publish to feed"}</button>
      <Msg msg={msg} />
    </form>
  );
}

export function FeedPostActions({ postId, published }: { postId: string; published: boolean }) {
  const { call, busy } = useAction();
  return (
    <div className="flex gap-2">
      <button className="btn-secondary btn-sm" disabled={busy} type="button"
        onClick={() => call(`/api/feed/${postId}`, "PATCH", { published: !published })}>
        {published ? "Unpublish" : "Publish"}
      </button>
      <button className="btn-danger btn-sm" disabled={busy} type="button"
        onClick={() => call(`/api/feed/${postId}`, "DELETE")}>
        Delete
      </button>
    </div>
  );
}

// ------------------------------------------------------ users & banking

export function VerifyButton({ userId, verified }: { userId: string; verified: boolean }) {
  const { call, busy } = useAction();
  return (
    <button className={verified ? "btn-danger btn-sm" : "btn-primary btn-sm"} disabled={busy} type="button"
      onClick={() => call(`/api/users/${userId}/verify`, "POST")}>
      {busy ? "…" : verified ? "Revoke vetting" : "Mark vetted"}
    </button>
  );
}

export function ConfirmTransferButton({ invoiceId }: { invoiceId: string }) {
  const { call, busy, msg } = useAction();
  return (
    <div>
      <button className="btn-secondary btn-sm" disabled={busy} type="button"
        onClick={() => call(`/api/invoices/${invoiceId}/confirm`, "POST")}>
        Confirm transfer received
      </button>
      <Msg msg={msg} />
    </div>
  );
}
