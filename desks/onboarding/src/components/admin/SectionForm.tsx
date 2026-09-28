"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  createSectionAction,
  updateSectionAction,
  type ActionResult,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

export interface SectionFormValues {
  id: string;
  icon: string | null;
  title_en: string;
  title_sw: string | null;
  description_en: string | null;
  description_sw: string | null;
}

/**
 * Create / edit a section. Bilingual EN/SW inputs side-by-side; empty SW is
 * flagged "translation pending". Submits via the matching server action with
 * React 19 `useActionState`.
 */
const EMOJI_SUGGESTIONS = [
  "📚","📖","📝","📋","📄","🗒️","🎓","🏫","🎒","🏆",
  "🏅","⭐","✅","💼","🏢","👥","🤝","💬","📢","🔒",
  "🔑","🛡️","⚠️","💡","🔧","🔍","📊","📈","💻","🎯",
  "🌍","🌿","✨","❤️","🚀","🧩","🏷️","📌","🗂️","⚙️",
];

export default function SectionForm({
  mode,
  initial,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: SectionFormValues;
  onDone?: () => void;
}) {
  const t = useTranslations("admin");
  const action = mode === "create" ? createSectionAction : updateSectionAction;
  const [icon, setIcon] = useState(initial?.icon ?? "");

  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | undefined,
    FormData
  >(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.ok && onDone) onDone();
    return result;
  }, undefined);

  const fieldErrors =
    state && !state.ok ? (state.error.fieldErrors ?? {}) : {};

  const swTitleEmpty = !initial?.title_sw;

  return (
    <form action={formAction} className={styles.form}>
      {mode === "edit" && (
        <input type="hidden" name="id" value={initial?.id ?? ""} />
      )}

      {state && !state.ok && (
        <p className={styles.formError}>{state.error.message}</p>
      )}
      {state && state.ok && (
        <p className={styles.formSuccess}>
          {mode === "create" ? t("sections.created") : t("sections.updated")}
        </p>
      )}

      {mode === "create" && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="section-id">
            {t("sections.fields.id")}
          </label>
          <input
            id="section-id"
            name="id"
            className={styles.input}
            placeholder="health-safety"
            defaultValue={initial?.id ?? ""}
            required
          />
          <span className={styles.hint}>{t("sections.fields.idHint")}</span>
          {fieldErrors["id"] && (
            <span className={styles.fieldError}>
              {t("sections.errors.idTaken")}
            </span>
          )}
        </div>
      )}

      {/* ── Icon picker ─────────────────────────────────────────── */}
      <div className={styles.field}>
        <label className={styles.label}>
          {t("sections.fields.icon")}{" "}
          <span className={styles.hint}>({t("common.optional")})</span>
        </label>

        {/* Hidden input carries the value to the server action */}
        <input type="hidden" name="icon" value={icon} />

        <div className={styles.iconPickerRow}>
          {/* Live preview */}
          <div className={styles.iconPreview}>
            {icon || <span className={styles.iconPlaceholder}>?</span>}
          </div>

          {/* Custom text input */}
          <input
            id="section-icon"
            className={`${styles.input} ${styles.iconInput}`}
            placeholder="Paste or type an emoji…"
            value={icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 8))}
            maxLength={8}
          />

          {/* Clear button */}
          {icon && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
              onClick={() => setIcon("")}
            >
              Remove
            </button>
          )}
        </div>

        {/* Quick-pick grid */}
        <div className={styles.emojiGrid}>
          {EMOJI_SUGGESTIONS.map((e) => (
            <button
              key={e}
              type="button"
              className={`${styles.emojiBtn} ${icon === e ? styles.emojiBtnActive : ""}`}
              onClick={() => setIcon(e)}
              title={e}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.bilingual}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="section-title-en">
            {t("sections.fields.titleEn")}
          </label>
          <input
            id="section-title-en"
            name="title_en"
            className={styles.input}
            defaultValue={initial?.title_en ?? ""}
            required
          />
          {fieldErrors["title_en"] && (
            <span className={styles.fieldError}>{t("errors.validation")}</span>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="section-title-sw">
            {t("sections.fields.titleSw")}
            {swTitleEmpty && (
              <span className={styles.pendingTag}>
                {t("common.translationPending")}
              </span>
            )}
          </label>
          <input
            id="section-title-sw"
            name="title_sw"
            className={styles.input}
            defaultValue={initial?.title_sw ?? ""}
          />
        </div>
      </div>

      <div className={styles.bilingual}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="section-desc-en">
            {t("sections.fields.descriptionEn")}{" "}
            <span className={styles.hint}>({t("common.optional")})</span>
          </label>
          <textarea
            id="section-desc-en"
            name="description_en"
            className={styles.textarea}
            defaultValue={initial?.description_en ?? ""}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="section-desc-sw">
            {t("sections.fields.descriptionSw")}
            {!initial?.description_sw && initial?.description_en && (
              <span className={styles.pendingTag}>
                {t("common.translationPending")}
              </span>
            )}
          </label>
          <textarea
            id="section-desc-sw"
            name="description_sw"
            className={styles.textarea}
            defaultValue={initial?.description_sw ?? ""}
          />
        </div>
      </div>

      {mode === "create" && (
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="isPublished" value="true" defaultChecked />
          {t("common.publish")}
        </label>
      )}

      <div className={styles.formActions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending
            ? t("common.saving")
            : mode === "create"
              ? t("sections.create")
              : t("common.save")}
        </button>
      </div>
    </form>
  );
}
