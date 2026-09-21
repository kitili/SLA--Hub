"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { resolveLocalized } from "@/lib/i18n-content";
import {
  deleteQuestionAction,
  setPassThresholdAction,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";
import QuestionForm, { type QuestionFormValues } from "./QuestionForm";

export interface QuizEditorOption {
  id: string;
  text_en: string;
  text_sw: string | null;
  isCorrect: boolean;
}

export interface QuizEditorQuestion {
  id: string;
  text_en: string;
  text_sw: string | null;
  options: QuizEditorOption[];
}

export interface QuizEditorData {
  sectionId: string;
  sectionTitle: string;
  passThreshold: number;
  questions: QuizEditorQuestion[];
}

export default function QuizEditor({ quiz }: { quiz: QuizEditorData }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(quiz.passThreshold);

  function refresh() {
    router.refresh();
  }

  function onDeleteQuestion(questionId: string) {
    if (!window.confirm(t("common.confirmDelete"))) return;
    startTransition(async () => {
      await deleteQuestionAction(quiz.sectionId, questionId);
      refresh();
    });
  }

  function onSaveThreshold() {
    startTransition(async () => {
      await setPassThresholdAction(quiz.sectionId, threshold);
      refresh();
    });
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{t("quizzes.passRule")}</h2>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pass-threshold">
            {t("quizzes.passThreshold")}
          </label>
          <div className={styles.linkRow}>
            <input
              id="pass-threshold"
              type="number"
              min={1}
              className={styles.input}
              style={{ maxWidth: "120px" }}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall}`}
              disabled={pending}
              onClick={onSaveThreshold}
            >
              {t("common.save")}
            </button>
            <span className={styles.hint}>
              {t("quizzes.passThresholdHint")}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            {t("quizzes.questionCount", { count: quiz.questions.length })}
          </h2>
          {!adding && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
            >
              {t("quizzes.addQuestion")}
            </button>
          )}
        </div>

        {adding && (
          <div className={styles.questionBlock}>
            <QuestionForm
              sectionId={quiz.sectionId}
              onDone={() => setAdding(false)}
            />
          </div>
        )}

        {quiz.questions.length === 0 && !adding && (
          <p className={styles.muted}>{t("quizzes.noQuizYet")}</p>
        )}

        {quiz.questions.map((q, qi) => {
          const isEditing = editingId === q.id;
          const questionText =
            resolveLocalized(q, "text", locale) ?? q.text_en;

          if (isEditing) {
            const initial: QuestionFormValues = {
              questionId: q.id,
              text_en: q.text_en,
              text_sw: q.text_sw,
              options: q.options.map((o) => ({
                text_en: o.text_en,
                text_sw: o.text_sw,
                isCorrect: o.isCorrect,
              })),
            };
            return (
              <div key={q.id} className={styles.questionBlock}>
                <QuestionForm
                  sectionId={quiz.sectionId}
                  initial={initial}
                  onDone={() => setEditingId(null)}
                />
              </div>
            );
          }

          return (
            <div key={q.id} className={styles.questionBlock}>
              <div className={styles.cardHeader}>
                <div className={styles.questionText}>
                  {t("quizzes.question")} {qi + 1}: {questionText}
                  {!q.text_sw && (
                    <span className={styles.pendingTag}>
                      {t("common.translationPending")}
                    </span>
                  )}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    onClick={() => {
                      setEditingId(q.id);
                      setAdding(false);
                    }}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                    disabled={pending}
                    onClick={() => onDeleteQuestion(q.id)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
              <ul className={styles.optionList}>
                {q.options.map((o) => {
                  const optText =
                    resolveLocalized(o, "text", locale) ?? o.text_en;
                  return (
                    <li
                      key={o.id}
                      className={`${styles.optionItem} ${
                        o.isCorrect ? styles.optionCorrect : ""
                      }`}
                    >
                      {o.isCorrect && (
                        <span aria-hidden="true">✓</span>
                      )}
                      {optText}
                      {o.isCorrect && (
                        <span className={styles.localeTag}>
                          {t("quizzes.correct")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
