/**
 * HTTP header helpers for streaming stored files back to the browser.
 *
 * Shared by every route that serves uploaded bytes (admin materials proxy and
 * the member bio-document proxy) so the XSS-safe Content-Disposition rules and
 * the extension→MIME map live in exactly one place.
 *
 * Not `server-only`: pure functions, importable from tests.
 */
import path from "node:path";

/** Minimal extension → MIME map covering the file types we accept. */
const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * Resolve the Content-Type from a name's extension. We intentionally derive the
 * type from the (server-known) extension rather than trusting a client-supplied
 * MIME string, so a spoofed `Content-Type` can never be echoed back.
 */
export function contentTypeForName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}

/**
 * Base content types we are willing to render INLINE in the browser. Anything
 * not on this list — most importantly `text/html` and `image/svg+xml`, which
 * can run script in our same-origin context — is served as an attachment so a
 * (hypothetically) malicious uploaded file downloads instead of executing.
 */
const INLINE_SAFE_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "text/plain",
]);

/**
 * Decide Content-Disposition: inline only for the render-safe allowlist;
 * everything else downloads. `downloadName` is the filename offered to the user
 * for attachments (sanitised to a safe charset).
 */
export function dispositionForType(
  mimeType: string,
  downloadName: string,
): string {
  const baseType = mimeType.split(";")[0]!.trim().toLowerCase();
  if (INLINE_SAFE_TYPES.has(baseType)) return "inline";
  const safeName =
    path.basename(downloadName).replace(/[^A-Za-z0-9._-]+/g, "_") || "download";
  return `attachment; filename="${safeName}"`;
}
