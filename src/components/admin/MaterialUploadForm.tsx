"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { useTranslations } from "next-intl";

import {
  registerMaterialAction,
  type ActionResult,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

export interface UploadItemOption {
  id: string;
  sectionTitleEn: string;
  titleEn: string;
}

/**
 * Upload a file and attach it to a section item.
 *
 * Large files (videos, etc.) are sent directly from the browser to Vercel Blob
 * via a client-side upload — no file bytes go through a serverless function,
 * so there is no 4.5 MB body-size limit.
 */
export default function MaterialUploadForm({
  items,
  onDone,
}: {
  items: UploadItemOption[];
  onDone?: () => void;
}) {
  const t = useTranslations("admin");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ActionResult<{ id: string }> | null>(null);

  if (items.length === 0) {
    return <p className={styles.muted}>{t("materials.noItems")}</p>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const file = formData.get("file") as File | null;
    const sectionItemId = formData.get("sectionItemId") as string;
    const language = (formData.get("language") as string) || "none";

    if (!file || file.size === 0) {
      setResult({ ok: false, error: { code: "VALIDATION_ERROR", message: t("materials.errors.noFile"), fieldErrors: { file: ["noFile"] } } });
      return;
    }

    setPending(true);
    setProgress(0);
    setResult(null);

    try {
      // Upload directly from browser to Vercel Blob — no size limit from server.
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/admin/blob-upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      // Register the blob URL + metadata in the DB via a lightweight server action.
      const res = await registerMaterialAction({
        blobUrl: blob.url,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        sectionItemId,
        language: language as "en" | "sw" | "none",
      });

      setResult(res);
      if (res.ok && onDone) onDone();
    } catch (err) {
      setResult({
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: err instanceof Error ? err.message : "Upload failed.",
        },
      });
    } finally {
      setPending(false);
      setProgress(0);
    }
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
        <label className={styles.label} htmlFor="material-file">
          {t("materials.fields.file")}
        </label>
        <input
          id="material-file"
          name="file"
          type="file"
          className={styles.input}
          required
        />
        {fieldErrors["file"] && (
          <span className={styles.fieldError}>
            {t("materials.errors.noFile")}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="material-item">
          {t("materials.fields.sectionItem")}
        </label>
        <select
          id="material-item"
          name="sectionItemId"
          className={styles.select}
          required
          defaultValue=""
        >
          <option value="" disabled>
            —
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sectionTitleEn} · {item.titleEn}
            </option>
          ))}
        </select>
        {fieldErrors["sectionItemId"] && (
          <span className={styles.fieldError}>
            {t("materials.errors.noItem")}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="material-language">
          {t("materials.fields.language")}
        </label>
        <select
          id="material-language"
          name="language"
          className={styles.select}
          defaultValue="none"
        >
          <option value="none">{t("materials.languageOptions.none")}</option>
          <option value="en">{t("materials.languageOptions.en")}</option>
          <option value="sw">{t("materials.languageOptions.sw")}</option>
        </select>
      </div>

      {pending && progress > 0 && (
        <p className={styles.muted}>
          {t("common.uploading")} {progress}%…
        </p>
      )}

      <div className={styles.formActions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? t("common.uploading") : t("materials.upload")}
        </button>
      </div>
    </form>
  );
}
