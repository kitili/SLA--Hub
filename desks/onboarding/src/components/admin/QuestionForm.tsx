"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  addQuestionAction,
  updateQuestionAction,
  type ActionResult,
} from "@/lib/actions/admin";
import { useRouter } from "@/i18n/navigation";
import styles from "./admin.module.css";

export interface QuestionFormOption {
  text_en: string;
  text_sw: string | null;
  isCorrect: boolean;
}

export interface QuestionFormValues {
  questionId?: string;
  text_en: string;
  text_sw: string | null;
  options: QuestionFormOption[];
}

const EMPTY_OPTION: QuestionFormOption = {
  text_en: "",
  text_sw: "",
  isCorrect: false,
};

/**
 * Add or edit a single quiz question with a dynamic option list. The correct
 * option is chosen via a radio group (`correctOption` = option index). Options
 * post as parallel arrays (`optionTextEn[]`, `optionTextSw[]`) consumed by the
 * server action. Correctness is set server-side only.
 */
export default function QuestionForm({
  sectionId,
  initial,
  onDone,
}: {
  sectionId: string;
  initial?: QuestionFormValues;
  onDone?: () => void;
}) {
  const t = useTranslations("admin");
  const router = useRouter();

  const startingOptions =
    initial && initial.options.length >= 2
      ? initial.options
      : [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }];

  const [options, setOptions] = useState<QuestionFormOption[]>(startingOptions);
  const [correctIndex, setCorrectIndex] = useState<number>(
    Math.max(
      0,
      startingOptions.findIndex((o) => o.isCorrect),
    ),
  );
  const [textEn, setTextEn] = useState(initial?.text_en ?? "");
  const [textSw, setTextSw] = useState(initial?.text_sw ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOption(i: number, patch: Partial<QuestionFormOption>) {
    setOptions((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    );
  }

  function addOption() {
    setOptions((prev) => [...prev, { ...EMPTY_OPTION }]);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setCorrectIndex((ci) => (ci === i ? 0 : ci > i ? ci - 1 : ci));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const filled = options.filter((o) => o.text_en.trim().length > 0);
    if (filled.length < 2) {
      setError(t("quizzes.errors.needTwoOptions"));
      return;
    }

    const formData = new FormData();
    formData.set("questionTextEn", textEn);
    formData.set("questionTextSw", textSw);
    // correctOption indexes into the *filtered* (non-empty) options, matching
    // how the server rebuilds the option list.
    let filteredCorrect = 0;
    let cursor = 0;
    options.forEach((o, idx) => {
      if (o.text_en.trim().length === 0) return;
      formData.append("optionTextEn", o.text_en);
      formData.append("optionTextSw", o.text_sw ?? "");
      if (idx === correctIndex) filteredCorrect = cursor;
      cursor += 1;
    });
    formData.set("correctOption", String(filteredCorrect));

    setPending(true);
    let result: ActionResult | ActionResult<{ questionId: string }>;
    if (initial?.questionId) {
      result = await updateQuestionAction(
        sectionId,
        initial.questionId,
        undefined,
        formData,
      );
    } else {
      result = await addQuestionAction(sectionId, undefined, formData);
    }
    setPending(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (onDone) onDone();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.bilingual}>
        <div className={styles.field}>
          <label className={styles.label}>{t("quizzes.questionTextEn")}</label>
          <textarea
            name="questionTextEn"
            className={styles.textarea}
            value={textEn}
            onChange={(e) => setTextEn(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>
            {t("quizzes.questionTextSw")}
            {!textSw && textEn && (
              <span className={styles.pendingTag}>
                {t("common.translationPending")}
              </span>
            )}
          </label>
          <textarea
            name="questionTextSw"
            className={styles.textarea}
            value={textSw}
            onChange={(e) => setTextSw(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t("quizzes.options")}</label>
        {options.map((opt, i) => (
          <div key={i} className={styles.optionRow}>
            <div className={styles.optionRadio}>
              <input
                type="radio"
                name="correctOption"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                aria-label={t("quizzes.markCorrect")}
              />
              <span>{t("quizzes.correct")}</span>
            </div>
            <input
              className={styles.input}
              placeholder={t("quizzes.optionTextEn")}
              value={opt.text_en}
              onChange={(e) => setOption(i, { text_en: e.target.value })}
            />
            <input
              className={styles.input}
              placeholder={t("quizzes.optionTextSw")}
              value={opt.text_sw ?? ""}
              onChange={(e) => setOption(i, { text_sw: e.target.value })}
            />
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t("quizzes.removeOption")}
              disabled={options.length <= 2}
              onClick={() => removeOption(i)}
            >
              ✕
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
            onClick={addOption}
          >
            + {t("quizzes.addOption")}
          </button>
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}
