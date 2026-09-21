"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteBioDocumentAction,
  uploadQualDocumentAction,
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

function errorMessage(code: UploadErrorCode): string {
  switch (code) {
    case "noFile": return "No file selected.";
    case "tooLarge": return "File is too large.";
    case "unsupportedType": return "Unsupported file type. Use PDF, Word, or image files.";
    case "profileRequired": return "Save your bio profile first before uploading files.";
    case "unauthenticated": return "You are not signed in.";
    default: return "Upload failed. Please try again.";
  }
}

interface Props {
  /** Position of this qualification in the list (0-based). */
  qualIndex: number;
  initialDocuments: BioDocumentView[];
}

export default function QualDocUpload({ qualIndex, initialDocuments }: Props) {
  const [docs, setDocs] = useState<BioDocumentView[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // One hidden file input per existing doc for Replace
  const replaceRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const inputId = `qual-doc-${qualIndex}`;

  async function performUpload(file: File): Promise<UploadDocResult> {
    const formData = new FormData();
    formData.append("file", file);
    return uploadQualDocumentAction(formData, qualIndex);
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
          setError(errorMessage(result.code));
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
          setError(errorMessage(uploadResult.code));
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
    <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
      <p style={{ fontWeight: 600, fontSize: "0.85rem", margin: "0 0 6px", color: "#333" }}>
        Attach certificate
      </p>

      {docs.length > 0 && (
        <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((d) => (
            <li
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                background: C.bgSubtle,
                fontSize: "0.85rem",
              }}
            >
              <a
                href={`/api/bio/documents/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.primary, fontWeight: 600, wordBreak: "break-all", flexGrow: 1 }}
              >
                {d.originalName}
              </a>
              {d.fileSizeBytes != null && (
                <span style={{ color: C.muted, whiteSpace: "nowrap" }}>
                  {formatSize(d.fileSizeBytes)}
                </span>
              )}

              {/* Replace button */}
              <label
                style={{
                  border: "1px solid #0d6efd",
                  color: "#0d6efd",
                  background: "transparent",
                  borderRadius: 4,
                  padding: "3px 8px",
                  cursor: isPending ? "default" : "pointer",
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                  opacity: isPending ? 0.6 : 1,
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
                  borderRadius: 4,
                  padding: "3px 8px",
                  cursor: isPending ? "default" : "pointer",
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label
          htmlFor={inputId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "#e7f1ff",
            color: "#0b5ed7",
            border: "1px solid #b6d4fe",
            borderRadius: 6,
            cursor: isPending ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending && replacingId === null ? "Uploading…" : "+ Attach file"}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            onChange={onFileChange}
            disabled={isPending}
            style={{ display: "none" }}
          />
        </label>
        <span style={{ color: C.muted, fontSize: "0.78rem" }}>PDF, Word, image</span>
      </div>

      {error && (
        <p role="alert" style={{ color: C.danger, fontSize: "0.8rem", margin: "6px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
