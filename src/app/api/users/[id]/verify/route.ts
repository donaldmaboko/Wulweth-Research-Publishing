import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, run } from "@/lib/db";

// Vet researcher toggle — drives the public "vetted" trust badge.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await apiUser("ADMIN");
    const { id } = await ctx.params;
    const u = get<{ id: string; role: string; verified: number }>(
      "SELECT id, role, verified FROM users WHERE id = ?", id
    );
    if (!u || u.role !== "FREELANCER") throw new HttpError(404, "Researcher not found.");
    run("UPDATE users SET verified = ? WHERE id = ?", u.verified ? 0 : 1, id);
    return NextResponse.json({ ok: true, message: u.verified ? "Vetting revoked." : "Researcher vetted ✔" });
  });
}
