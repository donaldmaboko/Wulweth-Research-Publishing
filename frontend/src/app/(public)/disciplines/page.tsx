import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research Disciplines",
  description:
    "Wulweth's structured research discipline taxonomy: health sciences, social sciences, education, business and economics, agriculture, STEM, data science, methodology and publishing.",
};

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";
export const revalidate = 600;

async function getFields(): Promise<{ group: string; fields: any[] }[]> {
  try {
    const res = await fetch(`${API_SERVER}/api/public/research-fields`, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error();
    return (await res.json()).groups ?? [];
  } catch {
    return [];
  }
}

export default async function DisciplinesPage() {
  const groups = await getFields();
  return (
    <>
      <section className="bg-ink-600 py-16 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Discipline Taxonomy</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold sm:text-[42px]">Research Disciplines</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            Wulweth organises research expertise across nine discipline groups. Professionals declare
            their disciplines, fields, methodologies and software so that research needs can be
            matched precisely.
          </p>
        </div>
      </section>
      <div className="container-w grid gap-6 py-16 md:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 && <p className="text-sm text-slate-400">Taxonomy is being prepared.</p>}
        {groups.map((g) => (
          <section key={g.group} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="font-display text-[18px] font-semibold">{g.group}</h2>
            <ul className="mt-3 space-y-1.5">
              {g.fields.map((f: any) => (
                <li key={f.id}>
                  <a href={`/expertise?field_id=${f.id}`} className="text-[13.5px] text-slate-600 transition-colors hover:text-teal-700 hover:underline">
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
