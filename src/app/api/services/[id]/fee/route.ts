import { NextResponse } from "next/server";
import { handle, readJson, requireFields } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, run } from "@/lib/db";

// Fee management: set the company take-rate per service (percent or fixed).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const body = await readJson<{ mode: string; value: string }>(req);
    requireFields(body, ["mode", "value"]);
    if (!["PERCENT", "FIXED"].includes(body.mode)) throw new HttpError(400, "mode must be PERCENT or FIXED.");

    const svc = get("SELECT id FROM services WHERE id = ?", id);
    if (!svc) throw new HttpError(404, "Service not found.");

    if (body.mode === "PERCENT") {
      const pct = parseFloat(body.value);
      if (Number.isNaN(pct) || pct < 0 || pct > 90) throw new HttpError(400, "Percent fee must be 0–90.");
      run("UPDATE services SET fee_mode='PERCENT', fee_value=? WHERE id=?", Math.round(pct), id);
    } else {
      const cents = Math.round(parseFloat(body.value) * 100);
      if (Number.isNaN(cents) || cents < 0) throw new HttpError(400, "Fixed fee must be a positive USD amount.");
      run("UPDATE services SET fee_mode='FIXED', fee_value=? WHERE id=?", cents, id);
    }
    return NextResponse.json({ ok: true, message: "Service fee updated. New payouts use the new rate." });
  });
}
