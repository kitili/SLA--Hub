"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import PolicyBriefingPanel from "@/components/PolicyBriefing";
import {
  generatePolicyBriefingAction,
  publishPolicyBriefingAction,
} from "@/lib/actions/policy-briefings";
import type { PolicyBriefingScript } from "@/lib/policy-briefing-script";
import styles from "./admin.module.css";
import reviewStyles from "./PolicyBriefingReview.module.css";

export interface PolicyBriefingAdminItem {
  itemId: string;
  itemTitle: string;
  hasDocument: boolean;
  latest: {
    id: string;
    status: "generating" | "draft" | "published" | "failed";
    generator: string | null;
    errorMessage: string | null;
    sourceFilename: string | null;
    createdAtISO: string;
    script: PolicyBriefingScript;
  } | null;
}

export default function PolicyBriefingReview({
  items,
}: {
  items: PolicyBriefingAdminItem[];
}) {
  const t = useTranslations("admin.briefings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const generating = items.some((item) => item.latest?.status === "generating");

  useEffect(() => {
    if (!generating) return;
    const id = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(id);
  }, [generating, router]);

  function generate(itemId: string) {
    setError(null);
    setBusyId(itemId);
    startTransition(async () => {
      const result = await generatePolicyBriefingAction(itemId);
      if (!result.ok) setError(result.error.message);
      setBusyId(null);
      router.refresh();
    });
  }

  function publish(briefingId: string) {
    setError(null);
    setBusyId(briefingId);
    startTransition(async () => {
      const result = await publishPolicyBriefingAction(briefingId);
      if (!result.ok) setError(result.error.message);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className={reviewStyles.stack}>
      <p className={styles.muted}>{t("intro")}</p>
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}

      {items.map((item) => {
        const latest = item.latest;
        const status = latest?.status ?? "none";
        const canPreview = Boolean(latest && latest.script.chapters.length > 0);
        return (
          <article key={item.itemId} className={reviewStyles.card}>
            <header className={reviewStyles.header}>
              <h3 className={reviewStyles.title}>{item.itemTitle}</h3>
              <span
                className={`${styles.badge} ${
                  status === "published"
                    ? styles.statusDone
                    : status === "draft" || status === "generating"
                      ? styles.statusProgress
                      : styles.statusNotStarted
                }`}
              >
                {t(`status.${status}`)}
              </span>
            </header>

            {latest?.sourceFilename && (
              <p className={styles.muted}>
                {t("fromFile", { file: latest.sourceFilename })}
                {latest.generator === "openai"
                  ? ` · ${t("generatorAi")}`
                  : latest.generator === "extractive"
                    ? ` · ${t("generatorExtractive")}`
                    : ""}
              </p>
            )}

            {latest?.status === "failed" && latest.errorMessage && (
              <p className={styles.fieldError}>{latest.errorMessage}</p>
            )}

            {latest?.status === "generating" && (
              <p className={styles.muted}>{t("generatingHint")}</p>
            )}

            {latest?.status === "draft" && (
              <p className={styles.muted}>{t("draftKeepsLive")}</p>
            )}

            {canPreview && latest && (
              <PolicyBriefingPanel
                briefing={{
                  itemId: item.itemId,
                  title: latest.script.title || item.itemTitle,
                  nextStep: latest.script.nextStep,
                  script: latest.script,
                }}
              />
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                disabled={pending || !item.hasDocument}
                onClick={() => generate(item.itemId)}
              >
                {busyId === item.itemId && pending
                  ? t("generating")
                  : latest
                    ? t("regenerate")
                    : t("generate")}
              </button>
              {latest?.status === "draft" && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                  disabled={pending}
                  onClick={() => publish(latest.id)}
                >
                  {busyId === latest.id && pending ? t("publishing") : t("publish")}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
