"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
  refreshSlaBotKnowledgeAction,
  resolveSlaBotAlertAction,
} from "@/lib/actions/sla-bot";
import styles from "./admin.module.css";

export interface SlaBotAlertRow {
  id: string;
  kind: string;
  severity: string;
  summary: string;
  detail: string;
  emailTo: string | null;
  emailSent: boolean;
  createdAtISO: string;
  memberEmail: string | null;
  memberName: string | null;
}

export default function SlaBotAlertsPanel({
  alerts,
  knowledgeCount,
  adminKnowledgeCount = 0,
}: {
  alerts: SlaBotAlertRow[];
  knowledgeCount: number;
  adminKnowledgeCount?: number;
}) {
  const t = useTranslations("admin.slaBot");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      await refreshSlaBotKnowledgeAction();
      router.refresh();
    });
  }

  function resolve(id: string) {
    startTransition(async () => {
      await resolveSlaBotAlertAction(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.cardHeader}>
        <div>
          <h2>{t("heading")}</h2>
          <p className={styles.muted}>
            {t("knowledgeCount", {
              count: knowledgeCount,
              adminCount: adminKnowledgeCount,
            })}
          </p>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          disabled={pending}
          onClick={refresh}
        >
          {pending ? t("refreshing") : t("refreshKnowledge")}
        </button>
      </div>

      <p className={styles.muted}>{t("intro")}</p>

      {alerts.length === 0 ? (
        <p className={styles.muted}>{t("empty")}</p>
      ) : (
        <ul className={styles.memberProgressList}>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <div className={styles.memberProgressRow}>
                <div>
                  <strong>
                    {alert.kind === "feedback" ||
                    alert.kind === "tech_issue" ||
                    alert.kind === "alarm"
                      ? t(`kinds.${alert.kind}`)
                      : alert.kind}
                  </strong>{" "}
                  <span
                    className={`${styles.badge} ${
                      alert.severity === "critical"
                        ? styles.riskRed
                        : alert.severity === "warning"
                          ? styles.riskOrange
                          : styles.statusProgress
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <p className={styles.muted} style={{ margin: "0.35rem 0" }}>
                    {alert.memberName ?? "—"} · {alert.memberEmail ?? "—"} ·{" "}
                    {new Date(alert.createdAtISO).toLocaleString()}
                  </p>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {alert.detail}
                  </p>
                  {alert.emailTo && (
                    <p className={styles.muted} style={{ marginTop: "0.35rem" }}>
                      {t("emailedTo", {
                        to: alert.emailTo,
                        status: alert.emailSent ? t("sent") : t("notSent"),
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                  disabled={pending}
                  onClick={() => resolve(alert.id)}
                >
                  {t("resolve")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
