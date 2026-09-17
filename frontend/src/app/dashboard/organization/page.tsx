"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { get, put } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Spinner, Table, Td, Textarea, useToast } from "@/components/ui";

export default function OrganizationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    get("/my/organizations").then(async (d) => {
      const first = (d.items ?? [])[0] ?? null;
      setOrg(first);
      if (first?.id) {
        try {
          const m = await get(`/organizations/${first.id}/members`);
          setMembers((m.items ?? m ?? []).filter((x: any) => x.id !== user?.id));
        } catch { setMembers([]); }
      }
    }).catch(() => setOrg(null)).finally(() => setLoading(false));
  }, [user]);

  useEffect(load, [load]);

  if (loading) return <div className="py-24 text-center"><Spinner /></div>;

  if (!org) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-[24px] font-semibold">Organization</h1>
        <div className="mt-5"><EmptyState title="No organization linked to your account" body="Organization accounts are provisioned with the Wulweth desk. Contact us to add colleagues or update your organization profile." /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-semibold">Organization</h1>
        <p className="mt-0.5 text-[13.5px] text-slate-500">Your organization&rsquo;s profile and team on Wulweth.</p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-ink-600">Organization profile</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.target as HTMLFormElement);
          setBusy(true);
          try {
            await put(`/organizations/${org.id}`, {
              name: form.get("name"),
              org_type: form.get("org_type"),
              industry: form.get("industry") || null,
              website: form.get("website") || null,
              description: form.get("description") || null,
              country: form.get("country") || null,
              city: form.get("city") || null,
            });
            toast.push("Organization profile saved", "success");
            load();
          } catch (err: any) { toast.push(err.message, "error"); }
          finally { setBusy(false); }
        }}>
          <Field label="Organization name" required><Input name="name" required defaultValue={org.name} key={`n-${org.name}`} /></Field>
          <Field label="Type" required>
            <Select name="org_type" defaultValue={org.org_type ?? org.organization_type ?? "NGO"} key={`t-${org.org_type ?? org.organization_type}`}>
              {["UNIVERSITY", "NGO", "GOVERNMENT", "HEALTHCARE", "COMPANY", "RESEARCH_INSTITUTE", "OTHER"].map((t) => (
                <option key={t} value={t}>{statusLabel(t)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Industry / sector"><Input name="industry" defaultValue={org.industry ?? ""} /></Field>
          <Field label="Website"><Input name="website" defaultValue={org.website ?? ""} placeholder="https://…" /></Field>
          <Field label="Country"><Input name="country" defaultValue={org.country ?? ""} /></Field>
          <Field label="City"><Input name="city" defaultValue={org.city ?? ""} /></Field>
          <div className="sm:col-span-2"><Field label="About the organization"><Textarea name="description" rows={3} defaultValue={org.description ?? ""} /></Field></div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Team members" subtitle="Colleagues with organization accounts can see shared requests and projects." />
        {members.length === 0 ? <EmptyState title="No other team members yet" body="Ask the Wulweth desk to provision additional organization accounts." /> : (
          <Table head={["Name", "Email", "Role", "Status"]}>
            {members.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium text-ink-600">{m.full_name}</Td>
                <Td className="text-slate-500">{m.email}</Td>
                <Td><Badge className="bg-ink-50 text-ink-600 ring-ink-100">{statusLabel(m.role)}</Badge></Td>
                <Td>{m.status === "ACTIVE" || m.is_active ? <span className="text-teal-600">active</span> : <span className="text-rose-500">suspended</span>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
