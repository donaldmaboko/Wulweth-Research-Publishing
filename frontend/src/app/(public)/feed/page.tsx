import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Research Feed",
  description:
    "A professional research community feed: research updates, publications, conferences, methodology discussion, data science insights and publishing information.",
};

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";
export const revalidate = 60;

async function getFeed(): Promise<{ items: any[]; categories: any[] }> {
  try {
    const [feedRes, catRes] = await Promise.all([
      fetch(`${API_SERVER}/api/feed?page_size=20`, { next: { revalidate: 60 } }),
      fetch(`${API_SERVER}/api/feed/categories`, { next: { revalidate: 300 } }),
    ]);
    const items = feedRes.ok ? (await feedRes.json()).items ?? [] : [];
    const categories = catRes.ok ? (await catRes.json()).items ?? [] : [];
    return { items, categories };
  } catch {
    return { items: [], categories: [] };
  }
}

export default async function FeedPage() {
  const { items } = await getFeed();
  return (
    <>
      <section className="bg-ink-600 py-14 text-white">
        <div className="container-w max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Community</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold sm:text-[42px]">Research Feed</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-100/90">
            Professional discussion for the research community — updates, publications,
            conferences, methodology and data science insight. All content is subject to
            Wulweth&rsquo;s research integrity and copyright policies.
          </p>
        </div>
      </section>

      <div className="container-w max-w-3xl py-12">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">The feed is quiet right now.</p>
        ) : (
          <div className="space-y-5">
            {items.map((post) => (
              <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card transition-all hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-600 font-display text-[13px] font-semibold text-teal-100">
                    {String(post.author?.full_name ?? "?").split(" ").slice(0, 2).map((s: string) => s[0]).join("")}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink-600">{post.author?.full_name}</p>
                    <p className="text-[12px] text-slate-400">
                      {post.author?.professional_title ?? post.author?.role?.replaceAll("_", " ").toLowerCase()}
                      {post.category ? ` · ${post.category.name}` : ""}
                    </p>
                  </div>
                </div>
                <h2 className="mt-4 text-[17px] font-semibold leading-snug text-ink-600">
                  <Link href={`/feed/${post.id}`} className="hover:text-teal-700">{post.title}</Link>
                </h2>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-500">{post.body}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-[12.5px] text-slate-400">
                  <span>{post.comment_count} comment{post.comment_count === 1 ? "" : "s"}</span>
                  <span>
                    {Object.entries(post.reactions ?? {}).map(([k, v]: [string, any]) => `${v} ${k.toLowerCase()}`).join(", ") || "Be the first to react"}
                  </span>
                  <Link href={`/feed/${post.id}`} className="ml-auto font-medium text-teal-700 hover:underline">Read &amp; join →</Link>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-[13px] text-slate-400">
          <Link href="/signin" className="link">Sign in</Link> to post, comment and react — every post is screened for research integrity.
        </p>
      </div>
    </>
  );
}
