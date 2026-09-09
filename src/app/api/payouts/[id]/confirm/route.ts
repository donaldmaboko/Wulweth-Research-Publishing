import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, nowISO, run } from "@/lib/db";

// Admin confirms the transfer settled (mock rails) → PAID.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const pot = get<{ id: string; status: string }>("SELECT id, status FROM payouts WHERE id = ?", id);
    if (!pot) throw new HttpError(404, "Payout not found.");
    if (pot.status !== "PROCESSING") throw new HttpError(400, "Payout is not pending.");
    run("UPDATE payouts SET status='PAID', paid_at=? WHERE id=?", nowISO(), id);
    return NextResponse.json({ ok: true, message: "Payout marked as settled." });
  });
}
