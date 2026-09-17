"use client";

import { useState } from "react";
import Link from "next/link";
import { post } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await post<any>("/auth/forgot-password", { email });
      setSent(true);
      setDevLink(res.dev_reset_link ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="font-display text-[24px] font-semibold">Reset your password</h1>
      {sent ? (
        <>
          <div className="mt-4"><Alert tone="success">If an account exists for that address, a reset link is on its way.</Alert></div>
          {devLink && (
            <div className="mt-4">
              <Alert tone="info" title="Demo environment">Reset link: <a className="link break-all" href={devLink}>{devLink}</a></Alert>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] text-slate-500">Enter your email and we&rsquo;ll send a secure reset link.</p>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <Field label="Email address" required>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" loading={loading}>Send reset link</Button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-[13px] text-slate-500"><Link href="/signin" className="link">Back to sign in</Link></p>
    </Card>
  );
}
