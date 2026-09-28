"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import CreateSectionItemForm from "./CreateSectionItemForm";
import styles from "./admin.module.css";

/**
 * Prominently shows "Add learning item" on the section edit page.
 */
export default function CreateSectionItemPanel({
  sectionId,
  initiallyOpen = false,
}: {
  sectionId: string;
  initiallyOpen?: boolean;
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(initiallyOpen);

  if (!open) {
    return (
      <div className={styles.addItemCallout}>
        <div>
          <strong>{t("sections.items.new")}</strong>
          <p className={styles.muted}>{t("sections.items.help")}</p>
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setOpen(true)}
        >
          {t("sections.items.new")}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.addItemCallout}>
      <div className={styles.cardHeader}>
        <h3>{t("sections.items.new")}</h3>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          onClick={() => setOpen(false)}
        >
          {t("common.cancel")}
        </button>
      </div>
      <p className={styles.muted}>{t("sections.items.help")}</p>
      <CreateSectionItemForm
        sectionId={sectionId}
        onDone={() => setOpen(false)}
      />
    </div>
  );
}
