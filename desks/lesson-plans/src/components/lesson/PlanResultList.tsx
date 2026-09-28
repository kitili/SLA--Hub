/**
 * PlanResultList — the search results region.
 *
 * Server-safe. Renders a short result-count summary, a list of {@link PlanCard}s
 * (one per row), and a friendly empty state when nothing matches. `total` is the
 * full match count across all pages; `rows` is just the current page.
 */
import { getTranslations } from "next-intl/server";

import type { LessonPlan } from "@/lib/db/schema";
import PlanCard from "./PlanCard";
import styles from "./PlanResultList.module.css";

export interface PlanResultListProps {
  rows: LessonPlan[];
  /** Total matches across all pages (drives the summary line). */
  total: number;
}

export default async function PlanResultList({
  rows,
  total,
}: PlanResultListProps) {
  const t = await getTranslations("lpResults");
  const tSearch = await getTranslations("lpSearch");

  if (total === 0) {
    return (
      <div className={styles.empty} role="status">
        <p className={styles.emptyTitle}>{t("emptyTitle")}</p>
        <p className={styles.emptyHint}>{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <section className={styles.results} aria-label={tSearch("resultsAriaLabel")}>
      <p className={styles.count} role="status">
        {t("count", { count: total })}
      </p>
      <ul className={styles.list}>
        {rows.map((plan) => (
          <li key={plan.id}>
            <PlanCard plan={plan} />
          </li>
        ))}
      </ul>
    </section>
  );
}
