"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { get } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/format";
import { Alert, Badge, Card, StatusBadge, Table, Td } from "@/components/ui";

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<any>(null);
  useEffect(() => { get(`/opportunities/${id}`).then(setO).catch(() => setO(null)); }, [id]);
  if (!o) return <p className="py-20 text-center text-sm text-slate-400">Opportunity not found.</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[24px] font-semibold">{o.title}</h1>
          <StatusBadge status={o.status} />
          <Badge className={o.visibility === "PUBLIC" ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-slate-100 text-slate-500 ring-slate-200"}>
            {o.visibility === "INVITATION_ONLY" ? "Invitation only" : o.visibility === "PRIVATE" ? "Private" : "Public"}
          </Badge>
        </div>
        <p className="mt-1 text-[13px] text-slate-500">
          {o.discipline ? `${o.discipline} · ` : ""}Timeline: {o.expected_timeline ?? "—"} · Closes {formatDate(o.closes_at)}
        </p>
      </div>
      {o.visibility === "PUBLIC" && (
        <Alert tone="info">This engagement is also listed on the public opportunities page.</Alert>
      )}
      <Card className="p-6">
        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">{o.description}</p>
        {o.required_expertise?.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Required expertise</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {o.required_expertise.map((x: string) => <Badge key={x} className="bg-ink-50 text-ink-600 ring-ink-100">{x}</Badge>)}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
