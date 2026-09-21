import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(): Buffer {
  const explicit = process.env["DATA_ENCRYPTION_KEY"]?.trim();
  if (explicit && explicit.length >= 32) {
    return createHash("sha256").update(explicit).digest();
  }
  const session = process.env["SESSION_SECRET"]?.trim();
  if (session && session.length >= 32) {
    return createHash("sha256").update(`data-enc:${session}`).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATA_ENCRYPTION_KEY (or a 32+ char SESSION_SECRET) is required in production.",
    );
  }
  return createHash("sha256").update("dev-data-encryption-fallback").digest();
}

let cachedKey: Buffer | undefined;

function getKey(): Buffer {
  cachedKey ??= resolveKey();
  return cachedKey;
}

export function encryptString(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return plain ?? null;
  if (plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptString(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value;
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64url");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return value;
  }
}

export function encryptFields<T extends Record<string, unknown>>(
  row: T,
  keys: readonly (keyof T)[],
): T {
  const out = { ...row };
  for (const key of keys) {
    const current = out[key];
    if (typeof current === "string") {
      out[key] = encryptString(current) as T[typeof key];
    }
  }
  return out;
}

export function decryptFields<T extends Record<string, unknown>>(
  row: T,
  keys: readonly (keyof T)[],
): T {
  const out = { ...row };
  for (const key of keys) {
    const current = out[key];
    if (typeof current === "string") {
      out[key] = decryptString(current) as T[typeof key];
    }
  }
  return out;
}
