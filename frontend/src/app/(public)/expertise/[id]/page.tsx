import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";
export const revalidate = 120;

async function getProfile(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_SERVER}/api/professionals/${id}`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProfile(params.id);
  if (!p) return { title: "Professional profile" };
  return {
    title: `${p.full_name} — ${p.professional_title ?? "Research Professional"}`,
    description: (p.bio ?? "").slice(0, 155),
  };
}

function Chips({ items, tone = "ink" }: { items?: string[]; tone?: "ink" | "teal" }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${tone === "teal" ? "bg-teal-50 text-teal-700" : "bg-ink-50 text-ink-500"}`}>{x}</span>
      ))}
    </div>
  );
}

export default async function ProfessionalProfile({ params }: { params: { id: string } }) {
  const p = await getProfile(params.id);
  if (!p) notFound();

  return (
    <>
      <section className="bg-ink-600 py-12 text-white">
        <div className="container-w">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Research Professional</p>
              <h1 className="mt-2 font-display text-[30px] font-semibold sm:text-[38px]">{p.full_name}</h1>
              <p className="mt-1 text-[16px] text-teal-200">{p.professional_title}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-100/85">
                <span>{p.years_experience}+ years experience</span>
                {p.location && <span>{p.location}</span>}
                <span>{p.availability === "FULL_TIME" ? "Full-time" : p.availability === "PART_TIME" ? "Part-time" : p.availability === "CONTRACT" ? "Contract engagement" : "Currently unavailable"}</span>
                {(p.languages ?? []).length > 0 && <span>Languages: {(p.languages ?? []).join(", ")}</span>}
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/15 font-display text-2xl font-bold text-teal-200 ring-1 ring-teal-400/30" aria-hidden="true">
              {p.full_name.split(" ").filter(Boolean).slice(0, 2).map((s: string) => s[0]).join("")}
            </div>
          </div>
        </div>
      </section>

      <div className="container-w grid max-w-6xl gap-10 py-12 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <section aria-labelledby="about">
            <h2 id="about" className="font-display text-[20px] font-semibold">Professional biography</h2>
            <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-600">{p.bio}</p>
          </section>

          {p.research_fields?.length > 0 && (
            <section className="mt-9" aria-labelledby="fields">
              <h2 id="fields" className="font-display text-[20px] font-semibold">Research disciplines &amp; fields</h2>
              <div className="mt-3 space-y-3">
                {Object.entries(
                  p.research_fields.reduce((acc: Record<string, string[]>, f: any) => {
                    (acc[f.group] = acc[f.group] ?? []).push(f.name);
                    return acc;
                  }, {})
                ).map(([group, names]) => (
                  <div key={group as string}>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                    <div className="mt-1.5"><Chips items={names as string[]} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-9 grid gap-6 sm:grid-cols-2" aria-label="Expertise details">
            <div><h3 className="mb-2 text-[14px] font-semibold text-ink-600">Areas of expertise</h3><Chips items={p.expertise} tone="teal" /></div>
            <div><h3 className="mb-2 text-[14px] font-semibold text-ink-600">Methodologies</h3><Chips items={p.methodologies} /></div>
            <div><h3 className="mb-2 text-[14px] font-semibold text-ink-600">Statistical methods</h3><Chips items={p.statistical_methods} /></div>
            <div><h3 className="mb-2 text-[14px] font-semibold text-ink-600">Software</h3><Chips items={p.software} /></div>
            <div><h3 className="mb-2 text-[14px] font-semibold text-ink-600">Industry experience</h3><Chips items={p.industries} /></div>
          </section>

          {p.qualifications?.length > 0 && (
            <section className="mt-9" aria-labelledby="quals">
              <h2 id="quals" className="font-display text-[20px] font-semibold">Qualifications</h2>
              <ul className="mt-3 space-y-3">
                {p.qualifications.map((q: any) => (
                  <li key={q.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="text-[14.5px] font-semibold text-ink-600">{q.degree}</p>
                      <p className="text-[13px] text-slate-500">{q.institution}{q.year ? ` · ${q.year}` : ""}</p>
                    </div>
                    {q.verification === "VERIFIED" && (
                      <span className="flex flex-none items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11.5px] font-semibold text-teal-700">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" /></svg>
                        Verified
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.publications?.length > 0 && (
            <section className="mt-9" aria-labelledby="pubs">
              <h2 id="pubs" className="font-display text-[20px] font-semibold">Selected publications</h2>
              <ol className="mt-3 space-y-4">
                {p.publications.map((pub: any) => (
                  <li key={pub.id} className="border-l-2 border-teal-200 pl-4">
                    <p className="text-[14.5px] font-medium leading-snug text-ink-600">{pub.title}</p>
                    <p className="mt-1 text-[12.5px] text-slate-500">
                      {[pub.journal, pub.year, pub.pub_type].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {p.portfolio?.length > 0 && (
            <section className="mt-9" aria-labelledby="portfolio">
              <h2 id="portfolio" className="font-display text-[20px] font-semibold">Portfolio</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {p.portfolio.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-5">
                    <p className="text-[14.5px] font-semibold text-ink-600">{item.title}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{item.description}</p>
                    <p className="mt-2 text-[12px] text-slate-400">{[item.discipline, item.year].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Working with Wulweth</h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
              Engagements with Wulweth professionals are coordinated by our research desk: scoped,
              quoted, contracted and quality-controlled. Submit a request to work with a specialist
              like {String(p.full_name).split(" ")[0]}.
            </p>
            <Link href="/register?next=%2Fdashboard%2Frequests%2Fnew" className="mt-4 block rounded-lg bg-ink-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-ink-700">
              Start a research request
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-[13px] font-semibold text-ink-600">Verification &amp; quality</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
              Qualification verification, QC review of every deliverable, and platform-wide research
              integrity screening protect every engagement.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
