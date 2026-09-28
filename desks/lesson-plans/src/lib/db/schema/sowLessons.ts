/**
 * Scheme-of-Work lessons — one record per lesson row (AI Studio v2).
 *
 * Mirrors the new 11-column Silverleaf SOW template. Rows are parsed from an
 * uploaded scheme (`source: 'parsed'`) or authored by hand (`source: 'manual'`).
 * The admin precisely picks one row in the AI Studio; its (possibly edited)
 * columns become the per-lesson input the generator expands into a full plan.
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

import { schemesOfWork } from "./schemesOfWork";

/** Whether the row was parsed from an uploaded scheme or authored by hand. */
export type SowLessonSource = "parsed" | "manual";

export const sowLessons = pgTable(
  "sow_lessons",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    schemeId: uuid("scheme_id")
      .notNull()
      .references(() => schemesOfWork.id, { onDelete: "cascade" }),
    /** Stable order within the scheme (row position). */
    orderIndex: integer("order_index").notNull(),
    /** Week number within the term, when known. */
    week: integer("week"),
    /** Lesson label as printed in the scheme, e.g. "1". */
    lessonNumber: text("lesson_number"),

    /* ── The 11 SOW columns ───────────────────────────────────────────── */
    /** e.g. "4.1 Recognise the concept of numbers". */
    specificCompetence: text("specific_competence"),
    mainActivity: text("main_activity"),
    /** "By the end of the lesson, the learner should be able to…". */
    lessonObjective: text("lesson_objective"),
    knowledgeAndSkills: text("knowledge_and_skills"),
    /** Assessment / Evidence ("How will you know they understood?"). */
    assessmentEvidence: text("assessment_evidence"),
    /** Learning Activities (I Do → We Do → You Do). */
    learningActivities: text("learning_activities"),
    misconceptions: text("misconceptions"),
    differentiationSupport: text("differentiation_support"),
    resources: text("resources"),
    reflection: text("reflection"),

    source: text("source").$type<SowLessonSource>().notNull().default("parsed"),
    /** Raw parsed cells, keyed by detected header, for provenance/debugging. */
    rawCells: jsonb("raw_cells").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("sow_lessons_scheme_order_idx").on(
      table.schemeId,
      table.orderIndex,
    ),
    index("sow_lessons_scheme_week_idx").on(table.schemeId, table.week),
  ],
);

export type SowLesson = typeof sowLessons.$inferSelect;
export type NewSowLesson = typeof sowLessons.$inferInsert;
