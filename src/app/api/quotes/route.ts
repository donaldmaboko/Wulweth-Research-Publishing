import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { get, newQuoteRef, nowISO, run } from "@/lib/db";
import { HttpError } from "@/lib/auth";

// Public endpoint — guests can request a quote. If a client is signed in we
// attach their identity implicitly via matching email in the portal.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{
      serviceSlug?: string; discipline: string; name: string; email: string;
      organisation?: string; budget?: string; deadline?: string; details: string;
    }>(req);
    requireFields(body, ["discipline", "name", "email", "details"]);

    const serviceId = body.serviceSlug
      ? (get<{ id: string }>("SELECT id FROM services WHERE slug = ?", body.serviceSlug)?.id ?? null)
      : null;

    const email = body.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
    if (body.details.trim().length < 20) {
      throw new HttpError(400, "Tell us a bit more — at least 20 characters describing the research need.");
    }

    const ref = newQuoteRef();
    const budgetCents = body.budget ? Math.round(parseFloat(body.budget) * 100) : null;
    if (body.budget && (Number.isNaN(budgetCents!) || budgetCents! < 0)) {
      throw new HttpError(400, "Budget must be a positive number.");
    }

    run(
      `INSERT INTO quote_requests
        (id, ref, name, email, organisation, service_id, discipline, details, budget_cents, deadline, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'NEW', ?)`,
      `qr_${ref.toLowerCase()}`, ref, body.name.trim(), email, body.organisation?.trim() || null,
      serviceId, body.discipline, body.details.trim(), budgetCents,
      body.deadline || null, nowISO()
    );

    return NextResponse.json({ ok: true, ref });
  });
}

