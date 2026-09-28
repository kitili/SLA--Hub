import "server-only";

/**
 * Storage factory — picks the adapter by environment.
 *
 *   - `BLOB_READ_WRITE_TOKEN` set → VercelBlobStorage (prod)
 *   - otherwise                   → LocalFileStorage (dev / no token)
 *
 * Use `getStorage()` everywhere; it caches a single adapter instance.
 */
import { LocalFileStorage } from "./local";
import type { MaterialStorage } from "./types";
import { BLOB_TOKEN_ENV, VercelBlobStorage } from "./vercel-blob";

export type { MaterialStorage, UploadInput, UploadResult } from "./types";
export { LocalFileStorage, resolveLocalPath } from "./local";
export { VercelBlobStorage } from "./vercel-blob";

let cached: MaterialStorage | undefined;

/** Which backend the factory will use, given current env. */
export function storageBackend(): "vercel-blob" | "local" {
  return process.env[BLOB_TOKEN_ENV] ? "vercel-blob" : "local";
}

/** Construct (or reuse) the active storage adapter. */
export function getStorage(): MaterialStorage {
  if (!cached) {
    cached =
      storageBackend() === "vercel-blob"
        ? new VercelBlobStorage()
        : new LocalFileStorage();
  }
  return cached;
}
