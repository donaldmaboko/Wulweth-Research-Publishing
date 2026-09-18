"use client";


import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { get, post, put } from "@/lib/api";
import { Alert, Button, Card, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { DocumentUpload } from "@/components/dashboard";

type Draft = any;

const DATA_OPTIONS = [
  { value: "HAVE_DATA", label: "I have data ready for analysis" },
  { value: "NEED_SUPPORT", label: "I need help collecting or preparing data" },
  { value: "NOT_YET", label: "No data yet — designing the study first" },
];

function NewRequestInner() {
  const router = useRouter();
  const params = useSearchParams();
  const draftParam = params.get("draft");
  const toast = useToast();
  const [services, setServices] = useState<{ category: string; services: any[] }[]>([]);
  const [fields, setFields] = useState<{ group: string; fields: any[] }[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [integrityMsg, setIntegrityMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    title: "", discipline: "", research_field_id: "", service_id: "",
    objective: "", description: "", methodology: "",
    data_availability: "HAVE_DATA", data_description: "",
    expected_deliverables: "", deadline: "",
    budget_min: "", budget_max: "", currency: "USD",
    preferred_expertise: "", confidentiality_note: "", additional_notes: "",
  });

  useEffect(() => {
    get("/public/services").then((d) => setServices(d.categories ?? [])).catch(() => {});
    get("/public/research-fields").then((d) => setFields(d.groups ?? [])).catch(() => {});
  }, []);

  // Load an existing draft / clarification-resubmission when ?draft=<id>
  useEffect(() => {
    if (!draftParam) return;
    get(`/research-requests/${draftParam}`).then((r) => {
      setDraftId(r.id);
      setForm((f) => ({
        ...f,
        title: r.title ?? "",
        discipline: r.discipline ?? "",
        research_field_id: r.research_field?.id ?? "",
        service_id: r.service?.id ?? "",
        objective: r.objective ?? "",
        description: r.description ?? "",
        methodology: r.methodology ?? "",
        data_availability: r.data_availability ?? "HAVE_DATA",
        data_description: r.data_description ?? "",
        expected_deliverables: r.expected_deliverables ?? "",
        deadline: r.deadline ? r.deadline.slice(0, 10) : "",
        budget_min: r.budget_min ?? "",
        budget_max: r.budget_max ?? "",
        currency: r.currency ?? "USD",
        preferred_expertise: r.preferred_expertise ?? "",
        confidentiality_note: r.confidentiality_note ?? "",
        additional_notes: r.additional_notes ?? "",
      }));
    }).catch(() => {});
  }, [draftParam]);

  const allServices = useMemo(() => services.flatMap((c) => c.services), [services]);
  const allFields = useMemo(() => fields.flatMap((g) => g.fields), [fields]);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const payload = () => ({
    ...form,
    budget_min: form.budget_min ? parseFloat(form.budget_min) : null,
    budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
    deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
    research_field_id: form.research_field_id || null,
    service_id: form.service_id || null,
  });

  async function saveDraft(): Promise<string | null> {
    setError(null);
    if (!form.title.trim()) { setError("Add a working title before saving."); return null; }
    try {
      if (draftId) {
        await put(`/research-requests/${draftId}`, payload());
        toast.push("Draft saved", "success");
        return draftId;
      }
      // eslint-disable-next-line no-unreachable
      const res = await post<any>("/research-requests", payload());
      setDraftId(res.id);
      toast.push("Draft saved — you can return to it anytime", "success");
      return res.id;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setIntegrityMsg(null);
    try {
      const id = draftId ?? (await saveDraft());
      if (!id) return;
      if (!form.description.trim() || !form.service_id) {
        setError("A description and a service are required before submitting.");
        return;
      }
      const res = await post<any>(`/research-requests/${id}/submit`);
      toast.push(`Submitted — tracking ID ${res.tracking_id}`, "success");
      router.push(`/dashboard/requests/${id}`);
    } catch (err: any) {
      setError(err.message);
      if ((err.message || "").toLowerCase().includes("wulweth supports legitimate")) setIntegrityMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Submit a research request</h1>
        <p className="mt-1 text-[13.5px] text-slate-500">
          Tell us what you need. The Wulweth desk reviews every request, clarifies where helpful,
          and identifies appropriate verified expertise. You can save a draft at any point.
        </p>
      </div>

      {integrityMsg && <Alert tone="error" title="This request conflicts with our Research Integrity Policy">{integrityMsg} If your request was misunderstood, rephrase it to describe the legitimate research support you need — for example, statistical analysis or manuscript editing of your own work.</Alert>}
      {error && !integrityMsg && <Alert tone="error" role="alert">{error}</Alert>}

      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4 p-6">
          <h2 className="text-[15px] font-semibold text-ink-600">1 · What do you need?</h2>
          <Field label="Project title" required>
            <Input required value={form.title} onChange={set("title")} placeholder="e.g. Statistical analysis of community health survey data" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Research discipline">
              <Select value={form.discipline} onChange={set("discipline")}>
                <option value="">Select a discipline…</option>
                {fields.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
              </Select>
            </Field>
            <Field label="Research field">
              <Select value={form.research_field_id} onChange={set("research_field_id")}>
                <option value="">Select a field…</option>
                {allFields.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Service required" required hint="Pick the closest match — the desk will confirm scope during review.">
            <Select required value={form.service_id} onChange={set("service_id")}>
              <option value="">Select a service…</option>
              {services.map((c) => (
                <optgroup key={c.category} label={c.category}>
                  {c.services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Research objective" hint="What should the work achieve?">
            <Textarea value={form.objective} onChange={set("objective")} placeholder="e.g. Identify predictors of facility-based care seeking for a district health report." />
          </Field>
          <Field label="Description" required hint="Context, data, audience and any constraints. This is what the desk and the professional will work from.">
            <Textarea required rows={5} value={form.description} onChange={set("description")} />
          </Field>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-[15px] font-semibold text-ink-600">2 · Method, data and deliverables</h2>
          <Field label="Methodology (if known)">
            <Textarea rows={2} value={form.methodology} onChange={set("methodology")} placeholder="e.g. Logistic regression with survey weights; thematic analysis of interviews…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data availability">
              <Select value={form.data_availability} onChange={set("data_availability")}>
                {DATA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Data description">
              <Input value={form.data_description} onChange={set("data_description")} placeholder="e.g. 1,150 household records, CSV + data dictionary" />
            </Field>
          </div>
          <Field label="Expected deliverables">
            <Textarea rows={2} value={form.expected_deliverables} onChange={set("expected_deliverables")} placeholder="e.g. Analysis report, figures, reproducible syntax, results workbook" />
          </Field>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-[15px] font-semibold text-ink-600">3 · Timeline, budget and preferences</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Deadline">
              <Input type="date" value={form.deadline} onChange={set("deadline")} />
            </Field>
            <Field label="Budget — minimum">
              <Input type="number" min="0" step="50" value={form.budget_min} onChange={set("budget_min")} />
            </Field>
            <Field label="Budget — maximum">
              <Input type="number" min="0" step="50" value={form.budget_max} onChange={set("budget_max")} />
            </Field>
          </div>
          <Field label="Preferred expertise" hint="Methods, software, disciplinary background or experience you consider essential.">
            <Input value={form.preferred_expertise} onChange={set("preferred_expertise")} placeholder="e.g. Stata or R; experience with complex survey analysis" />
          </Field>
          <Field label="Confidentiality requirements">
            <Input value={form.confidentiality_note} onChange={set("confidentiality_note")} placeholder="e.g. Data may not be shared beyond the assigned professional" />
          </Field>
          <Field label="Additional notes">
            <Textarea rows={2} value={form.additional_notes} onChange={set("additional_notes")} />
          </Field>
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 text-[15px] font-semibold text-ink-600">4 · Attachments</h2>
          <p className="mb-3 text-[12.5px] text-slate-400">Briefs, datasets, instruments or examples. Only the Wulweth desk and (later) the assigned professional can access these.</p>
          <DocumentUpload context={{ request_id: draftId ?? undefined }} kind="REQUEST_ATTACHMENT"
            onUploaded={(doc) => setAttachments((a) => [...a, doc])} />
          {attachments.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {attachments.map((d) => (
                <li key={d.id} className="rounded-lg bg-teal-50/70 px-3 py-2 text-[12.5px] text-teal-800">✓ {d.filename} uploaded</li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-[12.5px] text-slate-400">
            On submission you receive a unique tracking ID. The desk reviews scope and research-integrity compliance first.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={saveDraft}>Save draft</Button>
            <Button type="submit" loading={busy}>Submit request</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={null}>
      <NewRequestInner />
    </Suspense>
  );
}
