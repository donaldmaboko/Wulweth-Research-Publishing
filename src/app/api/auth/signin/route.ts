import { NextResponse } from "next/server";
import {
  createSession, findUserByEmail, homeForRole, HttpError, verifyPassword,
} from "@/lib/auth";
import { handle, readJson, requireFields } from "@/lib/api";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ email: string; password: string }>(req);
    requireFields(body, ["email", "password"]);
    const user = await findUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      throw new HttpError(401, "Incorrect email or password.");
    }
    await createSession(user.id, user.role);
    return NextResponse.json({ ok: true, redirect: homeForRole(user.role) });
  });
}
