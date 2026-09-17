"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, isStaff, qs } from "@/lib/api";
import { formatDate, money, statusLabel } from "@/lib/format";
import { Button, Card, EmptyState, Input, Select, StatusBadge, Table, Td } from "@/components/ui";

export default function RequestsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    get(`/research-requests${qs({ q, status, page_size: 50 })}`)
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, status]);

  const staff = isStaff(user);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold">Research Requests</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-500">
            {staff ? "Review, clarify and convert incoming research needs." : "Your research needs — drafts, submissions and their progress."}
          </p>
        </div>
        <Link href="/dashboard/requests/new"><Button>Submit a research request</Button></Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search by title or tracking ID…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search requests" />
          <Select className="max-w-[220px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED", "QUOTED", "CONVERTED", "DECLINED"].map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-16 text-center text-[13px] text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState title="No research requests found" body="Submit a structured research request and the Wulweth desk will take it from there."
            action={<Link href="/dashboard/requests/new"><Button size="sm">Submit a request</Button></Link>} />
        ) : (
          <Table head={["Tracking ID", "Title", staff ? "Client" : "Service", "Budget", "Deadline", "Status", ""]}>
            {items.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-50">
                <Td className="whitespace-nowrap font-mono text-[12px] text-slate-500">{r.tracking_id ?? "—"}</Td>
                <Td><Link href={`/dashboard/requests/${r.id}`} className="font-medium text-ink-600 hover:text-teal-700">{r.title}</Link></Td>
                <Td className="text-slate-500">{staff ? r.client_name : r.service_name ?? "—"}</Td>
                <Td className="text-slate-500">{r.budget_min ? `${money(r.budget_min, r.currency)} – ${money(r.budget_max, r.currency)}` : "—"}</Td>
                <Td className="text-slate-500">{formatDate(r.deadline)}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td><Link href={`/dashboard/requests/${r.id}`} className="text-[13px] font-medium text-teal-700 hover:underline">Open</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
