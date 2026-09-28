"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createYoutubeMaterialAction, type ActionResult } from "@/lib/actions/admin";
import type { UploadItemOption } from "./MaterialUploadForm";
import styles from "./admin.module.css";

export default function YoutubeForm({
  items,
  onDone,
}: {
  items: UploadItemOption[];
  onDone?: () => void;
}) {
  const t = useTranslations("admin");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult<{ id: string }> | null>(null);

  if (items.length === 0) {
    return <p className={styles.muted}>{t("materials.noItems")}</p>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setResult(null);
    const res = await createYoutubeMaterialAction({
      youtubeUrl: data.get("youtubeUrl") as string,
      sectionItemId: data.get("sectionItemId") as string,
      language: (data.get("language") as "en" | "sw" | "none") ?? "none",
    });
    setResult(res);
    if (res.ok && onDone) onDone();
    setPending(false);
  }

  const fieldErrors = result && !result.ok ? (result.error.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {result && !result.ok && (
        <p className={styles.formError}>{result.error.message}</p>
      )}
      {result && result.ok && (
        <p className={styles.formSuccess}>{t("materials.uploaded")}</p>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="yt-url">
          YouTube URL
        </label>
        <input
          id="yt-url"
          name="youtubeUrl"
          type="url"
          className={styles.input}
          placeholder="https://www.youtube.com/watch?v=..."
          required
        />
        {fieldErrors["youtubeUrl"] && (
          <span className={styles.fieldError}>Enter a valid YouTube URL.</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="yt-item">
          {t("materials.fields.sectionItem")}
        </label>
        <select
          id="yt-item"
          name="sectionItemId"
          className={styles.select}
          required
          defaultValue=""
        >
          <option value="" disabled>—</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sectionTitleEn} · {item.titleEn}
            </option>
          ))}
        </select>
        {fieldErrors["sectionItemId"] && (
          <span className={styles.fieldError}>{t("materials.errors.noItem")}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="yt-language">
          {t("materials.fields.language")}
        </label>
        <select id="yt-language" name="language" className={styles.select} defaultValue="none">
          <option value="none">{t("materials.languageOptions.none")}</option>
          <option value="en">{t("materials.languageOptions.en")}</option>
          <option value="sw">{t("materials.languageOptions.sw")}</option>
        </select>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? t("common.uploading") : "Add YouTube Video"}
        </button>
      </div>
    </form>
  );
}
