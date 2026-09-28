"use client";

import { useTranslations } from "next-intl";

import type { SchemeHeaderContext } from "@/lib/sow/types";

import styles from "./SchemesClient.module.css";

/** Read-only render of the structured UbD curriculum context. */
export default function HeaderContextPanel({ ctx }: { ctx?: SchemeHeaderContext | null }) {
  const t = useTranslations("lpManage.schemes");
  if (!ctx) return null;

  const lists: Array<[string, string[]]> = [
    [t("ubdEnduringUnderstandings"), ctx.enduringUnderstandings ?? []],
    [t("ubdEssentialQuestions"), ctx.essentialQuestions ?? []],
    [t("ubdKnowledge"), ctx.knowledge ?? []],
    [t("ubdSkills"), ctx.skills ?? []],
    [t("ubdPerformanceTasks"), ctx.performanceTasks ?? []],
  ];
  if (ctx.assessment) {
    lists.push([t("ubdFormative"), ctx.assessment.formative ?? []]);
    lists.push([t("ubdSummative"), ctx.assessment.summative ?? []]);
  }

  const hasAny =
    Boolean(ctx.transferGoal) ||
    Boolean(ctx.specificCompetences) ||
    Boolean(ctx.relatedSkills) ||
    lists.some(([, items]) => items.length > 0);

  return (
    <div className={styles.curriculumPanel}>
      <h3 className={styles.subHeading}>{t("curriculumHeading")}</h3>
      {!hasAny ? <p className={styles.muted}>{t("ubdNone")}</p> : null}
      {ctx.specificCompetences ? (
        <p className={styles.ubdProse}>
          <strong>{t("ubdSpecificCompetences")}:</strong> {ctx.specificCompetences}
        </p>
      ) : null}
      {ctx.transferGoal ? (
        <p className={styles.ubdProse}>
          <strong>{t("ubdTransferGoal")}:</strong> {ctx.transferGoal}
        </p>
      ) : null}
      {lists.map(([label, items]) =>
        items.length > 0 ? (
          <details key={label} className={styles.ubdGroup}>
            <summary>
              {label} ({items.length})
            </summary>
            <ul className={styles.ubdList}>
              {items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </details>
        ) : null,
      )}
      {ctx.relatedSkills ? (
        <p className={styles.ubdProse}>
          <strong>{t("ubdRelatedSkills")}:</strong> {ctx.relatedSkills}
        </p>
      ) : null}
    </div>
  );
}
