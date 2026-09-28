"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { submitSectionDeclarationAction } from "@/lib/actions/member";

import styles from "./PoliciesDeclarationForm.module.css";

interface Props {
  sectionId: string;
  onPassed: () => void;
}

export default function PoliciesDeclarationForm({
  sectionId,
  onPassed,
}: Props) {
  const t = useTranslations("policies");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const acknowledgedText = [
    "[EN] " + t("declarationTextEN"),
    "[SW] " + t("declarationTextSW"),
  ].join("\n\n");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) return;
    setError(null);

    startTransition(async () => {
      const result = await submitSectionDeclarationAction(
        sectionId,
        acknowledgedText,
      );
      if (result.ok) {
        onPassed();
      } else if (result.error === "incomplete") {
        setError(t("errorIncomplete"));
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <section className={styles.declaration} aria-labelledby="policy-decl-heading">
        <h3 id="policy-decl-heading">{t("declarationTitle")}</h3>
        <p className={styles.intro}>{t("declarationIntro")}</p>

        <div className={styles.langBlock}>
          <strong>English</strong>
          <p>{t("declarationTextEN")}</p>
        </div>

        <hr className={styles.divider} />

        <div className={styles.langBlock}>
          <strong>Kiswahili</strong>
          <p>{t("declarationTextSW")}</p>
        </div>
      </section>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={isPending}
        />
        <span>{t("checkboxLabel")}</span>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className={styles.submit}
        disabled={!checked || isPending}
      >
        {isPending ? t("submitting") : t("submitButton")}
      </button>
    </form>
  );
}
