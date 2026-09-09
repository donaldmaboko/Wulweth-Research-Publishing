import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { SignUpForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));
  const { as } = await searchParams;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
      <Card className="p-7">
        <h1 className="font-display text-2xl font-bold text-ink-950">Join Wulweth</h1>
        <p className="mb-6 mt-1 text-sm text-ink-600">
          One platform, two doors: commission research, or get matched to research work.
        </p>
        <SignUpForm defaultRole={as === "researcher" ? "FREELANCER" : "CLIENT"} />
      </Card>

      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">For clients</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-600">
            <li>Scope literature reviews, analysis, publication support</li>
            <li>Fixed quotes — no bidding chaos, no haggling</li>
            <li>Escrow protection &amp; editor-led quality control</li>
            <li>One tracking ID per project, receipt per payment</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">For researchers</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-600">
            <li>Research-only assignments matched to your discipline</li>
            <li>Guaranteed payment — funds are escrowed before you start</li>
            <li>Versioned submission portal, transparent payout ledger</li>
            <li>Build a verifiable portfolio with published-work links</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
