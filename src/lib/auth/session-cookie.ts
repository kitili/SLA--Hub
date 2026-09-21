/**
 * Session cookie encoding — HMAC-signed payload shared by the email auth
 * provider (Node server) and middleware (Edge).
 *
 * Keep this module free of `server-only`, `next/headers`, and the database so
 * Edge middleware can import it.
 *
 * Session shape: `{ staffId: string; iat: number; exp: number }`
 * Cookie name:   `__Host-sla_session` (or `__sla_session` over local http)
 * Algorithm:     HMAC-SHA256 (Web Crypto)
 *
 * Lifetime is a 15-minute sliding idle window — the same default as the
 * client idle-logout warning. Activity (page navigations via middleware, or
 * the `touchSessionAction` heartbeat) issues a fresh `exp`. Closing the
 * browser and returning after 15 minutes requires signing in again.
 */

import type { NextRequest, NextResponse } from "next/server";

/** Idle window before the signed session is rejected. Matches IdleLogout. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Rewrite the cookie at most once a minute to keep the idle window sliding. */
export const SESSION_SLIDE_AFTER_MS = 60 * 1000;

const DEV_FALLBACK_SECRET = "dev-secret-change-me-in-production";

export interface SessionPayload {
  staffId: string;
  /**
   * Admin flag copied from the staff row at sign-in so RLS GUCs can be set
   * before the first DB round-trip. Re-checked against the DB in
   * `getCurrentUser()`; stale for at most the 15-minute idle window.
   */
  isAdmin?: boolean;
  /** Issued-at (epoch ms). */
  iat: number;
  /**
   * Absolute expiry (epoch ms). The cookie is rejected once this passes, so a
   * captured token can't be replayed beyond its intended lifetime — unlike the
   * cookie `maxAge`, which is only a client-side hint.
   */
  exp: number;
}

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

/**
 * Whether the session cookie carries the Secure attribute. The `__Host-`
 * prefix REQUIRES Secure (and Path=/, no Domain), so it's only valid where
 * Secure is set — every environment except local http dev.
 */
export function isSecureSessionCookie(): boolean {
  return process.env.NODE_ENV !== "development";
}

export function getSessionCookieName(): string {
  return isSecureSessionCookie() ? "__Host-sla_session" : "__sla_session";
}

export function sessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: isSecureSessionCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/**
 * Matching attributes for clearing the session cookie. Browsers only drop a
 * cookie when Path/Secure/SameSite match the original Set-Cookie — a bare
 * `cookies().delete(name)` misses those on `__Host-` cookies, so logout would
 * appear to fail.
 */
export function expiredSessionCookieOptions(): SessionCookieOptions {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}

function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[auth/session] SESSION_SECRET is not set. " +
        "Set it in your environment before deploying.",
    );
  }
  return DEV_FALLBACK_SECRET;
}

let cachedKey: CryptoKey | undefined;
let cachedSecret: string | undefined;

async function getSigningKey(): Promise<CryptoKey> {
  const secret = resolveSecret();
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedSecret = secret;
  return cachedKey;
}

async function sign(payload: string): Promise<string> {
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(sig).toString("base64url");
}

async function verify(payload: string, sig: string): Promise<boolean> {
  const key = await getSigningKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(sig, "base64url"),
    new TextEncoder().encode(payload),
  );
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = await sign(json);
  return `${json}.${sig}`;
}

export async function decodeSession(
  raw: string,
): Promise<SessionPayload | null> {
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const json = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const valid = await verify(json, sig);
  if (!valid) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (typeof parsed.staffId !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return {
      staffId: parsed.staffId,
      isAdmin: parsed.isAdmin === true,
      iat: typeof parsed.iat === "number" ? parsed.iat : 0,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function buildSessionPayload(
  staffId: string,
  now = Date.now(),
  isAdmin = false,
): SessionPayload {
  return {
    staffId,
    isAdmin,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
}

export function shouldSlideSession(
  session: SessionPayload,
  now = Date.now(),
): boolean {
  return now - session.iat >= SESSION_SLIDE_AFTER_MS;
}

/**
 * On every document request: drop expired/tampered cookies, and slide a
 * still-valid session so activity keeps the idle window open.
 */
export async function applySessionSliding(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const cookieName = getSessionCookieName();
  const raw = request.cookies.get(cookieName)?.value;
  if (!raw) return response;

  const session = await decodeSession(raw);
  if (!session) {
    response.cookies.set(cookieName, "", expiredSessionCookieOptions());
    return response;
  }

  if (!shouldSlideSession(session)) return response;

  const value = await encodeSession(
    buildSessionPayload(session.staffId, Date.now(), session.isAdmin === true),
  );
  response.cookies.set(cookieName, value, sessionCookieOptions());
  return response;
}
