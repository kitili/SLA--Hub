"use client";

/**
 * FeedbackForm — rate a lesson plan 1–5 with an optional comment.
 *
 * Cross-vertical contract (owned here): props `{ planId, initialRating?,
 * initialComment? }`. Prefills from the initial props and reflects an
 * "already rated" state. On a successful submit it shows a <SuccessToast>
 * with the points awarded (0 when re-rating, which is free).
 *
 * The star control is an accessible radiogroup: arrow keys move the selection,
 * each star is a 44px+ touch target. Submission runs through `submitFeedback`
 * inside a transition so the UI stays responsive.
 */
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { submitFeedback } from "@/lib/actions/feedback";
import SuccessToast from "./SuccessToast";
import styles from "./FeedbackForm.module.css";

export interface FeedbackFormProps {
  planId: string;
  initialRating?: number | null;
  initialComment?: string | null;
}

const RATING_LABEL_KEYS = [
  "ratingPoor",
  "ratingFair",
  "ratingGood",
  "ratingGreat",
  "ratingExcellent",
] as const;

export default function FeedbackForm({
  planId,
  initialRating,
  initialComment,
}: FeedbackFormProps) {
  const t = useTranslations("lpFeedback");

  const alreadyRated =
    typeof initialRating === "number" && initialRating >= 1;

  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [hovered, setHovered] = useState<number>(0);
  const [comment, setComment] = useState<string>(initialComment ?? "");
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; points: number } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  // What the stars should render as: the hover preview wins, else the selection.
  const display = hovered || rating;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setToast(null);

    if (rating < 1 || rating > 5) {
      setError(t("form.errorRange"));
      return;
    }

    startTransition(async () => {
      const result = await submitFeedback({
        planId,
        rating,
        comment: comment.trim() || undefined,
      });

      if (!result.ok) {
        setError(
          result.error === "unauthenticated"
            ? t("form.errorUnauthenticated")
            : result.error === "invalid"
              ? t("form.errorRange")
              : t("form.errorGeneric"),
        );
        return;
      }

      const awarded = result.awardedPoints ?? 0;
      setToast({
        message: awarded > 0 ? t("toast.thanks") : t("toast.updated"),
        points: awarded,
      });
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <fieldset className={styles.fieldset} disabled={isPending}>
        <legend className={styles.legend}>
          {alreadyRated ? t("form.update") : t("form.rate")}
        </legend>

        <div className={styles.ratingHero}>
          <div
            className={styles.stars}
            role="radiogroup"
            aria-label={t("form.starsGroupLabel")}
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= display;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={t("form.starAriaLabel", {
                    count: value,
                    label: t(`form.${RATING_LABEL_KEYS[value - 1]}`),
                  })}
                  className={`${styles.star} ${filled ? styles.starFilled : ""}`}
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHovered(value)}
                  onMouseLeave={() => setHovered(0)}
                  onFocus={() => setHovered(value)}
                  onBlur={() => setHovered(0)}
                >
                  <span aria-hidden="true">{filled ? "★" : "☆"}</span>
                </button>
              );
            })}
          </div>
          <span className={styles.ratingLabel} aria-hidden="true">
            {display > 0 ? t(`form.${RATING_LABEL_KEYS[display - 1]}`) : ""}
          </span>
        </div>

        <label className={styles.commentLabel}>
          {t("form.comment")}{" "}
          <span className={styles.optional}>{t("form.optional")}</span>
          <textarea
            className={styles.comment}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={t("form.commentPlaceholder")}
            maxLength={1000}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isPending}>
          {isPending
            ? t("form.saving")
            : alreadyRated
              ? t("form.updateSubmit")
              : t("form.submit")}
        </button>
      </fieldset>

      {toast && (
        <SuccessToast message={toast.message} points={toast.points} />
      )}
    </form>
  );
}
