"use server";

/**
 * Admin server actions — Textbooks (AI Studio v2).
 *
 * CRUD + status polling + re-OCR for `textbooks` and their `textbook_pages`.
 * All actions are admin-only. Mutations revalidate the textbooks admin page
 * via its "/[locale]/..." route pattern (locale-less literals match nothing —
 * see feedback.ts).
 */
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { textbooks, textbookPages } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { ocrPage } from "@/lib/ai/ocr";

// ── Terminal statuses (ingest done) ──────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["ready", "failed"]);

// ── listTextbooks ─────────────────────────────────────────────────────────────

/** List all textbooks (lightweight projection). Admin-only. */
export async function listTextbooks(): Promise<
  ActionResult & {
    textbooks?: Array<{
    id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    status: string;
    pagesProcessed: number;
    pageCount: number | null;
  }>;
  }
> {
  await requireAdmin();

  try {
    const rows = await db
      .select({
        id: textbooks.id,
        title: textbooks.title,
        subject: textbooks.subject,
        grade: textbooks.grade,
        status: textbooks.status,
        pagesProcessed: textbooks.pagesProcessed,
        pageCount: textbooks.pageCount,
      })
      .from(textbooks)
      .orderBy(asc(textbooks.createdAt));

    return { ok: true, textbooks: rows };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── getTextbook ───────────────────────────────────────────────────────────────

/** Fetch one textbook + lightweight page list (no full content). Admin-only. */
export async function getTextbook(textbookId: string): Promise<
  ActionResult & {
    textbook?: typeof textbooks.$inferSelect;
    pages?: Array<{
      id: string;
      pageNumber: number;
      chapter: string | null;
      heading: string | null;
      contentPreview: string;
    }>;
  }
> {
  await requireAdmin();

  if (!textbookId) return actionFailure("invalid-input");

  try {
    const textbookRows = await db
      .select()
      .from(textbooks)
      .where(eq(textbooks.id, textbookId))
      .limit(1);

    const textbook = textbookRows[0];
    if (!textbook) return actionFailure("not-found");

    const pageRows = await db
      .select({
        id: textbookPages.id,
        pageNumber: textbookPages.pageNumber,
        chapter: textbookPages.chapter,
        heading: textbookPages.heading,
        content: textbookPages.content,
      })
      .from(textbookPages)
      .where(eq(textbookPages.textbookId, textbookId))
      .orderBy(asc(textbookPages.pageNumber));

    const pages = pageRows.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      chapter: p.chapter,
      heading: p.heading,
      contentPreview: p.content.slice(0, 200),
    }));

    return { ok: true, textbook, pages };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── getTextbookPage ───────────────────────────────────────────────────────────

/** Fetch a single textbook page with full content. Admin-only. */
export async function getTextbookPage(
  pageId: string,
): Promise<ActionResult & { page?: typeof textbookPages.$inferSelect }> {
  await requireAdmin();

  if (!pageId) return actionFailure("invalid-input");

  try {
    const rows = await db
      .select()
      .from(textbookPages)
      .where(eq(textbookPages.id, pageId))
      .limit(1);

    const page = rows[0];
    if (!page) return actionFailure("not-found");

    return { ok: true, page };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── getIngestStatus ───────────────────────────────────────────────────────────

/**
 * Poll the ingest progress of a textbook.
 * Terminal when status is "ready" or "failed". Admin-only.
 */
export async function getIngestStatus(textbookId: string): Promise<
  ActionResult & {
    status?: string;
    pagesProcessed?: number;
    pageCount?: number | null;
    done?: boolean;
  }
> {
  await requireAdmin();

  if (!textbookId) return actionFailure("invalid-input");

  try {
    const rows = await db
      .select({
        status: textbooks.status,
        pagesProcessed: textbooks.pagesProcessed,
        pageCount: textbooks.pageCount,
      })
      .from(textbooks)
      .where(eq(textbooks.id, textbookId))
      .limit(1);

    const row = rows[0];
    if (!row) return actionFailure("not-found");

    return {
      ok: true,
      status: row.status,
      pagesProcessed: row.pagesProcessed,
      pageCount: row.pageCount,
      done: TERMINAL_STATUSES.has(row.status),
    };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── reOcrPage ─────────────────────────────────────────────────────────────────

/**
 * Re-run OCR on an existing textbook page using its stored imageKey.
 * Updates content, chapter, heading, keywords, ocrModel, ocrAt. Admin-only.
 */
export async function reOcrPage(
  pageId: string,
  opts?: { modelId?: string },
): Promise<ActionResult> {
  await requireAdmin();

  if (!pageId) return actionFailure("invalid-input");

  try {
    // Load the page to get the imageKey.
    const rows = await db
      .select()
      .from(textbookPages)
      .where(eq(textbookPages.id, pageId))
      .limit(1);

    const page = rows[0];
    if (!page) return actionFailure("not-found");
    // Without a stored page image there is nothing to re-run OCR against.
    if (!page.imageKey) return actionFailure("invalid-input");

    // Load the page image from storage.
    const storage = getStorage();
    const imageData = await storage.read(page.imageKey);
    if (!imageData) {
      return actionFailure("not-found", {
        cause: `image missing in storage: ${page.imageKey}`,
      });
    }

    // Run OCR.
    const result = await ocrPage(
      { data: imageData, mediaType: "image/png" },
      opts,
    );

    // Persist the updated fields.
    await db
      .update(textbookPages)
      .set({
        content: result.content,
        chapter: result.chapter,
        heading: result.heading,
        keywords: result.keywords,
        ocrModel: result.modelId,
        ocrAt: new Date(),
      })
      .where(eq(textbookPages.id, pageId));

    revalidatePath("/[locale]/admin/ai-studio/textbooks", "page");
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── upsertTextbookPage ────────────────────────────────────────────────────────

export type UpsertTextbookPageInput = {
  id?: string;
  textbookId: string;
  pageNumber: number;
  chapter?: string | null;
  heading?: string | null;
  content?: string;
  keywords?: string[] | null;
  imageKey?: string | null;
};

/**
 * Insert or update a textbook page manually (source:"manual"). Admin-only.
 */
export async function upsertTextbookPage(
  page: UpsertTextbookPageInput,
): Promise<ActionResult & { pageId?: string }> {
  await requireAdmin();

  if (!page.textbookId) return actionFailure("invalid-input");

  try {
    const values: typeof textbookPages.$inferInsert = {
      textbookId: page.textbookId,
      pageNumber: page.pageNumber,
      chapter: page.chapter ?? undefined,
      heading: page.heading ?? undefined,
      content: page.content ?? "",
      keywords: page.keywords ?? undefined,
      imageKey: page.imageKey ?? undefined,
      source: "manual",
    };

    if (page.id) {
      const updated = await db
        .update(textbookPages)
        .set(values)
        .where(eq(textbookPages.id, page.id))
        .returning();
      const pageId = updated[0]?.id;
      if (!pageId) return actionFailure("not-found");
      revalidatePath("/[locale]/admin/ai-studio/textbooks", "page");
      return { ok: true, pageId };
    } else {
      const inserted = await db
        .insert(textbookPages)
        .values(values)
        .onConflictDoUpdate({
          target: [textbookPages.textbookId, textbookPages.pageNumber],
          set: { ...values },
        })
        .returning();
      const pageId = inserted[0]?.id;
      revalidatePath("/[locale]/admin/ai-studio/textbooks", "page");
      return { ok: true, pageId };
    }
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── deleteTextbook ────────────────────────────────────────────────────────────

/** Permanently delete a textbook (cascades to textbook_pages). Admin-only. */
export async function deleteTextbook(textbookId: string): Promise<ActionResult> {
  await requireAdmin();

  if (!textbookId) return actionFailure("invalid-input");

  try {
    await db.delete(textbooks).where(eq(textbooks.id, textbookId));
    revalidatePath("/[locale]/admin/ai-studio/textbooks", "page");
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}
