"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get, qs } from "@/lib/api";
import { money, statusLabel } from "@/lib/format";
import { Badge, Card, EmptyState, Input, Spinner, StatusBadge } from "@/components/ui";

function SearchInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback((query: string) => {
    if (query.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    get(`/search${qs({ q: query })}`).then(setResults).catch(() => setResults({})).finally(() => setLoading(false));
  }, []);

  useEffect(() => { run(params.get("q") ?? ""); }, [params, run]);

  const total = results ? (results.total ?? Object.values(results).reduce((n: number, v: any) => n + (Array.isArray(v) ? v.length : 0), 0)) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Search</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">Find your projects, requests, services, professionals, opportunities and feed posts in one place.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <Input className="text-[15px]" placeholder="Search everything…" value={q} onChange={(e) => setQ(e.target.value)}
          aria-label="Global search" autoFocus />
      </form>

      {loading && <div className="py-16 text-center"><Spinner /></div>}

      {!loading && results && total === 0 && (
        <EmptyState title="No matches" body={`Nothing matched “${q}”. Try a discipline, method, tracking ID or service name.`} />
      )}

      {!loading && results && (results.services?.length > 0) && (
        <Section title="Services">
          {results.services.map((s: any) => (
            <Link key={s.id} href={`/services#${s.slug ?? s.name.toLowerCase().replaceAll(" ", "-")}`}
              className="block rounded-lg px-4 py-2.5 hover:bg-slate-50">
              <p className="text-[13.5px] font-medium text-ink-600">{s.name}</p>
              <p className="text-[12px] text-slate-400">{s.category}</p>
            </Link>
          ))}
        </Section>
      )}

      {!loading && results && (results.projects?.length > 0) && (
        <Section title="Projects">
          {results.projects.map((p: any) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-ink-600">{p.title}</p>
                <p className="font-mono text-[11.5px] text-slate-400">{p.tracking_id}</p>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </Section>
      )}

      {!loading && results && (results.requests?.length > 0) && (
        <Section title="Research requests">
          {results.requests.map((r: any) => (
            <Link key={r.id} href={`/dashboard/requests/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-ink-600">{r.title}</p>
                <p className="font-mono text-[11.5px] text-slate-400">{r.tracking_id}</p>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </Section>
      )}

      {!loading && results && (results.professionals?.length > 0) && (
        <Section title="Professionals">
          {results.professionals.map((pr: any) => (
            <Link key={pr.user_id ?? pr.id} href={`/expertise/${pr.profile_id ?? pr.id}`} className="block rounded-lg px-4 py-2.5 hover:bg-slate-50">
              <p className="text-[13.5px] font-medium text-ink-600">{pr.full_name}</p>
              <p className="text-[12px] text-slate-400">{pr.professional_title}</p>
            </Link>
          ))}
        </Section>
      )}

      {!loading && results && (results.opportunities?.length > 0) && (
        <Section title="Opportunities">
          {results.opportunities.map((o: any) => (
            <Link key={o.id} href={`/dashboard/opportunities/${o.id}`} className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 hover:bg-slate-50">
              <p className="min-w-0 truncate text-[13.5px] font-medium text-ink-600">{o.title}</p>
              <Badge className="bg-ink-50 text-ink-600 ring-ink-100">{statusLabel(o.status)}</Badge>
            </Link>
          ))}
        </Section>
      )}

      {!loading && results && (results.feed_posts?.length > 0) && (
        <Section title="Feed posts">
          {results.feed_posts.map((f: any) => (
            <Link key={f.id} href={`/feed/${f.id}`} className="block rounded-lg px-4 py-2.5 hover:bg-slate-50">
              <p className="text-[13.5px] font-medium text-ink-600">{f.title}</p>
              <p className="text-[12px] text-slate-400">{f.category?.name ?? ""}{f.published_at ? ` · ${new Date(f.published_at).toLocaleDateString("en-GB")}` : ""}</p>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="border-b border-slate-100 px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="divide-y divide-slate-50">{children}</div>
    </Card>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<div className="py-24 text-center"><Spinner /></div>}><SearchInner /></Suspense>;
}
