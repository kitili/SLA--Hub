"use client";

/**
 * PromptPartsEditor — editable prompt parts, on the AI Studio Settings tab.
 *
 * One card per part with a full-height textarea, Save and Reset to default.
 * useTransition per card so saves are independent. router.refresh() syncs
 * the server state after each mutation.
 *
 * These parts are the ONLY source of prompt text for generation — there is no
 * per-request override — so a save here changes every plan generated
 * afterwards. Hence the warning the Settings page renders above this editor.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { updatePromptPart, resetPromptPart } from "@/lib/actions/prompts";
import type { PromptPartKey } from "@/lib/ai/lessonPlan/promptDefaults";

import styles from "./PromptPartsEditor.module.css";

// ── types ─────────────────────────────────────────────────────────────────────

type PromptPart = {
  id: string;
  key: string;
  label: string;
  content: string;
  updatedAt?: Date | string | null;
};

interface PromptPartsEditorProps {
  initialParts: PromptPart[];
}

// ── sub-component: PromptCard ─────────────────────────────────────────────────

function PromptCard({ part }: { part: PromptPart }) {
  const t = useTranslations("lpManage.settings");
  const router = useRouter();
  const [content, setContent] = useState(part.content);
  const [savePending, startSaveTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = savePending || resetPending;

  function handleSave() {
    setMsg(null);
    setError(null);
    startSaveTransition(async () => {
      const result = await updatePromptPart(part.key as PromptPartKey, content);
      if (result.ok) {
        setMsg(t("saved"));
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  function handleReset() {
    setMsg(null);
    setError(null);
    startResetTransition(async () => {
      const result = await resetPromptPart(part.key as PromptPartKey);
      if (result.ok) {
        setMsg(t("resetDone"));
        // router.refresh() re-renders with fresh initialParts but PRESERVES
        // client state (key={part.id} is stable, so no re-mount) — sync the
        // textarea from the default the action returns.
        if (result.content !== undefined) setContent(result.content);
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  // Format updatedAt
  let updatedAtStr: string | null = null;
  if (part.updatedAt) {
    try {
      updatedAtStr = new Date(part.updatedAt).toLocaleString();
    } catch {
      updatedAtStr = String(part.updatedAt);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{part.label}</h2>
          <code className={styles.cardKey}>{part.key}</code>
        </div>
        {updatedAtStr ? (
          <span className={styles.updatedAt}>
            {t("updatedAt", { date: updatedAtStr })}
          </span>
        ) : null}
      </div>

      <textarea
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={16}
        disabled={pending}
        spellCheck={false}
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {msg ? <p className={styles.success}>{msg}</p> : null}

      <div className={styles.cardActions}>
        <button
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={pending}
        >
          {savePending ? t("saving") : t("save")}
        </button>
        <button
          className={styles.btnSecondary}
          onClick={handleReset}
          disabled={pending}
        >
          {resetPending ? t("resetting") : t("reset")}
        </button>
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function PromptPartsEditor({ initialParts }: PromptPartsEditorProps) {
  const t = useTranslations("lpManage.settings");

  if (initialParts.length === 0) {
    return <p className={styles.empty}>{t("empty")}</p>;
  }

  return (
    <div className={styles.wrap}>
      {initialParts.map((part) => (
        <PromptCard key={part.id} part={part} />
      ))}
    </div>
  );
}
