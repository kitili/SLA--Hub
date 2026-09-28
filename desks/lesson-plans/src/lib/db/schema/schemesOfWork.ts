/**
 * Schemes of Work — the term-level curriculum container (AI Studio v2).
 *
 * A scheme owns an ordered set of {@link sowLessons} rows (one per lesson),
 * parsed from an uploaded docx/CSV or entered by hand. The scheme carries the
 * shared header context (grade/subject/term + any free-form meta) the lesson
 * generator injects once, while each row carries the per-lesson columns.
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

import type { SchemeHeaderContext } from "@/lib/sow/types";

import { staff } from "./staff";

export const schemesOfWork = pgTable(
  "schemes_of_work",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Human label, e.g. "Grade 1 Arithmetic — Term 1A". */
    title: text("title").notNull(),
    grade: text("grade").notNull(),
    /** Numeric grade for range queries / ordering. */
    gradeNum: integer("grade_num").notNull(),
    subject: text("subject").notNull(),
    /** Raw term label, e.g. "1a". */
    term: text("term").notNull(),
    /** Ordinal for sorting terms: 1a=1, 1b=2, 2a=3, 2b=4. */
    termOrdinal: integer("term_ordinal").notNull(),
    /** Academic year label, e.g. "2026". */
    year: text("year"),
    /** Main competence label from the metadata block, e.g. "4.0 Arithmetic". */
    mainCompetence: text("main_competence"),
    /** Number of teaching weeks in the term, when stated. */
    weeksCount: integer("weeks_count"),
    /** Lessons/periods per week, when stated. */
    lessonsPerWeek: integer("lessons_per_week"),
    /** Duration of one lesson/period in minutes, when stated. */
    lessonDurationMins: integer("lesson_duration_mins"),
    /** Free-form total-lessons note, e.g. "63 (1st week review)". */
    totalLessons: text("total_lessons"),
    /**
     * Shared scheme-header context injected once into the prompt: transfer goal,
     * enduring understandings, essential questions, knowledge/skills inventory,
     * performance tasks, and assessment plan. Typed as {@link SchemeHeaderContext}.
     */
    headerContext: jsonb("header_context").$type<SchemeHeaderContext>(),
    /** Original uploaded filename (docx/CSV) for provenance. */
    sourceFilename: text("source_filename"),
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
    index("schemes_of_work_grade_subject_term_idx").on(
      table.gradeNum,
      table.subject,
      table.termOrdinal,
    ),
  ],
);

export type SchemeOfWork = typeof schemesOfWork.$inferSelect;
export type NewSchemeOfWork = typeof schemesOfWork.$inferInsert;
