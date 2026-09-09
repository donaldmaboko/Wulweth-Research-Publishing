import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { money, moneyShort } from "@/lib/format";
import { Card, Pill } from "@/components/ui";

export const metadata: Metadata = {
  title: "Research service catalog",
  description:
    "Fixed-price research services: systematic literature reviews, statistical analysis, data visualization, journal submission support, thesis support, academic editing and more.",
};

type Service = {
  id: string; slug: string; name: string; tagline: string; description: string;
  category: string; from_price_cents: number; eta_days: number | null;
};

export default function ServicesPage() {
  const services = all<Service>(
    "SELECT * FROM services WHERE active = 1 ORDER BY category, sort_order"
  );
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="max-w-2xl">
        <p className="pill bg-gold-100 text-gold-800 ring-gold-300">Service catalog</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-950">
          Every engagement is research. Nothing else.
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-600">
          Prices below are <strong>starting points</strong> — every request is scoped by a desk
          officer into a fixed quote before anyone pays. Your funds sit in escrow until you
          approve the QC-passed deliverable.
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="mt-12">
          <h2 className="font-display text-xl font-bold text-ink-900">{cat}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services
              .filter((s) => s.category === cat)
              .map((s) => (
                <Card key={s.id} className="flex flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-display text-lg font-bold leading-6 text-ink-950">{s.name}</div>
                    {s.eta_days ? (
                      <Pill className="shrink-0 bg-ink-50 text-ink-600 ring-ink-200">~{s.eta_days}d</Pill>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink-700">{s.tagline}</p>
                  <p className="mt-3 flex-1 text-sm leading-6 text-ink-600">{s.description}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-ink-900/10 pt-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Starting at</div>
                      <div className="font-display text-xl font-bold text-ink-950">
                        {moneyShort(s.from_price_cents)}
                      </div>
                    </div>
                    <Link href={`/quote?service=${s.slug}`} className="btn-primary btn-sm">
                      Get a quote
                    </Link>
                  </div>
                </Card>
              ))}
          </div>
        </section>
      ))}

      <div className="mt-14 rounded-xl border border-ink-900/10 bg-white p-6">
        <h3 className="font-display text-lg font-bold text-ink-950">What your quote always includes</h3>
        <div className="mt-4 grid gap-6 text-sm leading-6 text-ink-600 md:grid-cols-3">
          <p><strong className="text-ink-900">A named researcher.</strong> Matched by discipline and methodology, with credentials you can verify (ORCID, affiliation, publications).</p>
          <p><strong className="text-ink-900">Editor QC pass.</strong> A rubric-based review — methodology, sourcing, statistics, style — before anything reaches you.</p>
          <p><strong className="text-ink-900">Escrow protection.</strong> {money(10000)}-style milestones are held by Wulweth and released only on approval. Disputes are arbitrated by our desk.</p>
        </div>
      </div>
    </div>
  );
}
