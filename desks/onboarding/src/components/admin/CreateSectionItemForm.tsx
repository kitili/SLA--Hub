"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  createSectionItemAction,
  type ActionResult,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

const ITEM_TYPES = ["pdf", "docx", "video", "image", "pptx", "link"] as const;

/**
 * Form to add a learning item to an existing section. Item id is optional —
 * the server auto-assigns e.g. `1-8` when left blank.
 */
export default function CreateSectionItemForm({
  sectionId,
  onDone,
}: {
  sectionId: string;
  onDone?: () => void;
}) {
  const t = useTranslations("admin");
  const router = useRouter();

  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | undefined,
    FormData
  >(async (prev, formData) => {
    const result = await createSectionItemAction(prev, formData);
    if (result.ok) {
      onDone?.();
      router.refresh();
    }
    return result;
  }, undefined);

  const fieldErrors =
    state && !state.ok ? (state.error.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="sectionId" value={sectionId} />

      {state && !state.ok && (
        <p className={styles.formError}>{state.error.message}</p>
      )}
      {state && state.ok && (
        <p className={styles.formSuccess}>
          {t("sections.items.created", { id: state.data.id })}
        </p>
      )}

      <div className={styles.bilingual}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-title-en">
            {t("sections.items.fields.titleEn")}
          </label>
          <input
            id="item-title-en"
            name="title_en"
            className={styles.input}
            placeholder={t("sections.items.fields.titlePlaceholder")}
            required
            maxLength={255}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-title-sw">
            {t("sections.items.fields.titleSw")}{" "}
            <span className={styles.hint}>({t("common.optional")})</span>
          </label>
          <input
            id="item-title-sw"
            name="title_sw"
            className={styles.input}
            maxLength={255}
          />
        </div>
      </div>

      <div className={styles.bilingual}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-note-en">
            {t("sections.items.fields.noteEn")}{" "}
            <span className={styles.hint}>({t("common.optional")})</span>
          </label>
          <textarea
            id="item-note-en"
            name="note_en"
            className={styles.textarea}
            rows={3}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-note-sw">
            {t("sections.items.fields.noteSw")}{" "}
            <span className={styles.hint}>({t("common.optional")})</span>
          </label>
          <textarea
            id="item-note-sw"
            name="note_sw"
            className={styles.textarea}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.bilingual}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-type">
            {t("sections.items.fields.type")}
          </label>
          <select
            id="item-type"
            name="type"
            className={styles.input}
            defaultValue="pdf"
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`sections.items.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-id">
            {t("sections.items.fields.id")}{" "}
            <span className={styles.hint}>({t("common.optional")})</span>
          </label>
          <input
            id="item-id"
            name="id"
            className={styles.input}
            placeholder={t("sections.items.fields.idPlaceholder")}
            maxLength={50}
          />
          <span className={styles.hint}>{t("sections.items.fields.idHint")}</span>
          {fieldErrors["id"] && (
            <span className={styles.fieldError}>
              {t("sections.items.errors.idTaken")}
            </span>
          )}
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? t("common.saving") : t("sections.items.create")}
        </button>
      </div>
    </form>
  );
}
