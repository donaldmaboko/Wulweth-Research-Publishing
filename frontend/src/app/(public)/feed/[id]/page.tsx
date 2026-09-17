import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_SERVER = process.env.BACKEND_URL || "http://localhost:8000";
export const revalidate = 60;

async function getPost(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_SERVER}/api/feed/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await getPost(params.id);
  if (!post) return { title: "Post" };
  return { title: post.title, description: (post.body ?? "").slice(0, 155) };
}

export default async function FeedPostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  if (!post || post.status !== "PUBLISHED") notFound();

  return (
    <article className="container-w max-w-2xl py-12">
      <Link href="/feed" className="text-[13px] font-medium text-teal-700 hover:underline">← Research Feed</Link>
      <header className="mt-6">
        {post.category && <p className="eyebrow">{post.category.name}</p>}
        <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight sm:text-[34px]">{post.title}</h1>
        <div className="mt-4 flex items-center gap-3">
          <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-600 font-display text-[14px] font-semibold text-teal-100">
            {String(post.author?.full_name ?? "?").split(" ").slice(0, 2).map((s: string) => s[0]).join("")}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink-600">{post.author?.full_name}</p>
            <p className="text-[12.5px] text-slate-400">{post.author?.professional_title ?? ""} · {new Date(post.published_at ?? post.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </header>
      <div className="prose-w mt-8 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{post.body}</div>
      <footer className="mt-10 rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-center">
        <p className="text-[13.5px] text-slate-500">
          Reactions, comments and reporting are available to signed-in members. All contributions are screened for research integrity and copyright compliance.
        </p>
        <Link href="/signin" className="mt-3 inline-block rounded-lg bg-ink-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700">Sign in to join the discussion</Link>
      </footer>
    </article>
  );
}
