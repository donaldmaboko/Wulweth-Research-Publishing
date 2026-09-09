import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, nextInvoiceNumber, nowISO, run, tx } from "@/lib/db";

/**
 * Invoice generation.
 *  - CLIENT: bundles one or more of their QUOTED projects (agreed price set,
 *    not yet invoiced) into a single invoice — "invoice for my project bundle".
 *  - ADMIN: issues an invoice for a single project (the desk-quote path).
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser("CLIENT", "ADMIN");
    const body = await readJson<{ projectIds?: string[] }>(req);
    if (!Array.isArray(body.projectIds) || body.projectIds.length === 0) {
      throw new HttpError(400, "Select at least one project to invoice.");
    }
    const projectIds: string[] = body.projectIds;

    const id = `inv_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const number = nextInvoiceNumber();
    const ts = nowISO();

    const created = tx(() => {
      let subtotal = 0;
      const items: { projectId: string; description: string; amount: number }[] = [];
      let ownerId = user.role === "CLIENT" ? user.id : null;

      for (const pid of projectIds) {
        const p = get<{
          id: string; tracking_id: string; title: string; client_id: string;
          agreed_cents: number | null; status: string;
        }>("SELECT id, tracking_id, title, client_id, agreed_cents, status FROM projects WHERE id = ?", pid);
        if (!p) throw new HttpError(404, `Project ${pid} not found.`);
        if (user.role === "CLIENT" && p.client_id !== user.id) {
          throw new HttpError(403, "You can only invoice your own projects.");
        }
        if (ownerId == null) ownerId = p.client_id;
        if (p.client_id !== ownerId) {
          throw new HttpError(400, "A bundle must contain projects for a single client.");
        }
        if (p.agreed_cents == null) {
          throw new HttpError(400, `"${p.title}" has no agreed price yet — awaiting our quote.`);
        }
        // Fundable once priced — whether or not matching already happened.
        if (!["QUOTED", "ASSIGNED"].includes(p.status)) {
          throw new HttpError(400, `"${p.title}" is not awaiting payment (status: ${p.status}).`);
        }
        const dup = get<{ id: string }>("SELECT id FROM invoice_items WHERE project_id = ?", pid);
        if (dup) throw new HttpError(400, `"${p.title}" is already on an invoice.`);

        subtotal += p.agreed_cents;
        items.push({
          projectId: p.id,
          description: `${p.tracking_id} — ${p.title}`,
          amount: p.agreed_cents,
        });
      }

      run(
        `INSERT INTO invoices (id, number, client_id, status, subtotal_cents, total_cents, created_at)
         VALUES (?,?,?, 'ISSUED', ?, ?, ?)`,
        id, number, ownerId, subtotal, subtotal, ts
      );
      for (const it of items) {
        run(
          "INSERT INTO invoice_items (id, invoice_id, project_id, description, amount_cents) VALUES (?,?,?,?,?)",
          `itm_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`, id, it.projectId, it.description, it.amount
        );
      }
      return { id, number, total: subtotal };
    });

    return NextResponse.json({ ok: true, ...created });
  });
}
