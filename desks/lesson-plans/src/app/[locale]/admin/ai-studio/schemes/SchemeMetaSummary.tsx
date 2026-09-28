"use client";

import { useTranslations } from "next-intl";

import styles from "./SchemesClient.module.css";

/** Read-only summary of a scheme's parsed metadata (weeks, duration, etc.). */
export default function SchemeMetaSummary({
  meta,
}: {
  meta: {
    mainCompetence?: string | null;
    weeksCount?: number | null;
    lessonsPerWeek?: number | null;
    lessonDurationMins?: number | null;
    totalLessons?: string | null;
  };
}) {
  const t = useTranslations("lpManage.schemes");
  const items: Array<[string, string]> = [];
  if (meta.mainCompetence) items.push([t("metaMainCompetence"), meta.mainCompetence]);
  if (meta.weeksCount != null) items.push([t("metaWeeks"), String(meta.weeksCount)]);
  if (meta.lessonsPerWeek != null) items.push([t("metaLessonsPerWeek"), String(meta.lessonsPerWeek)]);
  if (meta.lessonDurationMins != null) items.push([t("metaDuration"), String(meta.lessonDurationMins)]);
  if (meta.totalLessons) items.push([t("metaTotalLessons"), meta.totalLessons]);
  if (items.length === 0) return null;
  return (
    <p className={styles.meta}>
      {items.map(([label, value], i) => (
        <span key={label}>
          {i > 0 ? " · " : ""}
          <strong>{label}:</strong> {value}
        </span>
      ))}
    </p>
  );
}
