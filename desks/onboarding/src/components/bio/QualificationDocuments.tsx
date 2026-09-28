"use client";

/**
 * QualificationDocuments — the certificate upload bucket shown inside the
 * Qualifications & education section of the bio form.
 *
 * Uploads/removes run through their own server actions
 * (`@/lib/actions/bio-documents`), independent of the bio form's save cycle, so
 * a file persists across form edits. Files attach at the profile level (not to
 * a specific qualification row) because the bio save deletes-and-reinserts those
 * rows on every save.
 *
 * Until the member has saved their bio once (which captures consent and creates
 * the profile row uploads attach to), the uploader is disabled with a hint.
 */
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  deleteBioDocumentAction,
  uploadBioDocumentAction,
  type UploadDocResult,
} from "@/lib/actions/bio-documents";
import type { BioDocumentView } from "@/lib/db/queries/bio-documents";

/** Accept attribute mirrors BIO_DOCUMENT_EXTENSIONS (documents & images). */
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx";

type UploadErrorCode = Extract<UploadDocResult, { ok: false }>["code"];

const C = {
  border: "#dee2e6",
  muted: "#6c757d",
  danger: "#dc3545",
  primary: "#0d6efd",
  bgSubtle: "#f8f9fa",
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  initialDocuments: BioDocumentView[];
}

export default function QualificationDocuments({
  initialDocuments,
}: Props) {
  const t = useTranslations("bio");
  const [docs, setDocs] = useState<BioDocumentView[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function uploadErrorMessage(code: UploadErrorCode): string {
    switch (code) {
      case "noFile":
        return t("documents.errors.noFile");
      case "tooLarge":
        return t("documents.errors.tooLarge");
      case "unsupportedType":
        return t("documents.errors.unsupportedType");
      case "profileRequired":
        return t("documents.errors.profileRequired");
      case "unauthenticated":
        return t("errors.unauthenticated");
      default:
        return t("documents.errors.failed");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadBioDocumentAction(formData);
      if (result.ok) {
        setDocs((prev) => [...prev, result.document]);
      } else {
        setError(uploadErrorMessage(result.code));
      }
      // Reset the input so re-selecting the same file fires onChange again.
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteBioDocumentAction(id);
      if (result.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      } else {
        setError(t("documents.errors.failed"));
      }
    });
  }

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px dashed ${C.border}`,
      }}
    >
      <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px" }}>
        {t("documents.title")}
      </h3>
      <p style={{ color: C.muted, fontSize: "0.875rem", margin: "0 0 12px" }}>
        {t("documents.help")}
      </p>

      {docs.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 12px",
            padding: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {docs.map((d) => (
            <li
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                background: C.bgSubtle,
              }}
            >
              <a
                href={`/api/bio/documents/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.primary, fontWeight: 600, wordBreak: "break-all" }}
              >
                {d.originalName}
              </a>
              {d.fileSizeBytes != null && (
                <span style={{ color: C.muted, fontSize: "0.8rem" }}>
                  {formatSize(d.fileSizeBytes)}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(d.id)}
                disabled={isPending}
                style={{
                  marginLeft: "auto",
                  border: `1px solid ${C.danger}`,
                  color: C.danger,
                  background: "transparent",
                  borderRadius: 6,
                  padding: "6px 12px",
                  minHeight: 36,
                  cursor: isPending ? "default" : "pointer",
                  fontSize: "0.85rem",
                }}
              >
                {t("documents.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label
          htmlFor="qual-doc-upload"
          style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
        >
          {t("documents.addLabel")}
        </label>
        <input
          ref={inputRef}
          id="qual-doc-upload"
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          disabled={isPending}
          aria-describedby="qual-doc-help"
          style={{ display: "block", fontSize: "0.95rem" }}
        />
        <p
          id="qual-doc-help"
          style={{ color: C.muted, fontSize: "0.8rem", margin: "6px 0 0" }}
        >
          {t("documents.accept")}
        </p>
        {isPending && (
          <p style={{ color: C.muted, fontSize: "0.85rem", margin: "8px 0 0" }}>
            {t("documents.working")}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" style={{ color: C.danger, fontSize: "0.875rem", margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
