"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Result = { ok?: boolean; redirect?: string; error?: string };

function useSubmit(endpoint: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as Result;
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      router.push(json.redirect ?? "/");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }
  return { submit, error, busy };
}

export function SignInForm() {
  const { submit, error, busy } = useSubmit("/api/auth/signin");
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@university.edu" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="input" placeholder="••••••••" />
      </div>
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
      <button className="btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-ink-500">
        New to Wulweth? <Link href="/signup" className="font-semibold text-ink-800 underline">Create an account</Link>
      </p>
    </form>
  );
}

export function SignUpForm({ defaultRole = "CLIENT" }: { defaultRole?: string }) {
  const { submit, error, busy } = useSubmit("/api/auth/signup");
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">I am joining as</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "CLIENT", title: "A client", sub: "I need research done" },
            { value: "FREELANCER", title: "A researcher", sub: "I want to do research work" },
          ].map((r) => (
            <label
              key={r.value}
              className="cursor-pointer rounded-lg border border-ink-900/15 bg-white p-3 text-sm has-checked:border-gold-500 has-checked:bg-gold-50"
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                defaultChecked={defaultRole === r.value}
                className="sr-only"
              />
              <span className="block font-semibold text-ink-900">{r.title}</span>
              <span className="block text-xs text-ink-500">{r.sub}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input id="name" name="name" required className="input" placeholder="Dr. Amara Okoye" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@university.edu" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="8+ characters" />
      </div>
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
      <button className="btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-xs text-ink-500">
        By joining you agree to our GDPR-aligned privacy practices. Researchers are vetted by our
        editorial board before receiving assignments.
      </p>
    </form>
  );
}
