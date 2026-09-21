import "server-only";

/**
 * Local-filesystem storage adapter — the default when no Blob token is set.
 *
 * Writes uploaded bytes under a gitignored `.storage/` directory and serves
 * them via a stable key. Keys are URL-safe and contain no path separators or
 * `..`, so `resolveLocalPath` can never escape the storage root.
 *
 * Serving: `getUrl(key)` returns an app-routable path under
 * `LOCAL_SERVE_BASE_PATH` (default `/api/materials/<key>`). A route handler
 * (owned by the app layer) can stream the file by calling `resolveLocalPath`.
 * The key→path mapping is purely the filename under the storage root.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MaterialStorage, UploadInput, UploadResult } from "./types";

/** Gitignored directory holding local uploads. */
export const LOCAL_STORAGE_DIR = ".storage";

/** URL prefix the app uses to serve local files. */
export const LOCAL_SERVE_BASE_PATH = "/api/materials";

/** Absolute path to the storage root. */
function storageRoot(): string {
  return path.resolve(process.cwd(), LOCAL_STORAGE_DIR);
}

/**
 * Turn a key into an absolute on-disk path, guaranteed to stay inside the
 * storage root. Throws on traversal attempts.
 */
export function resolveLocalPath(key: string): string {
  const root = storageRoot();
  const full = path.resolve(root, key);
  if (full !== path.join(root, path.basename(full))) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return full;
}

/** Build a collision-resistant, filesystem-safe key from a filename. */
function makeKey(filename: string): string {
  const base = path.basename(filename);
  const ext = path.extname(base).toLowerCase();
  const stem = base
    .slice(0, base.length - ext.length)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${Date.now()}-${randomUUID()}-${stem}${safeExt}`;
}

export class LocalFileStorage implements MaterialStorage {
  async upload(file: UploadInput): Promise<UploadResult> {
    const key = makeKey(file.filename);
    const dest = resolveLocalPath(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, file.data);
    return { key, url: await this.getUrl(key) };
  }

  async getUrl(key: string): Promise<string> {
    return `${LOCAL_SERVE_BASE_PATH}/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    const target = resolveLocalPath(key);
    // Idempotent: ignore "missing file".
    await rm(target, { force: true });
  }

  /** Whether a key currently exists on disk (handy for serving routes/tests). */
  async exists(key: string): Promise<boolean> {
    try {
      await stat(resolveLocalPath(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Read raw bytes for a key; returns null if the file does not exist. */
  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolveLocalPath(key));
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return null;
      }
      throw err;
    }
  }
}
