/**
 * FeedbackHourHome — the teacher home shown during Feedback Hour (3–5pm EAT).
 *
 * Cross-vertical contract (owned here): default-export async Server Component,
 * NO required props — it resolves the current user and fetches its own data.
 *
 * It celebrates the daily window and nudges teachers to rate the plans they
 * recently used but haven't yet scored. Each plan links to its page (where the
 * <FeedbackForm> lives) to leave a rating. When nothing is pending, a positive
 * empty state confirms they're all caught up.
 */
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { requireUser } from "@/lib/auth";
import { getRecentlyUsedWithoutFeedback } from "@/lib/feedback-queries";
import { formatPlanMeta } from "@/lib/lesson/planMeta";
import PointsBadge from "./PointsBadge";
import styles from "./FeedbackHourHome.module.css";

export default async function FeedbackHourHome() {
  const t = await getTranslations("lpFeedback");
  // Meta-line labels live under lpPlan (shared with the plan page & cards).
  const tPlan = await getTranslations("lpPlan");
  const user = await requireUser();
  const plans = await getRecentlyUsedWithoutFeedback(user.id);

  const firstName = user.fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <main className={styles.wrap}>
      <section className={styles.banner} aria-labelledby="feedback-hour-title">
        <div className={styles.bannerTop}>
          <span className={styles.pill}>{t("hour.pill")}</span>
          <PointsBadge staffId={user.id} />
        </div>
        <h1 id="feedback-hour-title" className={styles.title}>
          {firstName ? t("hour.titleNamed", { name: firstName }) : t("hour.title")}
        </h1>
        <p className={styles.subtitle}>{t("hour.subtitle")}</p>
      </section>

      {plans.length === 0 ? (
        <section className={styles.empty}>
          <span className={styles.emptyMark} aria-hidden="true">
            ✓
          </span>
          <h2 className={styles.emptyTitle}>{t("hour.emptyTitle")}</h2>
          <p className={styles.emptyText}>{t("hour.emptyText")}</p>
          <Link href="/search" className={styles.emptyLink}>
            {t("hour.emptyLink")}
          </Link>
        </section>
      ) : (
        <section aria-labelledby="pending-title">
          <h2 id="pending-title" className={styles.sectionTitle}>
            {t("hour.pendingTitle")}
          </h2>
          <ul className={styles.list}>
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link href={`/plans/${plan.slug}`} className={styles.card}>
                  <div className={styles.cardBody}>
                    <span className={styles.cardTitle}>{plan.title}</span>
                    <span className={styles.cardMeta}>
                      {formatPlanMeta(plan, tPlan, { variant: "short" })}
                    </span>
                  </div>
                  <span className={styles.cardCta} aria-hidden="true">
                    {t("hour.rateCta")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
