/**
 * Upload validation — the single source of truth for which uploaded files we
 * accept and how big they may be. Shared by the admin materials actions and the
 * member bio-document actions so the (security-relevant) allowlist never drifts
 * between call sites.
 *
 * Not `server-only`: this is pure, dependency-free logic so it can be unit
 * tested directly. The adapters that actually touch bytes ARE server-only.
 */
import path from "node:path";

/** Largest admin CMS upload (videos). */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Qualification certificates / CV attached to a bio profile. */
export const MAX_BIO_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Hiring pipeline submissions (culture video, performance docs). */
export const MAX_HIRING_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Full onboarding-material allowlist (admin CMS uploads). Deliberately excludes
 * `.svg`, `.html`, `.htm`, `.xhtml` and other active types — an uploaded file is
 * served same-origin, so allowing those would create a stored-XSS vector.
 */
export const MATERIAL_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mp3",
  ".txt",
  ".docx",
  ".xlsx",
  ".pptx",
]);

/**
 * Narrower allowlist for member-uploaded qualification certificates: documents
 * and images only (no audio/video). Same XSS exclusions as above.
 */
export const BIO_DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".docx",
  ".xlsx",
  ".pptx",
]);

export const HIRING_DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".docx",
  ".xlsx",
  ".pptx",
]);

export const HIRING_VIDEO_EXTENSIONS: ReadonlySet<string> = new Set([
  ".mp4",
  ".webm",
  ".mov",
]);

/** MIME types that must never be stored even if the extension looks benign. */
export const FORBIDDEN_UPLOAD_MIME: ReadonlySet<string> = new Set([
  "text/html",
  "image/svg+xml",
  "application/xhtml+xml",
]);

/**
 * Return a field-error code when `file` is not acceptable, else `null`.
 *
 * @param file     the uploaded web File.
 * @param allowed  one of the extension allowlists above.
 * @param maxBytes optional size cap; oversize files return `"tooLarge"`.
 */
export function rejectionReason(
  file: File,
  allowed: ReadonlySet<string>,
  maxBytes?: number,
): string | null {
  const ext = path.extname(file.name).toLowerCase();
  if (!allowed.has(ext)) return "unsupportedType";
  // file.type is client-controlled, so it can't be trusted to *allow* a file,
  // but a forbidden type here means the extension and MIME disagree — reject.
  const mime = (file.type || "").split(";")[0]!.trim().toLowerCase();
  if (FORBIDDEN_UPLOAD_MIME.has(mime)) return "unsupportedType";
  if (maxBytes != null && file.size > maxBytes) return "tooLarge";
  return null;
}

/** Strip path segments and characters that break storage keys or headers. */
export function sanitizeUploadName(original: string): string {
  const base = path.basename(original).replace(/[\\/:*?"<>|#%\0]/g, "_");
  const trimmed = base.trim() || "upload";
  return trimmed.slice(0, 180);
}
