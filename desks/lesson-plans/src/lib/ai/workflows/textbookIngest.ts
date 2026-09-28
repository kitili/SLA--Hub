"use workflow";

/**
 * Durable textbook ingest (Vercel Workflow DevKit).
 *
 * OCRs every page of an uploaded textbook PDF into `textbook_pages` rows. The
 * workflow function is a pure orchestrator: a STEP rasterises the PDF and
 * uploads each page PNG, returning the per-page storage keys; then one OCR STEP
 * per page reads its PNG, runs the vision model, inserts the page row, and bumps
 * `textbooks.pagesProcessed`. A final step flips `textbooks.status` to `ready`.
 *
 * Why a workflow: a book can be
 * dozens of vision-model calls taking many minutes. A plain request would time
 * out and lose all progress on a crash. As a durable workflow, each completed
 * page is persisted and survives interruptions; the run resumes where it left
 * off. Progress (`pagesProcessed` / `status`) is mirrored onto the `textbooks`
 * row so the admin UI can poll without holding a connection open.
 *
 * Architecture notes:
 *  - `"use workflow"` runs in a sandbox (no Node APIs). All I/O — storage,
 *    rasterisation, OCR, Drizzle writes — lives in `"use step"` functions, which
 *    gives us retries + observability for free.
 *  - `getVisionModel()` / `getStorage()` / `pdf-to-img` all need full Node
 *    access, so they are only ever called inside steps, never the workflow body.
 *  - We rasterise-and-upload in one step so the (large) PNG bytes never cross
 *    the workflow boundary; only the lightweight page-key list does.
 *
 * @see node_modules/workflow/docs/foundations/workflows-and-steps.mdx
 * @see node_modules/workflow/docs/foundations/errors-and-retries.mdx
 */
import { eq, sql } from "drizzle-orm";
import { FatalError, RetryableError } from "workflow";

import { db } from "@/lib/db";
import { textbooks, textbookPages } from "@/lib/db/schema";
import { hasApiKey, isRateLimitMessage, OCR_MODEL_ID } from "@/lib/ai/model";
import { ocrPage } from "@/lib/ai/ocr";
import { rasterizePdfPages } from "@/lib/textbook/ingest";
import { getStorage } from "@/lib/storage";

/** Workflow input. The `textbooks` row + `fileKey` are created by the caller. */
export interface TextbookIngestInput {
  /** The `textbooks.id` to ingest into (already created, status `pending`). */
  textbookId: string;
  /** Storage key of the uploaded source PDF (see MaterialStorage). */
  fileKey: string;
  /** Optional OpenRouter vision slug override; defaults to {@link OCR_MODEL_ID}. */
  ocrModelId?: string;
}

/** Per-page outcome the workflow aggregates into a final summary. */
export interface TextbookPageResult {
  pageNumber: number;
  ok: boolean;
  pageId?: string;
  error?: string;
}

/** Final return value of an ingest run. */
export interface TextbookIngestResult {
  textbookId: string;
  total: number;
  succeeded: number;
  failed: number;
  results: TextbookPageResult[];
}

/** One uploaded page: its number and the storage key of the rendered PNG. */
interface UploadedPage {
  pageNumber: number;
  imageKey: string;
}

/**
 * STEP — read the PDF, render every page to PNG, upload each, and record the
 * page count on the `textbooks` row. Returns the lightweight page-key list so
 * the (large) image bytes never cross back into the workflow body.
 *
 * Retry policy: a missing file is a config/programmer error → {@link FatalError}
 * (retrying never helps). Storage/render hiccups bubble as ordinary errors and
 * are auto-retried by WDK.
 */
async function rasterizeAndUpload(
  textbookId: string,
  fileKey: string,
): Promise<UploadedPage[]> {
  "use step";

  const storage = getStorage();
  const pdfBuf = await storage.read(fileKey);
  if (!pdfBuf) {
    throw new FatalError(`Source PDF not found for key: ${fileKey}`);
  }

  const pages = await rasterizePdfPages(pdfBuf);

  const uploaded: UploadedPage[] = [];
  for (const page of pages) {
    const { key } = await storage.upload({
      filename: `textbooks/${textbookId}/page-${page.pageNumber}.png`,
      contentType: "image/png",
      data: page.png,
    });
    uploaded.push({ pageNumber: page.pageNumber, imageKey: key });
  }

  await db
    .update(textbooks)
    .set({
      pageCount: pages.length,
      status: "ingesting",
      pagesProcessed: 0,
    })
    .where(eq(textbooks.id, textbookId));

  return uploaded;
}

/**
 * STEP — OCR ONE uploaded page and persist it.
 *
 * Reads the page PNG back from storage, runs the vision model, inserts a
 * `textbook_pages` row (`source: "ocr"`), and atomically increments
 * `textbooks.pagesProcessed`. Returns the new page id.
 *
 * Retry policy:
 *  - Missing API key → {@link FatalError} (no retry helps).
 *  - A missing page image → {@link FatalError} (the prior step's output is
 *    inconsistent; retrying the OCR won't fix it).
 *  - An explicit provider rate-limit → {@link RetryableError} with back-off so a
 *    big book does not stampede the API.
 *  - Other model/network/DB errors → ordinary throw (WDK auto-retries).
 */
async function ocrAndSavePage(params: {
  textbookId: string;
  pageNumber: number;
  imageKey: string;
  ocrModelId: string;
}): Promise<{ pageId: string }> {
  "use step";

  if (!hasApiKey()) {
    throw new FatalError("OPENROUTER_API_KEY not set");
  }

  const storage = getStorage();
  const png = await storage.read(params.imageKey);
  if (!png) {
    throw new FatalError(`Page image missing for key: ${params.imageKey}`);
  }

  let result: Awaited<ReturnType<typeof ocrPage>>;
  try {
    result = await ocrPage(
      { data: png, mediaType: "image/png" },
      { modelId: params.ocrModelId },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isRateLimitMessage(message)) {
      throw new RetryableError(`Rate limited: ${message}`, {
        retryAfter: "30s",
      });
    }
    throw err;
  }

  const inserted = await db
    .insert(textbookPages)
    .values({
      textbookId: params.textbookId,
      pageNumber: params.pageNumber,
      content: result.content,
      chapter: result.chapter,
      heading: result.heading,
      keywords: result.keywords,
      imageKey: params.imageKey,
      ocrModel: result.modelId,
      ocrAt: new Date(),
      source: "ocr",
    })
    .onConflictDoUpdate({
      target: [textbookPages.textbookId, textbookPages.pageNumber],
      set: {
        content: result.content,
        chapter: result.chapter,
        heading: result.heading,
        keywords: result.keywords,
        imageKey: params.imageKey,
        ocrModel: result.modelId,
        ocrAt: new Date(),
        source: "ocr",
      },
    })
    .returning();

  const pageId = inserted[0]?.id;
  if (!pageId) {
    // Upsert returned no row — treat as transient and let the step retry.
    throw new Error("Upsert returned no textbook_pages row");
  }

  // Atomic bump so concurrent/replayed runs don't lose a count.
  await db
    .update(textbooks)
    .set({ pagesProcessed: sql`${textbooks.pagesProcessed} + 1` })
    .where(eq(textbooks.id, params.textbookId));

  return { pageId };
}

/**
 * STEP — finalise the `textbooks` row. All pages OK → `ready`; some failed →
 * `ready` with the errors recorded (the book is still usable); nothing OCR'd →
 * `failed`. Idempotent on replay.
 */
async function finishIngest(
  textbookId: string,
  summary: { total: number; succeeded: number; failed: number; results: TextbookPageResult[] },
): Promise<void> {
  "use step";

  const status = summary.succeeded === 0 && summary.total > 0 ? "failed" : "ready";
  const errors = summary.results
    .filter((r) => !r.ok && r.error)
    .map((r) => `p${r.pageNumber}: ${r.error}`);

  await db
    .update(textbooks)
    .set({
      status,
      error: errors.length ? errors.join("; ") : null,
      ocrModel: undefined,
    })
    .where(eq(textbooks.id, textbookId));
}

/**
 * STEP — mark the `textbooks` row `failed` with a message. Used when the run
 * aborts before any page work (e.g. the rasterise step throws fatally).
 */
async function markIngestFailed(
  textbookId: string,
  message: string,
): Promise<void> {
  "use step";
  await db
    .update(textbooks)
    .set({ status: "failed", error: message })
    .where(eq(textbooks.id, textbookId));
}

/**
 * Durable textbook-ingest workflow. Rasterises + uploads all pages in one step,
 * then OCRs each page in its own retried step, mirroring progress onto the
 * `textbooks` row, and returns a summary.
 *
 * A page that still fails after WDK exhausts its step retries is caught here so
 * the rest of the book still ingests — it is recorded as failed and the book is
 * left `ready` (usable) unless nothing succeeded.
 */
export async function textbookIngest(
  input: TextbookIngestInput,
): Promise<TextbookIngestResult> {
  "use workflow";

  const ocrModelId = input.ocrModelId ?? OCR_MODEL_ID;

  let uploaded: UploadedPage[];
  try {
    uploaded = await rasterizeAndUpload(input.textbookId, input.fileKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markIngestFailed(input.textbookId, message);
    return {
      textbookId: input.textbookId,
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const results: TextbookPageResult[] = [];
  for (const page of uploaded) {
    try {
      const { pageId } = await ocrAndSavePage({
        textbookId: input.textbookId,
        pageNumber: page.pageNumber,
        imageKey: page.imageKey,
        ocrModelId,
      });
      results.push({ pageNumber: page.pageNumber, ok: true, pageId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ pageNumber: page.pageNumber, ok: false, error: message });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  await finishIngest(input.textbookId, {
    total: results.length,
    succeeded,
    failed,
    results,
  });

  return {
    textbookId: input.textbookId,
    total: results.length,
    succeeded,
    failed,
    results,
  };
}
