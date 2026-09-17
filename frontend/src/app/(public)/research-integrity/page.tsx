import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Research Integrity",
  description:
    "Wulweth's research integrity standards: legitimate research support with clear boundaries against plagiarism, contract cheating, fabricated data and research misconduct.",
};

const SUPPORTED = [
  "Statistical consultation and analysis",
  "Data cleaning, management and visualization",
  "Research design and methodology consultation",
  "Questionnaire development and sampling consultation",
  "Power analysis and sample size justification",
  "Literature searching and evidence mapping",
  "Statistical programming and reproducible workflows",
  "Research editing, proofreading and formatting",
  "Manuscript preparation and journal submission support",
  "Research reporting and presentation support",
];

const PROHIBITED = [
  "Plagiarism and contract cheating",
  "Assignment or examination completion for dishonest submission",
  "Thesis or dissertation ghostwriting intended to be submitted as another person's own work",
  "Fabricated datasets, results or findings",
  "Falsification or manipulation of research findings",
  "Fabricated references or publications",
  "Forged academic documents and impersonation",
  "Copyright infringement and unauthorized reproduction",
  "Circumvention of plagiarism detection or AI detection",
  "Any other form of research or academic misconduct",
];

const SAFEGUARDS = [
  {
    title: "Automated screening",
    body: "Every research request, opportunity, profile and feed post passes automated screening for integrity and copyright risk before it proceeds.",
  },
  {
    title: "Human review",
    body: "Flagged content goes to Wulweth's moderation desk. Reviewers can approve, reject, restrict or request clarification — every decision is recorded with a reason.",
  },
  {
    title: "Purpose assessment",
    body: "We assess the purpose and intended use of each request. Editing your own manuscript is supported; having someone else's work submitted as yours is not.",
  },
  {
    title: "Copyright protection",
    body: "Uploaders confirm ownership or licence for all material. Anyone can report copyright concerns; reported material is reviewed and can be removed while under review.",
  },
  {
    title: "Quality control",
    body: "Deliverables pass independent versioned QC review — reinforcing honesty about methods, assumptions and limitations.",
  },
  {
    title: "Accountability",
    body: "Violations lead to content removal and account restriction. A full audit trail supports institutional and legal obligations.",
  },
];

export default function ResearchIntegrityPage() {
  return (
    <>
      <section className="bg-ink-600 py-16 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Our Standards</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight sm:text-[42px]">Research Integrity</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            Wulweth exists to strengthen legitimate research — never to substitute for it, and never
            to enable misconduct. These standards define what we support, what we refuse, and how
            we enforce the boundary.
          </p>
        </div>
      </section>

      <div className="container-w max-w-5xl py-14">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-teal-200 bg-teal-50/50 p-7" aria-labelledby="legit">
            <h2 id="legit" className="font-display text-[20px] font-semibold text-teal-800">What we support</h2>
            <p className="mt-1 text-[13px] text-teal-700/80">Legitimate professional research assistance</p>
            <ul className="mt-4 space-y-2.5">
              {SUPPORTED.map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink-700">
                  <svg className="mt-0.5 h-4 w-4 flex-none text-teal-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                  {x}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-7" aria-labelledby="not">
            <h2 id="not" className="font-display text-[20px] font-semibold text-rose-800">What we do not facilitate</h2>
            <p className="mt-1 text-[13px] text-rose-700/80">Research and academic misconduct</p>
            <ul className="mt-4 space-y-2.5">
              {PROHIBITED.map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink-700">
                  <svg className="mt-0.5 h-4 w-4 flex-none text-rose-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 7.3a1 1 0 00-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 101.4 1.4L10 11.4l1.3 1.3a1 1 0 001.4-1.4L11.4 10l1.3-1.3a1 1 0 00-1.4-1.4L10 8.6 8.7 7.3z" clipRule="evenodd" /></svg>
                  {x}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-14" aria-labelledby="safeguards">
          <h2 id="safeguards" className="text-center font-display text-[24px] font-semibold sm:text-[28px]">How the boundary is enforced</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[14px] text-slate-500">
            Integrity controls run through every part of the platform — from the first submitted
            word to the final approved deliverable.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAFEGUARDS.map((s) => (
              <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-[15px] font-semibold text-ink-600">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl bg-ink-600 px-8 py-10 text-center text-white">
          <h2 className="font-display text-[22px] font-semibold text-white">Report a concern</h2>
          <p className="mx-auto mt-2 max-w-lg text-[14px] text-ink-100/85">
            If you see content or behaviour that conflicts with these standards, report it in one
            click from any post or profile — or write to{" "}
            <a className="underline decoration-teal-400 underline-offset-4" href="mailto:integrity@wulweth.example">integrity@wulweth.example</a>.
            Every report receives a human review.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/policies/integrity" className="rounded-lg border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15">
              Read the full Research Integrity Policy
            </Link>
            <Link href="/policies/copyright" className="rounded-lg border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15">
              Copyright Policy
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
