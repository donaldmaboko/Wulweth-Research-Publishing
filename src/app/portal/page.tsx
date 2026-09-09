import Link from "next/link";
import { all, get } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { PROJECT_STATUS_META, type ProjectStatus } from "@/lib/types";
import { Card, EmptyState, Stat, StatusPill } from "@/components/ui";

type Project = {
  id: string; tracking_id: string; title: string; status: ProjectStatus;
  discipline: string; deadline: string | null; agreed_cents: number | null;
  service_name: string; researcher_name: string | null; created_at: string;
};

export default async function ClientDashboard() {
  const user = await requireRole("CLIENT");

  const projects = all<Project>(
    `SELECT p.id, p.tracking_id, p.title, p.status, p.discipline, p.deadline, p.agreed_cents,
            s.name AS service_name, u.name AS researcher_name, p.created_at
     FROM projects p
     JOIN services s ON s.id = p.service_id
     LEFT JOIN users u ON u.id = p.researcher_id
     WHERE p.client_id = ? AND p.status != 'CANCELLED'
     ORDER BY p.created_at DESC`,
    user.id
  );

  const escrow = get<{ s: number | null }>(
    `SELECT SUM(pay.amount_cents) AS s FROM payments pay
     JOIN invoices i ON i.id = pay.invoice_id
     WHERE i.client_id = ? AND pay.status = 'ESCROWED'`,
    user.id
  )?.s ?? 0;

  const issued = all<{ id: string; number: string; total_cents: number; due_date: string }>(
    "SELECT id, number, total_cents, due_date FROM invoices WHERE client_id = ? AND status = 'ISSUED' ORDER BY created_at DESC",
    user.id
  );

  const quoted = projects.filter((p) => p.status === "QUOTED");
  const active = projects.filter((p) => ["ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW"].includes(p.status));
  const done = projects.filter((p) => ["COMPLETED", "PAID_OUT"].includes(p.status));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active projects" value={active.length} hint="assigned, in progress or in QC" />
        <Stat label="Held in escrow" value={money(escrow)} hint="released on your approval" href="/portal/invoices" />
        <Stat label="Awaiting your action" value={quoted.length + issued.length} hint="quotes to approve · invoices to pay" />
        <Stat label="Completed" value={done.length} hint="delivered & approved" />
      </div>

      {quoted.length > 0 || issued.length > 0 ? (
        <Card className="border-gold-300 bg-gold-50 p-5">
          <h2 className="font-display text-lg font-bold text-ink-950">Action needed</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {quoted.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-4 py-3 ring-1 ring-gold-200">
                <span>
                  <span className="font-mono text-xs text-ink-500">{p.tracking_id}</span>{" "}
                  <strong>{p.title}</strong> — quote ready:{" "}
                  <strong>{money(p.agreed_cents)}</strong>
                </span>
                <Link href={`/portal/projects/${p.id}`} className="btn-gold btn-sm">Review quote &amp; fund</Link>
              </li>
            ))}
            {issued.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-4 py-3 ring-1 ring-gold-200">
                <span>
                  Invoice <span className="font-mono text-xs text-ink-500">{i.number}</span> —{" "}
                  <strong>{money(i.total_cents)}</strong> unpaid
                </span>
                <Link href={`/portal/invoices/${i.id}`} className="btn-gold btn-sm">Pay now</Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink-950">Projects</h2>
          <Link href="/portal/new" className="btn-primary btn-sm">+ New research request</Link>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="Submit your first research request — a literature review, statistical analysis, publication support — and we'll return a fixed quote with a tracking ID."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Tracking ID</th><th>Project</th><th>Service</th><th>Researcher</th>
                  <th>Deadline</th><th>Price</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.tracking_id}</td>
                    <td className="max-w-[260px] truncate font-medium">{p.title}</td>
                    <td className="text-ink-600">{p.service_name}</td>
                    <td className="text-ink-600">{p.researcher_name ?? "—"}</td>
                    <td className="text-ink-600">{fmtDate(p.deadline)}</td>
                    <td className="font-semibold">{money(p.agreed_cents)}</td>
                    <td><StatusPill status={p.status} /></td>
                    <td className="text-right">
                      <Link href={`/portal/projects/${p.id}`} className="text-sm font-semibold text-ink-700 underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {projects[0] ? (
          <p className="mt-2 text-xs text-ink-500">
            Current status meaning: <strong>{PROJECT_STATUS_META[projects[0].status].label}</strong> —{" "}
            {PROJECT_STATUS_META[projects[0].status].hint}
          </p>
        ) : null}
      </section>
    </div>
  );
}
