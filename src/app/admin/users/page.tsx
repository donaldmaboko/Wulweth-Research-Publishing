import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import { Card, PageHeader, Pill } from "@/components/ui";
import { VerifyButton } from "@/components/admin-actions";
import { DISCIPLINES } from "@/lib/types";

type Researcher = {
  id: string; name: string; email: string; verified: number; headline: string | null;
  disciplines: string | null; affiliation: string | null; orcid: string | null;
  created_at: string; active_projects: number; earned_cents: number | null;
};

type Client = {
  id: string; name: string; email: string; created_at: string;
  project_count: number; spent_cents: number | null;
};

export default async function AdminUsersPage() {
  await requireRole("ADMIN");

  const researchers = all<Researcher>(
    `SELECT u.id, u.name, u.email, u.verified, u.headline, u.disciplines, u.affiliation, u.orcid, u.created_at,
            (SELECT count(*) FROM projects p WHERE p.researcher_id = u.id AND p.status IN ('ASSIGNED','IN_PROGRESS','UNDER_REVIEW')) AS active_projects,
            (SELECT SUM(po.net_cents) FROM payouts po WHERE po.researcher_id = u.id AND po.status = 'PAID') AS earned_cents
     FROM users u WHERE u.role = 'FREELANCER' ORDER BY u.verified DESC, u.name`
  );
  const clients = all<Client>(
    `SELECT u.id, u.name, u.email, u.created_at,
            (SELECT count(*) FROM projects p WHERE p.client_id = u.id) AS project_count,
            (SELECT SUM(i.total_cents) FROM invoices i WHERE i.client_id = u.id AND i.status = 'PAID') AS spent_cents
     FROM users u WHERE u.role = 'CLIENT' ORDER BY u.created_at DESC`
  );

  return (
    <div className="space-y-10">
      <section>
        <PageHeader
          title="Researcher roster"
          subtitle="Vetting is our core trust mechanism — only vetted researchers appear with the badge and get priority matching."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {researchers.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-950">{r.name}</span>
                    {r.verified ? <Pill className="bg-emerald-50 text-emerald-800 ring-emerald-300">✔ Vetted</Pill> : <Pill className="bg-amber-50 text-amber-800 ring-amber-300">Unvetted</Pill>}
                  </div>
                  <div className="text-xs text-ink-500">{r.email} · joined {fmtDate(r.created_at)}</div>
                  {r.headline ? <div className="mt-1 text-sm text-ink-700">{r.headline}</div> : null}
                  {r.affiliation || r.orcid ? (
                    <div className="mt-0.5 text-xs text-ink-500">
                      {[r.affiliation, r.orcid ? `ORCID ${r.orcid}` : null].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                  {r.disciplines ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.disciplines.split(",").map((d) => (
                        <span key={d} className="pill bg-ink-50 text-ink-600 ring-ink-200">{d.trim()}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-ink-500">
                    {r.active_projects} active · {money(r.earned_cents ?? 0)} paid lifetime
                  </div>
                </div>
                <VerifyButton userId={r.id} verified={!!r.verified} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <PageHeader title="Clients" subtitle={`${clients.length} account(s)`} />
        <div className="overflow-x-auto rounded-xl border border-ink-900/10 bg-white">
          <table className="table-base">
            <thead><tr><th>Name</th><th>Email</th><th>Projects</th><th>Lifetime paid</th><th>Joined</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-ink-600">{c.email}</td>
                  <td>{c.project_count}</td>
                  <td className="font-semibold">{money(c.spent_cents ?? 0)}</td>
                  <td className="text-ink-500">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink-950">Vetting checklist (used by the desk)</h2>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-ink-600 md:grid-cols-2">
            <ul className="list-disc space-y-1 pl-5">
              <li>Degree verification &amp; affiliation check</li>
              <li>ORCID iD and publication history review</li>
              <li>Anonymized writing-sample assessment</li>
            </ul>
            <ul className="list-disc space-y-1 pl-5">
              <li>Discipline knowledge quiz ({DISCIPLINES.length} tracks)</li>
              <li>Plagiarism &amp; AI-content policy attestation</li>
              <li>GDPR data-handling training</li>
            </ul>
          </div>
        </Card>
      </section>
    </div>
  );
}
