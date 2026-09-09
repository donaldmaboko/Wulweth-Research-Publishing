import type { Metadata } from "next";
import Link from "next/link";
import { all, get } from "@/lib/db";
import { moneyShort } from "@/lib/format";
import { DISCIPLINES, FEED_TYPE_META, type FeedPostType } from "@/lib/types";
import { Card, Pill, WulwethMark } from "@/components/ui";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

type Service = {
  id: string; slug: string; name: string; tagline: string;
  category: string; from_price_cents: number; eta_days: number | null;
};

export default function HomePage() {
  const services = all<Service>(
    "SELECT id, slug, name, tagline, category, from_price_cents, eta_days FROM services WHERE active = 1 ORDER BY sort_order LIMIT 4"
  );
  const posts = all<{
    id: string; type: FeedPostType; title: string; body: string; created_at: string;
  }>(
    "SELECT id, type, title, body, created_at FROM feed_posts WHERE published = 1 ORDER BY created_at DESC LIMIT 3"
  );
  const stats = {
    researchers: (get<{ c: number }>("SELECT count(*) AS c FROM users WHERE role='FREELANCER' AND verified=1")?.c ?? 0),
    delivered: (get<{ c: number }>("SELECT count(*) AS c FROM projects WHERE status IN ('COMPLETED','PAID_OUT')")?.c ?? 0),
    disciplines: DISCIPLINES.length,
    escrow: get<{ s: number | null }>(
      "SELECT SUM(amount_cents) AS s FROM payments WHERE status='ESCROWED'"
    )?.s ?? 0,
  };

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-ink-950 text-parchment">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #ddbd72 0, transparent 34%), radial-gradient(circle at 80% 20%, #5270a6 0, transparent 40%), radial-gradient(circle at 65% 85%, #0e7c6b 0, transparent 45%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="pill border-0 bg-white/10 text-gold-200 ring-white/20">
              The marketplace built exclusively for research
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl">
              Where boundless curiosity meets{" "}
              <span className="text-gold-300">limitless potential.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-8 text-ink-100">
              Wulweth pairs universities, clinics, NGOs and independent scholars with{" "}
              <strong className="text-white">vetted researchers</strong> — for literature reviews,
              statistical analysis, journal submission support and more. You pay into escrow, we
              manage quality control, and researchers are paid when the work passes review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/quote" className="btn-gold px-5 py-2.5 text-[15px]">Get a research quote</Link>
              <Link href="/services" className="btn px-5 py-2.5 text-[15px] ring-1 ring-inset ring-white/25 text-white hover:bg-white/10">
                Browse the service catalog
              </Link>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { k: "Vetted researchers", v: `${stats.researchers}+` },
                { k: "Projects delivered", v: `${stats.delivered}` },
                { k: "Research disciplines", v: `${stats.disciplines}` },
                { k: "Held in escrow now", v: moneyShort(stats.escrow) },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-widest text-ink-300">{s.k}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-gold-200">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product mock: a live tracking card */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-x-6 -inset-y-8 rounded-3xl bg-gradient-to-br from-white/10 to-transparent ring-1 ring-white/10" />
            <Card className="relative border-white/10 bg-white p-6 text-ink-900 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">Tracking ID</div>
                  <div className="font-mono text-sm font-bold text-ink-950">WRP-2026-KM74P</div>
                </div>
                <span className="pill bg-violet-50 text-violet-800 ring-violet-300">Under review</span>
              </div>
              <div className="mt-4 border-t border-ink-900/10 pt-4">
                <div className="font-display text-lg font-semibold">Systematic review · telehealth diabetes care</div>
                <div className="mt-0.5 text-xs text-ink-500">Medical &amp; Health Research · PRISMA-2020 protocol</div>
              </div>
              <ol className="mt-5 space-y-3 text-sm">
                {[
                  ["Quote accepted & funded", "done"],
                  ["Matched with Dr. A. Okoye (epidemiology)", "done"],
                  ["Deliverable v2 submitted for QC", "done"],
                  ["Editor review in progress", "active"],
                  ["Payout on your approval", "todo"],
                ].map(([label, state]) => (
                  <li key={label} className="flex items-start gap-3">
                    <span
                      className={
                        state === "done"
                          ? "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700"
                          : state === "active"
                            ? "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-100 text-[11px] font-bold text-gold-700"
                            : "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-400"
                      }
                    >
                      {state === "done" ? "✓" : state === "active" ? "•" : "○"}
                    </span>
                    <span className={state === "todo" ? "text-ink-400" : "text-ink-800"}>{label}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded-lg bg-parchment p-3 text-xs leading-5 text-ink-600 ring-1 ring-ink-900/10">
                <strong className="text-ink-900">Escrow protected:</strong> $4,200 held by Wulweth.
                Released to the researcher only after QC approval — or refunded per policy.
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- disciplines */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-950">
            Research is not a gig category. It&rsquo;s the whole platform.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-600">
            Generalist freelance sites bury research among logo designs and voiceovers. Wulweth is
            purpose-built around eight research disciplines, with editors who know what a
            methods section should look like.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DISCIPLINES.map((d, i) => (
            <div key={d} className="card flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-950 font-display text-sm font-bold text-gold-300">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-sm font-semibold leading-5 text-ink-800">{d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- how it works */}
      <section id="how-it-works" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-950">
            How a Wulweth engagement works
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-600">
            A managed marketplace — not a bidding war. Every step has an accountable owner.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              {
                n: "01", t: "Request & fixed quote",
                d: "Tell us the research need. A Wulweth desk officer scopes it and returns a fixed quote with deliverables and deadline.",
              },
              {
                n: "02", t: "Fund the escrow",
                d: "Pay by card or bank transfer. Funds are held by Wulweth — the researcher never touches them upfront.",
              },
              {
                n: "03", t: "Matched, researched, QC'd",
                d: "We assign a vetted researcher by discipline. Our editors review every deliverable before it reaches you.",
              },
              {
                n: "04", t: "Approve & release",
                d: "Approve the work to release payment to the researcher (minus our service fee). Revisions are requested at no cost.",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border-t-2 border-gold-500 bg-parchment p-5">
                <div className="font-display text-sm font-bold text-gold-700">{s.n}</div>
                <div className="mt-2 font-display text-lg font-bold text-ink-950">{s.t}</div>
                <p className="mt-2 text-sm leading-6 text-ink-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- services */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-950">
            Most-requested research services
          </h2>
          <Link href="/services" className="text-sm font-semibold text-ink-700 underline">
            See the full catalog →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <Pill className="w-fit bg-ink-50 text-ink-700 ring-ink-200">{s.category}</Pill>
              <div className="mt-3 font-display text-lg font-bold leading-6 text-ink-950">{s.name}</div>
              <p className="mt-1.5 flex-1 text-sm leading-6 text-ink-600">{s.tagline}</p>
              <div className="mt-4 flex items-center justify-between border-t border-ink-900/10 pt-3">
                <span className="text-sm font-bold text-ink-950">
                  from {moneyShort(s.from_price_cents)}
                </span>
                <span className="text-xs text-ink-500">{s.eta_days ?? "—"} day turnaround</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- trust */}
      <section id="trust" className="bg-ink-950 py-16 text-parchment">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white">
            Built on academic trust
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                t: "Vetted researchers only",
                d: "Every researcher passes credential review — degree verification, ORCID iD, writing sample and a discipline exam before their first assignment.",
              },
              {
                t: "Publication-grade QC",
                d: "Deliverables pass a two-eye editorial review against a rubric (methodology, sourcing, statistics, style) before funds move.",
              },
              {
                t: "Data security & GDPR",
                d: "Encrypted storage for manuscripts and datasets, least-privilege access, EU data-subject rights, and anonymized case studies by default.",
              },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <WulwethMark className="h-8 w-8" />
                <div className="mt-4 font-display text-lg font-bold text-white">{c.t}</div>
                <p className="mt-2 text-sm leading-7 text-ink-200">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ feed teas */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-950">
            From the company feed
          </h2>
          <Link href="/feed" className="text-sm font-semibold text-ink-700 underline">
            Open the feed →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {posts.map((p) => (
            <Card key={p.id} className="p-5">
              <Pill className={FEED_TYPE_META[p.type]?.className ?? ""}>
                {FEED_TYPE_META[p.type]?.label ?? p.type}
              </Pill>
              <div className="mt-3 font-display text-lg font-bold leading-6 text-ink-950">{p.title}</div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-600">{p.body}</p>
            </Card>
          ))}
          {posts.length === 0 ? (
            <p className="text-sm text-ink-500">Feed is warming up — check back soon.</p>
          ) : null}
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-r from-gold-600 via-gold-500 to-gold-400 px-8 py-12 text-center text-ink-950">
          <h2 className="font-display text-3xl font-bold">Have a research problem worth solving?</h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-7 text-ink-900/80">
            Send us the brief. You&rsquo;ll have a scoped, fixed-price quote from a desk officer —
            usually within one business day.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/quote" className="btn bg-ink-950 px-6 py-3 text-[15px] text-parchment hover:bg-ink-900">
              Request a quote
            </Link>
            <Link href="/signup?as=researcher" className="btn bg-white/90 px-6 py-3 text-[15px] text-ink-950 hover:bg-white">
              Join as a researcher
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
