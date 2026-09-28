"use client";

/**
 * SettingsClient — the generation-model picker on the AI Studio Settings tab.
 *
 * The picker offers the curated, structured-output-capable shortlist only:
 * `generateObject`/`streamObject` need structured output, so an arbitrary slug
 * would fail every generation. `setGenerationModel` re-checks the slug
 * server-side — this list is a convenience, not the guard.
 *
 * Saving takes effect for every subsequent generation (single and batch), which
 * is what the warning above this panel is about.
 */
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import type { OpenRouterModel } from "@/lib/ai/model";
import { setGenerationModel } from "@/lib/actions/settings";

import styles from "./Settings.module.css";

function priceLabel(perToken: number): string {
  if (!perToken) return "free";
  // OpenRouter reports USD per token; show per-million for readability.
  const perM = perToken * 1_000_000;
  return `$${perM.toFixed(2)}/M`;
}

export default function SettingsClient({
  models,
  currentModelId,
  ocrModelId,
}: {
  models: OpenRouterModel[];
  /** The model generation will use right now (stored setting, or the default). */
  currentModelId: string;
  ocrModelId: string;
}) {
  const t = useTranslations("lpManage.settings");
  const router = useRouter();
  const [selected, setSelected] = useState(currentModelId);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = models.find((m) => m.id === selected);
  const dirty = selected !== currentModelId;

  function handleSave() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const result = await setGenerationModel(selected);
      if (result.ok) {
        setMsg(t("modelSaved"));
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t("modelHeading")}</h2>

      <label className={styles.label} htmlFor="settings-model">
        {t("generationModel")}
      </label>
      {models.length === 0 ? (
        <p className={styles.muted}>{t("noModels")}</p>
      ) : (
        <select
          id="settings-model"
          className={styles.select}
          value={selected}
          disabled={pending}
          onChange={(e) => setSelected(e.target.value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {Math.round(m.contextLength / 1000)}k ·{" "}
              {priceLabel(m.promptPrice)}
            </option>
          ))}
        </select>
      )}

      {selectedModel && (
        <div className={styles.modelMeta}>
          <span className={styles.modelTag}>
            {t("context", { k: Math.round(selectedModel.contextLength / 1000) })}
          </span>
          <span className={styles.modelTag}>
            {t("prompt")}: {priceLabel(selectedModel.promptPrice)}
          </span>
          <span className={styles.modelTag}>
            {t("completion")}: {priceLabel(selectedModel.completionPrice)}
          </span>
        </div>
      )}

      <p className={styles.hint}>{t("structuredOnly")}</p>
      <p className={styles.muted}>{t("ocrNote", { model: ocrModelId })}</p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {msg ? <p className={styles.success}>{msg}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={pending || !dirty || models.length === 0}
        >
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
