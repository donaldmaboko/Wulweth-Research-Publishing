"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, isStaff, isProfessional } from "@/lib/api";
import { money, statusLabel, timeAgo } from "@/lib/format";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Spinner, StatCard, StatusBadge } from "@/components/ui";

export default function DashboardOverview() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [qcQueue, setQcQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      get("/projects?page_size=5"),
      isStaff(user) || user.role === "CLIENT" || user.role === "ORGANIZATION" ? get("/research-requests?page_size=5") : Promise.resolve(null),
      get("/notifications?page_size=6"),
      isProfessional(user) ? get("/my/earnings") : Promise.resolve(null),
      user.role === "QC_REVIEWER" || isStaff(user) ? get("/qc/queue") : Promise.resolve(null),
      isStaff(user) ? get("/analytics/overview") : Promise.resolve(null),
    ]).then(([p, r, n, e, q, s]) => {
      if (p.status === "fulfilled") setProjects(p.value.items ?? []);
      if (r.status === "fulfilled" && r.value) setRequests(r.value.items ?? []);
      if (n.status === "fulfilled") setNotifications(n.value.items ?? []);
      if (e.status === "fulfilled" && e.value) setEarnings(e.value);
      if (q.status === "fulfilled" && q.value) setQcQueue(q.value.items ?? []);
      if (s.status === "fulfilled" && s.value) setStats(s.value);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex justify-center py-24 text-ink-300"><Spinner className="h-8 w-8" /></div>;

  const staff = isStaff(user);
  const professional = isProfessional(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold">Welcome back, {user.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            {professional && "Your research workspace — opportunities, assignments, deliverables and earnings."}
            {user.role === "CLIENT" && "Your client workspace — requests, projects, quotes and documents."}
            {user.role === "ORGANIZATION" && "Your organization workspace — team projects, invoices and research requests."}
            {staff && "The Wulweth desk — requests, coordination, quality control and governance."}
          </p>
        </div>
        {user.role === "CLIENT" || user.role === "ORGANIZATION" || staff ? (
          <Link href="/dashboard/requests/new"><Button>Submit a research request</Button></Link>
        ) : professional ? (
          <Link href="/dashboard/opportunities"><Button>View opportunities</Button></Link>
        ) : null}
      </div>

      {!user.email_verified && (
        <Alert tone="warning" title="Verify your email address">
          Check your inbox for the verification link to fully activate your account.
        </Alert>
      )}

      {/* stat cards by role */}
      {staff && stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active projects" value={stats.projects.active} hint={`${stats.projects.total} total`} />
          <StatCard label="Pending requests" value={stats.projects.pending_requests} tone="gold" hint="Awaiting desk review" />
          <StatCard label="Revenue (confirmed)" value={money(stats.finance.revenue_total)} tone="teal" hint={`${money(stats.finance.revenue_30d)} in last 30 days`} />
          <StatCard label="QC queue" value={stats.projects.qc_queue} hint={`${stats.governance.moderation_pending} moderation cases pending`} />
        </div>
      ) : professional && earnings ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Lifetime earnings" value={money(earnings.totals.paid)} tone="teal" />
          <StatCard label="Pending payouts" value={money(earnings.totals.pending)} tone="gold" />
          <StatCard label="Platform fees (paid projects)" value={money(earnings.totals.fees)} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Active projects" value={projects.filter((p) => !["COMPLETED", "PAYMENT_RELEASED", "CANCELLED"].includes(p.status)).length} />
          <StatCard label="Completed projects" value={projects.filter((p) => ["COMPLETED", "PAYMENT_RELEASED"].includes(p.status)).length} tone="teal" />
          <StatCard label="Open requests" value={requests.filter((r) => !["CONVERTED", "DECLINED"].includes(r.status)).length} tone="gold" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* projects */}
        <Card>
          <CardHeader title="Recent projects" action={<Link href="/dashboard/projects" className="text-[13px] font-medium text-teal-700 hover:underline">View all</Link>} />
          {projects.length === 0 ? (
            <EmptyState title="No projects yet"
              body={professional ? "Accept an assignment or express interest in opportunities to get started." : "Submit a research request to start your first project."}
              action={professional ? <Link href="/dashboard/opportunities"><Button size="sm" variant="secondary">Browse opportunities</Button></Link>
                : <Link href="/dashboard/requests/new"><Button size="sm" variant="secondary">Submit a request</Button></Link>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/projects/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink-600">{p.title}</p>
                      <p className="text-[12px] text-slate-400">{p.tracking_id}{p.professional_name ? ` · ${p.professional_name}` : ""}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* role-specific second column */}
        {staff ? (
          <Card>
            <CardHeader title="Quality-control queue" subtitle="Deliverables awaiting review"
              action={<Link href="/dashboard/qc" className="text-[13px] font-medium text-teal-700 hover:underline">Open QC</Link>} />
            {qcQueue.length === 0 ? <EmptyState title="QC queue is clear" body="Submitted deliverables will appear here for review." /> : (
              <ul className="divide-y divide-slate-100">
                {qcQueue.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    <Link href={`/dashboard/projects/${v.project.id}?tab=deliverables`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-ink-600">{v.deliverable.title} — v{v.version_number}</p>
                        <p className="text-[12px] text-slate-400">{v.project.tracking_id} · {v.uploaded_by}</p>
                      </div>
                      <Badge className="bg-gold-100/60 text-gold-600 ring-gold-400/40">Review</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : professional ? (
          <Card>
            <CardHeader title="Notifications" action={<Link href="/dashboard/notifications" className="text-[13px] font-medium text-teal-700 hover:underline">View all</Link>} />
            {notifications.length === 0 ? <EmptyState title="Nothing yet" /> : (
              <ul className="divide-y divide-slate-100">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <p className="text-[13.5px] font-medium text-ink-600">{n.title}</p>
                    <p className="text-[12px] text-slate-400">{timeAgo(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Research requests" action={<Link href="/dashboard/requests" className="text-[13px] font-medium text-teal-700 hover:underline">View all</Link>} />
            {requests.length === 0 ? <EmptyState title="No requests yet" action={<Link href="/dashboard/requests/new"><Button size="sm" variant="secondary">Submit a request</Button></Link>} /> : (
              <ul className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/dashboard/requests/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-ink-600">{r.title}</p>
                        <p className="text-[12px] text-slate-400">{r.tracking_id ?? "Draft"}{r.service_name ? ` · ${r.service_name}` : ""}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* how it works for clients */}
      {!staff && !professional && projects.length === 0 && (
        <Card className="bg-gradient-to-br from-ink-600 to-ink-700 p-8 text-white">
          <h2 className="font-display text-[20px] font-semibold text-white">What happens after you submit a request?</h2>
          <ol className="mt-4 grid gap-3 text-[13.5px] text-ink-100/90 sm:grid-cols-3">
            <li><span className="font-semibold text-teal-300">1–2.</span> The desk reviews your request and clarifies anything unclear.</li>
            <li><span className="font-semibold text-teal-300">3–4.</span> You receive a transparent quote; on approval we match and assign a professional.</li>
            <li><span className="font-semibold text-teal-300">5–6.</span> Work is delivered, quality-controlled and released to your workspace.</li>
          </ol>
        </Card>
      )}
    </div>
  );
}
