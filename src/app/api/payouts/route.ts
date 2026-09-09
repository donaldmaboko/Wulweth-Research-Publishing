import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, newId, newRef, nowISO, run, tx } from "@/lib/db";
import { computeFee } from "@/lib/format";

/**
 * Admin triggers a payout for a COMPLETED project whose invoice payment is
 * still in escrow. The company service fee is snapshotted (audit-proof), the
 * remainder is queued to the researcher.
 *
 * Production mapping: Stripe Connect `transfers.create` to the researcher's
 * connected account with `source_transaction` set on the original charge
 * (ensures the platform never pays out uncollected funds).
 */
export async function POST(req: Request) {
  return handle(async () => {
    await apiUser("ADMIN");
    const body = await readJson<{ projectId: string }>(req);
    requireFields(body, ["projectId"]);

    const p = get<{
      id: string; tracking_id: string; status: string; agreed_cents: number;
      researcher_id: string | null; fee_mode: string; fee_value: number;
    }>(
      `SELECT p.id, p.tracking_id, p.status, p.agreed_cents, p.researcher_id,
              s.fee_mode, s.fee_value
       FROM projects p JOIN services s ON s.id = p.service_id WHERE p.id = ?`,
      body.projectId
    );
    if (!p) throw new HttpError(404, "Project not found.");
    if (p.status !== "COMPLETED") throw new HttpError(400, "Only QC-completed projects can be paid out.");
    if (!p.researcher_id) throw new HttpError(400, "No researcher assigned.");
    if (p.agreed_cents == null) throw new HttpError(400, "No agreed price on this project.");
    if (get("SELECT id FROM payouts WHERE project_id = ?", p.id)) {
      throw new HttpError(409, "A payout already exists for this project.");
    }
    const payment = get<{ id: string }>(
      `SELECT pay.id FROM payments pay JOIN invoices i ON i.id = pay.invoice_id
       JOIN invoice_items ii ON ii.invoice_id = i.id WHERE ii.project_id = ? AND pay.status = 'ESCROWED'`,
      p.id
    );
    if (!payment) throw new HttpError(400, "No escrowed payment found for this project.");

    const fee = computeFee(p.agreed_cents, p.fee_mode as "PERCENT" | "FIXED", p.fee_value);
    const net = p.agreed_cents - fee;
    const ts = nowISO();

    tx(() => {
      run(
        `INSERT INTO payouts (id, project_id, researcher_id, gross_cents, fee_cents, net_cents, status, reference, created_at)
         VALUES (?,?,?,?,?,?, 'PROCESSING', ?, ?)`,
        newId("pot"), p.id, p.researcher_id, p.agreed_cents, fee, net, newRef("po"), ts
      );
      // Escrow is now committed to the researcher; project fully settled.
      run(
        `UPDATE payments SET status = 'RELEASED' WHERE id = ?`,
        payment.id
      );
      run("UPDATE projects SET status = 'PAID_OUT', updated_at = ? WHERE id = ?", ts, p.id);
    });

    return NextResponse.json({
      ok: true,
      message: `Payout queued — gross ${(p.agreed_cents / 100).toFixed(2)}, company fee ${(fee / 100).toFixed(2)}, researcher net ${(net / 100).toFixed(2)}.`,
    });
  });
}
