import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local copy of the curriculum Neon tables.
 *
 * A successful read from the shared database is written under
 * `.curriculum-cache/`. Later visits use that copy when the machine is offline
 * or Neon cannot be reached. The lesson-plan database is left alone.
 */

export type DataSource = "live" | "offline";

export type Loaded<T> = { data: T; source: DataSource };

function cacheDir(): string {
  return process.env.CURRICULUM_CACHE_DIR || path.join(process.cwd(), ".curriculum-cache");
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
      if (save(data)) await saveOffline(name, data);
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
