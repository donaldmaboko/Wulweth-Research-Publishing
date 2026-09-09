import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { newId, nowISO, run } from "@/lib/db";
import { FEED_TYPE_META, type FeedPostType } from "@/lib/types";

// Admin composes a company-feed post (announcement, trend, job, showcase).
export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser("ADMIN");
    const body = await readJson<{
      type: string; title: string; body: string; published?: boolean;
      anonymized?: boolean; projectId?: string;
    }>(req);
    requireFields(body, ["type", "title", "body"]);
    if (!(body.type in FEED_TYPE_META)) throw new HttpError(400, "Unknown post type.");

    const projectId = body.projectId?.trim() || null;
    if (projectId && !["JOB", "COMPLETED_PROJECT"].includes(body.type)) {
      throw new HttpError(400, "Only JOB or COMPLETED_PROJECT posts link a project.");
    }

    run(
      `INSERT INTO feed_posts (id, type, title, body, published, anonymized, project_id, author_id, created_at)
       VALUES (?,?,?,?,?,?,?, ?, ?)`,
      newId("fp"), body.type, body.title.trim(), body.body.trim(),
      body.published === false ? 0 : 1,
      body.anonymized === false ? 0 : 1,
      projectId, user.id, nowISO()
    );
    return NextResponse.json({ ok: true, message: "Feed post saved." });
  });
}
