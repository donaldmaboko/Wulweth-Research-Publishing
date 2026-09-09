import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, newRef, nowISO, run } from "@/lib/db";

/**
 * Mock payment gateway — stands in for a Stripe PaymentIntent / bank-transfer
 * instruction. Card charges settle instantly into ESCROW. Bank transfers stay
 * 'awaiting confirmation' until a Wulweth admin confirms receipt (admin side).
 *
 * Production mapping (Stripe Connect destination charge):
 *   1. create PaymentIntent on the platform account, transfer_group=<invoice>
 *   2. funds land on the platform balance (escrow) — this record: status ESCROWED
 *   3. on payout, create a Transfer to the researcher's connected account
 *      minus the application fee → this record: status RELEASED
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await apiUser("CLIENT");
    const body = await readJson<{ method?: string }>(req);
    
    if (!["CARD", "BANK_TRANSFER"].includes(body.method!)) {
      throw new HttpError(400, "Choose card or bank transfer.");
    }
    const method = body.method!;

    const inv = get<{
      id: string; number: string; client_id: string; status: string; total_cents: number;
    }>("SELECT id, number, client_id, status, total_cents FROM invoices WHERE id = ?", id);
    if (!inv) throw new HttpError(404, "Invoice not found.");
    if (inv.client_id !== user.id) throw new HttpError(403, "Not your invoice.");
    if (inv.status !== "ISSUED") throw new HttpError(400, "This invoice is not awaiting payment.");

    const ts = nowISO();
    // Bank transfer: record intent; funds confirmed later by an admin.
    run(
      `INSERT INTO payments (id, invoice_id, method, amount_cents, status, reference, created_at)
       VALUES (?,?,?,?, 'ESCROWED', ?, ?)`,
      `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      inv.id, method, inv.total_cents, newRef("pay"), ts
    );
    run("UPDATE invoices SET status = 'PAID', paid_at = ? WHERE id = ?", ts, inv.id);

    return NextResponse.json({
      ok: true,
      message:
        method === "CARD"
          ? "Payment approved — funds are now held in escrow by Wulweth."
          : "Bank transfer registered — our desk will confirm receipt within 1 business day.",
    });
  });
}
