import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { riskLevel } from "@/lib/at-risk";

export const metadata: Metadata = {
  title: "Members — Silverleaf Onboarding Hub",
  description: "Monitor staff onboarding progress and risk status.",
};
import {
  getContentQualitySnapshot,
  getMemberMonitorOverview,
  listCampuses,
} from "@/lib/db/queries/admin";
import MembersTable, {
  type MemberTableRow,
} from "@/components/admin/MembersTable";
import AdminPasswordForm from "@/components/admin/AdminPasswordForm";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Onboarding admin — member monitoring and progress overview. */
export default async function AdminMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;

  const t = await getTranslations("admin.members");
  const [overview, contentQuality, campusRows] = await Promise.all([
    getMemberMonitorOverview(),
    getContentQualitySnapshot(),
    listCampuses(),
  ]);
  const now = new Date();

  const rows: MemberTableRow[] = overview.members.map((m) => {
    const risk = riskLevel({
      startedAt: m.startedAt,
      completionPct: m.completionPct,
      lastActiveAt: m.lastActiveAt,
      now,
    });
    return {
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      campus: m.campus,
      completionPct: m.completionPct,
      lastActiveAt: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
      startedAt: m.startedAt ? m.startedAt.toISOString() : null,
      complete: m.complete,
      checkpointsPassed: m.checkpointsPassed,
      hasBio: m.hasBio,
      risk,
    };
  });

  const atRiskCount = rows.filter((r) => r.risk !== "green").length;

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
        <p className={styles.muted}>{t("campusHelp")}</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{overview.staffCount}</div>
          <div className={styles.statLabel}>{t("stats.registered")}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{overview.completedCount}</div>
          <div className={styles.statLabel}>{t("stats.completed")}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{overview.totalCheckpoints}</div>
          <div className={styles.statLabel}>{t("stats.checkpoints")}</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardRisk}`}>
          <div className={styles.statValue}>{atRiskCount}</div>
          <div className={styles.statLabel}>{t("stats.atRisk")}</div>
        </div>
      </div>

      <section className={styles.insightPanel}>
        <div>
          <span className={styles.insightKicker}>Content readiness</span>
          <h2>Learning item upload status</h2>
          <p>
            The hub now includes the preserved legacy document folder, so older
            policies, charts, templates, and guides can be opened from their
            original paths. Use the Content tab to add any new support videos or
            replace outdated files.
          </p>
        </div>
        <div className={styles.insightStats}>
          <div>
            <strong>{contentQuality.listedMaterials}</strong>
            <span>listed materials</span>
          </div>
          <div>
            <strong>{contentQuality.itemsWithoutMaterials}</strong>
            <span>items without files</span>
          </div>
          <div>
            <strong>{contentQuality.youtubeEmbeds}</strong>
            <span>video embeds</span>
          </div>
        </div>
      </section>

      <MembersTable
        rows={rows}
        campuses={campusRows.map((c) => c.name)}
      />
      <div style={{ marginTop: "1.5rem" }}>
        <AdminPasswordForm />
      </div>
    </>
  );
}
