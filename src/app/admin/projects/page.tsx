import Link from "next/link";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { PROJECT_STATUSES, PROJECT_STATUS_META, type ProjectStatus } from "@/lib/types";

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = PROJECT_STATUSES.includes(status as ProjectStatus) ? (status as ProjectStatus) : null;

  const projects = all<{
    id: string; tracking_id: string; title: string; status: ProjectStatus;
    client_name: string; researcher_name: string | null; agreed_cents: number | null;
    discipline: string; created_at: string;
  }>(
    `SELECT p.id, p.tracking_id, p.title, p.status, p.agreed_cents, p.discipline, p.created_at,
            c.name AS client_name, r.name AS researcher_name
     FROM projects p
     JOIN users c ON c.id = p.client_id
     LEFT JOIN users r ON r.id = p.researcher_id
     ${filter ? "WHERE p.status = ?" : ""}
     ORDER BY p.created_at DESC LIMIT 200`,
    ...(filter ? [filter] : [])
  );

  return (
    <div>
      <PageHeader title="All projects" subtitle="Full book of engagements across every client and researcher." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/projects"
          className={`pill ${!filter ? "bg-ink-950 text-parchment ring-ink-950" : "bg-white text-ink-700 ring-ink-200"}`}>
          All
        </Link>
        {PROJECT_STATUSES.map((s) => (
          <Link key={s} href={`/admin/projects?status=${s}`}
            className={`pill ${filter === s ? "bg-ink-950 text-parchment ring-ink-950" : PROJECT_STATUS_META[s].className}`}>
            {PROJECT_STATUS_META[s].label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState title="Nothing here" body="No projects match this filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
          <table className="table-base">
            <thead>
              <tr><th>Tracking</th><th>Title</th><th>Discipline</th><th>Client</th><th>Researcher</th><th>Price</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.tracking_id}</td>
                  <td className="max-w-[240px] truncate font-medium">{p.title}</td>
                  <td className="text-ink-600">{p.discipline}</td>
                  <td className="text-ink-600">{p.client_name}</td>
                  <td className="text-ink-600">{p.researcher_name ?? "—"}</td>
                  <td className="font-semibold">{money(p.agreed_cents)}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td className="text-right">
                    <Link href={`/admin/projects/${p.id}`} className="text-sm font-semibold text-ink-700 underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-500">Showing {projects.length} project(s) · created date order · {fmtDate(new Date().toISOString())}</p>
    </div>
  );
}
