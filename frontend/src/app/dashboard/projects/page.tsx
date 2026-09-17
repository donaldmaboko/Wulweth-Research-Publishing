"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { get, isStaff, qs } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/format";
import { Card, EmptyState, Input, Select, StatusBadge, Table, Td } from "@/components/ui";

export default function ProjectsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    get(`/projects${qs({ q, status, page_size: 50 })}`)
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, status]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Projects</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">Every engagement, tracked by its unique ID from request to payment release.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search by title or tracking ID…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
          <Select className="max-w-[240px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {["REQUEST_SUBMITTED", "UNDER_REVIEW", "QUOTE_PREPARED", "AWAITING_CLIENT_APPROVAL", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "PROFESSIONAL_ASSIGNED", "IN_PROGRESS", "SUBMITTED", "QUALITY_REVIEW", "REVISION_REQUIRED", "APPROVED", "COMPLETED", "PAYMENT_RELEASED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-16 text-center text-[13px] text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState title="No projects found" />
        ) : (
          <Table head={["Tracking ID", "Title", "Professional", "Value", "Deadline", "Status", ""]}>
            {items.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-slate-50">
                <Td className="whitespace-nowrap font-mono text-[12px] text-slate-500">{p.tracking_id}</Td>
                <Td><Link href={`/dashboard/projects/${p.id}`} className="font-medium text-ink-600 hover:text-teal-700">{p.title}</Link></Td>
                <Td className="text-slate-500">{p.professional_name ?? <span className="text-slate-300">Unassigned</span>}</Td>
                <Td className="text-slate-500">{p.quoted_amount ?? "—"}</Td>
                <Td className="text-slate-500">{formatDate(p.deadline)}</Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td><Link href={`/dashboard/projects/${p.id}`} className="text-[13px] font-medium text-teal-700 hover:underline">Workspace</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
