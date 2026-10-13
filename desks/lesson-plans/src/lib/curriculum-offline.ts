import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Server copy of the Academics Neon tables.
 *
 * A successful read is written under `.curriculum-cache/` (or the temp
 * directory on Vercel). A later request uses that copy when Neon cannot be
 * reached. A failed write never throws away a read that already succeeded.
 * The visitor's own offline copy is kept in the browser by the Academics
 * service worker; this file is only the server fallback.
 */

export type DataSource = "live" | "offline";

export type Loaded<T> = { data: T; source: DataSource };

function cacheDir(): string {
  if (process.env.CURRICULUM_CACHE_DIR) return process.env.CURRICULUM_CACHE_DIR;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "silverleaf-academics-cache");
  return path.join(process.cwd(), ".curriculum-cache");
}

export async function saveOffline(name: string, value: unknown): Promise<void> {
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, name);
  const tmp = `${dest}.tmp`;
  await writeFile(tmp, JSON.stringify(value));
  await rename(tmp, dest);
}

export async function readOffline<T>(name: string): Promise<T | null> {
  try {
    const text = await readFile(path.join(cacheDir(), name), "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function withOfflineCache<T>(
  name: string,
  live: (() => Promise<T>) | null,
  save: (data: T) => boolean = () => true,
): Promise<Loaded<T> | null> {
  if (live) {
    try {
      const data = await live();
      if (save(data)) {
        try {
          await saveOffline(name, data);
        } catch (error) {
          console.error("[offline-cache]", error instanceof Error ? error.name : "error");
        }
      }
      return { data, source: "live" };
    } catch (error) {
      const cached = await readOffline<T>(name);
      if (cached) return { data: cached, source: "offline" };
      throw error;
    }
  }
  const cached = await readOffline<T>(name);
  return cached ? { data: cached, source: "offline" } : null;
}
