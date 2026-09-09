import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { handle } from "@/lib/api";
import { apiUser, HttpError } from "@/lib/auth";
import { get, newId, nowISO, run } from "@/lib/db";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per deliverable
const ALLOWED = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", "text/csv", "text/plain",
  "application/zip", "image/png", "image/jpeg",
];

/**
 * Researcher submits a deliverable (version-controlled). Sets the project to
 * UNDER_REVIEW so the QC desk picks it up.
 *
 * Storage: local `.data/uploads/<projectId>/` in the MVP.
 * Production: S3 multipart upload with server-side KMS encryption; the
 * `stored_name` column carries the S3 object key unchanged.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await apiUser("FREELANCER");
    const { id } = await ctx.params;

    const p = get<{ id: string; researcher_id: string | null; status: string; tracking_id: string }>(
      "SELECT id, researcher_id, status, tracking_id FROM projects WHERE id = ?", id
    );
    if (!p || p.researcher_id !== user.id) throw new HttpError(404, "Assignment not found.");
    if (!["ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW"].includes(p.status)) {
      throw new HttpError(400, "This project is not open for submissions.");
    }

    const form = await req.formData();
    const file = form.get("file");
    const note = (form.get("note") as string | null)?.trim() || null;
    if (!(file instanceof File)) throw new HttpError(400, "Attach a file.");
    if (file.size === 0) throw new HttpError(400, "File is empty.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File exceeds the 25 MB limit.");
    if (file.type && !ALLOWED.includes(file.type)) {
      throw new HttpError(415, `Unsupported file type: ${file.type}`);
    }

    const last = get<{ v: number }>("SELECT MAX(version) AS v FROM deliverables WHERE project_id = ?", id);
    const version = (last?.v ?? 0) + 1;
    const delivId = newId("dlv");
    const ext = path.extname(file.name) || "";
    const storedName = `${p.tracking_id}/v${version}-${delivId}${ext}`;

    const dir = path.join(process.cwd(), ".data", "uploads", p.tracking_id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, path.basename(storedName)), Buffer.from(await file.arrayBuffer()));

    run(
      `INSERT INTO deliverables (id, project_id, version, filename, stored_name, mime, size_bytes, note, status, created_at)
       VALUES (?,?,?,?,?,?,?,?, 'SUBMITTED', ?)`,
      delivId, id, version, file.name, storedName, file.type || "application/octet-stream",
      file.size, note, nowISO()
    );
    run("UPDATE projects SET status = 'UNDER_REVIEW', updated_at = ? WHERE id = ?", nowISO(), id);

    return NextResponse.json({
      ok: true,
      message: `v${version} uploaded and queued for QC review.`,
    });
  });
}
