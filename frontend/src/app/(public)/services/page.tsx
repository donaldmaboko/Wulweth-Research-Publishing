import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Research Services",
  description:
    "Professional research services: research design, statistical analysis, data services, literature and evidence, research consulting and publishing support.",
};

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";
export const revalidate = 300;

async function getServices(): Promise<{ category: string; services: any[] }[]> {
  try {
    const res = await fetch(`${API_SERVER}/api/public/services`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error();
    return (await res.json()).categories ?? [];
  } catch {
    return [];
  }
}

const CATEGORY_BLURBS: Record<string, string> = {
  "Research Design": "Sound studies start with sound design. Build defensible study architecture before data collection begins.",
  "Statistical Analysis": "Rigorous analysis with assumptions checked, methods documented and results reported honestly.",
  "Data Services": "Research-grade data handling: cleaning, validation, programming and visualization with full provenance.",
  "Literature and Evidence": "Systematic, documented approaches to finding and synthesising existing evidence.",
  "Research Consulting": "Focused expertise at any stage — from planning and methodology to reporting and presentation.",
  "Publishing Support": "Manuscript preparation and submission support that presents your research at its professional best.",
};

export default async function ServicesPage() {
  const categories = await getServices();
  return (
    <>
      <section className="bg-ink-600 py-16 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Service Catalogue</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight sm:text-[42px]">Research Services</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            Every service is delivered by a verified research professional and passes through
            Wulweth&rsquo;s quality-control review before delivery. Submit a research request and the
            Wulweth desk will scope the work, quote it transparently and match appropriate expertise.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register?next=%2Fdashboard%2Frequests%2Fnew" className="rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-ink-800 hover:bg-teal-400">
              Submit a research request
            </Link>
            <Link href="/research-integrity" className="rounded-lg border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15">
              What we do — and don&rsquo;t — support
            </Link>
          </div>
        </div>
      </section>

      <div className="container-w py-16">
        {categories.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">The service catalogue is being prepared.</p>
        ) : (
          <div className="space-y-16">
            {categories.map((cat) => (
              <section key={cat.category} id={cat.category.toLowerCase().replace(/ /g, "-")} className="scroll-mt-24">
                <div className="mb-6 max-w-2xl">
                  <h2 className="font-display text-[24px] font-semibold sm:text-[28px]">{cat.category}</h2>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">{CATEGORY_BLURBS[cat.category] ?? ""}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.services.map((s: any) => (
                    <div key={s.id} id={s.slug} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-card scroll-mt-24 transition-all hover:border-teal-200 hover:shadow-lift">
                      <h3 className="text-[15px] font-semibold text-ink-600">{s.name}</h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{s.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
