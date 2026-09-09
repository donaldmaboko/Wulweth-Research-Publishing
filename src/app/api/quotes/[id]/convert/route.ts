import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, createUserRecord, HttpError } from "@/lib/auth";
import { get, newTrackingId, nowISO, run, tx } from "@/lib/db";

/**
 * Admin converts a public quote request into a priced project.
 *  - If a client account exists for the email → link it; otherwise provision
 *    a client account with a temporary password.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const body = await readJson<{ agreedPrice: string; serviceId?: string }>(req);
    requireFields({ agreedPrice: body.agreedPrice ?? "" }, ["agreedPrice"]);

    const q = get<{
      id: string; ref: string; name: string; email: string; service_id: string | null;
      discipline: string; details: string; budget_cents: number | null; deadline: string | null; status: string;
    }>("SELECT * FROM quote_requests WHERE id = ?", id);
    if (!q) throw new HttpError(404, "Quote request not found.");
    if (q.status !== "NEW") throw new HttpError(400, "Already handled.");

    const agreed = Math.round(parseFloat(body.agreedPrice) * 100);
    if (Number.isNaN(agreed) || agreed <= 0) throw new HttpError(400, "Enter a valid price in USD.");

    const serviceId = body.serviceId?.trim() || q.service_id;
    if (!serviceId) throw new HttpError(400, "Pick a service for this request.");

    const provisioned = { email: "", created: false };
    let projectId = "";

    tx(() => {
      let clientId = get<{ id: string }>("SELECT id FROM users WHERE lower(email) = lower(?)", q.email)?.id;
      if (!clientId) {
        clientId = createUserRecord({
          name: q.name, email: q.email, password: "wulweth-reset", role: "CLIENT",
        });
        provisioned.email = q.email.toLowerCase();
        provisioned.created = true;
      }

      projectId = `prj_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      const ts = nowISO();
      run(
        `INSERT INTO projects (id, tracking_id, client_id, service_id, discipline, title, description,
          status, deadline, budget_cents, agreed_cents, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?, 'QUOTED', ?,?,?,?,?)`,
        projectId, newTrackingId(), clientId, serviceId, q.discipline,
        `Quote ${q.ref} — ${q.discipline} engagement`, q.details, q.deadline,
        q.budget_cents, agreed, ts, ts
      );
      run("UPDATE quote_requests SET status='CONVERTED', project_id=? WHERE id=?", projectId, q.id);
    });

    return NextResponse.json({
      ok: true,
      projectId,
      message: provisioned.created
        ? `Converted to a QUOTED project. A client account was provisioned for ${provisioned.email} (temporary password "wulweth-reset" — must be reset on first login in production).`
        : "Converted to a QUOTED project — linked to the existing client account.",
    });
  });
}
