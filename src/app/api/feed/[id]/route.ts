import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, run } from "@/lib/db";

// Admin: publish/unpublish or delete a feed post.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const body = await readJson<{ published?: boolean; anonymized?: boolean }>(req);
    const post = get("SELECT id FROM feed_posts WHERE id = ?", id);
    if (!post) throw new HttpError(404, "Post not found.");
    if (body.published != null) run("UPDATE feed_posts SET published = ? WHERE id = ?", body.published ? 1 : 0, id);
    if (body.anonymized != null) run("UPDATE feed_posts SET anonymized = ? WHERE id = ?", body.anonymized ? 1 : 0, id);
    return NextResponse.json({ ok: true, message: "Post updated." });
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    run("DELETE FROM feed_claims WHERE post_id = ?", id);
    run("DELETE FROM feed_posts WHERE id = ?", id);
    return NextResponse.json({ ok: true, message: "Post deleted." });
  });
}
