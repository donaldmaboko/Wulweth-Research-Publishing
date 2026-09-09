import { NextResponse } from "next/server";
import { HttpError } from "./auth";

/** Wraps a route handler: JSON errors for HttpError, 500 otherwise. */
export function handle(fn: () => Promise<NextResponse | Response>): Promise<NextResponse | Response> {
  return fn().catch((err) => {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 400 });
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

export function requireFields(obj: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((f) => obj[f] == null || obj[f] === "");
  if (missing.length) {
    throw new HttpError(400, `Missing field(s): ${missing.join(", ")}`);
  }
}
