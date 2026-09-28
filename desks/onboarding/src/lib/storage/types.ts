/**
 * Storage contract — abstracts where uploaded file bytes live.
 *
 * Two adapters implement this:
 *   - LocalFileStorage (dev / no Blob token): writes under `.storage/`.
 *   - VercelBlobStorage (prod): backed by Vercel Blob (skeleton; see
 *     docs/materials.md).
 *
 * The `materials` table (src/lib/db/schema/materials.ts) stores the `key`/`url`
 * returned here alongside file metadata.
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
  /** Opaque storage key; pass back to `getUrl`/`delete`. Stored in `materials`. */
  key: string;
  /** A URL the app can use to fetch the file. Stored in `materials`. */
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
