/**
 * UpcomingLessons — the teacher's "your next lessons" card list.
 *
 * Default-export async Server Component, no props: resolves the current user
 * via requireUser() and asks getUpcomingForTeacher() for the plans they are
 * most likely to teach next. Each row links to the plan detail page.
 *
 * Renders a friendly empty state when there is nothing to suggest. Mobile-first.
 */
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { getUpcomingForTeacher } from "@/lib/search/upcoming";
import { formatPlanMeta } from "@/lib/lesson/planMeta";
import styles from "./UpcomingLessons.module.css";

export default async function UpcomingLessons() {
  const user = await requireUser();
  const plans = await getUpcomingForTeacher(user.id);
  const t = await getTranslations("lpHome");
  // Meta-line labels live under lpPlan (shared with the plan page & cards).
  const tPlan = await getTranslations("lpPlan");

  return (
    <section className={styles.section} aria-labelledby="upcoming-heading">
      <h2 id="upcoming-heading" className={styles.heading}>
        {t("upcomingHeading")}
      </h2>

      {plans.length === 0 ? (
        <p className={styles.empty}>{t("upcomingEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link href={`/plans/${plan.slug}`} className={styles.card}>
                <span className={styles.cardTitle}>{plan.title}</span>
                <span className={styles.cardMeta}>{formatPlanMeta(plan, tPlan)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
