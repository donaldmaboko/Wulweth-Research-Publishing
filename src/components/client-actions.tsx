"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISCIPLINES } from "@/lib/types";
import { money } from "@/lib/format";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function call(url: string, body: unknown, onDone?: (json: Record<string, unknown>) => void) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      setSuccess((json.message as string) ?? "Done.");
      onDone?.(json);
      router.refresh();
      setBusy(false);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }
  return { call, busy, error, success, router };
}

// ------------------------------------------------------------ new project

export function NewProjectForm({ services }: { services: { id: string; name: string; category: string }[] }) {
  const { call, busy, error, success, router } = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget).entries());
        call("/api/projects", f, (json) => {
          setTimeout(() => router.push(`/portal/projects/${json.id}`), 900);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="serviceId">Service *</label>
          <select id="serviceId" name="serviceId" required className="input" defaultValue="">
            <option value="" disabled>Choose a service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.category} — {s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="discipline">Discipline *</label>
          <select id="discipline" name="discipline" required className="input" defaultValue="">
            <option value="" disabled>Choose a discipline…</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="title">Project title *</label>
        <input id="title" name="title" required minLength={6} className="input"
          placeholder="e.g. Systematic review of telehealth interventions for type-2 diabetes" />
      </div>
      <div>
        <label className="label" htmlFor="description">Brief *</label>
        <textarea id="description" name="description" required rows={7} className="input"
          placeholder="Research questions, scope, data availability, required methods, citation style, target output (journal, thesis chapter, report)…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="deadline">Target deadline</label>
          <input id="deadline" name="deadline" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="budget">Indicative budget (USD)</label>
          <input id="budget" name="budget" type="number" min={50} className="input" placeholder="1500" />
        </div>
      </div>
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
      {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{success}</p> : null}
      <button className="btn-primary" disabled={busy} type="submit">
        {busy ? "Submitting…" : "Submit research request"}
      </button>
      <p className="text-xs text-ink-500">
        Your request goes to the Wulweth desk. You&rsquo;ll receive a fixed quote (and a tracking ID
        right away) — nothing is charged until you approve the quote.
      </p>
    </form>
  );
}

// ------------------------------------------------------- bundle invoicing

export type BundleProject = {
  id: string; tracking_id: string; title: string; agreed_cents: number | null;
};

export function BundleInvoiceBuilder({ projects }: { projects: BundleProject[] }) {
  const { call, busy, error, success, router } = useAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const total = projects
    .filter((p) => selected.has(p.id))
    .reduce((sum, p) => sum + (p.agreed_cents ?? 0), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No projects are awaiting payment. Once we send a quote, you can generate an invoice here.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-ink-900/5 rounded-lg ring-1 ring-ink-900/10">
        {projects.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 has-checked:bg-gold-50">
            <input
              type="checkbox"
              className="h-4 w-4 accent-gold-600"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span className="flex-1 text-sm">
              <span className="font-mono text-xs text-ink-500">{p.tracking_id}</span>
              <span className="ml-2 font-medium text-ink-900">{p.title}</span>
            </span>
            <span className="text-sm font-semibold text-ink-900">{money(p.agreed_cents)}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-600">
          Bundle total: <strong className="font-display text-lg text-ink-950">{money(total)}</strong>
        </div>
        <button
          className="btn-primary"
          disabled={busy || selected.size === 0}
          onClick={() => call("/api/invoices", { projectIds: [...selected] }, (json) => {
            setTimeout(() => router.push(`/portal/invoices/${json.id}`), 700);
          })}
          type="button"
        >
          {busy ? "Generating…" : `Generate invoice for ${selected.size || ""} project${selected.size === 1 ? "" : "s"}`}
        </button>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
      {success ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{success}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------- pay invoice

export function PayInvoicePanel({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  const { call, busy, error, success } = useAction();
  const [method, setMethod] = useState<"CARD" | "BANK_TRANSFER">("CARD");

  return (
    <div className="rounded-xl border border-ink-900/10 bg-ink-950 p-5 text-parchment">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-bold text-white">Pay {money(amount)}</div>
        <span className="pill bg-white/10 text-gold-200 ring-white/20">🔒 Escrow protected</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-ink-300">
        Funds are held by Wulweth and released to the researcher only after our QC desk approves
        the deliverable. This demo uses a simulated gateway (no card is charged).
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className={`cursor-pointer rounded-lg p-3 text-sm ring-1 ${method === "CARD" ? "bg-white/10 ring-gold-400" : "ring-white/15"}`}>
          <input type="radio" name="method" className="mr-2 accent-gold-500" checked={method === "CARD"} onChange={() => setMethod("CARD")} />
          💳 Card — instant
          <span className="mt-1 block pl-6 text-xs text-ink-400">Visa · Mastercard · Amex (Stripe)</span>
        </label>
        <label className={`cursor-pointer rounded-lg p-3 text-sm ring-1 ${method === "BANK_TRANSFER" ? "bg-white/10 ring-gold-400" : "ring-white/15"}`}>
          <input type="radio" name="method" className="mr-2 accent-gold-500" checked={method === "BANK_TRANSFER"} onChange={() => setMethod("BANK_TRANSFER")} />
          🏦 Bank transfer
          <span className="mt-1 block pl-6 text-xs text-ink-400">SEPA / ACH — confirmed by our desk</span>
        </label>
      </div>
      {method === "CARD" ? (
        <div className="mt-3 grid grid-cols-[2fr_1fr_1fr] gap-2 text-ink-900">
          <input className="input" placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242" aria-label="Card number" />
          <input className="input" placeholder="MM/YY" defaultValue="12/28" aria-label="Expiry" />
          <input className="input" placeholder="CVC" defaultValue="123" aria-label="CVC" />
        </div>
      ) : null}
      {error ? <p className="mt-3 rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      {success ? <p className="mt-3 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-200">{success}</p> : null}
      <button
        className="btn-gold mt-4 w-full"
        disabled={busy}
        onClick={() => call(`/api/invoices/${invoiceId}/pay`, { method })}
        type="button"
      >
        {busy ? "Processing…" : method === "CARD" ? `Pay ${money(amount)} by card` : "Register bank transfer"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- review

export function ReviewForm({ projectId }: { projectId: string }) {
  const { call, busy, error, success } = useAction();
  const [rating, setRating] = useState(5);

  return (
    <div>
      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={n <= rating ? "text-gold-500" : "text-ink-200"}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="input mt-3" rows={3} id={`review-${projectId}`}
        placeholder="How was the research quality, communication and timeliness?"
      />
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-emerald-700">Thanks — your review is published to the feed team.</p> : null}
      <button
        className="btn-secondary btn-sm mt-2"
        disabled={busy || success != null}
        type="button"
        onClick={() => {
          const el = document.getElementById(`review-${projectId}`) as HTMLTextAreaElement;
          call("/api/reviews", { projectId, rating: String(rating), comment: el?.value ?? "" });
        }}
      >
        {busy ? "Publishing…" : "Submit review"}
      </button>
    </div>
  );
}

// ------------------------------------------------- single-project invoice

export function GenerateInvoiceButton({ projectId }: { projectId: string }) {
  const { call, busy, error, success, router } = useAction();
  return (
    <div>
      <button
        className="btn-gold btn-sm"
        disabled={busy}
        type="button"
        onClick={() => call("/api/invoices", { projectIds: [projectId] }, (json) => {
          setTimeout(() => router.push(`/portal/invoices/${json.id}`), 700);
        })}
      >
        {busy ? "Generating…" : "Generate invoice & pay"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-emerald-700">Invoice created — redirecting…</p> : null}
    </div>
  );
}
