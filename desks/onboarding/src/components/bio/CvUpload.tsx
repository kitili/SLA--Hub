"use client";

import { useRef, useState, useTransition } from "react";

import {
  deleteBioDocumentAction,
  uploadCvDocumentAction,
  type UploadDocResult,
} from "@/lib/actions/bio-documents";
import type { BioDocumentView } from "@/lib/db/queries/bio-documents";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.doc";

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

export default function CvUpload({ initialDocuments }: Props) {
  const [docs, setDocs] = useState<BioDocumentView[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // One hidden file input per existing doc for Replace
  const replaceRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  function uploadErrorMessage(code: UploadErrorCode): string {
    switch (code) {
      case "noFile": return "No file selected.";
      case "tooLarge": return "File is too large (max 500 MB).";
      case "unsupportedType": return "File type not supported. Use PDF, Word, or image files.";
      case "profileRequired": return "Save your bio profile first before uploading files.";
      case "unauthenticated": return "You are not signed in.";
      default: return "Upload failed. Please try again.";
    }
  }

  async function performUpload(file: File): Promise<UploadDocResult> {
    const formData = new FormData();
    formData.append("file", file);
    return uploadCvDocumentAction(formData);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await performUpload(file);
        if (result.ok) {
          setDocs((prev) => [...prev, result.document]);
        } else {
          setError(uploadErrorMessage(result.code));
        }
      } catch {
        setError("Upload failed. Please try again.");
      }
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
        setError("Failed to remove file.");
      }
    });
  }

  function onReplaceFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    docId: string,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setReplacingId(docId);
    startTransition(async () => {
      try {
        // Upload first, then delete the old one. This avoids losing the prior
        // file if the replacement upload fails (network/Blob hiccups).
        const uploadResult = await performUpload(file);
        if (uploadResult.ok) {
          setDocs((prev) => [
            ...prev.filter((d) => d.id !== docId),
            uploadResult.document,
          ]);
          const deleteResult = await deleteBioDocumentAction(docId);
          if (!deleteResult.ok) {
            setError("Replaced, but failed to remove the old file.");
          }
        } else {
          setError(uploadErrorMessage(uploadResult.code));
        }
      } catch {
        setError("Replace failed. Please try again.");
      } finally {
        setReplacingId(null);
        const ref = replaceRefs.current.get(docId);
        if (ref) ref.value = "";
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
        Curriculum Vitae (CV)
      </h3>
      <p style={{ color: C.muted, fontSize: "0.875rem", margin: "0 0 12px" }}>
        Upload your CV or résumé. PDF and Word documents are preferred.
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

              {/* Replace button */}
              <label
                style={{
                  marginLeft: "auto",
                  border: "1px solid #0d6efd",
                  color: "#0d6efd",
                  background: "transparent",
                  borderRadius: 6,
                  padding: "6px 12px",
                  minHeight: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  cursor: isPending ? "default" : "pointer",
                  fontSize: "0.85rem",
                  opacity: isPending ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {replacingId === d.id ? "Replacing…" : "Replace"}
                <input
                  type="file"
                  accept={ACCEPT}
                  disabled={isPending}
                  style={{ display: "none" }}
                  ref={(el) => {
                    if (el) replaceRefs.current.set(d.id, el);
                    else replaceRefs.current.delete(d.id);
                  }}
                  onChange={(e) => onReplaceFileChange(e, d.id)}
                />
              </label>

              <button
                type="button"
                onClick={() => onRemove(d.id)}
                disabled={isPending}
                style={{
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
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label
          htmlFor="cv-upload"
          style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
        >
          Upload CV file
        </label>
        <input
          ref={inputRef}
          id="cv-upload"
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          disabled={isPending}
          aria-describedby="cv-upload-help"
          style={{ display: "block", fontSize: "0.95rem", maxWidth: "100%" }}
        />
        <p
          id="cv-upload-help"
          style={{ color: C.muted, fontSize: "0.8rem", margin: "6px 0 0" }}
        >
          Accepted: PDF, Word (.doc/.docx), PNG, JPG
        </p>
        {isPending && replacingId === null && (
          <p style={{ color: C.muted, fontSize: "0.85rem", margin: "8px 0 0" }}>
            Uploading…
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
