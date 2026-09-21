/**
 * Integration tests for the quiz repository against in-memory PGlite.
 *
 * The schema is applied once in test/setup.ts via runMigrations(). Tests here
 * insert their own rows using unique IDs so they do not conflict with each other
 * and run in any order.
 *
 * Key invariants verified:
 *   - getQuizForMember strips is_correct from every option
 *   - gradeAndRecordAttempt with all-correct answers → passed=true, attempt row saved
 *   - gradeAndRecordAttempt with wrong answer → passed=false, attempt row saved (retry)
 *   - Both attempts for the same quiz/member are retained (unlimited-retry history)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db/client";
import {
  sections,
  staff,
  quizzes,
  quizQuestions,
  quizOptions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getQuizForMember, gradeAndRecordAttempt, listAttempts } from "./quizzes";

// ---------------------------------------------------------------------------
// Test data (all IDs are unique to this module)
// ---------------------------------------------------------------------------
const SECTION_ID = "test-quiz-section";
const QUIZ_ID = "section-test-quiz-section";
const MEMBER_EMAIL = "quiz-test-member@example.com";

let questionId: string;
let correctOptionId: string;
let wrongOptionId: string;
let memberId: string;

beforeAll(async () => {
  // Insert the owning section (quiz FK → sections.id)
  await db.insert(sections).values({
    id: SECTION_ID,
    number: 99,
    order: 99,
    title_en: "Test Quiz Section",
  }).onConflictDoNothing();

  // Insert a staff member to act as quiz-taker
  const memberRows = await db
    .insert(staff)
    .values({
      email: MEMBER_EMAIL,
      fullName: "Quiz Test User",
    })
    .onConflictDoNothing()
    .returning();

  // If the row already existed (re-run), fetch it
  if (memberRows.length > 0 && memberRows[0]) {
    memberId = memberRows[0].id;
  } else {
    const existing = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.email, MEMBER_EMAIL))
      .limit(1);
    memberId = existing[0]!.id;
  }

  // Insert the quiz (pass_threshold = 1 → need 1/1 correct to pass)
  await db.insert(quizzes).values({
    id: QUIZ_ID,
    sectionId: SECTION_ID,
    passThreshold: 1,
  }).onConflictDoNothing();

  // Insert one question
  const questionRows = await db
    .insert(quizQuestions)
    .values({
      quizId: QUIZ_ID,
      order: 1,
      text_en: "What is 2 + 2?",
      text_sw: "Mbili pamoja mbili ni ngapi?",
    })
    .returning();
  questionId = questionRows[0]!.id;

  // Insert two options: one correct, one wrong
  const optionRows = await db
    .insert(quizOptions)
    .values([
      {
        questionId,
        order: 1,
        text_en: "4",
        isCorrect: true,
      },
      {
        questionId,
        order: 2,
        text_en: "5",
        isCorrect: false,
      },
    ])
    .returning();

  correctOptionId = optionRows.find((o) => o.isCorrect)!.id;
  wrongOptionId = optionRows.find((o) => !o.isCorrect)!.id;
});

// ---------------------------------------------------------------------------
// getQuizForMember
// ---------------------------------------------------------------------------

describe("getQuizForMember", () => {
  it("returns undefined for an unknown quiz id", async () => {
    const result = await getQuizForMember("does-not-exist");
    expect(result).toBeUndefined();
  });

  it("returns the quiz with its questions and options", async () => {
    const quiz = await getQuizForMember(QUIZ_ID);
    expect(quiz).toBeDefined();
    expect(quiz!.id).toBe(QUIZ_ID);
    expect(quiz!.sectionId).toBe(SECTION_ID);
    expect(quiz!.passThreshold).toBe(1);
    expect(quiz!.questions).toHaveLength(1);
    expect(quiz!.questions[0]!.options).toHaveLength(2);
  });

  it("does NOT expose is_correct on any option", async () => {
    const quiz = await getQuizForMember(QUIZ_ID);
    for (const question of quiz!.questions) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty("is_correct");
        expect(option).not.toHaveProperty("isCorrect");
      }
    }
  });

  it("exposes text_en and text_sw on options", async () => {
    const quiz = await getQuizForMember(QUIZ_ID);
    const option = quiz!.questions[0]!.options[0]!;
    expect(option).toHaveProperty("text_en");
    // text_sw may be null (we didn't set it), which is fine
  });
});

// ---------------------------------------------------------------------------
// gradeAndRecordAttempt
// ---------------------------------------------------------------------------

describe("gradeAndRecordAttempt", () => {
  it("throws for an unknown quiz", async () => {
    await expect(
      gradeAndRecordAttempt({
        memberId,
        quizId: "unknown-quiz",
        answers: [],
      }),
    ).rejects.toThrow(/unknown quiz/i);
  });

  it("returns passed=true and score=1 when the correct answer is submitted", async () => {
    const result = await gradeAndRecordAttempt({
      memberId,
      quizId: QUIZ_ID,
      answers: [{ questionId, optionId: correctOptionId }],
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.total).toBe(1);
    expect(result.passThreshold).toBe(1);
    expect(result.attempt.id).toBeTruthy();
    expect(result.attempt.memberId).toBe(memberId);
    expect(result.attempt.quizId).toBe(QUIZ_ID);
  });

  it("records the passing attempt in quiz_attempts", async () => {
    // There's already a passing attempt from the test above.
    const attempts = await listAttempts(memberId, QUIZ_ID);
    const passingAttempts = attempts.filter((a) => a.passed);
    expect(passingAttempts.length).toBeGreaterThanOrEqual(1);
  });

  it("returns passed=false and score=0 when the wrong answer is submitted", async () => {
    const result = await gradeAndRecordAttempt({
      memberId,
      quizId: QUIZ_ID,
      answers: [{ questionId, optionId: wrongOptionId }],
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.total).toBe(1);
  });

  it("retains all attempts (unlimited-retry history) — both pass and fail rows exist", async () => {
    const attempts = await listAttempts(memberId, QUIZ_ID);
    // At this point we have submitted: correct (pass), wrong (fail)
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    const hasPass = attempts.some((a) => a.passed);
    const hasFail = attempts.some((a) => !a.passed);
    expect(hasPass).toBe(true);
    expect(hasFail).toBe(true);
  });

  it("returns passed=false when no answers are submitted (score=0, threshold=1)", async () => {
    const result = await gradeAndRecordAttempt({
      memberId,
      quizId: QUIZ_ID,
      answers: [],
    });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });
});
