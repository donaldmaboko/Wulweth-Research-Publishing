import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { NewProjectForm } from "@/components/client-actions";

export default async function NewProjectPage() {
  await requireRole("CLIENT");
  const services = all<{ id: string; name: string; category: string }>(
    "SELECT id, name, category FROM services WHERE active = 1 ORDER BY sort_order"
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_0.7fr]">
      <Card className="p-7">
        <PageHeader
          title="New research request"
          subtitle="Scope it once — we quote it fixed-price, match a vetted researcher, and QC the output."
        />
        <NewProjectForm services={services} />
      </Card>
      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">What a good brief includes</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-600">
            <li>Research questions or hypotheses</li>
            <li>Discipline &amp; subfield, methodology preferences</li>
            <li>Data you already have (or expect)</li>
            <li>Required style (APA 7, Vancouver, Chicago…)</li>
            <li>Target outlet or committee requirements</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink-950">Prefer a conversation?</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Complex or multi-workpackage programs (grant proposals, multi-study reviews) are
            scoped on a call. Submit the brief anyway and tick that you&rsquo;d like to discuss —
            a desk officer will reach out.
          </p>
        </Card>
      </div>
    </div>
  );
}
