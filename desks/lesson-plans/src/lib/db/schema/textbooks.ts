/**
 * Textbooks — the school-book container (AI Studio v2).
 *
 * Mirrors {@link schemesOfWork}: a book owns an ordered set of
 * {@link textbookPages} records produced by OCR-ing every page of an uploaded
 * PDF. Ingest is a durable workflow; `status` + `pagesProcessed` track its
 * progress (polled by the UI, same pattern as batch generation).
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

/** Ingest-workflow lifecycle of a book. */
export type TextbookStatus = "pending" | "ingesting" | "ready" | "failed";

export const textbooks = pgTable(
  "textbooks",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    subject: text("subject"),
    grade: text("grade"),
    /** Numeric grade for range queries / ordering. */
    gradeNum: integer("grade_num"),
    publisher: text("publisher"),
    /** Total page count of the source PDF. */
    pageCount: integer("page_count"),
    /** Storage key of the original uploaded PDF (see MaterialStorage). */
    fileKey: text("file_key"),
    status: text("status").$type<TextbookStatus>().notNull().default("pending"),
    /** Pages OCR'd so far (ingest progress). */
    pagesProcessed: integer("pages_processed").notNull().default(0),
    /** OpenRouter model used for OCR (e.g. google/gemini-3.5-flash). */
    ocrModel: text("ocr_model"),
    error: text("error"),
    createdBy: uuid("created_by").references(() => staff.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("textbooks_grade_subject_idx").on(table.gradeNum, table.subject),
  ],
);

export type Textbook = typeof textbooks.$inferSelect;
export type NewTextbook = typeof textbooks.$inferInsert;
