/**
 * PointsBadge — a small pill showing a staff member's points total and current
 * feedback streak, e.g. "120 pts · 3-day streak".
 *
 * Async Server Component. With no props it resolves the current user; pass
 * `staffId` to render the badge for a specific member. Reads are cheap (one
 * sum + one row) and run per-request.
 */
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth";
import { getPointsTotal, getStreak } from "@/lib/points";

import styles from "./PointsBadge.module.css";

export interface PointsBadgeProps {
  /** Staff UUID to render for. Defaults to the current user. */
  staffId?: string;
}

export default async function PointsBadge({ staffId }: PointsBadgeProps) {
  const t = await getTranslations("lpFeedback");
  const resolvedStaffId = staffId ?? (await requireUser()).id;

  const [points, streak] = await Promise.all([
    getPointsTotal(resolvedStaffId),
    getStreak(resolvedStaffId),
  ]);

  const pointsLabel = t("points.pts", { points });
  const hasStreak = streak.currentStreak > 0;

  return (
    <span
      className={styles.badge}
      aria-label={
        hasStreak
          ? t("points.ariaWithStreak", {
              points,
              days: streak.currentStreak,
            })
          : t("points.ariaPointsOnly", { points })
      }
    >
      <span className={styles.star} aria-hidden="true">
        ★
      </span>
      <span className={styles.points}>{pointsLabel}</span>
      {hasStreak && (
        <>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span className={styles.streak}>
            {t("points.streak", { days: streak.currentStreak })}
          </span>
        </>
      )}
    </span>
  );
}
