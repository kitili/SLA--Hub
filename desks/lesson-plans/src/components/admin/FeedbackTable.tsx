/**
 * FeedbackTable — the admin feedback-review surface.
 *
 * Presentational Server Component. Shows three things, all passed in by the
 * page so this stays a pure view:
 *   - the overall average rating (headline),
 *   - the lowest-rated plans (a board to triage),
 *   - the most recent comments.
 *
 * Each plan reference is a locale-aware Link to its admin edit page. Mobile
 * first: comments render as stacked cards; the lowest-rated list is a compact
 * ranked list that reads well on a phone.
 */
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { LowestRatedPlan, RecentComment } from "@/lib/admin/insights";
import styles from "./FeedbackTable.module.css";

export interface FeedbackTableProps {
  overallAvg: number | null;
  lowestRated: LowestRatedPlan[];
  recentComments: RecentComment[];
}

/** Render a 1–5 rating as filled/empty stars with an accessible label. */
function Stars({ rating, ariaLabel }: { rating: number; ariaLabel: string }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={styles.stars} aria-label={ariaLabel}>
      <span aria-hidden="true">
        {"★".repeat(clamped)}
        {"☆".repeat(5 - clamped)}
      </span>
    </span>
  );
}

/** Format a date as a short, locale-neutral "24 Jun 2026". */
function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function FeedbackTable({
  overallAvg,
  lowestRated,
  recentComments,
}: FeedbackTableProps) {
  const t = await getTranslations("lpAdmin.feedback");

  return (
    <div className={styles.wrap}>
      <div className={styles.headline}>
        <span className={styles.headlineValue}>
          {overallAvg == null ? "—" : overallAvg.toFixed(1)}
        </span>
        <span className={styles.headlineLabel}>
          {overallAvg != null
            ? t("overallAverageOutOf5")
            : t("overallAverage")}
        </span>
      </div>

      <section className={styles.section} aria-labelledby="lowest-rated-heading">
        <h2 id="lowest-rated-heading" className={styles.sectionTitle}>
          {t("lowestRatedHeading")}
        </h2>
        {lowestRated.length === 0 ? (
          <p className={styles.empty}>{t("lowestRatedEmpty")}</p>
        ) : (
          <ol className={styles.rankedList}>
            {lowestRated.map((plan) => (
              <li key={plan.planId} className={styles.rankedItem}>
                <Link
                  href={`/admin/plans/${plan.slug}/edit`}
                  className={styles.planLink}
                >
                  {plan.title}
                </Link>
                <span className={styles.rankedMeta}>
                  <Stars
                    rating={plan.avgRating}
                    ariaLabel={t("ratingAria", { rating: plan.avgRating })}
                  />
                  <span className={styles.ratingNum}>
                    {plan.avgRating.toFixed(1)}
                  </span>
                  <span className={styles.count}>
                    ({t("ratings", { count: plan.feedbackCount })})
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.section} aria-labelledby="comments-heading">
        <h2 id="comments-heading" className={styles.sectionTitle}>
          {t("commentsHeading")}
        </h2>
        {recentComments.length === 0 ? (
          <p className={styles.empty}>{t("commentsEmpty")}</p>
        ) : (
          <ul className={styles.comments}>
            {recentComments.map((c) => (
              <li key={c.id} className={styles.comment}>
                <div className={styles.commentHead}>
                  <Stars
                    rating={c.rating}
                    ariaLabel={t("ratingAria", { rating: c.rating })}
                  />
                  <span className={styles.commentDate}>
                    {formatDate(c.createdAt)}
                  </span>
                </div>
                <p className={styles.commentBody}>{c.comment}</p>
                <div className={styles.commentFoot}>
                  <Link
                    href={`/admin/plans/${c.slug}/edit`}
                    className={styles.planLink}
                  >
                    {c.title}
                  </Link>
                  {c.authorEmail ? (
                    <span className={styles.author}>· {c.authorEmail}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
