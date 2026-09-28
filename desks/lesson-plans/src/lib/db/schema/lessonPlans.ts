/**
 * Lesson plans schema — the core catalogue of teachable lesson plans.
 *
 * New in the lesson-plans wave. Each row is one published (or draft) lesson
 * plan, addressable by a stable `slug`. Plans are imported, AI-generated, or
 * seeded (`source`), and carry both rendered markdown and an optional
 * structured JSON body.
 *
 * Search: `search_text` is a denormalised, lowercased blob of the searchable
 * fields. A GIN expression index over `to_tsvector('simple', search_text)`
 * backs full-text search (see `lesson_plans_fts_idx`).
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
  uuid,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";
import { sowLessons } from "./sowLessons";
import { textbooks } from "./textbooks";

/** Lifecycle state of a plan in the teacher catalogue. */
export type PlanStatus = "draft" | "published";
/** How a plan entered the catalogue. */
export type PlanSource = "import" | "ai" | "seed";

export const lessonPlans = pgTable(
  "lesson_plans",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Stable, human-readable URL key. Unique business key. */
    slug: text("slug").notNull().unique(),
    filename: text("filename").notNull(),
    grade: text("grade").notNull(),
    /** Numeric grade for range queries / ordering. */
    gradeNum: integer("grade_num").notNull(),
    subject: text("subject").notNull(),
    /** Raw term label, e.g. "1a". */
    term: text("term").notNull(),
    /** Ordinal for sorting terms: 1a=1, 1b=2, 2a=3, 2b=4. */
    termOrdinal: integer("term_ordinal").notNull(),
    week: integer("week").notNull(),
    lesson: integer("lesson").notNull(),
    title: text("title").notNull(),
    topic: text("topic"),
    /** Learning objectives. */
    objectives: jsonb("objectives").$type<string[]>(),
    durationMinutes: integer("duration_minutes"),
    contentMarkdown: text("content_markdown").notNull(),
    /** Optional structured body. Holds the AI Studio v2 StructuredLessonPlan. */
    contentJson: jsonb("content_json"),
    status: text("status").$type<PlanStatus>().notNull().default("published"),
    source: text("source").$type<PlanSource>().notNull().default("import"),
    blobUrl: text("blob_url"),

    /* ── AI Studio v2 provenance (all nullable; only set for new structured
       plans) ──────────────────────────────────────────────────────────── */
    /** The SOW lesson row this plan was generated from. */
    schemeLessonId: uuid("scheme_lesson_id").references(() => sowLessons.id),
    /** The textbook the page record(s) came from. */
    textbookId: uuid("textbook_id").references(() => textbooks.id),
    /** Selected textbook page record id(s). */
    textbookPageIds: jsonb("textbook_page_ids").$type<string[]>(),
    /** OpenRouter model slug used to generate this plan. */
    modelId: text("model_id"),
    /** Denormalised, lowercased searchable text. Backs the GIN FTS index. */
    searchText: text("search_text").notNull(),
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
    index("lesson_plans_grade_subject_term_week_lesson_idx").on(
      table.gradeNum,
      table.subject,
      table.termOrdinal,
      table.week,
      table.lesson,
    ),
    index("lesson_plans_subject_idx").on(table.subject),
    index("lesson_plans_grade_idx").on(table.grade),
    index("lesson_plans_term_idx").on(table.term),
    index("lesson_plans_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', ${table.searchText})`,
    ),
  ],
);

export type LessonPlan = typeof lessonPlans.$inferSelect;
export type NewLessonPlan = typeof lessonPlans.$inferInsert;
