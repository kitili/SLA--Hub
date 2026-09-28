import "server-only";

import { put, del } from "@vercel/blob";

import { env } from "@/lib/env";
import type { MaterialStorage, UploadInput, UploadResult } from "./types";

export class VercelBlobStorage implements MaterialStorage {
  private readonly token: string;

  constructor() {
    const token = env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error(
        `VercelBlobStorage is not configured: BLOB_READ_WRITE_TOKEN is not set. ` +
          `Add Vercel Blob from the dashboard, or run without the token to use ` +
          `the local filesystem adapter.`,
      );
    }
    this.token = token;
  }

  async upload(file: UploadInput): Promise<UploadResult> {
    const body = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const { url } = await put(file.filename, body, {
      access: "public",
      contentType: file.contentType,
      token: this.token,
    });
    // Blob uses the public URL as its own object identity (key === url).
    return { key: url, url };
  }

  async getUrl(key: string): Promise<string> {
    return key;
  }

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token });
  }

  async read(key: string): Promise<Buffer | null> {
    const res = await fetch(key);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
}
