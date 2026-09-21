"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  submitFeedbackAction,
  type FeedbackRecord,
} from "@/lib/actions/feedback";

import styles from "./feedback.module.css";

interface Props {
  locale: string;
  initial?: FeedbackRecord;
  alreadySubmitted?: boolean;
}

export default function FeedbackForm({
  locale,
  initial,
  alreadySubmitted = false,
}: Props) {
  const t = useTranslations("feedback");
  const [expectations, setExpectations] = useState(initial?.expectations ?? "");
  const [unclear, setUnclear] = useState(initial?.unclear ?? "");
  const [improvements, setImprovements] = useState(initial?.improvements ?? "");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!alreadySubmitted);
  const [savedAt, setSavedAt] = useState<string | null>(
    alreadySubmitted ? (initial?.submittedAt ?? null) : null,
  );
  const [isPending, startTransition] = useTransition();

  if (savedAt && !editing && !isPending) {
    const savedDate = new Date(savedAt).toLocaleDateString(
      locale === "sw" ? "sw-TZ" : "en-GB",
      { day: "numeric", month: "long", year: "numeric" },
    );

    return (
      <div className={styles.completion}>
        <span className={styles.completionIcon} aria-hidden>
          💬
        </span>
        <h2>
          {alreadySubmitted ? t("alreadySubmittedTitle") : t("completionTitle")}
        </h2>
        <p>
          {alreadySubmitted ? t("alreadySubmittedBody") : t("completionBody")}
        </p>
        <p className={styles.completionDate}>
          {alreadySubmitted
            ? t("submittedOn", { date: savedDate })
            : t("completionSubmittedOn", { date: savedDate })}
        </p>
        <div className={styles.actions} style={{ justifyContent: "center" }}>
          <button
            type="button"
            className={styles.submit}
            onClick={() => setEditing(true)}
          >
            {t("editButton")}
          </button>
          <Link href="/" className={styles.secondary}>
            {t("backToDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitFeedbackAction({
        expectations,
        unclear,
        improvements,
      });

      if (result.ok && result.feedback) {
        setSavedAt(result.feedback.submittedAt);
        setEditing(false);
      } else if (result.error === "empty") {
        setError(t("errorEmpty"));
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <section className={styles.intro} aria-labelledby="feedback-intro">
        <h2 id="feedback-intro">{t("introTitle")}</h2>
        <p>{t("introBody")}</p>
      </section>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="feedback-expectations">
          {t("expectationsLabel")}
        </label>
        <p className={styles.hint}>{t("expectationsHint")}</p>
        <textarea
          id="feedback-expectations"
          className={styles.textarea}
          value={expectations}
          onChange={(e) => setExpectations(e.target.value)}
          rows={4}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="feedback-unclear">
          {t("unclearLabel")}
        </label>
        <p className={styles.hint}>{t("unclearHint")}</p>
        <textarea
          id="feedback-unclear"
          className={styles.textarea}
          value={unclear}
          onChange={(e) => setUnclear(e.target.value)}
          rows={4}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="feedback-improvements">
          {t("improvementsLabel")}
        </label>
        <p className={styles.hint}>{t("improvementsHint")}</p>
        <textarea
          id="feedback-improvements"
          className={styles.textarea}
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          rows={4}
        />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending ? t("submitting") : t("submitButton")}
        </button>
        <Link href="/" className={styles.secondary}>
          {t("backToDashboard")}
        </Link>
      </div>
    </form>
  );
}
