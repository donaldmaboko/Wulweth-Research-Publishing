import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { SignInForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

// One-click demo accounts — mirrors the seeded dataset.
const demos = [
  { role: "Client", name: "Dana Whitfield", email: "client@demo.io", password: "password123" },
  { role: "Researcher", name: "Dr. Amara Okoye", email: "researcher@demo.io", password: "password123" },
  { role: "Admin", name: "Wulweth Desk", email: "admin@demo.io", password: "password123" },
];

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
      <Card className="p-7">
        <h1 className="font-display text-2xl font-bold text-ink-950">Welcome back</h1>
        <p className="mb-6 mt-1 text-sm text-ink-600">
          Sign in to track projects, invoices and payouts.
        </p>
        <SignInForm />
      </Card>

      <div className="space-y-4">
        <Card className="border-gold-300 bg-gold-50 p-6">
          <h2 className="font-display text-lg font-bold text-ink-950">Demo accounts</h2>
          <p className="mt-1 text-sm text-ink-600">
            This build is seeded with sample data. Use any of these (password{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-ink-900/10">password123</code>):
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {demos.map((d) => (
              <li key={d.email} className="rounded-lg bg-white p-3 ring-1 ring-gold-200">
                <div className="font-semibold text-ink-900">{d.role} — {d.name}</div>
                <div className="font-mono text-xs text-ink-600">{d.email}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">Escrow, explained</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            When you pay an invoice, funds are held by Wulweth — not the researcher. The
            researcher is paid only after our quality-control desk approves the deliverable.
            If QC finds issues, revisions are requested at no extra cost.
          </p>
        </Card>
      </div>
    </div>
  );
}
