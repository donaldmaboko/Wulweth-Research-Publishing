"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISCIPLINES } from "@/lib/types";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  async function call(url: string, method: string, body?: unknown) {
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

export function StartWorkButton({ projectId }: { projectId: string }) {
  const { call, busy, msg } = useAction();
  return (
    <div>
      <button className="btn-primary btn-sm" disabled={busy} type="button"
        onClick={() => call(`/api/projects/${projectId}/start`, "POST")}>
        {busy ? "…" : "▶ Start work"}
      </button>
      <Msg msg={msg} />
    </div>
  );
}

export function UploadDeliverableForm({ projectId, nextVersion }: { projectId: string; nextVersion: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables`, { method: "POST", body: form });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) setMsg({ kind: "err", text: json.error ?? "Upload failed." });
      else {
        setMsg({ kind: "ok", text: json.message ?? "Uploaded." });
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-lg border border-dashed border-ink-300 bg-parchment p-4 text-center">
        <input
          type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg"
          className="mx-auto block w-full max-w-sm text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-ink-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-parchment"
        />
        <p className="mt-2 text-xs text-ink-500">
          PDF, DOCX, XLSX, CSV, ZIP or images · max 25 MB · uploads as <strong>v{nextVersion}</strong>
        </p>
      </div>
      <textarea name="note" rows={2} className="input" placeholder="Version note — what changed in this revision?" />
      <button className="btn-gold" disabled={busy} type="submit">
        {busy ? "Uploading…" : `Submit deliverable v${nextVersion} for QC`}
      </button>
      <Msg msg={msg} />
    </form>
  );
}

export function ClaimJobButton({ postId, claimed }: { postId: string; claimed: boolean }) {
  const { call, busy, msg } = useAction();
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  if (claimed) {
    return <span className="pill bg-emerald-50 text-emerald-800 ring-emerald-300">✔ Claimed by you</span>;
  }
  return (
    <div>
      {!open ? (
        <button className="btn-primary btn-sm" type="button" onClick={() => setOpen(true)}>Claim engagement</button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="One-line pitch (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button className="btn-gold btn-sm" disabled={busy} type="button"
            onClick={() => { setOpen(false); call(`/api/feed/${postId}/claim`, "POST", { message }); }}>
            {busy ? "…" : "Confirm claim"}
          </button>
        </div>
      )}
      <Msg msg={msg} />
    </div>
  );
}

export function ProfileForm({
  profile,
}: {
  profile: {
    headline: string | null; bio: string | null; disciplines: string | null;
    affiliation: string | null; orcid: string | null;
  };
}) {
  const { call, busy, msg } = useAction();
  const [disciplines, setDisciplines] = useState<string[]>(
    (profile.disciplines ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );

  function toggleDiscipline(d: string) {
    setDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
      call("/api/profile", "POST", { ...f, disciplines: disciplines.join(",") });
    }}>
      <input type="hidden" name="disciplines" value={disciplines.join(",")} />
      <div>
        <label className="label" htmlFor="headline">Headline</label>
        <input id="headline" name="headline" className="input" defaultValue={profile.headline ?? ""}
          placeholder="Epidemiologist · systematic reviews & meta-analysis" />
      </div>
      <div>
        <label className="label">Disciplines (drives assignment matching)</label>
        <div className="grid grid-cols-2 gap-2">
          {DISCIPLINES.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm has-checked:border-gold-500 has-checked:bg-gold-50">
              <input
                type="checkbox"
                className="h-4 w-4 accent-gold-600"
                checked={disciplines.includes(d)}
                onChange={() => toggleDiscipline(d)}
              />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="affiliation">Affiliation</label>
          <input id="affiliation" name="affiliation" className="input" defaultValue={profile.affiliation ?? ""} placeholder="London School of Hygiene & Tropical Medicine" />
        </div>
        <div>
          <label className="label" htmlFor="orcid">ORCID iD</label>
          <input id="orcid" name="orcid" className="input" defaultValue={profile.orcid ?? ""} placeholder="0000-0002-1825-0097" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">Bio & portfolio highlights</label>
        <textarea id="bio" name="bio" rows={5} className="input" defaultValue={profile.bio ?? ""}
          placeholder="Methods you master, publications, links to published papers (DOI/URLs), datasets…" />
      </div>
      <button className="btn-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save profile"}</button>
      <Msg msg={msg} />
    </form>
  );
}
