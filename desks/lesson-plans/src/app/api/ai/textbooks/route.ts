/**
 * POST /api/ai/textbooks — upload a textbook PDF and kick off durable ingest.
 *
 * Admin-only. Accepts multipart/form-data with:
 *   - file       — the PDF file
 *   - title      — human-readable title (falls back to filename)
 *   - subject    — e.g. "Mathematics"
 *   - grade      — e.g. "Grade 7"
 *   - ocrModelId — optional OpenRouter vision model override
 *
 * Uploads the PDF to storage, inserts a `textbooks` row (status:"pending"),
 * then starts the `textbookIngest` durable workflow. Returns { textbookId }.
 *
 * Node runtime (NOT edge): storage, auth, DB, and workflow runtime are
 * all server-only.
 *
 * @see src/lib/ai/workflows/textbookIngest.ts
 */
import { eq } from "drizzle-orm";
import { start } from "workflow/api";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { textbooks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { textbookIngest } from "@/lib/ai/workflows/textbookIngest";

/** Force the Node.js runtime — do not run on the edge. */
export const runtime = "nodejs";
/** Never cache; every request starts a fresh upload. */
export const dynamic = "force-dynamic";

/** Derive numeric grade from a grade string (e.g. "Grade 7" → 7). */
function deriveGradeNum(grade: string): number {
  return parseInt(grade.replace(/\D/g, ""), 10) || 0;
}

export async function POST(req: Request): Promise<Response> {
  const user = await requireAdmin();

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ error: "Invalid multipart/form-data body." }, { status: 400 });
  }

  const file = fd.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "A PDF file is required (field: file)." }, { status: 400 });
  }

  const titleField = (fd.get("title") ?? "").toString().trim();
  const subject = (fd.get("subject") ?? "").toString().trim() || undefined;
  const grade = (fd.get("grade") ?? "").toString().trim() || undefined;
  const ocrModelId = (fd.get("ocrModelId") ?? "").toString().trim() || undefined;

  const title = titleField || file.name;
  const gradeNum = grade ? deriveGradeNum(grade) : undefined;

  // Convert File → Buffer.
  const buf = Buffer.from(await file.arrayBuffer());

  // Upload the PDF to storage.
  let fileKey: string;
  try {
    const { key } = await getStorage().upload({
      filename: file.name,
      contentType: "application/pdf",
      data: buf,
    });
    fileKey = key;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }

  // Insert the textbooks row (status:"pending") so the UI can track progress.
  let textbookId: string;
  try {
    const inserted = await db
      .insert(textbooks)
      .values({
        title,
        subject,
        grade,
        gradeNum,
        fileKey,
        status: "pending",
        pagesProcessed: 0,
        ocrModel: ocrModelId,
        createdBy: user.id,
      })
      .returning();

    const id = inserted[0]?.id;
    if (!id) {
      return Response.json({ error: "Could not create textbook record." }, { status: 500 });
    }
    textbookId = id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create textbook record.";
    return Response.json({ error: message }, { status: 500 });
  }

  // Start the durable ingest workflow.
  try {
    await start(textbookIngest, [{ textbookId, fileKey, ocrModelId }]);

    // Flip status to "ingesting" — the workflow will set pageCount + keep it
    // updated, and finishes by setting "ready" or "failed".
    await db
      .update(textbooks)
      .set({ status: "ingesting" })
      .where(eq(textbooks.id, textbookId));
  } catch (err) {
    // Workflow start failed — mark the row so it doesn't dangle in "pending".
    const message =
      err instanceof Error ? err.message : "Failed to start the ingest workflow.";
    await db
      .update(textbooks)
      .set({ status: "failed", error: message })
      .where(eq(textbooks.id, textbookId));
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ textbookId });
}
