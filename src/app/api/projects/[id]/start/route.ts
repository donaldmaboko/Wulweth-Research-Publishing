import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, nowISO, run } from "@/lib/db";

// Assigned researcher starts work → IN_PROGRESS
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await apiUser("FREELANCER");
    const { id } = await ctx.params;
    const p = get<{ id: string; researcher_id: string | null; status: string }>(
      "SELECT id, researcher_id, status FROM projects WHERE id = ?", id
    );
    if (!p || p.researcher_id !== user.id) throw new HttpError(404, "Assignment not found.");
    if (p.status !== "ASSIGNED") throw new HttpError(400, `Cannot start from status ${p.status}.`);
    run("UPDATE projects SET status = 'IN_PROGRESS', updated_at = ? WHERE id = ?", nowISO(), id);
    return NextResponse.json({ ok: true, message: "Marked as in progress. Good luck!" });
  });
}
