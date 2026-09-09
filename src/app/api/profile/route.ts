import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { run } from "@/lib/db";

// Researcher updates their profile (used by admin for expertise matching).
export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser("FREELANCER");
    const body = await readJson<{
      headline?: string; bio?: string; disciplines?: string;
      affiliation?: string; orcid?: string;
    }>(req);
    run(
      `UPDATE users SET headline = ?, bio = ?, disciplines = ?, affiliation = ?, orcid = ? WHERE id = ?`,
      body.headline?.trim() || null,
      body.bio?.trim() || null,
      body.disciplines?.trim() || null,
      body.affiliation?.trim() || null,
      body.orcid?.trim() || null,
      user.id
    );
    return NextResponse.json({ ok: true, message: "Profile saved." });
  });
}
