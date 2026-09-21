/**
 * Quiz attempts — a row per quiz submission (unlimited-retry history).
 *
 * New in Wave 3. Records EVERY submission (not just the latest) so the full
 * retry history is auditable. The pass *marker* for a section still lives in
 * `checkpoint_completions` (kept as-is for compatibility); this table is the
 * detailed log behind it.
 *
 * `answers` is the raw submission payload (e.g. selected option ids per
 * question) stored as JSONB for forensic/debug purposes — it is not the source
 * of truth for scoring (the server recomputes `score`/`passed`).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { quizzes } from "./quizzes";
import { staff } from "./staff";

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Who submitted. ON DELETE CASCADE: removing a member drops their history. */
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    quizId: varchar("quiz_id", { length: 100 })
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    /** Number of correct answers in this submission. */
    score: integer("score").notNull(),
    /** Whether `score >= quiz.pass_threshold` at submission time. */
    passed: boolean("passed").notNull(),
    /** Raw submission payload (selected option ids per question). */
    answers: jsonb("answers"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_quiz_attempts_member").on(table.memberId),
    index("idx_quiz_attempts_quiz").on(table.quizId),
  ],
);

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
