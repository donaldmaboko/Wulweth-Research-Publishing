"use client";

import { useCallback, useEffect, useState } from "react";
import { get, put } from "@/lib/api";
import { formatDate, money, statusLabel } from "@/lib/format";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Spinner, Table, Tabs, Td, useToast } from "@/components/ui";

export default function AdminPage() {
  const [tab, setTab] = useState("overview");
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      get("/analytics/overview"), get("/admin/users?limit=200"), get("/admin/audit-logs?limit=80"), get("/admin/settings"),
    ]).then(([a, u, l, f]) => {
      if (a.status === "fulfilled") setAnalytics(a.value);
      if (u.status === "fulfilled") setUsers(u.value.items ?? []);
      if (l.status === "fulfilled") setAudit(l.value.items ?? []);
      if (f.status === "fulfilled") {
        const entry = (f.value.settings ?? []).find((s: any) => s.key === "fees");
        setFees(entry?.value ?? null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  if (loading) return <div className="py-24 text-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Administration</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">Platform governance — analytics from real system data only, user administration, fees and the full audit trail.</p>
      </div>

      <Tabs tabs={[
        { id: "overview", label: "Analytics" },
        { id: "users", label: "Users", count: users.length },
        { id: "fees", label: "Fee configuration" },
        { id: "audit", label: "Audit trail", count: audit.length },
      ]} active={tab} onChange={setTab} />

      {tab === "overview" && analytics && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Projects</p><p className="mt-1 font-display text-[26px] font-semibold text-ink-600">{analytics.projects.total}</p><p className="text-[12px] text-slate-400">{analytics.projects.active} active · {analytics.projects.completed} completed</p></Card>
            <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Requests pending</p><p className="mt-1 font-display text-[26px] font-semibold text-gold-500">{analytics.projects.pending_requests}</p><p className="text-[12px] text-slate-400">{analytics.projects.qc_queue} in QC · {analytics.projects.revision_rate_percent}% revision rate</p></Card>
            <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Revenue (confirmed)</p><p className="mt-1 font-display text-[26px] font-semibold text-teal-600">{money(analytics.finance.revenue_total)}</p><p className="text-[12px] text-slate-400">{money(analytics.finance.revenue_30d)} last 30 days</p></Card>
            <Card className="p-5"><p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Fees collected</p><p className="mt-1 font-display text-[26px] font-semibold text-ink-600">{money(analytics.finance.fees_collected)}</p><p className="text-[12px] text-slate-400">{money(analytics.finance.professional_earnings)} paid to professionals</p></Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="People on the platform" subtitle="Counts reflect real registered accounts" />
              <ul className="space-y-2.5 px-5 py-4 text-[13.5px]">
                <li className="flex justify-between"><span className="text-slate-500">Total accounts</span><span className="font-semibold text-ink-600">{analytics.users.total}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Clients</span><span className="font-semibold text-ink-600">{analytics.users.clients}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Research professionals</span><span className="font-semibold text-teal-700">{analytics.users.professionals}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Organizations</span><span className="font-semibold text-ink-600">{analytics.users.organizations}</span></li>
                <li className="flex justify-between border-t border-slate-100 pt-2.5"><span className="text-slate-500">Moderation cases pending</span><span className="font-semibold text-gold-600">{analytics.governance.moderation_pending}</span></li>
                <li className="flex justify-between"><span className="text-slate-500">Open copyright reports</span><span className="font-semibold text-ink-600">{analytics.governance.reports_open}</span></li>
              </ul>
            </Card>
            <Card>
              <CardHeader title="Monthly volume" subtitle="Projects opened and revenue recorded, from real system data" />
              {(analytics.volume ?? []).length === 0 ? <EmptyState title="No data yet" /> : (
                <div className="px-5 py-4">
                  <div className="flex h-40 items-end gap-2" role="img" aria-label="Bar chart of projects per month">
                    {analytics.volume.map((v: any) => {
                      const max = Math.max(1, ...analytics.volume.map((x: any) => x.projects));
                      return (
                        <div key={v.month} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex w-full flex-1 items-end">
                            <div className="w-full rounded-t-md bg-teal-500/80 transition-all" style={{ height: `${(v.projects / max) * 100}%` }} title={`${v.projects} projects · ${money(v.revenue)}`} />
                          </div>
                          <span className="text-[9.5px] font-medium text-slate-400">{v.month}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-[11.5px] text-slate-400">
                    Average project duration: {analytics.projects.avg_duration_days ?? "—"} days. Wulweth never displays invented totals or success-rate claims — every figure is computed from live records.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "users" && (
        <Card>
          <CardHeader title="User administration" subtitle="Roles, verification and account status" />
          <Table head={["Name", "Email", "Role", "Verified", "Status", ""]}>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-medium text-ink-600">{u.full_name}</Td>
                <Td className="text-slate-500">{u.email}</Td>
                <Td><Badge className="bg-ink-50 text-ink-600 ring-ink-100">{statusLabel(u.role)}</Badge></Td>
                <Td>{u.email_verified_at ? <span className="text-teal-600">✓ {formatDate(u.email_verified_at)}</span> : <span className="text-slate-400">pending</span>}</Td>
                <Td>{u.status === "ACTIVE" ? <span className="text-teal-600">active</span> : <Badge className="bg-rose-50 text-rose-700 ring-rose-200">{statusLabel(u.status)}</Badge>}</Td>
                <Td><UserActions user={u} onDone={load} /></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === "fees" && (
        <FeesEditor fees={fees} onDone={load} />
      )}

      {tab === "audit" && (
        <Card>
          <CardHeader title="Audit trail" subtitle="Append-only log of governance-relevant actions — created by the system, never editable." />
          {audit.length === 0 ? <EmptyState title="No audit entries in view" /> : (
            <Table head={["When", "Actor", "Action", "Entity", "Detail"]}>
              {audit.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-[12px] text-slate-400">{new Date(a.created_at).toLocaleString("en-GB")}</Td>
                  <Td className="text-slate-600">{a.actor ?? "system"}</Td>
                  <Td><Badge className="bg-slate-100 text-slate-600 ring-slate-200">{a.action}</Badge></Td>
                  <Td className="text-slate-500">{a.entity_type} {String(a.entity_id ?? "").slice(0, 8)}</Td>
                  <Td className="max-w-[260px] truncate text-slate-400">{Object.keys(a.metadata_json ?? {}).length ? JSON.stringify(a.metadata_json) : a.ip}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

function UserActions({ user, onDone }: { user: any; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>Manage</Button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {user.status === "ACTIVE" ? (
            <Button size="sm" variant="danger" onClick={async () => {
              try { await put(`/admin/users/${user.id}`, { status: "SUSPENDED" }); toast.push("Account suspended", "success"); onDone(); }
              catch (err: any) { toast.push(err.message, "error"); }
            }}>Suspend</Button>
          ) : (
            <Button size="sm" variant="teal" onClick={async () => {
              try { await put(`/admin/users/${user.id}`, { status: "ACTIVE" }); toast.push("Account reactivated", "success"); onDone(); }
              catch (err: any) { toast.push(err.message, "error"); }
            }}>Reactivate</Button>
          )}
        </div>
      )}
    </>
  );
}

function FeesEditor({ fees, onDone }: { fees: any; onDone: () => void }) {
  const toast = useToast();
  const [percent, setPercent] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fees) { setPercent(String(fees.default_percent ?? 15)); setNote(fees.note ?? ""); }
  }, [fees]);

  if (!fees) return <EmptyState title="Fee configuration unavailable" />;

  const perService = Object.entries(fees.per_service ?? {});

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink-600">Default platform fee</h2>
        <p className="mt-1 text-[13px] text-slate-500">Percentage deducted from the professional payout once a project completes. It appears transparently on every payout record.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-36"><Field label="Default percent"><Input type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} /></Field></div>
          <div className="min-w-[240px] flex-1"><Field label="Note shown on payouts"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
          <Button loading={busy} onClick={async () => {
            setBusy(true);
            try {
              await put("/admin/settings", { key: "fees", value: { note, default_percent: parseFloat(percent) || 0, per_service: fees.per_service ?? {} } });
              toast.push("Fee configuration saved — new payouts use the updated rate", "success");
              onDone();
            } catch (err: any) { toast.push(err.message, "error"); }
            finally { setBusy(false); }
          }}>Save configuration</Button>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink-600">Per-service overrides</h2>
        {perService.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-500">No per-service overrides — the default rate applies to all projects.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {perService.map(([svc, pct]) => (
              <li key={svc} className="flex justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-[13.5px]"><span className="text-slate-600">{svc}</span><span className="font-semibold text-ink-600">{pct as number}%</span></li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Alert tone="info" title="Transparency commitment">Fees are configurable per platform policy and always disclosed on quotes, invoices and payout records — never hidden from professionals.</Alert>
        </div>
      </Card>
    </div>
  );
}
