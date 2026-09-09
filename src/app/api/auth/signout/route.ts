import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: Request) {
  await destroySession();
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
