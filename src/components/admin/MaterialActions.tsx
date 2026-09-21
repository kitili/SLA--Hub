"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
  deleteMaterialAction,
  replaceMaterialAction,
  replaceYoutubeMaterialAction,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function MaterialActions({
  materialId,
  isYoutube = false,
}: {
  materialId: string;
  isYoutube?: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File update state
  const [updating, setUpdating] = useState(false);
  const [staged, setStaged] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // YouTube edit state
  const [editingLink, setEditingLink] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    setStaged(e.target.files?.[0] ?? null);
    setError(null);
  }

  function openPreview() {
    if (!staged) return;
    const objectUrl = URL.createObjectURL(staged);
    window.open(objectUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  function cancelUpdate() {
    setUpdating(false);
    setStaged(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmUpload() {
    if (!staged || busy) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", staged);
      // replaceMaterialAction(materialId, _prev, formData) — pass undefined for _prev
      const result = await replaceMaterialAction(materialId, undefined, fd);
      if (!result.ok) {
        setError(result.error.message);
      } else {
        cancelUpdate();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveYoutubeLink() {
    if (!linkInput.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await replaceYoutubeMaterialAction(materialId, linkInput.trim());
      if (!result.ok) {
        setError(result.error.message);
      } else {
        setEditingLink(false);
        setLinkInput("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setError(null);
    setBusy(true);
    try {
      const result = await deleteMaterialAction(materialId);
      if (!result.ok) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ── YouTube edit UI ────────────────────────────────────────────────────────
  if (isYoutube) {
    return (
      <div className={styles.actions}>
        {editingLink ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "220px" }}>
            <input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={styles.input}
              style={{ fontSize: "0.82rem", padding: "0.3rem 0.5rem" }}
              disabled={busy}
              autoFocus
            />
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={busy || !linkInput.trim()}
                onClick={onSaveYoutubeLink}
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                disabled={busy}
                onClick={() => { setEditingLink(false); setLinkInput(""); setError(null); }}
              >
                Cancel
              </button>
            </div>
            {error && <span className={styles.fieldError}>{error}</span>}
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
              disabled={busy}
              onClick={() => setEditingLink(true)}
            >
              Edit link
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
              disabled={busy}
              onClick={onDelete}
            >
              {t("common.delete")}
            </button>
          </>
        )}
        {error && !editingLink && <span className={styles.fieldError}>{error}</span>}
      </div>
    );
  }

  // ── File update panel ──────────────────────────────────────────────────────
  if (updating) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "240px" }}>
        {staged ? (
          <div style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: "6px",
            padding: "0.5rem 0.65rem",
            fontSize: "0.82rem",
          }}>
            <p style={{ fontWeight: 700, color: "#0369a1", margin: "0 0 0.15rem", wordBreak: "break-all" }}>
              {staged.name}
            </p>
            <p style={{ color: "#64748b", margin: 0 }}>{formatBytes(staged.size)}</p>
          </div>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
            Choose a file to replace this document.
          </p>
        )}

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Choose file
          </button>

          {staged && !busy && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
              onClick={openPreview}
            >
              Preview
            </button>
          )}

          {staged && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall}`}
              disabled={busy}
              onClick={confirmUpload}
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
          )}

          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
            disabled={busy}
            onClick={cancelUpdate}
          >
            Cancel
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={onFileChosen}
          aria-hidden="true"
        />
        {error && <span className={styles.fieldError}>{error}</span>}
      </div>
    );
  }

  // ── Default (collapsed) ────────────────────────────────────────────────────
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
        disabled={busy}
        onClick={() => setUpdating(true)}
      >
        {t("common.replace")}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
        disabled={busy}
        onClick={onDelete}
      >
        {t("common.delete")}
      </button>
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}
