"use client";

import { useState } from "react";
import { DISCIPLINES } from "@/lib/types";

export function QuoteForm({
  services,
  prefillService,
  prefillName,
  prefillEmail,
}: {
  services: { id: string; slug: string; name: string }[];
  prefillService?: string;
  prefillName?: string;
  prefillEmail?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const json = (await res.json()) as { ref?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not submit your request.");
        setBusy(false);
        return;
      }
      setDone(json.ref ?? "OK");
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
        <div className="font-display text-xl font-bold text-emerald-900">Request received</div>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          Your reference is <span className="font-mono font-bold">{done}</span>. A Wulweth desk
          officer will reply with a scoped, fixed quote — usually within one business day.
          {prefillEmail ? " Signed-in clients also see this request under My quotes." : " Create a client account with this email to track it in the client portal."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="service">Service</label>
          <select id="service" name="serviceSlug" className="input" defaultValue={prefillService ?? ""}>
            <option value="">General / not sure yet</option>
            {services.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="discipline">Discipline *</label>
          <select id="discipline" name="discipline" required className="input" defaultValue="">
            <option value="" disabled>Select a discipline</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Your name *</label>
          <input id="name" name="name" required className="input" defaultValue={prefillName} placeholder="Prof. J. Mwangi" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required className="input" defaultValue={prefillEmail} placeholder="you@institution.edu" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="organisation">Institution</label>
          <input id="organisation" name="organisation" className="input" placeholder="University / clinic / NGO" />
        </div>
        <div>
          <label className="label" htmlFor="budget">Budget (USD)</label>
          <input id="budget" name="budget" type="number" min={50} step={1} className="input" placeholder="e.g. 1500" />
        </div>
        <div>
          <label className="label" htmlFor="deadline">Deadline</label>
          <input id="deadline" name="deadline" type="date" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="details">Research brief *</label>
        <textarea
          id="details" name="details" required rows={6} className="input"
          placeholder="Describe the research need: topic, research questions, data you have (or need), target journal/committee requirements, citation style, length…"
        />
        <p className="mt-1 text-xs text-ink-500">
          Please don&rsquo;t include personal data of study participants at this stage — we sign
          an NDA/DPA before any dataset changes hands.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
      <button className="btn-primary w-full sm:w-auto" disabled={busy} type="submit">
        {busy ? "Sending…" : "Request my fixed quote"}
      </button>
    </form>
  );
}
