import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { normalizeStaffEmail } from "@/lib/email";

const SCRYPT_KEY_LENGTH = 32;
const HASH_PREFIX = "scrypt";

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString("base64url");
  return `${HASH_PREFIX}:${salt}:${hash}`;
}

export function verifyAdminPassword(
  password: string,
  storedHash: string,
): boolean {
  const [prefix, salt, expected] = storedHash.split(":");
  if (prefix !== HASH_PREFIX || !salt || !expected) return false;

  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });
  const expectedBuffer = Buffer.from(expected, "base64url");
  return (
    actual.byteLength === expectedBuffer.byteLength &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

/**
 * Optional per-admin bootstrap passwords, e.g.
 * `admin@example.com:change-me`.
 */
export function getConfiguredAdminPassword(email: string): string | null {
  const normalizedEmail = normalizeStaffEmail(email);

  for (const entry of env.ADMIN_PASSWORDS?.split(",") ?? []) {
    const [rawEmail, ...passwordParts] = entry.split(":");
    const password = passwordParts.join(":");
    if (!rawEmail || !password) continue;
    if (normalizeStaffEmail(rawEmail) === normalizedEmail) return password;
  }

  return env.ADMIN_PIN ?? null;
}
