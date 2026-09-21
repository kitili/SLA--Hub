"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { submitPolicySignatureAction } from "@/lib/actions/member";
import styles from "./PolicySignatureForm.module.css";

interface Props {
  itemId: string;
  policyTitle: string;
  /** Prefill typed signature from the staff profile name. */
  defaultSignedName?: string;
  alreadySigned?: boolean;
  signedName?: string | null;
  signedAtISO?: string | null;
  onSigned: (result: {
    readItems: string[];
    signedName: string;
    signedAtISO: string;
  }) => void;
}

export default function PolicySignatureForm({
  itemId,
  policyTitle,
  defaultSignedName = "",
  alreadySigned = false,
  signedName = null,
  signedAtISO = null,
  onSigned,
}: Props) {
  const t = useTranslations("policies.itemSignature");
  const [name, setName] = useState(defaultSignedName);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const acknowledgedText = t("ackText", { policy: policyTitle });

  if (alreadySigned && signedName) {
    const when = signedAtISO
      ? new Date(signedAtISO).toLocaleString()
      : null;
    return (
      <div className={styles.signedBox} role="status">
        <p className={styles.signedTitle}>{t("signedTitle")}</p>
        <p className={styles.signedMeta}>
          {t("signedBy", { name: signedName })}
          {when ? ` · ${when}` : ""}
        </p>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked || name.trim().length < 2) return;
    setError(null);

    startTransition(async () => {
      const result = await submitPolicySignatureAction({
        itemId,
        signedName: name,
        acknowledgedText,
      });
      if (result.ok && result.readItems && result.signedName && result.signedAtISO) {
        onSigned({
          readItems: result.readItems,
          signedName: result.signedName,
          signedAtISO: result.signedAtISO,
        });
      } else if (result.error === "invalid-input") {
        setError(t("errorName"));
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <span className={styles.badge}>{t("badge")}</span>
        <h4 className={styles.title}>{t("title")}</h4>
      </div>
      <p className={styles.intro}>{t("intro", { policy: policyTitle })}</p>

      <label className={styles.field}>
        <span>{t("nameLabel")}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          autoComplete="name"
          required
          minLength={2}
          maxLength={255}
          disabled={isPending}
        />
        <span className={styles.hint}>{t("nameHint")}</span>
      </label>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          disabled={isPending}
        />
        <span>{t("checkboxLabel", { policy: policyTitle })}</span>
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="submit"
        className={styles.submit}
        disabled={isPending || !checked || name.trim().length < 2}
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
