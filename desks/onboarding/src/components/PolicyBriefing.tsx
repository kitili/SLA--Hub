"use client";

import { useTranslations } from "next-intl";

import type { PolicyBriefing } from "@/lib/policy-briefings";
import PolicyBriefingPlayer from "@/components/PolicyBriefingPlayer";
import styles from "./PolicyBriefing.module.css";

interface Props {
  briefing: PolicyBriefing;
}

/** Inline policy briefing — generated script player, or fallback MP4. */
export default function PolicyBriefingPanel({ briefing }: Props) {
  const t = useTranslations("member.section.policyBriefing");
  const hasScript = Boolean(briefing.script && briefing.script.chapters.length > 0);
  const hasVideo = Boolean(briefing.videoSrc);

  return (
    <aside className={styles.panel} aria-labelledby={`briefing-${briefing.itemId}`}>
      <div className={styles.header}>
        <span className={styles.badge}>{t("badge")}</span>
        <h4 id={`briefing-${briefing.itemId}`} className={styles.title}>
          {t("title")}
        </h4>
      </div>

      {hasScript ? (
        <PolicyBriefingPlayer briefing={briefing} />
      ) : hasVideo ? (
        <div
          className={styles.videoWrap}
          onContextMenu={(e) => e.preventDefault()}
        >
          <p className={styles.videoLabel}>{t("videoLabel")}</p>
          <video
            className={styles.video}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            preload="metadata"
            playsInline
          >
            <source src={briefing.videoSrc} type="video/mp4" />
          </video>
        </div>
      ) : (
        <p className={styles.pending}>{t("videoPending")}</p>
      )}

      <p className={styles.nextStep}>
        <strong>{t("nextLabel")}</strong> {briefing.nextStep} {t("soundHint")}
      </p>
    </aside>
  );
}
