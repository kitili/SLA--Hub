/**
 * Textbook pages — one structured record per book page (AI Studio v2).
 *
 * Mirrors {@link sowLessons}: produced by OCR-ing each page of the source PDF
 * with a vision model (default Gemini 3.5 Flash). The admin precisely picks a
 * page record in the AI Studio; its stored `content` (+ chapter/heading) becomes
 * the textbook context fed to the generator. `imageKey`/`thumbKey` back the
 * picker preview and any re-OCR.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { textbooks } from "./textbooks";

/** How a page record was produced. */
export type TextbookPageSource = "ocr" | "manual";

export const textbookPages = pgTable(
  "textbook_pages",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    textbookId: uuid("textbook_id")
      .notNull()
      .references(() => textbooks.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    /** Chapter the page belongs to, when detectable. */
    chapter: text("chapter"),
    /** Page/section heading from OCR. */
    heading: text("heading"),
    /** Verbatim OCR text — the field fed to generation. */
    content: text("content").notNull().default(""),
    /** Salient keywords for precise search/disambiguation. */
    keywords: jsonb("keywords").$type<string[]>(),
    /** Storage key of the rendered page PNG (preview / re-OCR). */
    imageKey: text("image_key"),
    /** Storage key of the page thumbnail (picker preview). */
    thumbKey: text("thumb_key"),
    /** OpenRouter model used for OCR. */
    ocrModel: text("ocr_model"),
    ocrAt: timestamp("ocr_at", { withTimezone: true }),
    source: text("source").$type<TextbookPageSource>().notNull().default("ocr"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("textbook_pages_book_page_idx").on(
      table.textbookId,
      table.pageNumber,
    ),
    index("textbook_pages_book_chapter_idx").on(table.textbookId, table.chapter),
    // Precise picker search over heading + content.
    index("textbook_pages_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${table.heading}, '') || ' ' || ${table.content})`,
    ),
  ],
);

export type TextbookPage = typeof textbookPages.$inferSelect;
export type NewTextbookPage = typeof textbookPages.$inferInsert;
