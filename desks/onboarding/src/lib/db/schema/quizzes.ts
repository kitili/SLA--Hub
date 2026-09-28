/**
 * Quiz schema — section checkpoints as first-class DB rows.
 *
 * New in Wave 3. Replaces the file-based quiz bank (legacy
 * `legacy/client/src/data/checkpoints.js`).
 *
 * ID alignment (CRITICAL):
 *   - `quizzes.id` is the legacy checkpoint key, `section-<slug>` (e.g.
 *     "section-welcome"), so existing `checkpoint_completions.checkpoint_id`
 *     rows keep referencing a real quiz.
 *   - `quizzes.section_id` is the owning section slug, and is UNIQUE: one quiz
 *     per section.
 *
 * Correctness (`quiz_options.is_correct`) lives **server-side only** — the quiz
 * read path for clients must project it away (see the quizzes repository).
 *
 * Bilingual prompt/label copy follows the `*_en` / `*_sw` convention.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { sections } from "./content";

/** One checkpoint quiz per section. */
export const quizzes = pgTable("quizzes", {
  /** Legacy checkpoint key, e.g. "section-welcome". */
  id: varchar("id", { length: 100 }).primaryKey(),
  /** Owning section slug; UNIQUE → at most one quiz per section. */
  sectionId: varchar("section_id", { length: 100 })
    .notNull()
    .unique()
    .references(() => sections.id, { onDelete: "cascade" }),
  /**
   * Number of correct answers required to pass. Defaults to the question count
   * (i.e. 100%); seeded explicitly from the legacy PASS_THRESHOLD.
   */
  passThreshold: integer("pass_threshold").notNull().default(1),
});

/** Questions within a quiz, ordered. */
export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    quizId: varchar("quiz_id", { length: 100 })
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    text_en: text("text_en").notNull(),
    text_sw: text("text_sw"),
  },
  (table) => [index("idx_quiz_questions_quiz").on(table.quizId)],
);

/** Answer options per question, ordered. Correctness is server-side only. */
export const quizOptions = pgTable(
  "quiz_options",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    text_en: text("text_en").notNull(),
    text_sw: text("text_sw"),
    /** NEVER projected to clients on the quiz read path. */
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (table) => [index("idx_quiz_options_question").on(table.questionId)],
);

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;
export type QuizOption = typeof quizOptions.$inferSelect;
export type NewQuizOption = typeof quizOptions.$inferInsert;
