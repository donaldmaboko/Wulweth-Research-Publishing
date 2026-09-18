import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Research Opportunities",
  description:
    "Curated research opportunities for verified research professionals — coordinated and assigned by Wulweth's research desk. No bidding, no chaos.",
};

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";
export const revalidate = 120;

async function getOpportunities(): Promise<any[]> {
  try {
    const res = await fetch(`${API_SERVER}/api/opportunities?status=OPEN&page_size=20`, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    return (await res.json()).items ?? [];
  } catch {
    return [];
  }
}

export default async function OpportunitiesPage() {
  const items = await getOpportunities();
  return (
    <>
      <section className="bg-ink-600 py-16 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">For Research Professionals</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold sm:text-[42px]">Research Opportunities</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            Curated research engagements — public, private, invitation-only or direct assignment.
            Wulweth&rsquo;s research desk coordinates matching and assignment, so professionals spend
            their time on research, not bidding. Express interest or respond to invitations from
            your professional workspace.
          </p>
          <Link href="/register?type=professional" className="mt-7 inline-block rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-ink-800 hover:bg-teal-400">
            Join as a Research Professional
          </Link>
        </div>
      </section>

      <div className="container-w max-w-5xl py-14">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No public opportunities are listed right now. Sign in as a research professional to see opportunities shared with members.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((o) => (
              <article key={o.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card transition-all hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="max-w-xl text-[17px] font-semibold leading-snug text-ink-600">{o.title}</h2>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-ink-50 px-2.5 py-1 text-[11.5px] font-semibold text-ink-500">{o.discipline ?? "Interdisciplinary"}</span>
                    {o.visibility === "PUBLIC" && (
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11.5px] font-semibold text-teal-700">Public</span>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-500">{o.description}</p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-[12.5px] text-slate-400">
                  {o.expected_timeline && <span>Timeline: {o.expected_timeline}</span>}
                  {o.location && <span>{o.location}</span>}
                  {(o.required_expertise ?? []).length > 0 && <span>Expertise: {(o.required_expertise ?? []).slice(0, 3).join(", ")}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
