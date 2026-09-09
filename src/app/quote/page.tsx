import type { Metadata } from "next";
import { all } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { QuoteForm } from "@/components/quote-form";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Get a research quote",
  description:
    "Describe your research need — literature review, statistical analysis, publication support — and receive a scoped, fixed-price quote from Wulweth's desk.",
};

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;
  const user = await getCurrentUser();
  const services = all<{ id: string; slug: string; name: string }>(
    "SELECT id, slug, name FROM services WHERE active = 1 ORDER BY sort_order"
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_0.6fr]">
      <Card className="p-7">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-950">
          Tell us the research problem
        </h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-ink-600">
          No obligation. We scope every request into a fixed quote with named deliverables and a
          deadline — you approve before anything is charged.
        </p>
        <QuoteForm
          services={services}
          prefillService={service}
          prefillName={user?.role === "CLIENT" ? user.name : undefined}
          prefillEmail={user?.role === "CLIENT" ? user.email : undefined}
        />
      </Card>

      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-600">
            <li>A desk officer scopes the brief and clarifies open points.</li>
            <li>You receive a <strong>fixed quote</strong> with deliverables, timeline and price.</li>
            <li>On approval we issue an invoice; card or bank transfer funds the escrow.</li>
            <li>We match a vetted researcher and QC every deliverable before release.</li>
          </ol>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">Ethics &amp; integrity</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Wulweth provides research <em>assistance</em> — analysis, editing, literature
            synthesis, methods support. Deliverables are provided for research support purposes
            and clients remain responsible for appropriate use, disclosure and authorship
            practices of their institution or target journal.
          </p>
        </Card>
      </div>
    </div>
  );
}
