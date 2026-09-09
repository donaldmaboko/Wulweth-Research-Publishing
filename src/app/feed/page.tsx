import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { FEED_TYPE_META, type FeedPostType } from "@/lib/types";
import { Card, Pill } from "@/components/ui";

export const metadata: Metadata = {
  title: "Company feed",
  description:
    "Announcements, research trends, anonymized completed projects and open research engagements from Wulweth Research & Publishing.",
};

type Post = {
  id: string; type: FeedPostType; title: string; body: string;
  created_at: string; project_id: string | null;
};

export default function FeedPage() {
  const posts = all<Post>(
    "SELECT id, type, title, body, created_at, project_id FROM feed_posts WHERE published = 1 ORDER BY created_at DESC LIMIT 50"
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="pill bg-gold-100 text-gold-800 ring-gold-300">Company feed</p>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-950">
        Dispatches from the desk
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-600">
        Announcements, research trend notes, recently completed engagements (anonymized), and
        open calls for researchers on our roster.
      </p>

      <div className="mt-10 space-y-5">
        {posts.map((p) => {
          const meta = FEED_TYPE_META[p.type] ?? FEED_TYPE_META.ANNOUNCEMENT;
          return (
            <Card key={p.id} className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className={meta.className}>{meta.label}</Pill>
                <span className="text-xs text-ink-500">{fmtDate(p.created_at)}</span>
              </div>
              <h2 className="mt-3 font-display text-xl font-bold leading-7 text-ink-950">{p.title}</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-ink-700">{p.body}</p>
              {p.type === "JOB" ? (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
                  <span>Open engagement for roster researchers.</span>
                  <Link href="/signup?as=researcher" className="font-semibold underline">
                    Join the roster to claim →
                  </Link>
                </div>
              ) : null}
            </Card>
          );
        })}
        {posts.length === 0 ? (
          <Card className="p-10 text-center text-sm text-ink-500">
            No dispatches yet — the desk is writing the first one.
          </Card>
        ) : null}
      </div>
    </div>
  );
}
