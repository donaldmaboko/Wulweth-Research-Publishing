import Link from "next/link";
import { all } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Card, PageHeader, Pill } from "@/components/ui";
import { FeedComposer, FeedPostActions } from "@/components/admin-actions";
import { FEED_TYPE_META, type FeedPostType } from "@/lib/types";

type Post = {
  id: string; type: FeedPostType; title: string; body: string; published: number;
  anonymized: number; created_at: string; author_name: string; claims: number; p_title: string | null;
};

export default async function AdminFeedPage() {
  await requireRole("ADMIN");

  const posts = all<Post>(
    `SELECT f.id, f.type, f.title, f.body, f.published, f.anonymized, f.created_at,
            u.name AS author_name, p.title AS p_title,
            (SELECT count(*) FROM feed_claims fc WHERE fc.post_id = f.id) AS claims
     FROM feed_posts f
     JOIN users u ON u.id = f.author_id
     LEFT JOIN projects p ON p.id = f.project_id
     ORDER BY f.created_at DESC`
  );
  const projects = all<{ id: string; title: string }>(
    "SELECT id, title FROM projects ORDER BY created_at DESC LIMIT 50"
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section>
        <PageHeader title="Compose a dispatch" subtitle="Announcements, research trends, open engagements (jobs) and anonymized showcases — published to the public feed." />
        <Card className="p-6">
          <FeedComposer projects={projects} />
        </Card>
      </section>

      <section>
        <PageHeader title="Feed management" subtitle={`${posts.length} post(s)`} />
        <div className="space-y-4">
          {posts.map((p) => {
            const meta = FEED_TYPE_META[p.type] ?? FEED_TYPE_META.ANNOUNCEMENT;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill className={meta.className}>{meta.label}</Pill>
                  <Pill className={p.published ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : "bg-stone-100 text-stone-600 ring-stone-300"}>
                    {p.published ? "Published" : "Draft"}
                  </Pill>
                  {p.type === "JOB" && p.claims > 0 ? (
                    <Pill className="bg-sky-50 text-sky-800 ring-sky-300">{p.claims} claim(s)</Pill>
                  ) : null}
                  <span className="ml-auto text-xs text-ink-500">{fmtDateTime(p.created_at)}</span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-ink-950">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-600">{p.body}</p>
                {p.p_title ? <p className="mt-1 text-xs text-ink-500">Linked project: {p.p_title}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FeedPostActions postId={p.id} published={!!p.published} />
                  <Link href="/feed" className="text-xs font-semibold text-ink-600 underline">View public feed →</Link>
                </div>
              </Card>
            );
          })}
          {posts.length === 0 ? <Card className="p-6 text-sm text-ink-500">No posts yet — write the first dispatch.</Card> : null}
        </div>
      </section>
    </div>
  );
}
