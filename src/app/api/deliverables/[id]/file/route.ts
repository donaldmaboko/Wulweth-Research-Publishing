import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser, HttpError } from "@/lib/auth";
import { get } from "@/lib/db";

/**
 * Authorized download of a deliverable.
 *  - researcher on the project: any version
 *  - client who owns the project: any version of their own project
 *    (QC-gated in the UI; the file belongs to the client who paid for it)
 *  - admin: any
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Sign in required.");
    const { id } = await ctx.params;

    const d = get<{
      id: string; project_id: string; filename: string; stored_name: string; mime: string;
      researcher_id: string | null; client_id: string;
    }>(
      `SELECT d.id, d.project_id, d.filename, d.stored_name, d.mime,
              p.researcher_id, p.client_id
       FROM deliverables d JOIN projects p ON p.id = d.project_id WHERE d.id = ?`,
      id
    );
    if (!d) throw new HttpError(404, "File not found.");

    const allowed =
      user.role === "ADMIN" ||
      d.researcher_id === user.id ||
      d.client_id === user.id;
    if (!allowed) throw new HttpError(403, "No access to this deliverable.");

    const full = path.join(process.cwd(), ".data", "uploads", d.stored_name);
    if (!existsSync(full)) throw new HttpError(404, "File missing from storage.");

    const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": d.mime,
        "Content-Length": String(statSync(full).size),
        "Content-Disposition": `attachment; filename="${d.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[file]", err);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
