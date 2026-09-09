import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { get, newTrackingId, nowISO, run, tx } from "@/lib/db";
import { DISCIPLINES, type Discipline } from "@/lib/types";

// Client creates a research request (status PENDING → desk officer quotes it).
export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser("CLIENT");
    const body = await readJson<{
      serviceId: string; discipline: string; title: string; description: string;
      deadline?: string; budget?: string;
    }>(req);
    requireFields(body, ["serviceId", "discipline", "title", "description"]);

    const service = get<{ id: string }>("SELECT id FROM services WHERE id = ? AND active = 1", body.serviceId);
    if (!service) throw new Error("Unknown service.");
    if (!DISCIPLINES.includes(body.discipline as Discipline)) throw new Error("Unknown discipline.");
    if (body.title.trim().length < 6) throw new Error("Give the project a descriptive title.");

    const budgetCents = body.budget ? Math.round(parseFloat(body.budget) * 100) : null;
    const id = `prj_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const ts = nowISO();

    tx(() => {
      run(
        `INSERT INTO projects (id, tracking_id, client_id, service_id, discipline, title, description,
          status, deadline, budget_cents, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?, 'PENDING', ?,?,?,?)`,
        id, newTrackingId(), user.id, service.id, body.discipline,
        body.title.trim(), body.description.trim(), body.deadline || null, budgetCents, ts, ts
      );
    });

    const trackingId = get<{ tracking_id: string }>("SELECT tracking_id FROM projects WHERE id = ?", id)!.tracking_id;
    return NextResponse.json({ ok: true, id, trackingId });
  });
}
