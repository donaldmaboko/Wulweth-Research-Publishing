import { NextResponse } from "next/server";
import {
  createSession, createUser, findUserByEmail, homeForRole, HttpError,
} from "@/lib/auth";
import { handle, readJson, requireFields } from "@/lib/api";
import { ROLES, type Role } from "@/lib/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ name: string; email: string; password: string; role: string }>(req);
    requireFields(body, ["name", "email", "password", "role"]);
    if (!ROLES.includes(body.role as Role) || body.role === "ADMIN") {
      throw new HttpError(400, "Choose a valid account type (client or researcher).");
    }
    if (body.password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters.");
    }
    if (await findUserByEmail(body.email)) {
      throw new HttpError(409, "An account with this email already exists — sign in instead.");
    }
    const id = await createUser({
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role as Role,
    });
    await createSession(id, body.role as Role);
    return NextResponse.json({ ok: true, redirect: homeForRole(body.role as Role) });
  });
}
