"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, isStaff, post, qs } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, StatusBadge, Table, Td, Textarea, useToast } from "@/components/ui";

export default function DashboardOpportunities() {
  const { user } = useAuth();
  const toast = useToast();
  const staff = isStaff(user);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("");
  const [interestOpen, setInterestOpen] = useState<any>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    get(`/opportunities${qs({ q, visibility, page_size: 50 })}`)
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, visibility]);

  useEffect(load, [load]);

  async function expressInterest(o: any, cover: string) {
    try {
      await post(`/opportunities/${o.id}/express-interest`, { cover_note: cover });
      toast.push("Interest registered — the Wulweth desk reviews every expression before shortlisting", "success");
      setInterestOpen(null);
    } catch (err: any) { toast.push(err.message, "error"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold">Research Opportunities</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-500">
            {staff ? "Create and manage scoped engagements open to the professional network." : "Scoped engagements published by the Wulweth desk — public, private to you, or invitation-only."}
          </p>
        </div>
        {staff && <Button onClick={() => setNewOpen(true)}>Publish an opportunity</Button>}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search opportunities…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search opportunities" />
          <Select className="max-w-[200px]" value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Visibility filter">
            <option value="">All visibility</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private (direct to you)</option>
            <option value="INVITATION_ONLY">Invitation only</option>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? <div className="py-16 text-center text-[13px] text-slate-400">Loading…</div> : items.length === 0 ? (
          <EmptyState title="No opportunities found" body={staff ? "Publish one to invite expressions of interest." : "New engagements are published by the desk as clients approve projects."} />
        ) : (
          <Table head={["Opportunity", staff ? "Client" : "Discipline", "Visibility", "Timeline", "Closes", "Status", ""]}>
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <Td className="max-w-[260px]"><Link href={`/dashboard/opportunities/${o.id}`} className="font-medium text-ink-600 hover:text-teal-700">{o.title}</Link></Td>
                <Td className="text-slate-500">{staff ? o.client?.full_name : o.discipline ?? "—"}</Td>
                <Td>
                  <Badge className={o.visibility === "PUBLIC" ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-slate-100 text-slate-500 ring-slate-200"}>
                    {o.visibility === "INVITATION_ONLY" ? "Invitation only" : o.visibility === "PRIVATE" ? "Private" : "Public"}
                  </Badge>
                </Td>
                <Td className="text-slate-500">{o.expected_timeline ?? "—"}</Td>
                <Td className="text-slate-500">{formatDate(o.closes_at)}</Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td>{!staff && o.status === "OPEN" && <Button size="sm" variant="secondary" onClick={() => setInterestOpen(o)}>Express interest</Button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={!!interestOpen} onClose={() => setInterestOpen(null)} title={`Express interest — ${interestOpen?.title ?? ""}`}>
        <InterestForm onSubmit={(cover: string) => expressInterest(interestOpen, cover)} />
      </Modal>

      {staff && <NewOpportunityModal open={newOpen} onClose={() => setNewOpen(false)} onDone={load} />}
    </div>
  );
}

function InterestForm({ onSubmit }: { onSubmit: (cover: string) => void }) {
  const [cover, setCover] = useState("");
  return (
    <div>
      <Field label="Why are you a strong fit?" hint="Relevant methods, disciplines and comparable work. The desk reviews every expression.">
        <Textarea rows={4} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="e.g. I have led three complex-survey analyses in public health using Stata and R…" />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button variant="teal" disabled={cover.trim().length < 20} onClick={() => onSubmit(cover)}>Submit expression of interest</Button>
      </div>
    </div>
  );
}

function NewOpportunityModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "", description: "", discipline: "", visibility: "PUBLIC", expected_timeline: "", deadline: "", location: "", methodology: "", required_expertise: "" });
  const set = (k: string) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open={open} onClose={onClose} title="Publish an opportunity" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title" required><Input value={f.title} onChange={set("title")} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description" required><Textarea rows={4} value={f.description} onChange={set("description")} /></Field></div>
        <Field label="Discipline"><Input value={f.discipline} onChange={set("discipline")} /></Field>
        <Field label="Visibility" required>
          <Select value={f.visibility} onChange={set("visibility")}>
            <option value="PUBLIC">Public — all verified professionals</option>
            <option value="INVITATION_ONLY">Invitation only</option>
            <option value="PRIVATE">Private — specific professional</option>
          </Select>
        </Field>
        <Field label="Expected timeline"><Input value={f.expected_timeline} onChange={set("expected_timeline")} placeholder="e.g. 6–8 weeks" /></Field>
        <Field label="Closes on"><Input type="date" value={f.deadline} onChange={set("deadline")} /></Field>
        <Field label="Location"><Input value={f.location} onChange={set("location")} placeholder="e.g. Gaborone / Remote" /></Field>
        <div className="sm:col-span-2">
          <Field label="Required expertise" hint="Comma-separated: methods, software, subject areas.">
            <Input value={f.required_expertise} onChange={set("required_expertise")} placeholder="Complex survey analysis, Stata, public health" />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={!f.title || !f.description} onClick={async () => {
          setBusy(true);
          try {
            await post("/opportunities", { ...f, required_expertise: f.required_expertise.split(",").map((s) => s.trim()).filter(Boolean) });
            toast.push("Opportunity published", "success"); onDone(); onClose();
          } catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>Publish</Button>
      </div>
    </Modal>
  );
}
