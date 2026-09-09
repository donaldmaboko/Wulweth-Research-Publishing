import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, newId, nowISO, run, tx } from "@/lib/db";

/**
 * A roster researcher claims a JOB posting. If the post is linked to a
 * project, claiming assigns the project to them (first claim wins) and moves
 * it to ASSIGNED.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await apiUser("FREELANCER");
    const { id } = await ctx.params;
    const body = await readJson<{ message?: string }>(req).catch(() => ({ message: undefined }));

    const post = get<{ id: string; type: string; project_id: string | null; title: string }>(
      "SELECT id, type, project_id, title FROM feed_posts WHERE id = ? AND published = 1", id
    );
    if (!post) throw new HttpError(404, "Posting not found.");
    if (post.type !== "JOB") throw new HttpError(400, "Only job postings can be claimed.");

    if (get("SELECT id FROM feed_claims WHERE post_id = ? AND user_id = ?", id, user.id)) {
      throw new HttpError(409, "You already claimed this posting.");
    }

    let assigned = false;
    tx(() => {
      run(
        "INSERT INTO feed_claims (id, post_id, user_id, message) VALUES (?,?,?,?)",
        newId("clm"), id, user.id, body?.message?.trim() || null
      );
      if (post.project_id) {
        const p = get<{ id: string; researcher_id: string | null }>(
          "SELECT id, researcher_id FROM projects WHERE id = ?", post.project_id
        );
        // First claim wins the assignment.
        if (p && !p.researcher_id) {
          run("UPDATE projects SET researcher_id = ?, updated_at = ? WHERE id = ?", user.id, nowISO(), p.id);
          assigned = true;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: assigned
        ? "Claimed — this engagement is now assigned to you. Find it under My assignments."
        : "Claim registered — the desk will confirm matching shortly.",
    });
  });
}
