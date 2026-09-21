import "server-only";

import fs from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "documents/hiring-uploads");

function containedPath(relativePath: string): string | null {
  if (!relativePath || relativePath.includes("\0") || path.isAbsolute(relativePath)) {
    return null;
  }
  const root = path.resolve(UPLOAD_ROOT);
  const full = path.resolve(root, relativePath);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return full;
}

export async function saveHiringUploadToDisk(
  relativePath: string,
  bytes: Buffer,
): Promise<string> {
  const full = containedPath(relativePath);
  if (!full) throw new Error("Invalid upload path");
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
  return relativePath;
}

export function hiringFilePublicUrl(relativePath: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const encoded = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/api/hiring/files/${encoded}`;
}

export function hiringUploadRoot(): string {
  return UPLOAD_ROOT;
}

export function resolveHiringDiskPath(relativePath: string): string | null {
  return containedPath(relativePath);
}

/** Store a hiring upload — Vercel Blob in production, local disk in dev. */
export async function storeHiringUpload(params: {
  relativePath: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`hiring/${params.relativePath}`, params.bytes, {
      access: "private",
      contentType: params.contentType,
      token,
    });
    return url;
  }

  await saveHiringUploadToDisk(params.relativePath, params.bytes);
  return hiringFilePublicUrl(params.relativePath);
}

export function isBlobStoredUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "blob.vercel-storage.com" ||
        parsed.hostname.endsWith(".blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

export async function readHiringUpload(storedUrl: string): Promise<Buffer | null> {
  if (isBlobStoredUrl(storedUrl)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return null;
    const { get } = await import("@vercel/blob");
    try {
      const result = await get(storedUrl, { access: "private", token });
      if (!result?.stream) return null;
      const reader = result.stream.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  const prefix = "/api/hiring/files/";
  let relative = storedUrl;
  try {
    const parsed = new URL(storedUrl);
    const idx = parsed.pathname.indexOf(prefix);
    if (idx >= 0) {
      relative = decodeURIComponent(parsed.pathname.slice(idx + prefix.length));
    } else {
      return null;
    }
  } catch {
    if (storedUrl.startsWith(prefix)) {
      relative = decodeURIComponent(storedUrl.slice(prefix.length));
    }
  }

  const full = containedPath(relative);
  if (!full) return null;
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
