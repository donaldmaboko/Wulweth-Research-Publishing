import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, nowISO, run } from "@/lib/db";

/**
 * Project dispersion: admin matches a request with a researcher and sets the
 * agreed price. Works for unpriced requests (PENDING → QUOTED when priced
 * without a researcher, ASSIGNED when matched) and re-assignment.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const body = await readJson<{
      researcherId?: string; agreedPrice?: string; sendToPool?: boolean;
    }>(req);

    const p = get<{ id: string; status: string }>("SELECT id, status FROM projects WHERE id = ?", id);
    if (!p) throw new HttpError(404, "Project not found.");
    if (["COMPLETED", "PAID_OUT", "CANCELLED"].includes(p.status)) {
      throw new HttpError(400, "Settled projects cannot be reassigned.");
    }

    const agreed = body.agreedPrice != null && body.agreedPrice !== ""
      ? Math.round(parseFloat(body.agreedPrice) * 100)
      : undefined;
    if (agreed != null && (Number.isNaN(agreed) || agreed <= 0)) {
      throw new HttpError(400, "Agreed price must be a positive USD amount.");
    }

    const ts = nowISO();
    let message = "Project updated.";

    if (body.sendToPool) {
      // Publish to the assignment pool → any roster researcher can claim via feed.
      run(
        `INSERT INTO feed_posts (id, type, title, body, published, anonymized, project_id, author_id, created_at)
         VALUES ('fp_' || lower(hex(randomblob(8))), 'JOB', ?,
                 'Open engagement — claim to be matched. Scope on the project page.',
                 1, 1, ?, (SELECT id FROM users WHERE role='ADMIN' LIMIT 1), ?)`,
        `Engagement open: ${get<{ title: string }>("SELECT title FROM projects WHERE id = ?", id)?.title ?? "research project"}`,
        id, ts
      );
      if (agreed != null) run("UPDATE projects SET agreed_cents = ? WHERE id = ?", agreed, id);
      message = "Posted to the company feed as an open engagement — roster researchers can claim it.";
    } else {
      const r = get<{ id: string; role: string; verified: number; name: string }>(
        "SELECT id, role, verified, name FROM users WHERE id = ?", body.researcherId ?? ""
      );
      if (!r || r.role !== "FREELANCER") throw new HttpError(400, "Pick a researcher to assign.");

      run(
        "UPDATE projects SET researcher_id = ?, status = ?, updated_at = ? WHERE id = ?",
        r.id, "ASSIGNED", ts, id
      );
      if (agreed != null) run("UPDATE projects SET agreed_cents = ? WHERE id = ?", agreed, id);
      message = `Assigned to ${r.name}${r.verified ? " (vetted)" : ""}.`;
    }

    run("UPDATE projects SET updated_at = ? WHERE id = ?", ts, id);
    return NextResponse.json({ ok: true, message });
  });
}
