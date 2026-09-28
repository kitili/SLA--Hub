import "server-only";

import { createReadStream } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import path from "node:path";

const LEGACY_DOCUMENTS_DIR = "documents";

function documentsRoot(): string {
  return path.resolve(process.cwd(), LEGACY_DOCUMENTS_DIR);
}

function resolveLegacyDocumentPath(key: string): string {
  const root = documentsRoot();
  const full = path.resolve(root, key);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Invalid legacy document key: ${key}`);
  }
  return full;
}

export async function legacyDocumentExists(key: string): Promise<boolean> {
  try {
    const s = await stat(resolveLegacyDocumentPath(key));
    return s.isFile();
  } catch {
    return false;
  }
}

export async function statLegacyDocument(
  key: string,
): Promise<{ size: number; path: string } | null> {
  try {
    const full = resolveLegacyDocumentPath(key);
    const s = await stat(full);
    if (!s.isFile()) return null;
    return { size: s.size, path: full };
  } catch {
    return null;
  }
}

export async function readLegacyDocument(key: string): Promise<Buffer | null> {
  try {
    if (!(await legacyDocumentExists(key))) return null;
    return readFile(resolveLegacyDocumentPath(key));
  } catch {
    return null;
  }
}

/** Read a byte range without loading the whole file into memory. */
export async function readLegacyDocumentRange(
  key: string,
  start: number,
  end: number,
): Promise<Buffer | null> {
  try {
    const info = await statLegacyDocument(key);
    if (!info) return null;
    const length = end - start + 1;
    if (length <= 0 || start < 0 || end >= info.size) return null;
    const fh = await open(info.path, "r");
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, start);
      return bytesRead === length ? buf : buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}

/** Stream a legacy document (optionally a byte range) for progressive video. */
export function streamLegacyDocument(
  absolutePath: string,
  start?: number,
  end?: number,
): Readable {
  if (start !== undefined && end !== undefined) {
    return createReadStream(absolutePath, { start, end });
  }
  return createReadStream(absolutePath);
}
