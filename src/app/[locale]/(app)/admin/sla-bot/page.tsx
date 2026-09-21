import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import SlaBotAlertsPanel from "@/components/admin/SlaBotAlertsPanel";
import styles from "@/components/admin/admin.module.css";
import { requireAdmin } from "@/lib/auth";
import { slaBotRepo } from "@/lib/db/repositories";
import { syncSlaBotAdminKnowledge } from "@/lib/sla-bot-admin-knowledge";
import { syncSlaBotKnowledge } from "@/lib/sla-bot-knowledge";

export const dynamic = "force-dynamic";

export default async function AdminSlaBotPage() {
  await requireAdmin();
  const t = await getTranslations("admin.slaBot");

  let learnerCount = await slaBotRepo.knowledgeCount("learner");
  let adminCount = await slaBotRepo.knowledgeCount("admin");
  if (learnerCount === 0) {
    learnerCount = await syncSlaBotKnowledge();
  }
  if (adminCount === 0) {
    adminCount = await syncSlaBotAdminKnowledge();
  }

  const alerts = await slaBotRepo.listOpenAlerts(80);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("pageTitle")}</h1>
        <p className={styles.linkRow}>
          <Link href="/admin">← {t("back")}</Link>
        </p>
      </div>

      <div className={styles.card}>
        <SlaBotAlertsPanel
          knowledgeCount={learnerCount}
          adminKnowledgeCount={adminCount}
          alerts={alerts.map((a) => ({
            id: a.id,
            kind: a.kind,
            severity: a.severity,
            summary: a.summary,
            detail: a.detail,
            emailTo: a.emailTo,
            emailSent: a.emailSent,
            createdAtISO: a.createdAt.toISOString(),
            memberEmail: a.memberEmail,
            memberName: a.memberName,
          }))}
        />
      </div>
    </>
  );
}
