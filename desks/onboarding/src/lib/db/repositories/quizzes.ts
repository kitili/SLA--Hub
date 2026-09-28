import "server-only";

/**
 * Quiz repository — the read path (WITHOUT correct answers) and the grade +
 * attempt-record path (server-authoritative).
 *
 * SECURITY: `quiz_options.is_correct` must NEVER reach a client. `getQuizFor
 * Member` deliberately projects it away. Grading (`gradeAndRecordAttempt`)
 * recomputes the score from the DB's correctness flags — the submitted answers
 * are stored verbatim for audit but are NOT trusted for scoring.
 *
 * Bilingual `text_en` / `text_sw` columns are returned as-is for the caller to
 * resolve via `resolveLocalized`.
 */
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import {
  checkpointCompletions,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
  type QuizAttempt,
} from "../schema";

/** An answer option as exposed to clients — NO `is_correct`. */
export interface PublicQuizOption {
  id: string;
  order: number;
  text_en: string;
  text_sw: string | null;
}

/** A question as exposed to clients, with its options (correctness stripped). */
export interface PublicQuizQuestion {
  id: string;
  order: number;
  text_en: string;
  text_sw: string | null;
  options: PublicQuizOption[];
}

/** A full quiz as exposed to clients — safe to serialize to the browser. */
export interface PublicQuiz {
  id: string;
  sectionId: string;
  passThreshold: number;
  questions: PublicQuizQuestion[];
}

/**
 * Fetch a quiz with its questions and options, **without** the `is_correct`
 * flags, ready to send to a member. Returns `undefined` if the quiz is unknown.
 *
 * @param quizId e.g. "section-welcome".
 */
export async function getQuizForMember(
  quizId: string,
): Promise<PublicQuiz | undefined> {
  const quizRows = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) return undefined;

  const questionRows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.order));

  const questionIds = questionRows.map((q) => q.id);
  const optionRows = questionIds.length
    ? await db
        .select({
          id: quizOptions.id,
          questionId: quizOptions.questionId,
          order: quizOptions.order,
          text_en: quizOptions.text_en,
          text_sw: quizOptions.text_sw,
          // NOTE: is_correct intentionally NOT selected.
        })
        .from(quizOptions)
        .where(inArray(quizOptions.questionId, questionIds))
        .orderBy(asc(quizOptions.order))
    : [];

  const optionsByQuestion = new Map<string, PublicQuizOption[]>();
  for (const opt of optionRows) {
    const pub: PublicQuizOption = {
      id: opt.id,
      order: opt.order,
      text_en: opt.text_en,
      text_sw: opt.text_sw,
    };
    const bucket = optionsByQuestion.get(opt.questionId);
    if (bucket) bucket.push(pub);
    else optionsByQuestion.set(opt.questionId, [pub]);
  }

  return {
    id: quiz.id,
    sectionId: quiz.sectionId,
    passThreshold: quiz.passThreshold,
    questions: questionRows.map((q) => ({
      id: q.id,
      order: q.order,
      text_en: q.text_en,
      text_sw: q.text_sw,
      options: optionsByQuestion.get(q.id) ?? [],
    })),
  };
}

/** A submitted answer: the option the member chose for a question. */
export interface SubmittedAnswer {
  questionId: string;
  optionId: string;
}

/** The outcome of grading + recording an attempt. */
export interface GradeResult {
  attempt: QuizAttempt;
  score: number;
  total: number;
  passed: boolean;
  passThreshold: number;
}

/**
 * Grade a submission against the server-side correctness flags, record the
 * attempt (every submission is kept — unlimited-retry history), and, when the
 * member passes, mark the section checkpoint complete (compat with
 * `checkpoint_completions`).
 *
 * Scoring is authoritative: only the DB's `is_correct` decides a point. The raw
 * `answers` are persisted on the attempt for audit but never trusted.
 *
 * @throws if `quizId` is unknown.
 */
export async function gradeAndRecordAttempt(input: {
  memberId: string;
  quizId: string;
  answers: SubmittedAnswer[];
}): Promise<GradeResult> {
  const { memberId, quizId, answers } = input;

  const quizRows = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) {
    throw new Error(`Unknown quiz: ${quizId}`);
  }

  const questionRows = await db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId));
  const total = questionRows.length;

  // The set of correct option ids for this quiz, from the DB only.
  const correctRows = total
    ? await db
        .select({
          questionId: quizOptions.questionId,
          optionId: quizOptions.id,
        })
        .from(quizOptions)
        .where(
          and(
            inArray(
              quizOptions.questionId,
              questionRows.map((q) => q.id),
            ),
            eq(quizOptions.isCorrect, true),
          ),
        )
    : [];

  const correctOptionByQuestion = new Map<string, string>();
  for (const row of correctRows) {
    correctOptionByQuestion.set(row.questionId, row.optionId);
  }

  // One point per question whose chosen option matches the correct option.
  // Last answer for a given question wins (defensive against duplicates).
  const chosenByQuestion = new Map<string, string>();
  for (const a of answers) {
    chosenByQuestion.set(a.questionId, a.optionId);
  }

  let score = 0;
  for (const [questionId, correctOptionId] of correctOptionByQuestion) {
    if (chosenByQuestion.get(questionId) === correctOptionId) {
      score += 1;
    }
  }

  const passed = score >= quiz.passThreshold;

  const inserted = await db
    .insert(quizAttempts)
    .values({
      memberId,
      quizId,
      score,
      passed,
      answers,
    })
    .returning();
  const attempt = inserted[0]!;

  if (passed) {
    // Mark the section checkpoint complete (idempotent), keeping the legacy
    // progress marker consistent with the attempt history.
    await db
      .insert(checkpointCompletions)
      .values({ staffId: memberId, checkpointId: quizId })
      .onConflictDoUpdate({
        target: [
          checkpointCompletions.staffId,
          checkpointCompletions.checkpointId,
        ],
        set: { passedAt: new Date() },
      });
  }

  return {
    attempt,
    score,
    total,
    passed,
    passThreshold: quiz.passThreshold,
  };
}

/** List a member's attempts at a quiz, newest first (retry history). */
export async function listAttempts(
  memberId: string,
  quizId: string,
): Promise<QuizAttempt[]> {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.memberId, memberId),
        eq(quizAttempts.quizId, quizId),
      ),
    )
    .orderBy(asc(quizAttempts.submittedAt));
}
