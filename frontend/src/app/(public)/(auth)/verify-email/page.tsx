"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { post } from "@/lib/api";
import { Alert, Button, Card } from "@/components/ui";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"working" | "ok" | "error" | "pending">(token ? "working" : params.get("pending") ? "pending" : "error");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    post("/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch((e) => { setState("error"); setMessage(e.message); });
  }, [token]);

  return (
    <Card className="p-7 text-center">
      {state === "working" && <p className="text-sm text-slate-500">Verifying your email…</p>}
      {state === "ok" && (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
          </div>
          <h1 className="mt-4 font-display text-[22px] font-semibold">Email verified</h1>
          <p className="mt-2 text-[13.5px] text-slate-500">Your account is fully active. Welcome to Wulweth.</p>
          <Link href="/dashboard" className="mt-5 inline-block rounded-lg bg-ink-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700">Go to your workspace</Link>
        </>
      )}
      {state === "pending" && (
        <>
          <h1 className="font-display text-[22px] font-semibold">Check your inbox</h1>
          <p className="mt-2 text-[13.5px] text-slate-500">
            We sent a verification link to your email address. Follow it to activate your account.
            In the demo environment, the verification link is printed in the API server log.
          </p>
          <Link href="/dashboard" className="mt-5 inline-block rounded-lg border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-50">Continue to workspace</Link>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="font-display text-[22px] font-semibold">Verification failed</h1>
          <p className="mt-2 text-[13.5px] text-slate-500">{message || "This link is invalid or has expired."}</p>
          <Link href="/signin" className="mt-5 inline-block rounded-lg border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-50">Back to sign in</Link>
        </>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
