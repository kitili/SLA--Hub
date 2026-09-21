import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getMemberDashboard } from "@/lib/dashboard";
import styles from "./admin.module.css";

interface Props {
  member: { id: string; fullName: string | null };
  locale: string;
}

export default async function MemberOnboardingProgress({
  member,
  locale,
}: Props) {
  const t = await getTranslations("admin.memberDetail.onboardingProgress");
  const summary = await getMemberDashboard(member, locale as Locale);

  return (
    <section className={styles.memberProgressPanel} aria-labelledby="member-progress-heading">
      <h2 id="member-progress-heading">{t("heading")}</h2>
      <p className={styles.muted}>{t("readOnly")}</p>

      <div className={styles.memberProgressSummary}>
        <span className={styles.memberProgressPct}>{summary.overallPct}%</span>
        <div className={styles.progressBar} style={{ flex: 1, minWidth: "12rem" }}>
          <div
            className={styles.progressFill}
            style={{ width: `${summary.overallPct}%` }}
          />
        </div>
      </div>

      <p className={styles.muted}>
        {t("stepsNote", {
          done: summary.stepsDone,
          total: summary.totalSteps,
          checkpoints: summary.sectionsPassed,
          sections: summary.totalSections,
        })}
      </p>

      <ul className={styles.memberProgressList}>
        {summary.sections.map((section) => (
          <li key={section.id}>
            <div className={styles.memberProgressRow}>
              <span>
                {t("sectionLabel", { number: section.number })}: {section.title}
              </span>
              <span className={styles.muted}>{section.pct}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${section.pct}%` }}
              />
            </div>
            {section.quizPassed && (
              <span className={styles.formSuccess} style={{ fontSize: "0.8rem" }}>
                {t("checkpointPassed")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
