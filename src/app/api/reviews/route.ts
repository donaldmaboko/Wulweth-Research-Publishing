import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, newId, nowISO, run } from "@/lib/db";

// Client reviews a completed project (1–5 stars + comment).
export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser("CLIENT");
    const body = await readJson<{ projectId: string; rating: string; comment: string }>(req);
    requireFields(body, ["projectId", "rating", "comment"]);

    const p = get<{ id: string; client_id: string; status: string }>(
      "SELECT id, client_id, status FROM projects WHERE id = ?", body.projectId
    );
    if (!p || p.client_id !== user.id) throw new HttpError(404, "Project not found.");
    if (!["COMPLETED", "PAID_OUT"].includes(p.status)) {
      throw new HttpError(400, "You can review a project once work is completed.");
    }
    if (get("SELECT id FROM reviews WHERE project_id = ?", p.id)) {
      throw new HttpError(409, "You already reviewed this project.");
    }
    const rating = parseInt(body.rating, 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, "Rating must be 1–5.");
    }
    run(
      "INSERT INTO reviews (id, project_id, client_id, rating, comment, created_at) VALUES (?,?,?,?,?,?)",
      newId("rev"), p.id, user.id, rating, body.comment.trim(), nowISO()
    );
    return NextResponse.json({ ok: true });
  });
}
