/**
 * Session-cookie codec for the email auth provider — pure crypto, no request
 * context.
 *
 * Cookie format: `<base64url(JSON payload)>.<base64url(signature)>`
 * Algorithm:     HMAC-SHA256 (Web Crypto — available in Node.js 15+ and Edge)
 *
 * Kept separate from `providers/email.ts` (which owns the `cookies()`
 * plumbing) so the security-critical encode/verify logic is unit-testable —
 * see `session-codec.test.ts`. The e2e suite forges byte-for-byte compatible
 * cookies with `node:crypto` (`e2e/auth-helpers.ts` → `mintSessionCookie`);
 * any format change here must be mirrored there.
 */

import "server-only";

/** Session shape stored in the cookie (JSON, then HMAC-signed). */
export interface SessionPayload {
  staffId: string;
  /** True after the user has passed the ADMIN_PIN check for this session. */
  adminElevated?: boolean;
}

/**
 * Insecure constant used to sign sessions when SESSION_SECRET is unset in
 * development. Exported only so the test suite can pin it.
 */
export const DEV_FALLBACK_SECRET = "dev-secret-change-me-in-production";

/**
 * Resolve the HMAC signing secret from the configured SESSION_SECRET.
 *
 * Missing secret → hard error everywhere except development, where the
 * insecure {@link DEV_FALLBACK_SECRET} is used (with a console warning) so
 * local dev needs zero configuration.
 */
export function resolveSessionSecret(
  secret: string | undefined,
  nodeEnv: "development" | "production" | "test",
): string {
  if (!secret) {
    if (nodeEnv !== "development") {
      // In production a missing secret is a hard error.
      throw new Error(
        "[auth/email] SESSION_SECRET is not set. " +
          "Set it in your environment before deploying.",
      );
    }
    console.warn(
      "[auth/email] SESSION_SECRET is not set — using insecure dev fallback. " +
        "Set SESSION_SECRET in .env.local for local development.",
    );
  }
  return secret ?? DEV_FALLBACK_SECRET;
}

// ---------------------------------------------------------------------------
// HMAC helpers (Web Crypto — no extra deps)
// ---------------------------------------------------------------------------

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(sig).toString("base64url");
}

async function verify(
  payload: string,
  sig: string,
  secret: string,
): Promise<boolean> {
  const key = await getSigningKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(sig, "base64url"),
    new TextEncoder().encode(payload),
  );
}

// ---------------------------------------------------------------------------
// Cookie serialisation: `<base64url(JSON)>.<signature>`
// ---------------------------------------------------------------------------

/** Serialise and sign a session payload into a cookie value. */
export async function encodeSession(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = await sign(json, secret);
  return `${json}.${sig}`;
}

/**
 * Verify and parse a cookie value. Returns null when the value is malformed,
 * the signature does not match, or the payload is not valid JSON.
 */
export async function decodeSession(
  raw: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const json = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const valid = await verify(json, sig, secret);
  if (!valid) return null;
  try {
    return JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}
