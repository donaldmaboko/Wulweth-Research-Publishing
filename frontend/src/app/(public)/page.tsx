import Link from "next/link";
import Image from "next/image";

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";

export const revalidate = 120;

async function getProfessionals(): Promise<any[]> {
  try {
    const res = await fetch(`${API_SERVER}/api/professionals?verified_only=true&page_size=3`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

const SERVICE_CATEGORIES = [
  {
    name: "Research Design",
    blurb: "Study architecture, sampling strategy, sample size and power analysis, questionnaire and survey design — quantitative, qualitative and mixed methods.",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.247",
  },
  {
    name: "Statistical Analysis",
    blurb: "Descriptive and inferential statistics, regression, ANOVA, survival and multivariate analysis — documented, reproducible and honestly reported.",
    icon: "M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
  {
    name: "Data Services",
    blurb: "Data cleaning, validation and management, statistical programming, visualization and dashboards for research-grade datasets.",
    icon: "M4 7v10c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3M4 7c0 1.66 3.58 3 8 3s8-1.34 8-3m0 5c0 1.66-3.58 3-8 3s-8-1.34-8-3",
  },
  {
    name: "Literature and Evidence",
    blurb: "Comprehensive literature searching, systematic and scoping review support, evidence mapping and reference management.",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.247",
  },
  {
    name: "Research Consulting",
    blurb: "Methodology, statistical and data consultation; research planning, reporting and presentation support at any project stage.",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a4 4 0 11-4-4",
  },
  {
    name: "Publishing Support",
    blurb: "Manuscript editing, proofreading, journal formatting and submission preparation — presenting your work at its professional best.",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
];

const STEPS = [
  { n: 1, title: "Submit your research need", body: "Describe your objective, discipline, service and timeline through a structured request." },
  { n: 2, title: "Request is reviewed", body: "The Wulweth desk reviews scope, integrity and feasibility — and clarifies where needed." },
  { n: 3, title: "Appropriate expertise is identified", body: "We match the request to verified professionals with the right methods and experience." },
  { n: 4, title: "Project is coordinated", body: "A quote is approved, payment is arranged, and a professional is assigned with a clear plan." },
  { n: 5, title: "Work is reviewed through quality control", body: "Every deliverable passes versioned QC review before it reaches you as final." },
  { n: 6, title: "Final deliverables are provided", body: "Approved outputs, documentation and source files are delivered through your secure workspace." },
];

const TRUST = [
  { title: "Verified professionals", body: "Qualifications are reviewed before the verification badge is granted." },
  { title: "Quality-control procedures", body: "Dedicated reviewers examine every deliverable version." },
  { title: "Secure document handling", body: "Encrypted storage, permission-checked access and signed downloads." },
  { title: "Research integrity standards", body: "Automated screening and human review of all submitted content." },
  { title: "Data protection practices", body: "Access controls, audit logging and privacy by design." },
];

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-[26px] font-semibold leading-tight sm:text-[32px]">{title}</h2>
      {lead && <p className="mt-3 text-[15px] leading-relaxed text-slate-500">{lead}</p>}
    </div>
  );
}

export default async function HomePage() {
  const professionals = await getProfessionals();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Wulweth Research & Publishing",
    slogan: "Where boundless curiosity meets limitless potential",
    description:
      "Professional platform connecting research needs with verified research expertise: statistical analysis, data services, research consulting and publishing support.",
    email: "hello@wulweth.example",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------------------------------- hero --------------------------------- */}
      <section className="relative overflow-hidden bg-ink-600 text-white">
        <Image src="/images/hero-abstract.jpg" alt="" fill priority sizes="100vw"
          className="pointer-events-none object-cover opacity-60" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-600 via-ink-600/92 to-ink-600/40" aria-hidden="true" />
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="container-w relative py-20 sm:py-28">
          <div className="max-w-2xl animate-fadeUp">
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-teal-300">
              Research · Expertise · Data · Collaboration · Quality · Integrity · Publishing
            </p>
            <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.08] sm:text-[52px]">
              Wulweth Research &amp; Publishing
            </h1>
            <p className="mt-3 font-display text-xl italic text-teal-200 sm:text-2xl">
              Where boundless curiosity meets limitless potential
            </p>
            <p className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-ink-100/90">
              Connect research needs with professional research expertise — statistical analysis,
              data services, research consulting and publishing support, coordinated end-to-end
              with quality control and research integrity at the core.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register?next=%2Fdashboard%2Frequests%2Fnew"
                className="rounded-lg bg-teal-500 px-6 py-3.5 text-[15px] font-semibold text-ink-800 shadow-lift transition-colors hover:bg-teal-400">
                Get Research Support
              </Link>
              <Link href="/expertise"
                className="rounded-lg border border-white/25 bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/15">
                Explore Research Expertise
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-[13.5px] text-ink-100/80">
              <Link href="/register?type=professional" className="font-medium text-teal-200 underline decoration-teal-400/40 underline-offset-4 hover:text-teal-100">
                Join as a Research Professional
              </Link>
              <Link href="/services" className="font-medium text-teal-200 underline decoration-teal-400/40 underline-offset-4 hover:text-teal-100">
                Explore Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- trust strip ------------------------------ */}
      <section className="border-b border-slate-100 bg-white">
        <div className="container-w grid gap-x-8 gap-y-5 py-8 sm:grid-cols-2 lg:grid-cols-5">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink-600">{t.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------- services ------------------------------- */}
      <section className="section bg-slate-50/60">
        <div className="container-w">
          <SectionHeading eyebrow="Research Services"
            title="Professional research services, end to end"
            lead="Six service families spanning the full research lifecycle — each delivered by vetted specialists and reviewed through quality control." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <Link key={cat.name} href={`/services#${cat.name.toLowerCase().replace(/ /g, "-")}`}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lift">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink-600 text-teal-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={cat.icon} /></svg>
                </span>
                <h3 className="mt-4 text-[17px] font-semibold">{cat.name}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{cat.blurb}</p>
                <p className="mt-3 text-[13px] font-semibold text-teal-700 group-hover:underline">View services →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- expertise -------------------------------- */}
      <section className="section bg-white">
        <div className="container-w">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Research Expertise</p>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight sm:text-[32px]">
                A professional directory of research expertise
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
                Wulweth is not a marketplace of gigs. It is a curated directory of research
                professionals — evaluated on what matters:
              </p>
              <ul className="mt-5 space-y-2.5">
                {["Qualifications", "Expertise", "Experience", "Verification", "Research record"].map((x) => (
                  <li key={x} className="flex items-center gap-3 text-[14.5px] font-medium text-ink-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" /> {x}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/expertise" className="rounded-lg bg-ink-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-700">
                  Browse the directory
                </Link>
                <Link href="/disciplines" className="rounded-lg border border-ink-200 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-ink-50">
                  Research disciplines
                </Link>
              </div>
            </div>
            <div className="grid gap-4">
              {professionals.length > 0 ? professionals.slice(0, 3).map((p: any) => (
                <Link key={p.id} href={`/expertise/${p.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
                  <div>
                    <p className="text-[15px] font-semibold text-ink-600">{p.full_name}</p>
                    <p className="text-[13px] text-slate-500">{p.professional_title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(p.disciplines ?? []).slice(0, 2).map((d: string) => (
                        <span key={d} className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">{d}</span>
                      ))}
                    </div>
                  </div>
                  <span className="flex flex-none items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11.5px] font-semibold text-teal-700">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" /></svg>
                    Verified
                  </span>
                </Link>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  The directory preview appears here once professionals publish their profiles.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ how it works ------------------------------ */}
      <section className="section bg-ink-600 text-white">
        <div className="container-w">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">How Wulweth Works</p>
            <h2 className="mt-2 font-display text-[26px] font-semibold text-white sm:text-[32px]">
              A coordinated path from research need to finished deliverable
            </h2>
          </div>
          <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 font-display text-[15px] font-bold text-teal-300 ring-1 ring-teal-400/30">
                  {s.n}
                </span>
                <h3 className="mt-4 text-[16px] font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-100/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------- integrity + publishing ---------------------- */}
      <section className="section bg-white">
        <div className="container-w grid items-center gap-12 lg:grid-cols-2">
          <div className="relative order-2 overflow-hidden rounded-2xl border border-slate-200 shadow-card lg:order-1">
            <Image src="/images/integrity.jpg" alt="Abstract illustration of research integrity safeguards"
              width={880} height={660} className="h-auto w-full" />
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow">Research Integrity</p>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight sm:text-[32px]">
              Legitimate research support, clearly bounded
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              Wulweth exists to strengthen research — never to substitute for it. We support
              statistical consultation, data cleaning and analysis, research design, literature
              searching, editing and publishing preparation.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
              We do not facilitate plagiarism, contract cheating, fabricated data or references,
              forged documents, or any circumvention of plagiarism or AI detection. Every request
              passes automated screening and, where needed, human review.
            </p>
            <Link href="/research-integrity" className="mt-6 inline-block rounded-lg border border-ink-200 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-ink-50">
              Read our integrity standards
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------- publishing + data ----------------------------- */}
      <section className="section bg-slate-50/60">
        <div className="container-w grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
            <p className="eyebrow">Publishing Support</p>
            <h3 className="mt-2 text-[22px] font-semibold">Present your research at its best</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
              Manuscript preparation, substantive editing, proofreading, journal formatting,
              reference styling and complete submission packages — prepared to the target
              journal&rsquo;s guidelines.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2 text-[13px] text-ink-600">
              {["Manuscript editing", "Proofreading", "Journal formatting", "Submission preparation", "Reference formatting", "Research communication"].map((x) => (
                <li key={x} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-teal-500" aria-hidden="true" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
            <p className="eyebrow">Data &amp; Statistics</p>
            <h3 className="mt-2 text-[22px] font-semibold">Data handled with statistical care</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
              From raw files to defensible results: statistical analysis, data cleaning and
              validation, statistical programming, survey analysis, dashboards and research data
              management — always documented and reproducible.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2 text-[13px] text-ink-600">
              {["Statistical analysis", "Data cleaning", "Visualization", "Statistical programming", "Survey analysis", "Data management"].map((x) => (
                <li key={x} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-teal-500" aria-hidden="true" />{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------- CTA ---------------------------------- */}
      <section className="section bg-white">
        <div className="container-w">
          <div className="rounded-2xl bg-ink-600 px-8 py-12 text-center shadow-lift sm:px-14">
            <h2 className="mx-auto max-w-xl font-display text-[24px] font-semibold text-white sm:text-[30px]">
              Wulweth connects research needs with professional research expertise.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14.5px] text-ink-100/85">
              Whether you need statistical analysis, a sampling plan, an indicator dashboard or a
              submission-ready manuscript — start with a structured research request.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register?next=%2Fdashboard%2Frequests%2Fnew" className="rounded-lg bg-teal-500 px-6 py-3.5 text-[15px] font-semibold text-ink-800 hover:bg-teal-400">
                Get Research Support
              </Link>
              <Link href="/register?type=professional" className="rounded-lg border border-white/25 bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/15">
                Join as a Research Professional
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
