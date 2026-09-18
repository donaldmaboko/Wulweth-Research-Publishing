"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, get, qs } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Select, VerifiedBadge, useDebounced } from "@/components/ui";

type Pro = {
  id: string; full_name: string; professional_title: string | null; bio: string | null;
  disciplines: string[]; expertise: string[]; methodologies: string[]; software: string[];
  languages: string[]; years_experience: number; availability: string; location: string | null;
  verification: string; research_fields: { id: string; name: string; group: string }[];
};

export default function ExpertiseDirectory() {
  const [items, setItems] = useState<Pro[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [methodology, setMethodology] = useState("");
  const [software, setSoftware] = useState("");
  const [availability, setAvailability] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [fields, setFields] = useState<{ group: string; fields: { id: string; name: string }[] }[]>([]);
  const dq = useDebounced(q);

  useEffect(() => {
    get("/public/research-fields").then((d) => setFields(d.groups ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    get(`/professionals${qs({
      q: dq, discipline, field_id: fieldId, methodology, software, availability,
      verified_only: verifiedOnly, page, page_size: 12,
    })}`)
      .then((d) => { setItems(d.items ?? []); setTotal(d.total ?? 0); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0 });
  }, [dq, discipline, fieldId, methodology, software, availability, verifiedOnly, page]);

  useEffect(() => { setPage(1); }, [dq, discipline, fieldId, methodology, software, availability, verifiedOnly]);

  const allFields = fields.flatMap((g) => g.fields);

  return (
    <>
      <section className="bg-ink-600 py-14 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Professional Directory</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold sm:text-[42px]">Research Expertise</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            A professional directory of research expertise — evaluated on qualifications, expertise,
            experience, verification and the research record. Not a marketplace of gigs.
          </p>
        </div>
      </section>

      <div className="container-w py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-card lg:sticky lg:top-24">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Search &amp; filters</h2>
            <Input placeholder="Search expertise, names…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search professionals" />
            <div className="mt-3 space-y-3">
              <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)} aria-label="Discipline">
                <option value="">All disciplines</option>
                {Array.from(new Set(fields.map((g) => g.group))).map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
              <Select value={fieldId} onChange={(e) => setFieldId(e.target.value)} aria-label="Research field">
                <option value="">All research fields</option>
                {allFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
              <Select value={methodology} onChange={(e) => setMethodology(e.target.value)} aria-label="Methodology">
                <option value="">Any methodology</option>
                {["Quantitative", "Qualitative", "Mixed Methods", "Survey Research", "Experimental Research"].map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Select value={software} onChange={(e) => setSoftware(e.target.value)} aria-label="Software">
                <option value="">Any software</option>
                {["R", "Python", "Stata", "SPSS", "NVivo", "Power BI", "Excel", "EndNote", "Zotero"].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select value={availability} onChange={(e) => setAvailability(e.target.value)} aria-label="Availability">
                <option value="">Any availability</option>
                {["FULL_TIME", "PART_TIME", "CONTRACT"].map((a) => <option key={a} value={a}>{a === "FULL_TIME" ? "Full-time" : a === "PART_TIME" ? "Part-time" : "Contract"}</option>)}
              </Select>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-ink-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                Qualification verified only
              </label>
              {(q || discipline || fieldId || methodology || software || availability || verifiedOnly) && (
                <Button variant="ghost" size="sm" onClick={() => { setQ(""); setDiscipline(""); setFieldId(""); setMethodology(""); setSoftware(""); setAvailability(""); setVerifiedOnly(false); }}>
                  Clear all filters
                </Button>
              )}
            </div>
          </aside>

          <div>
            <p className="mb-4 text-[13px] text-slate-500" role="status">
              {loading ? "Searching…" : `${total} professional${total === 1 ? "" : "s"} found`}
            </p>
            {!loading && items.length === 0 ? (
              <Card><EmptyState title="No professionals match those filters yet" body="Try broadening your search — new professionals join the directory as their qualifications are verified." /></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((p) => (
                  <Link key={p.id} href={`/expertise/${p.id}`}
                    className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-[16px] font-semibold text-ink-600 group-hover:text-teal-700">{p.full_name}</h2>
                        <p className="text-[13px] text-slate-500">{p.professional_title}</p>
                      </div>
                      <VerifiedBadge status={p.verification} />
                    </div>
                    <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-slate-500">{p.bio}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(p.expertise ?? []).slice(0, 3).map((x) => (
                        <span key={x} className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">{x}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[12px] text-slate-400">
                      <span>{p.years_experience}+ yrs experience{(p.location ? ` · ${p.location}` : "")}</span>
                      <span className="font-medium text-teal-700 group-hover:underline">View profile →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {total > 12 && (
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="self-center text-[13px] text-slate-500">Page {page} of {Math.ceil(total / 12)}</span>
                <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / 12)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
