import { useTranslations } from "next-intl";

import type { RiskLevel } from "@/lib/at-risk";
import styles from "./admin.module.css";

const RISK_STYLE: Record<RiskLevel, string> = {
  green: styles.riskGreen!,
  orange: styles.riskOrange!,
  red: styles.riskRed!,
};

/** Icon (not colour alone) so the signal is accessible to colour-blind users. */
const RISK_ICON: Record<RiskLevel, string> = {
  green: "●",
  orange: "▲",
  red: "■",
};

/**
 * At-risk badge — text + icon + colour (never colour alone). The label is
 * localized via `admin.members.risk.*`.
 */
export default function RiskBadge({ level }: { level: RiskLevel }) {
  const t = useTranslations("admin.members.risk");
  return (
    <span className={`${styles.badge} ${RISK_STYLE[level]}`}>
      <span className={styles.badgeIcon} aria-hidden="true">
        {RISK_ICON[level]}
      </span>
      {t(level)}
    </span>
  );
}
