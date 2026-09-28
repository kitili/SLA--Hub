/**
 * Storage contract — abstracts where uploaded file bytes live.
 *
 * Two adapters implement this (see docs/materials.md):
 *   - LocalFileStorage (dev / no Blob token): writes under `.storage/`.
 *   - VercelBlobStorage (prod): backed by Vercel Blob.
 *
 * There is no file-metadata table; consumers persist the returned `key` on
 * their own rows (e.g. `textbooks.file_key`) and read bytes back via `read`.
 *
 * NOTE: this module is intentionally NOT `server-only`-marked so the type can be
 * imported anywhere, but the adapters and factory are server-only.
 */

/** A file to upload, in a runtime-portable shape (no web `File` dependency). */
export interface UploadInput {
  /** Original filename, e.g. "handbook.pdf". */
  filename: string;
  /** MIME type, e.g. "application/pdf". */
  contentType: string;
  /** File contents. */
  data: Buffer | Uint8Array;
}

/** The result of a successful upload. */
export interface UploadResult {
  /** Opaque storage key; pass back to `read`/`getUrl`/`delete`. Persist this. */
  key: string;
  /**
   * A URL the app could use to fetch the file. Currently unused — the local
   * adapter's `/api/materials/<key>` URLs have no serving route yet (see
   * docs/materials.md).
   */
  url: string;
}

/** Pluggable file storage backend. */
export interface MaterialStorage {
  /** Store the bytes; return its key and a fetch URL. */
  upload(file: UploadInput): Promise<UploadResult>;
  /** Resolve a fetch URL for a previously-uploaded key. */
  getUrl(key: string): Promise<string>;
  /** Remove the stored object for a key (idempotent). */
  delete(key: string): Promise<void>;
  /**
   * Read the raw bytes for a key so the serve route can stream them.
   * Returns `null` if the key does not exist.
   */
  read(key: string): Promise<Buffer | null>;
}
