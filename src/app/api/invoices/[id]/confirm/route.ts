import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, nowISO, run } from "@/lib/db";

// Admin confirms receipt of a bank transfer → escrow funded.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const inv = get<{ id: string; status: string }>("SELECT id, status FROM invoices WHERE id = ?", id);
    if (!inv) throw new HttpError(404, "Invoice not found.");
    if (inv.status === "PAID") throw new HttpError(400, "Invoice already settled.");
    if (inv.status !== "ISSUED") throw new HttpError(400, "Only issued invoices can be confirmed.");

    const ts = nowISO();
    run(
      `INSERT INTO payments (id, invoice_id, method, amount_cents, status, reference, created_at)
       VALUES (?,?, 'BANK_TRANSFER',
         (SELECT total_cents FROM invoices WHERE id = ?), 'ESCROWED', ?, ?)`,
      `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`, inv.id, inv.id,
      `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`, ts
    );
    run("UPDATE invoices SET status = 'PAID', paid_at = ? WHERE id = ?", ts, inv.id);
    return NextResponse.json({ ok: true, message: "Transfer confirmed — escrow funded." });
  });
}
