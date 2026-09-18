"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.push("/signin"), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="font-display text-[24px] font-semibold">Choose a new password</h1>
      {done ? (
        <div className="mt-4"><Alert tone="success">Password updated. Redirecting you to sign in…</Alert></div>
      ) : (
        <>
          {error && <div className="mt-4"><Alert tone="error" role="alert">{error}</Alert></div>}
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <Field label="New password" required hint="At least 8 characters.">
              <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="submit" className="w-full" loading={loading}>Update password</Button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-[13px] text-slate-500"><Link href="/signin" className="link">Back to sign in</Link></p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetInner /></Suspense>;
}
