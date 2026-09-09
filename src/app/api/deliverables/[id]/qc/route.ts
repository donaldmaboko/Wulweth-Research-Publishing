import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, nowISO, run, tx } from "@/lib/db";

/**
 * QC decision by a Wulweth editor/admin:
 *  - approve  → deliverable APPROVED, project COMPLETED (eligible for payout)
 *  - revise   → deliverable REVISION_REQUESTED, project back to IN_PROGRESS
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const body = await readJson<{ action: string; note?: string }>(req);
    requireFields({ action: body.action }, ["action"]);
    if (!["approve", "revise"].includes(body.action)) throw new HttpError(400, "action must be approve or revise.");

    const d = get<{ id: string; project_id: string; status: string }>(
      "SELECT id, project_id, status FROM deliverables WHERE id = ?", id
    );
    if (!d) throw new HttpError(404, "Deliverable not found.");
    const p = get<{ id: string; status: string }>("SELECT id, status FROM projects WHERE id = ?", d.project_id);
    if (!p || p.status !== "UNDER_REVIEW") throw new HttpError(400, "Project is not awaiting QC.");

    const ts = nowISO();
    tx(() => {
      if (body.action === "approve") {
        run("UPDATE deliverables SET status='APPROVED', reviewer_note=? WHERE id=?", body.note?.trim() || null, id);
        run("UPDATE projects SET status='COMPLETED', updated_at=? WHERE id=?", ts, p.id);
      } else {
        run("UPDATE deliverables SET status='REVISION_REQUESTED', reviewer_note=? WHERE id=?", body.note?.trim() || "Please revise per QC note.", id);
        run("UPDATE projects SET status='IN_PROGRESS', updated_at=? WHERE id=?", ts, p.id);
      }
    });

    return NextResponse.json({
      ok: true,
      message: body.action === "approve"
        ? "Approved — project completed and eligible for payout."
        : "Revision requested — sent back to the researcher.",
    });
  });
}
