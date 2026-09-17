import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About",
  description:
    "Wulweth Research & Publishing connects individuals, organizations and institutions with professional research expertise — coordinated, quality-controlled and integrity-checked.",
};

const VALUES = [
  { title: "Research", body: "Everything we do serves the production and communication of sound research." },
  { title: "Expertise", body: "Professional specialists, evaluated on qualifications, experience and verification — not popularity." },
  { title: "Data", body: "Data handled with statistical care, documentation and respect for the people behind it." },
  { title: "Collaboration", body: "Clients, professionals and the Wulweth desk working in one coordinated workspace." },
  { title: "Quality", body: "Independent, versioned quality control on every deliverable — no exceptions." },
  { title: "Integrity", body: "Clear boundaries against misconduct, enforced through screening and human review." },
  { title: "Publishing", body: "Research communicated at its professional best, prepared for real editorial scrutiny." },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-ink-600 py-16 text-white">
        <div className="container-w grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">About Wulweth</p>
            <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight sm:text-[42px]">
              A professional platform for research, expertise and publishing
            </h1>
            <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-100/90">
              Wulweth Research &amp; Publishing connects individuals, organizations, companies,
              researchers, institutions and research professionals for legitimate research services,
              research expertise, data services, research consulting, collaboration and publishing
              support.
            </p>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-100/90">
              We help research professionals reach clients with real research needs — and give
              clients access to expertise they can verify and trust.
            </p>
          </div>
          <div className="relative hidden overflow-hidden rounded-2xl border border-white/10 lg:block">
            <Image src="/images/integrity.jpg" alt="" width={640} height={480} className="h-full w-full object-cover" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-w max-w-3xl">
          <p className="eyebrow">What Wulweth is</p>
          <h2 className="mt-2 font-display text-[26px] font-semibold sm:text-[32px]">A research desk, not a marketplace</h2>
          <div className="prose-w mt-5 text-[15px] text-slate-600">
            <p>
              Wulweth is deliberately structured like a modern research consultancy. Requests are
              reviewed by our research desk, scoped into transparent quotes, matched to appropriate
              expertise, and coordinated through to quality-controlled delivery. Professionals are
              selected for the strength of their qualifications, expertise, experience, verification
              and research record.
            </p>
            <p>
              That makes Wulweth credible for the people who need it most: researchers, companies,
              NGOs, government organizations, research institutions, universities, healthcare
              organizations and development organizations.
            </p>
          </div>
        </div>
      </section>

      <section className="section bg-slate-50/60">
        <div className="container-w">
          <h2 className="text-center font-display text-[26px] font-semibold sm:text-[32px]">What we stand for</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                <p className="font-display text-[17px] font-semibold text-teal-700">{v.title}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-w max-w-2xl text-center">
          <h2 className="font-display text-[24px] font-semibold sm:text-[30px]">Work with us</h2>
          <p className="mt-3 text-[14.5px] text-slate-500">
            Whether you need research support or you are a research professional looking for
            legitimate, well-coordinated engagements — start here.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/register?next=%2Fdashboard%2Frequests%2Fnew" className="rounded-lg bg-ink-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-ink-700">Get Research Support</Link>
            <Link href="/register?type=professional" className="rounded-lg border border-ink-200 px-6 py-3.5 text-sm font-semibold text-ink-600 hover:bg-ink-50">Join as a Research Professional</Link>
          </div>
        </div>
      </section>
    </>
  );
}
