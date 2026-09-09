import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { get, newId, nowISO, run } from "./db";
import type { Role } from "./types";

const COOKIE_NAME = "wulweth_session";
const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return process.env.SESSION_SECRET ?? "wulweth-dev-secret-change-in-production";
}

// --------------------------------------------------------------- passwords

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

// ---------------------------------------------------------------- sessions
// Stateless HMAC-signed token stored in an httpOnly cookie:
//   base64url(json payload) + "." + hex hmac-sha256(payload)
// Production note: swap for NextAuth/Auth.js or JWT rotation; the surface
// (getCurrentUser / requireRole) stays identical.

type SessionPayload = { uid: string; role: Role; exp: number };

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("hex");
}

function makeToken(uid: string, role: Role): string {
  const payload: SessionPayload = {
    uid,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(uid: string, role: Role): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, makeToken(uid, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_S,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ------------------------------------------------------------------ lookups

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  verified: number;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = readToken(store.get(COOKIE_NAME)?.value);
  if (!payload) return null;
  const user = get<{
    id: string; name: string; email: string; role: Role; verified: number;
  }>("SELECT id, name, email, role, verified FROM users WHERE id = ?", payload.uid);
  return user ?? null;
}

/** Server-page guard: redirect to /signin when not authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

/** Server-page guard: redirect when the role does not match. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}

/** API-route guard: returns the user or throws a Response-friendly error. */
export async function apiUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sign in required.");
  if (roles.length && !roles.includes(user.role)) throw new HttpError(403, "Not allowed for your role.");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function homeForRole(role: Role): string {
  switch (role) {
    case "ADMIN": return "/admin";
    case "FREELANCER": return "/researcher";
    default: return "/portal";
  }
}

export async function findUserByEmail(email: string) {
  return get<{ id: string; name: string; email: string; password_hash: string; role: Role }>(
    "SELECT id, name, email, password_hash, role FROM users WHERE lower(email) = lower(?)",
    email.trim()
  );
}

export function createUserRecord(input: {
  name: string; email: string; password: string; role: Role;
}): string {
  const id = newId("usr");
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)",
    id, input.name.trim(), input.email.trim().toLowerCase(), hashPassword(input.password), input.role, nowISO()
  );
  return id;
}

export async function createUser(input: {
  name: string; email: string; password: string; role: Role;
}) {
  return createUserRecord(input);
}
