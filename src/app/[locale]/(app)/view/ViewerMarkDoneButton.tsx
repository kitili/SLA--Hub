"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";

import { markItemReadAction } from "@/lib/actions/member";
import styles from "./view.module.css";

export default function ViewerMarkDoneButton({
  itemId,
  initiallyRead,
  requiresSignature = false,
  initiallySigned = false,
  sectionId,
}: {
  itemId: string;
  initiallyRead: boolean;
  /** Policy items must be signed on the section page, not here. */
  requiresSignature?: boolean;
  initiallySigned?: boolean;
  /** Owning section id for the return-to-sign deep link. */
  sectionId?: string | null;
}) {
  const t = useTranslations("member.viewer");
  const router = useRouter();
  const [isRead, setIsRead] = useState(initiallyRead);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (requiresSignature) {
    if (initiallySigned) {
      return <span className={styles.viewerDoneBadge}>{t("digitallySigned")}</span>;
    }
    return (
      <div className={styles.viewerDoneWrap}>
        <p className={styles.viewerDoneHint}>{t("signHint")}</p>
        {sectionId ? (
          <Link
            href={`/section/${sectionId}?resume=${encodeURIComponent(itemId)}`}
            className={styles.viewerDoneButton}
          >
            {t("backToSign")}
          </Link>
        ) : null}
      </div>
    );
  }

  if (isRead) {
    return <span className={styles.viewerDoneBadge}>{t("complete")}</span>;
  }

  return (
    <div className={styles.viewerDoneWrap}>
      <button
        type="button"
        className={styles.viewerDoneButton}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await markItemReadAction(itemId);
            if (result.ok) {
              setIsRead(true);
              router.refresh();
            } else if (result.error === "requires-signature") {
              setError(t("errorRequiresSignature"));
            } else {
              setError(t("errorMarkDone"));
            }
          });
        }}
      >
        {isPending ? t("marking") : t("markDone")}
      </button>
      {error && <p className={styles.viewerDoneError}>{error}</p>}
    </div>
  );
}
