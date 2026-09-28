import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth";
import { listPromptParts } from "@/lib/actions/prompts";
import { getGenerationModel } from "@/lib/actions/settings";
import { listCuratedModels, MODEL_ID, OCR_MODEL_ID } from "@/lib/ai/model";

import SettingsClient from "./SettingsClient";
import PromptPartsEditor from "./PromptPartsEditor";
import styles from "./Settings.module.css";

/** Live admin data — never prerender or cache. */
export const dynamic = "force-dynamic";

/**
 * Admin AI Studio Settings page.
 *
 * The one place the generation model and the prompts are changed. Both used to
 * sit inside the generation and batch flows, where they invited accidental
 * change on the everyday path; the routes now resolve them server-side and
 * accept neither from the client.
 *
 * Server side: gate with requireAdmin, load the curated model list, the stored
 * model setting, and the prompt parts, then hand them to the clients.
 */
export default async function AdminSettingsPage() {
  await requireAdmin();
  const t = await getTranslations("lpManage.settings");

  const [models, promptResult, modelResult] = await Promise.all([
    listCuratedModels(),
    listPromptParts(),
    getGenerationModel(),
  ]);

  const parts = promptResult.parts ?? [];
  // No stored setting → generation falls back to AI_MODEL_ID / the built-in
  // default, so show that as the current value rather than an empty picker.
  const currentModelId = modelResult.modelId ?? MODEL_ID;

  return (
    <div className={styles.wrap}>
      <div>
        <h1>{t("heading")}</h1>
        <p className={styles.hint}>{t("subtitle")}</p>
      </div>

      <div className={styles.warning} role="alert">
        <div className={styles.warningTitle}>{t("warningTitle")}</div>
        {t("warningBody")}
      </div>

      {!promptResult.ok || !modelResult.ok ? (
        <p className={styles.error}>{t("errorGeneric")}</p>
      ) : null}

      <SettingsClient
        models={models}
        currentModelId={currentModelId}
        ocrModelId={OCR_MODEL_ID}
      />

      <div>
        <h2 className={styles.sectionTitle}>{t("promptsHeading")}</h2>
        <p className={styles.hint}>{t("promptsSubtitle")}</p>
      </div>

      <PromptPartsEditor initialParts={parts} />
    </div>
  );
}
