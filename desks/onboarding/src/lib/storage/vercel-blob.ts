import "server-only";

import { put, del, get } from "@vercel/blob";
import type { MaterialStorage, UploadInput, UploadResult } from "./types";

export const BLOB_TOKEN_ENV = "BLOB_READ_WRITE_TOKEN";

export class VercelBlobStorage implements MaterialStorage {
  private readonly token: string;

  constructor() {
    const token = process.env[BLOB_TOKEN_ENV];
    if (!token) {
      throw new Error(
        `VercelBlobStorage is not configured: ${BLOB_TOKEN_ENV} is not set. ` +
          `Add Vercel Blob from the dashboard, or run without the token to use ` +
          `the local filesystem adapter.`,
      );
    }
    this.token = token;
  }

  async upload(file: UploadInput): Promise<UploadResult> {
    const body = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const { url } = await put(file.filename, body, {
      access: "private",
      contentType: file.contentType,
      token: this.token,
    });
    return { key: url, url };
  }

  async getUrl(key: string): Promise<string> {
    // YouTube embed URLs are returned as-is — they're public and need no proxy.
    if (key.startsWith("https://www.youtube.com/embed/")) return key;
    // Everything else is proxied through /api/materials so the browser never
    // contacts Vercel Blob directly (keeps token server-side, ensures inline).
    return `/api/materials/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token });
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      const result = await get(key, { access: "private", token: this.token });
      if (!result || !result.stream) return null;
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
}
