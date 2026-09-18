"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, isStaff, isProfessional, post, put } from "@/lib/api";
import { formatDate, formatDateTime, money, PROJECT_FLOW, statusLabel } from "@/lib/format";
import {
  Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal,
  Select, Spinner, StatusBadge, Tabs, Textarea, useToast,
} from "@/components/ui";
import { DeliverableVersions, DocumentList, DocumentUpload, StatusTimeline } from "@/components/dashboard";

function WorkspaceInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const [p, setP] = useState<any>(null);
  const [tab, setTab] = useState(searchParams.get("tab") ?? "overview");
  const [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");

  const staff = isStaff(user);
  const isAssignedPro = user && p && p.professional?.id === user.id;

  const load = useCallback(() => {
    get(`/projects/${id}`).then((data) => {
      setP(data);
      if (data.milestones === undefined) setMilestones([]);
      else setMilestones(data.milestones ?? []);
    }).catch(() => setP(null));
    get(`/documents?project_id=${id}`).then((d) => setDocs(d.items ?? [])).catch(() => {});
    get(`/projects/${id}/deliverables`).then((d) => setDeliverables(d.items ?? [])).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (p?.conversation_id) {
      get(`/conversations/${p.conversation_id}`).then((c) => setMessages(c.messages ?? [])).catch(() => {});
    }
  }, [p?.conversation_id]);

  const flowIndex = useMemo(() => {
    if (!p) return -1;
    return PROJECT_FLOW.indexOf(p.status);
  }, [p]);

  if (!p) return <p className="py-20 text-center text-sm text-slate-400">Project not found.</p>;

  async function transition(to: string, note?: string) {
    setBusy(true);
    try {
      await post(`/projects/${p.id}/status`, { status: to, note });
      toast.push(`Project moved to ${statusLabel(to)}`, "success");
      setStatusOpen(false);
      load();
    } catch (err: any) {
      toast.push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function loadSuggestions() {
    try {
      const d = await get(`/projects/${p.id}/suggested-professionals`);
      setSuggestions(d.items ?? []);
    } catch { setSuggestions([]); }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageDraft.trim() || !p.conversation_id) return;
    try {
      await post(`/conversations/${p.conversation_id}/messages`, { body: messageDraft });
      setMessageDraft("");
      const c = await get(`/conversations/${p.conversation_id}`);
      setMessages(c.messages ?? []);
    } catch (err: any) {
      toast.push(err.message, "error");
    }
  }

  const clientActions = p.status === "AWAITING_CLIENT_APPROVAL" && p.quote && user?.id === p.client?.id;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[24px] font-semibold">{p.title}</h1>
            <StatusBadge status={p.status} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500">
            <span>Tracking ID <span className="font-mono font-semibold text-ink-600">{p.tracking_id}</span></span>
            {p.service && <span>{p.service.name}</span>}
            {p.deadline && <span>Due {formatDate(p.deadline)}</span>}
            {p.quoted_amount && <span>{money(p.quoted_amount, p.currency)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clientActions && (
            <Link href="/dashboard/finance?tab=quotes"><Button variant="teal">Review quote</Button></Link>
          )}
          {p.status === "PAYMENT_PENDING" && user?.id === p.client?.id && (
            <Link href="/dashboard/finance?tab=invoices"><Button variant="teal">Pay invoice</Button></Link>
          )}
          {staff && !["CANCELLED", "PAYMENT_RELEASED"].includes(p.status) && (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>Update status</Button>
          )}
          {staff && p.status === "PAYMENT_CONFIRMED" && !p.professional && (
            <Button onClick={() => { setAssignOpen(true); loadSuggestions(); }}>Assign professional</Button>
          )}
          {staff && p.status === "APPROVED" && p.funds_status === "PENDING_RELEASE" && (
            <Link href="/dashboard/finance?tab=payouts"><Button variant="teal">Prepare payout</Button></Link>
          )}
          {isAssignedPro && p.status === "PROFESSIONAL_ASSIGNED" && (
            <AcceptAssignment projectId={p.id} onDone={load} />
          )}
        </div>
      </div>

      {/* flow strip */}
      <Card className="overflow-x-auto scrollbar-thin p-4">
        <ol className="flex min-w-[900px] items-center gap-1" aria-label="Project workflow progress">
          {PROJECT_FLOW.map((s, i) => {
            const done = flowIndex > i || ["PAYMENT_RELEASED"].includes(p.status);
            const current = s === p.status || (p.status === "REVISION_REQUIRED" && s === "QUALITY_REVIEW");
            return (
              <li key={s} className="flex flex-1 items-center gap-1">
                <div className="flex flex-col items-center">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-2 ${
                    current ? "bg-gold-400 text-ink-800 ring-gold-400/50"
                    : done ? "bg-teal-500 text-white ring-teal-500/40"
                    : "bg-white text-slate-300 ring-slate-200"}`}>
                    {done && !current ? "✓" : i + 1}
                  </span>
                  <span className={`mt-1 hidden whitespace-nowrap text-[9.5px] font-semibold xl:block ${current ? "text-gold-600" : done ? "text-teal-700" : "text-slate-300"}`}>
                    {statusLabel(s).replace("Approval", "Appr.").replace("Professional", "Pro.").replace("Payment ", "")}
                  </span>
                </div>
                {i < PROJECT_FLOW.length - 1 && <span className={`mb-4 h-0.5 flex-1 ${done ? "bg-teal-400" : "bg-slate-200"}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
        {p.status === "REVISION_REQUIRED" && (
          <p className="mt-2 text-[12.5px] text-gold-600">A revision was requested — the professional is updating the deliverable.</p>
        )}
      </Card>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" },
        { id: "deliverables", label: "Deliverables", count: deliverables.length },
        { id: "documents", label: "Documents", count: docs.length },
        { id: "messages", label: "Messages", count: messages.length },
        { id: "activity", label: "Activity" },
      ]} />

      {/* ------------------------------- overview ------------------------------- */}
      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Card className="p-6">
              <h3 className="mb-3 text-[15px] font-semibold text-ink-600">Project brief</h3>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">{p.description}</p>
              {p.request && (
                <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 text-[13px] sm:grid-cols-2">
                  {p.request.objective && <div><dt className="font-semibold text-ink-600">Objective</dt><dd className="mt-0.5 text-slate-600">{p.request.objective}</dd></div>}
                  {p.request.methodology && <div><dt className="font-semibold text-ink-600">Methodology</dt><dd className="mt-0.5 text-slate-600">{p.request.methodology}</dd></div>}
                  {p.request.expected_deliverables && <div><dt className="font-semibold text-ink-600">Expected deliverables</dt><dd className="mt-0.5 text-slate-600">{p.request.expected_deliverables}</dd></div>}
                  {p.request.preferred_expertise && <div><dt className="font-semibold text-ink-600">Preferred expertise</dt><dd className="mt-0.5 text-slate-600">{p.request.preferred_expertise}</dd></div>}
                </dl>
              )}
            </Card>

            {/* milestones */}
            {milestones.length > 0 && (
            <Card>
              <CardHeader title="Milestones" subtitle={staff || isAssignedPro ? "You can update milestone status" : undefined} />
              {milestones.length === 0 ? <EmptyState title="No milestones defined" /> : (
                <ul className="divide-y divide-slate-100">
                  {milestones.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="text-[13.5px] font-medium text-ink-600">{m.title}</p>
                        {m.due_date && <p className="text-[12px] text-slate-400">Due {formatDate(m.due_date)}</p>}
                      </div>
                      {staff || isAssignedPro ? (
                        <Select className="w-36" value={m.status} aria-label={`Milestone status for ${m.title}`}
                          onChange={async (e) => { await put(`/projects/${p.id}/milestones/${m.id}`, { ...m, status: e.target.value }); load(); }}>
                          {["PENDING", "IN_PROGRESS", "DONE"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </Select>
                      ) : <StatusBadge status={m.status} />}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            )}

            {/* reviews */}
            <ProjectReviews project={p} onRefresh={load} />

            {/* finance summary */}
            <Card className="p-6">
              <h3 className="text-[15px] font-semibold text-ink-600">Commercial summary</h3>
              <dl className="mt-3 grid gap-4 text-[13px] sm:grid-cols-3">
                <div><dt className="text-slate-500">Quote</dt><dd className="mt-0.5 font-medium text-ink-600">
                  {p.quote ? <>{p.quote.quote_number} · {money(p.quote.total, p.quote.currency)} <StatusBadge status={p.quote.status} /></> : "Not yet prepared"}
                </dd></div>
                <div><dt className="text-slate-500">Invoice</dt><dd className="mt-0.5 font-medium text-ink-600">
                  {p.invoice ? <>{p.invoice.invoice_number} · {money(p.invoice.total, p.invoice.currency)} <StatusBadge status={p.invoice.status} /></> : "—"}
                </dd></div>
                <div><dt className="text-slate-500">Funds</dt><dd className="mt-0.5"><StatusBadge status={p.funds_status} /></dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Link href="/dashboard/finance?tab=quotes"><Button size="sm" variant="secondary">Quotes</Button></Link>
                <Link href="/dashboard/finance?tab=invoices"><Button size="sm" variant="secondary">Invoices</Button></Link>
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Client</h3>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={p.client?.full_name ?? "?"} />
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-600">{p.client?.full_name}</p>
                  <p className="text-[12px] text-slate-400">{p.organization?.name ?? p.client?.country}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Assigned professional</h3>
              {p.professional ? (
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={p.professional.full_name} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink-600">{p.professional.full_name}</p>
                    <p className="truncate text-[12px] text-slate-400">{p.professional.professional_title ?? statusLabel(p.professional.role)}</p>
                  </div>
                </div>
              ) : p.status === "PAYMENT_CONFIRMED" && staff ? (
                <p className="mt-2 text-[12.5px] text-slate-500">Payment confirmed — assign a professional to begin.</p>
              ) : (
                <p className="mt-2 text-[12.5px] text-slate-400">Not yet assigned.</p>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Confidentiality</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
                Level: <span className="font-semibold text-ink-600">{p.confidentiality_level}</span>. Documents are
                encrypted at rest and shared only with this project&rsquo;s participants.
              </p>
            </Card>
          </aside>
        </div>
      )}

      {/* ----------------------------- deliverables ----------------------------- */}
      {tab === "deliverables" && (
        <div className="space-y-5">
          {(staff || isAssignedPro) && (
            <NewDeliverable projectId={p.id} onDone={load} canCreate={["IN_PROGRESS", "REVISION_REQUIRED", "PROFESSIONAL_ASSIGNED", "SUBMITTED", "QUALITY_REVIEW", "PAYMENT_CONFIRMED"].includes(p.status)} />
          )}
          {deliverables.length === 0 ? (
            <Card><EmptyState title="No deliverables yet" body="Deliverables appear here with their full version history once work begins." /></Card>
          ) : deliverables.map((d) => (
            <DeliverableVersions key={d.id} deliverable={d} onRefresh={load} projectId={p.id} canUpload={isAssignedPro || staff} />
          ))}
          {p.status === "SUBMITTED" && user?.role === "QC_REVIEWER" && (
            <Alert tone="info" title="Quality review needed">Open the QC queue to review the submitted version.</Alert>
          )}
        </div>
      )}

      {/* ------------------------------ documents ------------------------------- */}
      {tab === "documents" && (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-ink-600">Project documents</h3>
            <p className="text-[12.5px] text-slate-400">Encrypted at rest · access-controlled · downloads use signed links that expire in 10 minutes.</p>
          </div>
          <DocumentList docs={docs} onChanged={load} />
          {(staff || isAssignedPro || user?.id === p.client?.id) && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <DocumentUpload context={{ project_id: p.id }} kind="PROJECT_DOCUMENT" onUploaded={load} />
            </div>
          )}
        </Card>
      )}

      {/* ------------------------------- messages ------------------------------- */}
      {tab === "messages" && (
        <Card className="flex min-h-[420px] flex-col">
          <CardHeader title="Project messages" subtitle="Secure, project-scoped communication — visible to the client, the professional and the Wulweth desk." />
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 scrollbar-thin" style={{ maxHeight: 480 }}>
            {messages.length === 0 && <p className="py-10 text-center text-[13px] text-slate-400">No messages yet — say hello.</p>}
            {messages.map((m) => {
              const mine = m.sender?.id === user?.id;
              return (
                <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                  <Avatar name={m.sender?.full_name ?? "?"} className="h-8 w-8 text-[11px]" />
                  <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${mine ? "bg-ink-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                    <p className={`text-[11px] font-semibold ${mine ? "text-teal-200" : "text-teal-700"}`}>
                      {m.sender?.full_name} · {m.created_at ? new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed">{m.body}</p>
                    {m.attachment && (
                      <button className="mt-2 block text-[12px] font-medium underline" onClick={async () => {
                        const { url } = await post(`/documents/${m.attachment.id}/download-url`, {});
                        window.open(url, "_blank", "noopener");
                      }}>📎 {m.attachment.filename}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-4">
            <Input placeholder="Write a message…" value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} aria-label="Message" />
            <Button type="submit" disabled={!messageDraft.trim()}>Send</Button>
          </form>
        </Card>
      )}

      {/* ------------------------------- activity ------------------------------- */}
      {tab === "activity" && (
        <Card className="p-6">
          <h3 className="mb-4 text-[15px] font-semibold text-ink-600">Project history</h3>
          <StatusTimeline history={p.status_history ?? []} status={p.status} />
        </Card>
      )}

      {/* ------------------------------- modals ---------------------------------- */}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Update project status">
        <StatusForm project={p} busy={busy} onSubmit={transition} />
      </Modal>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign a professional" wide>
        <p className="text-[13px] text-slate-500">Decision support ranks professionals by discipline fit, expertise, verification, availability and current load. The final assignment decision is always yours.</p>
        {suggestions === null ? (
          <div className="py-10 text-center"><Spinner /></div>
        ) : suggestions.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-slate-400">No suggestions yet — profiles may still be pending.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {suggestions.map((s) => (
              <li key={s.profile.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink-600">{s.profile.full_name} <span className="ml-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10.5px] font-bold text-teal-700">match {s.score}</span></p>
                  <p className="text-[12.5px] text-slate-500">{s.profile.professional_title} · {s.profile.years_experience}+ yrs · {s.profile.active_projects} active</p>
                  <p className="mt-1 truncate text-[11.5px] text-slate-400">{(s.profile.expertise ?? []).slice(0, 4).join(" · ")}</p>
                </div>
                <Button size="sm" onClick={async () => {
                  setBusy(true);
                  try {
                    await post(`/projects/${p.id}/assign`, { professional_id: s.profile.user_id });
                    toast.push("Assignment offer sent", "success");
                    setAssignOpen(false); load();
                  } catch (err: any) { toast.push(err.message, "error"); }
                  finally { setBusy(false); }
                }}>Assign</Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}


function ProjectReviews({ project, onRefresh }: { project: any; onRefresh: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({ professionalism: 5, communication: 5, quality: 5, timeliness: 5, expertise: 5 });
  const [comment, setComment] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadReviews = useCallback(() => {
    get(`/projects/${project.id}/reviews`).then((d) => setReviews(d.items ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [project.id]);

  useEffect(loadReviews, [loadReviews]);

  const eligible = ["APPROVED", "COMPLETED", "PAYMENT_RELEASED"].includes(project.status);
  const isClient = user && project.client?.id === user.id;
  const isPro = user && project.professional?.id === user.id;
  const alreadyReviewed = reviews.some((r) => r.author_name === user?.full_name);

  if (!eligible || !(isClient || isPro)) return null;

  return (
    <Card className="p-6">
      <h3 className="text-[15px] font-semibold text-ink-600">Feedback &amp; quality rating</h3>
      <p className="mt-0.5 text-[12.5px] text-slate-400">
        {isClient ? "Rate the professional on five dimensions once the engagement is complete — feedback informs future matching." : "Share how the engagement worked from your side."}
      </p>
      {loading ? <p className="mt-4 text-[13px] text-slate-400">Loading…</p> : (
        <>
          {reviews.length > 0 && (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-[13px] font-semibold text-ink-600">{r.author_name} <span className="ml-2 font-normal text-slate-400">quality {r.quality}/5 · communication {r.communication}/5</span></p>
                  <p className="mt-1 text-[12.5px] text-slate-600">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
          {alreadyReviewed ? (
            <p className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-[13px] text-teal-800">Thank you — your feedback has been recorded.</p>
          ) : (
            <form className="mt-5 space-y-4 border-t border-slate-100 pt-4" onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await post("/reviews", { project_id: project.id, ...scores, comment, private_note: privateNote || null });
                toast.push("Thank you — your feedback has been recorded", "success");
                setComment(""); setPrivateNote("");
                loadReviews();
              } catch (err: any) { toast.push(err.message, "error"); }
              finally { setBusy(false); }
            }}>
              <div className="grid gap-3 sm:grid-cols-5">
                {(Object.keys(scores) as (keyof typeof scores)[]).map((dim) => (
                  <label key={dim} className="text-[12px] font-medium text-slate-500">
                    {dim[0].toUpperCase() + dim.slice(1)}
                    <select value={scores[dim]} aria-label={`${dim} rating`}
                      onChange={(e) => setScores({ ...scores, [dim]: parseInt(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-[13px]">
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What stood out about this engagement?" aria-label="Feedback comment" required />
              {isClient && (
                <Input value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} placeholder="Private note to the Wulweth desk (optional)" aria-label="Private note" />
              )}
              <div className="flex justify-end"><Button type="submit" variant="teal" loading={busy} disabled={comment.trim().length < 4}>Submit feedback</Button></div>
            </form>
          )}
        </>
      )}
    </Card>
  );
}

function AcceptAssignment({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  useEffect(() => {
    get(`/projects/${projectId}`).then((d) => {
      const mine = (d.assignments ?? []).find((a: any) => a.professional?.id === user?.id && a.status === "ASSIGNED");
      setAssignmentId(mine?.id ?? null);
    }).catch(() => {});
  }, [projectId, user]);
  if (!assignmentId) return null;
  return (
    <div className="flex gap-2">
      <Button variant="teal" onClick={async () => {
        try { await post(`/assignments/${assignmentId}/accept`); toast.push("Assignment accepted — you can begin", "success"); onDone(); }
        catch (err: any) { toast.push(err.message, "error"); }
      }}>Accept assignment</Button>
      <Button variant="secondary" onClick={async () => {
        try { await post(`/assignments/${assignmentId}/decline`); toast.push("Assignment declined — the desk will reassign", "info"); onDone(); }
        catch (err: any) { toast.push(err.message, "error"); }
      }}>Decline</Button>
    </div>
  );
}

function StatusForm({ project, busy, onSubmit }: { project: any; busy: boolean; onSubmit: (s: string, note?: string) => void }) {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const options: Record<string, string[]> = {
    REQUEST_SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
    UNDER_REVIEW: ["QUOTE_PREPARED", "CANCELLED"],
    QUOTE_PREPARED: ["AWAITING_CLIENT_APPROVAL", "CANCELLED"],
    AWAITING_CLIENT_APPROVAL: ["PAYMENT_PENDING", "UNDER_REVIEW", "CANCELLED"],
    PAYMENT_PENDING: ["PAYMENT_CONFIRMED", "CANCELLED"],
    PAYMENT_CONFIRMED: ["PROFESSIONAL_ASSIGNED"],
    PROFESSIONAL_ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["SUBMITTED", "CANCELLED"],
    SUBMITTED: ["QUALITY_REVIEW", "APPROVED"],
    QUALITY_REVIEW: ["REVISION_REQUIRED", "APPROVED"],
    REVISION_REQUIRED: ["IN_PROGRESS", "SUBMITTED", "CANCELLED"],
    APPROVED: ["COMPLETED"],
    COMPLETED: project.funds_status === "RELEASED" ? ["PAYMENT_RELEASED"] : [],
    CANCELLED: [],
  };
  const allowed = options[project.status] ?? [];
  if (!allowed.length && project.status === "COMPLETED" && project.funds_status !== "RELEASED")
    return <p className="text-[13px] text-slate-500">Prepare and complete the payout first — funds release follows the completed payout record.</p>;
  if (allowed.length === 0) return <p className="text-[13px] text-slate-500">This project is in a final state.</p>;
  return (
    <div className="space-y-4">
      <Field label="Move to" required>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Select status…</option>
          {allowed.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </Field>
      <Field label="Note (recorded in project history)">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onSubmit.length}>Cancel</Button>
        <Button disabled={!status} loading={busy} onClick={() => onSubmit(status, note || undefined)}>Update status</Button>
      </div>
    </div>
  );
}

function NewDeliverable({ projectId, onDone, canCreate }: { projectId: string; onDone: () => void; canCreate: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canCreate) return null;
  return (
    <>
      <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? "Cancel" : "+ Define a deliverable"}</Button></div>
      {open && (
        <Card className="space-y-3 p-5">
          <Field label="Deliverable title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Analysis report and outputs" /></Field>
          <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Button loading={busy} onClick={async () => {
            setBusy(true);
            try { await post(`/projects/${projectId}/deliverables`, { title, description: description || null }); setOpen(false); setTitle(""); setDescription(""); onDone(); }
            catch (err: any) { toast.push(err.message, "error"); }
            finally { setBusy(false); }
          }}>Create deliverable</Button>
        </Card>
      )}
    </>
  );
}

export default function ProjectWorkspace() {
  return <Suspense fallback={<div className="py-24 text-center"><Spinner /></div>}><WorkspaceInner /></Suspense>;
}
