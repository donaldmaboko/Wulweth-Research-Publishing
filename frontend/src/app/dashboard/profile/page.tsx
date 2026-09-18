"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, isProfessional, post, put } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, StatusBadge, Textarea, useToast } from "@/components/ui";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const professional = isProfessional(user);

  const load = useCallback(() => {
    if (professional) get("/my/profile").then(setProfile).catch(() => {});
  }, [professional]);

  useEffect(load, [load]);
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">My Profile</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">
          {professional ? "Your account details and the professional profile clients and the desk see." : "Your account details and verification status."}
        </p>
      </div>

      {!user.email_verified && <Alert tone="warning" title="Email not verified">Check your inbox for the verification link, or contact the Wulweth desk for help.</Alert>}

      {/* account details */}
      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-ink-600">Account details</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.target as HTMLFormElement);
          setBusy(true);
          try {
            await put("/my/profile", {
              full_name: form.get("full_name"), phone: form.get("phone") || null,
              country: form.get("country") || null, city: form.get("city") || null,
              timezone: form.get("timezone") || null, bio: form.get("bio") || null,
              language: form.get("language") || null,
            });
            await refresh();
            toast.push("Account details saved", "success");
            load();
          } catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>
          <Field label="Full name" required><Input name="full_name" required defaultValue={user.full_name} key={user.full_name} /></Field>
          <Field label="Email"><Input value={user.email} disabled className="bg-slate-50 text-slate-400" /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={user.phone ?? ""} key={`ph-${user.phone ?? ""}`} /></Field>
          <Field label="Country"><Input name="country" defaultValue={user.country ?? ""} key={`co-${user.country ?? ""}`} /></Field>
          <Field label="City"><Input name="city" defaultValue={profile?.location ?? ""} key={`ci-${profile?.location ?? ""}`} /></Field>
          <Field label="Timezone"><Input name="timezone" defaultValue={user.timezone ?? ""} placeholder="e.g. Africa/Gaborone" /></Field>
          {professional && (
            <div className="sm:col-span-2"><Field label="Short biography"><Textarea name="bio" rows={3} defaultValue={profile?.bio ?? ""} /></Field></div>
          )}
          <Field label="Role"><Input value={statusLabel(user.role)} disabled className="bg-slate-50 text-slate-400" /></Field>
          <div className="flex items-end"><Button type="submit" loading={busy}>Save account details</Button></div>
        </form>
      </Card>

      {/* change password */}
      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-ink-600">Change password</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.target as HTMLFormElement);
          setBusy(true);
          try {
            await post("/auth/change-password", { current_password: form.get("current_password"), new_password: form.get("new_password") });
            toast.push("Password updated", "success");
            (e.target as HTMLFormElement).reset();
          } catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>
          <Field label="Current password"><Input name="current_password" type="password" required autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 8 characters."><Input name="new_password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" variant="secondary" loading={busy}>Update password</Button></div>
        </form>
      </Card>

      {professional && profile && (
        <>
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink-600">Professional profile</h2>
                <p className="mt-0.5 text-[12.5px] text-slate-400">Shown on the public Research Expertise directory.</p>
              </div>
              <StatusBadge status={profile.verification ?? "UNVERIFIED"} />
            </div>
            <dl className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2">
              <div><dt className="text-slate-500">Title</dt><dd className="mt-0.5 font-medium text-ink-600">{profile.professional_title ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Experience</dt><dd className="mt-0.5 font-medium text-ink-600">{profile.years_experience}+ years</dd></div>
              <div><dt className="text-slate-500">Disciplines</dt><dd className="mt-0.5 text-slate-600">{(profile.disciplines ?? []).join(", ") || "—"}</dd></div>
              <div><dt className="text-slate-500">Research fields</dt><dd className="mt-0.5 text-slate-600">{(profile.research_fields ?? []).map((f: any) => f.name ?? f).join(", ") || "—"}</dd></div>
            </dl>
            <ChipRow label="Expertise" items={profile.expertise} />
            <ChipRow label="Methodologies" items={profile.methodologies} />
            <ChipRow label="Statistical methods" items={profile.statistical_methods} />
            <ChipRow label="Software" items={profile.software} />
            <ChipRow label="Industries" items={profile.industries} />
            <ChipRow label="Languages" items={profile.languages} />
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-[12.5px] text-slate-500">
              To update your disciplines, expertise, software or availability, add the detail below (qualifications, publications,
              portfolio) or contact the Wulweth desk — profile edits by the desk keep the directory consistent and verified.
            </p>
          </Card>

          {/* credentials */}
          <Card>
            <CardHeader title="Qualifications & credentials" subtitle="Verified by the Wulweth desk — verified items show a badge on your public profile." />
            <ul className="divide-y divide-slate-100">
              {(profile.qualifications ?? []).map((q: any) => (
                <li key={q.id ?? q.degree} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-600">{q.degree}</p>
                    <p className="text-[12px] text-slate-400">{q.institution} · {q.year ?? ""}{q.field_of_study ? ` · ${q.field_of_study}` : ""}</p>
                  </div>
                  <StatusBadge status={q.verification ?? "PENDING"} />
                </li>
              ))}
              {(profile.qualifications ?? []).length === 0 && <li className="px-5 py-6 text-center text-[13px] text-slate-400">No qualifications added yet.</li>}
            </ul>
            <div className="border-t border-slate-100 px-5 py-4">
              <AddRow fields={[["degree", "Degree / credential"], ["institution", "Institution"], ["field_of_study", "Field of study"], ["year", "Year"]]}
                onSubmit={async (vals) => {
                  await post("/my/qualifications", { ...vals, year: vals.year ? parseInt(vals.year) : null });
                  load();
                }} label="Add for verification" />
            </div>
          </Card>

          {/* publications */}
          <Card>
            <CardHeader title="Publications" />
            <ul className="divide-y divide-slate-100">
              {(profile.publications ?? []).map((p: any) => (
                <li key={p.id ?? p.title} className="px-5 py-3">
                  <p className="text-[13.5px] font-medium text-ink-600">{p.title}</p>
                  <p className="text-[12px] text-slate-400">{p.journal} · {p.year ?? ""} · {statusLabel(p.pub_type ?? "")}</p>
                </li>
              ))}
              {(profile.publications ?? []).length === 0 && <li className="px-5 py-6 text-center text-[13px] text-slate-400">No publications added.</li>}
            </ul>
            <div className="border-t border-slate-100 px-5 py-4">
              <AddRow fields={[["title", "Title"], ["journal", "Journal"], ["year", "Year"], ["pub_type", "journal_article / conference / chapter"]]}
                onSubmit={async (vals) => { await post("/my/publications", { ...vals, year: vals.year ? parseInt(vals.year) : null }); load(); }}
                label="Add publication" />
            </div>
          </Card>

          {/* portfolio */}
          <Card>
            <CardHeader title="Portfolio" subtitle="Describe completed work without breaching client confidentiality." />
            <ul className="divide-y divide-slate-100">
              {(profile.portfolio ?? []).map((p: any) => (
                <li key={p.id ?? p.title} className="px-5 py-3">
                  <p className="text-[13.5px] font-medium text-ink-600">{p.title}</p>
                  <p className="text-[12px] text-slate-400">{p.discipline} · {p.year ?? ""}</p>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">{p.description}</p>
                </li>
              ))}
              {(profile.portfolio ?? []).length === 0 && <li className="px-5 py-6 text-center text-[13px] text-slate-400">No portfolio items yet.</li>}
            </ul>
            <div className="border-t border-slate-100 px-5 py-4">
              <AddRow fields={[["title", "Title"], ["discipline", "Discipline"], ["year", "Year"], ["description", "Short description"]]}
                onSubmit={async (vals) => { await post("/my/portfolio", { ...vals, year: vals.year ? parseInt(vals.year) : null }); load(); }}
                label="Add portfolio item" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((x) => <Badge key={x} className="bg-ink-50 text-ink-600 ring-ink-100">{x}</Badge>)}
      </div>
    </div>
  );
}

function AddRow({ fields, onSubmit, label }: { fields: [string, string][]; onSubmit: (vals: Record<string, string>) => Promise<void>; label: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-5" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const vals: Record<string, string> = {};
      fields.forEach(([k]) => { vals[k] = (data.get(k) as string) || ""; });
      setBusy(true);
      try { await onSubmit(vals); form.reset(); toast.push("Added", "success"); }
      catch (err: any) { toast.push(err.message, "error"); }
      finally { setBusy(false); }
    }}>
      {fields.map(([k, label2]) => <Input key={k} name={k} placeholder={label2} aria-label={label2} />)}
      <Button type="submit" variant="secondary" loading={busy}>{label}</Button>
    </form>
  );
}
