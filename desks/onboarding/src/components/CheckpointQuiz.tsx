"use client";

/**
 * CheckpointQuiz — the section checkpoint quiz.
 *
 * Ported from legacy/client/src/components/CheckpointQuiz.jsx, but grading is
 * now SERVER-AUTHORITATIVE: the question payload carries NO correct answers
 * (see quizzesRepo.getQuizForMember). The member's selections are submitted via
 * `onSubmit`, which calls the grade server action; pass/fail comes back from the
 * server. 100% is required; retries are unlimited.
 *
 * Bilingual question/option text is resolved by the parent (server) and passed
 * in already-localised; chrome uses next-intl (`member.quiz.*`).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./CheckpointQuiz.module.css";

/** A localised option (correctness lives only on the server). */
export interface QuizOptionView {
  id: string;
  text: string;
}

/** A localised question with its options. */
export interface QuizQuestionView {
  id: string;
  text: string;
  options: QuizOptionView[];
}

/** The result returned by the grade server action. */
export interface QuizSubmitResult {
  ok: boolean;
  passed?: boolean;
  score?: number;
  total?: number;
  error?: "unauthenticated" | "locked" | "incomplete" | "unknown-quiz";
}

export interface CheckpointQuizProps {
  /** Section number, for the localised heading. */
  sectionNumber: number;
  questions: QuizQuestionView[];
  /** Submit selected answers for server-side grading. */
  onSubmit: (
    answers: { questionId: string; optionId: string }[],
  ) => Promise<QuizSubmitResult>;
  /** Called after a passing submission (parent reveals the "next" CTA). */
  onPassed?: () => void;
}

export default function CheckpointQuiz({
  sectionNumber,
  questions,
  onSubmit,
  onPassed,
}: CheckpointQuizProps) {
  const t = useTranslations("member");

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);

  const passed = result?.ok === true && result.passed === true;
  const failed = result?.ok === true && result.passed === false;

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  const handleSelect = (questionId: string, optionId: string) => {
    if (passed) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!allAnswered || submitting || passed) return;
    setSubmitting(true);
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        optionId: answers[q.id]!,
      }));
      const res = await onSubmit(payload);
      setResult(res);
      if (res.ok && res.passed) onPassed?.();
    } catch {
      setResult({ ok: false, error: "unknown-quiz" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setAnswers({});
  };

  const quizClass = [
    styles.checkpointQuiz,
    passed ? styles.passed : "",
    failed ? styles.failed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={quizClass}>
      <div className={styles.checkpointHeader}>
        <span className={styles.checkpointLabel}>
          📋 {t("quiz.checkpointLabel")}
        </span>
        <h4>{t("quiz.title", { number: sectionNumber })}</h4>
        <p className={styles.checkpointHint}>{t("quiz.intro")}</p>
      </div>

      {failed && (
        <div className={styles.checkpointFailBanner}>
          <span aria-hidden>⚠</span>
          <div>
            <strong>{t("quiz.failTitle")}</strong>
            <p>{t("quiz.failBody")}</p>
            {result?.score !== undefined && result.total !== undefined && (
              <p>
                {t("quiz.scoreNote", {
                  score: result.score,
                  total: result.total,
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {result?.ok === false && (
        <div className={styles.checkpointFailBanner} role="alert">
          <span aria-hidden>⚠</span>
          <div>
            <strong>
              {result.error === "incomplete"
                ? t("quiz.errorIncomplete")
                : t("quiz.errorGeneric")}
            </strong>
          </div>
        </div>
      )}

      {passed && (
        <div className={styles.checkpointPassBanner}>
          <span aria-hidden>✓</span>
          <span>
            <strong>{t("quiz.passedTitle")}</strong> {t("quiz.passedBody")}
          </span>
        </div>
      )}

      <div className={styles.questionsList}>
        {questions.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className={styles.questionBlock}>
              <p className={styles.questionText}>
                <span className={styles.qNum}>{qi + 1}.</span> {q.text}
              </p>
              <div className={styles.optionsList}>
                {q.options.map((opt) => {
                  const optClass = [
                    styles.optionBtn,
                    selected === opt.id ? styles.optionBtnSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={optClass}
                      onClick={() => handleSelect(q.id, opt.id)}
                      disabled={passed}
                      aria-pressed={selected === opt.id}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.checkpointActions}>
        {!passed && !failed && (
          <button
            type="button"
            className={styles.btnSubmitCheckpoint}
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
          >
            {submitting ? t("quiz.submitting") : t("quiz.submit")}
          </button>
        )}
        {failed && (
          <button
            type="button"
            className={styles.btnSubmitCheckpoint}
            onClick={handleRetake}
          >
            {t("quiz.retake")}
          </button>
        )}
      </div>
    </div>
  );
}
