/**
 * InsightCards — the row of headline stat cards atop the admin dashboard.
 *
 * Pure presentational Server Component: it receives the already-computed
 * {@link OverviewStats} and renders four cards. Mobile-first: a single column
 * on phones, widening to a 2-up then 4-up grid on larger screens.
 */
import { getTranslations } from "next-intl/server";

import type { OverviewStats } from "@/lib/admin/insights";
import styles from "./InsightCards.module.css";

interface Card {
  label: string;
  value: string;
  hint?: string;
}

export default async function InsightCards({ stats }: { stats: OverviewStats }) {
  const t = await getTranslations("lpAdmin.insights");

  const cards: Card[] = [
    {
      label: t("totalPlans"),
      value: String(stats.totalPlans),
      hint: t("publishedCount", { count: stats.publishedPlans }),
    },
    {
      label: t("published"),
      value: String(stats.publishedPlans),
      hint:
        stats.totalPlans > 0
          ? t("draftCount", { count: stats.totalPlans - stats.publishedPlans })
          : undefined,
    },
    {
      label: t("activeTeachers"),
      value: String(stats.activeTeachers),
      hint: t("last14Days"),
    },
    {
      label: t("averageRating"),
      value: stats.avgRating == null ? "—" : stats.avgRating.toFixed(1),
      hint: stats.avgRating == null ? t("noFeedbackYet") : t("outOf5"),
    },
  ];

  return (
    <section className={styles.grid} aria-label={t("ariaLabel")}>
      {cards.map((card) => (
        <div key={card.label} className={styles.card}>
          <span className={styles.value}>{card.value}</span>
          <span className={styles.label}>{card.label}</span>
          {card.hint ? <span className={styles.hint}>{card.hint}</span> : null}
        </div>
      ))}
    </section>
  );
}
