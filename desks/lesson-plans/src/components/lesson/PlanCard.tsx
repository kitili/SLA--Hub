/**
 * PlanCard — a single lesson-plan search result, rendered as a tappable card.
 *
 * Server-safe (no client state). The whole card is a locale-aware <Link> to the
 * plan's detail page (`/plans/<slug>`), so the entire surface is one large
 * touch target. Shows the title, the compact plan meta line, and the topic
 * when present.
 */
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { LessonPlan } from "@/lib/db/schema";
import { formatPlanMeta } from "@/lib/lesson/planMeta";
import styles from "./PlanCard.module.css";

export interface PlanCardProps {
  plan: LessonPlan;
}

export default async function PlanCard({ plan }: PlanCardProps) {
  const t = await getTranslations("lpPlan");

  return (
    <Link href={`/plans/${plan.slug}`} className={styles.card}>
      <h3 className={styles.title}>{plan.title}</h3>
      <p className={styles.meta}>{formatPlanMeta(plan, t, { variant: "short" })}</p>
      {plan.topic ? <p className={styles.topic}>{plan.topic}</p> : null}
    </Link>
  );
}
