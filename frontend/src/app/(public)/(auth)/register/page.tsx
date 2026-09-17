"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/api";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

const TYPES = [
  { id: "client", label: "Client", blurb: "Submit research requests and work with verified professionals." },
  { id: "professional", label: "Research Professional", blurb: "Offer research, data, consulting or editing expertise." },
  { id: "organization", label: "Organization", blurb: "Company, NGO, institution or government account with team members." },
];

const PRO_ROLES = [
  { value: "RESEARCHER", label: "Researcher" },
  { value: "RESEARCH_CONSULTANT", label: "Research Consultant" },
  { value: "DATA_SPECIALIST", label: "Data Specialist" },
  { value: "EDITOR", label: "Editor (Publishing Support)" },
];

const ORG_TYPES = ["Company", "NGO", "Research Institution", "University", "Government", "Healthcare Organization", "Development Organization", "Other"];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const initialType = params.get("type") === "professional" ? "professional" : params.get("type") === "organization" ? "organization" : "client";

  const [type, setType] = useState(initialType);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "RESEARCHER", professional_title: "",
    organization_name: "", organization_type: "NGO", country: "", accept_terms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setLoading(true);
    try {
      const res = await post<any>("/auth/register", { account_type: type, ...form });
      setNotice(res.message ?? "Account created.");
      setTimeout(() => {
        router.push(next && next.startsWith("/") ? next : res.dev_verification_link ? "/verify-email?pending=1" : "/dashboard");
        router.refresh();
      }, 900);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="font-display text-[24px] font-semibold">Create your account</h1>
      <p className="mt-1 text-[13.5px] text-slate-500">Join a professional research platform — curated, verified and integrity-checked.</p>

      <div className="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Account type">
        {TYPES.map((t) => (
          <button key={t.id} role="tab" aria-selected={type === t.id} onClick={() => setType(t.id)}
            className={`rounded-lg border px-3 py-2.5 text-[12px] font-semibold transition-colors ${
              type === t.id ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-slate-400">{TYPES.find((t) => t.id === type)?.blurb}</p>

      {error && <div className="mt-4"><Alert tone="error" role="alert">{error}</Alert></div>}
      {notice && <div className="mt-4"><Alert tone="success">{notice} Check your inbox for the verification email.</Alert></div>}

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <Field label="Full name" required>
          <Input required value={form.full_name} onChange={set("full_name")} autoComplete="name" placeholder="Dr. Jane Modise" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address" required>
            <Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" placeholder="you@organisation.org" />
          </Field>
          <Field label="Password" required hint="At least 8 characters.">
            <Input type="password" required minLength={8} value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Input value={form.country} onChange={set("country")} placeholder="Botswana" />
          </Field>
          {type === "professional" ? (
            <>
              <Field label="Professional role" required>
                <Select value={form.role} onChange={set("role")}>
                  {PRO_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Professional title">
                  <Input value={form.professional_title} onChange={set("professional_title")} placeholder="e.g. Public Health Researcher, Statistical Analyst" />
                </Field>
              </div>
            </>
          ) : type === "organization" ? (
            <>
              <Field label="Organization type">
                <Select value={form.organization_type} onChange={set("organization_type")}>
                  {ORG_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Organization name" required>
                  <Input required={type === "organization"} value={form.organization_name} onChange={set("organization_name")} placeholder="Kalahari Development Institute" />
                </Field>
              </div>
            </>
          ) : null}
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-slate-600">
          <input type="checkbox" required checked={form.accept_terms} onChange={set("accept_terms")}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
          <span>
            I agree to the <Link className="link" href="/policies/terms">Terms of Service</Link>,{" "}
            <Link className="link" href="/policies/privacy">Privacy Policy</Link> and{" "}
            <Link className="link" href="/policies/integrity">Research Integrity Policy</Link>.
          </span>
        </label>
        <Button type="submit" className="w-full" loading={loading}>Create Account</Button>
      </form>
      <p className="mt-4 text-center text-[13px] text-slate-500">
        Already have an account? <Link href="/signin" className="link">Sign in</Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}
