"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await post("/auth/login", { email, password });
      router.push(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="font-display text-[24px] font-semibold">Sign in</h1>
      <p className="mt-1 text-[13.5px] text-slate-500">Welcome back to your Wulweth workspace.</p>
      {error && <div className="mt-4"><Alert tone="error" role="alert">{error}</Alert></div>}
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <Field label="Email address" required htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.org" />
        </Field>
        <Field label="Password" required htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>Sign In</Button>
      </form>
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <Link href="/forgot-password" className="link">Forgot password?</Link>
        <Link href="/register" className="link">Create account</Link>
      </div>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-[12.5px] leading-relaxed text-slate-500">
        <p className="font-semibold text-ink-600">Demo environment</p>
        <p className="mt-1">
          Explore any role with password <code className="rounded bg-white px-1.5 py-0.5 text-[11.5px]">wulweth-demo</code>:
        </p>
        <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
          <li>client@wulweth.example — Client</li>
          <li>org.admin@kdi.example — Organization</li>
          <li>lerato@wulweth.example — Researcher</li>
          <li>naledi.stats@wulweth.example — Data Specialist</li>
          <li>manager@wulweth.example — Manager</li>
          <li>qc@wulweth.example — Quality Reviewer</li>
          <li>finance@wulweth.example — Finance</li>
          <li>admin@wulweth.example — Administrator</li>
        </ul>
      </div>
    </>
  );
}
