import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { ClaimJobButton } from "@/components/researcher-actions";
import { FEED_TYPE_META, type FeedPostType } from "@/lib/types";

type Job = {
  id: string; type: FeedPostType; title: string; body: string; created_at: string;
  project_id: string | null; discipline: string | null; agreed_cents: number | null;
  claimed_by_me: number; claimed_total: number; taken: number;
};

export default async function ResearcherJobsPage() {
  const user = await requireRole("FREELANCER");

  // Job postings + (for context) other published dispatches, newest first.
  const posts = all<Job>(
    `SELECT f.id, f.type, f.title, f.body, f.created_at, f.project_id,
            p.discipline, p.agreed_cents,
            (SELECT count(*) FROM feed_claims fc WHERE fc.post_id = f.id AND fc.user_id = ?) AS claimed_by_me,
            (SELECT count(*) FROM feed_claims fc WHERE fc.post_id = f.id) AS claimed_total,
            (SELECT count(*) FROM projects pp WHERE pp.id = f.project_id AND pp.researcher_id IS NOT NULL) AS taken
     FROM feed_posts f LEFT JOIN projects p ON p.id = f.project_id
     WHERE f.published = 1 AND f.type IN ('JOB','ANNOUNCEMENT','TREND','COMPLETED_PROJECT')
     ORDER BY CASE WHEN f.type = 'JOB' THEN 0 ELSE 1 END, f.created_at DESC`,
    user.id
  );

  return (
    <div>
      <PageHeader
        title="Company feed — jobs & dispatches"
        subtitle="Open engagements posted by the desk. Claim one to be matched; announcements and trend notes are for context."
      />
      <div className="space-y-4">
        {posts.map((j) => {
          const meta = FEED_TYPE_META[j.type as FeedPostType] ?? FEED_TYPE_META.ANNOUNCEMENT;
          const isJob = j.type === "JOB";
          const taken = isJob && j.project_id != null && !!j.taken;
          return (
            <Card key={j.id} className={`p-5 ${isJob ? "border-emerald-200" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill className={meta.className}>{meta.label}</Pill>
                {isJob && j.discipline ? <Pill className="bg-ink-50 text-ink-700 ring-ink-200">{j.discipline}</Pill> : null}
                {isJob && j.agreed_cents != null ? <Pill className="bg-gold-100 text-gold-800 ring-gold-300">{Math.round(j.agreed_cents / 100)} USD gross</Pill> : null}
                <span className="ml-auto text-xs text-ink-500">{fmtDateTime(j.created_at)}</span>
              </div>
              <h3 className="mt-2 font-display text-lg font-bold leading-6 text-ink-950">{j.title}</h3>
              <p className="mt-1.5 whitespace-pre-line text-[15px] leading-7 text-ink-700">{j.body}</p>
              {isJob ? (
                <div className="mt-4">
                  {taken ? (
                    <span className="pill bg-stone-100 text-stone-600 ring-stone-300">Already matched</span>
                  ) : j.claimed_by_me ? (
                    <span className="pill bg-emerald-50 text-emerald-800 ring-emerald-300">✔ Claimed — the desk will confirm</span>
                  ) : (
                    <ClaimJobButton postId={j.id} claimed={false} />
                  )}
                  {j.claimed_total > 0 && !taken ? (
                    <span className="ml-3 text-xs text-ink-500">{j.claimed_total} researcher(s) interested</span>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
        {posts.length === 0 ? (
          <EmptyState title="Nothing on the feed" body="Job postings from the Wulweth desk will appear here." />
        ) : null}
      </div>
    </div>
  );
}
