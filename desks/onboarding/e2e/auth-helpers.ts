/**
 * auth-helpers.ts — hermetic session helpers shared by the e2e specs,
 * playwright.config, and global-setup.
 *
 * The app's only hermetic UI sign-in path is the HR-admin bypass
 * (`HR_ADMIN_EMAILS`), which grants admin. Every other account is verified
 * against the live ed-admin directory, which is unavailable in CI. To exercise
 * a *signed-in non-admin* (e.g. the admin-gate redirect) without that API, we
 * forge the session cookie directly for the seeded `teacher@silverleaf.co.tz`
 * account (isAdmin: false).
 *
 * The forged cookie is byte-for-byte compatible with `encodeSession()` in
 * src/lib/auth/providers/email.ts:
 *   `<base64url(JSON {staffId,iat,exp})>.<base64url(HMAC-SHA256 over that base64url string)>`
 * The payload MUST carry a numeric, unexpired `exp` — the server rejects a
 * session without one. Production sessions last 15 minutes of idle time
 * (sliding); fixtures mint a long `exp` so specs don't expire mid-run.
 *
 * For the server to accept it, both sides must sign with the same secret —
 * `E2E_SESSION_SECRET` is injected into the dev server via
 * playwright.config's `webServer.env.SESSION_SECRET` (the same mechanism that
 * already pins `HR_ADMIN_EMAILS`). NOTE: with `reuseExistingServer`, a dev
 * server started outside the Playwright harness won't have this secret — start
 * e2e against a fresh server (CI always does).
 */
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cookie name written by the email auth provider in dev/test (http). The
 * provider switches to the `__Host-`-prefixed name only when the cookie is
 * Secure (production); e2e runs `next dev` over http, so the plain name applies.
 */
export const SESSION_COOKIE_NAME = "__sla_session";

/**
 * Session secret pinned for the e2e run. Must match the value injected into the
 * dev server via playwright.config `webServer.env.SESSION_SECRET`.
 */
// Must be >= 32 chars to satisfy the env-schema minimum (src/lib/env.ts).
export const E2E_SESSION_SECRET = "e2e-playwright-session-secret-0123456789";

/** Where global-setup stashes the seeded non-admin staff id (gitignored). */
export const NON_ADMIN_FIXTURE = join(__dirname, ".non-admin-session.json");

/**
 * Mint a `__sla_session` cookie value for `staffId`, matching the email
 * provider's `encodeSession` exactly: sign the base64url-encoded JSON payload
 * (not the raw JSON) with HMAC-SHA256.
 */
export function mintSessionCookie(
  staffId: string,
  secret: string = E2E_SESSION_SECRET,
): string {
  const now = Date.now();
  const payload = { staffId, iat: now, exp: now + 30 * 24 * 60 * 60 * 1000 };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  return `${json}.${sig}`;
}

/** Persist the seeded non-admin staff id for the gate spec to read. */
export function writeNonAdminFixture(staffId: string): void {
  writeFileSync(NON_ADMIN_FIXTURE, JSON.stringify({ staffId }), "utf8");
}

/** Read the seeded non-admin staff id captured by global-setup. */
export function readNonAdminStaffId(): string {
  const { staffId } = JSON.parse(readFileSync(NON_ADMIN_FIXTURE, "utf8")) as {
    staffId?: string;
  };
  if (!staffId) {
    throw new Error(
      `[e2e] ${NON_ADMIN_FIXTURE} is missing staffId — did global-setup run?`,
    );
  }
  return staffId;
}

/** Where global-setup stashes the seeded HR-admin staff id (gitignored). */
export const ADMIN_FIXTURE = join(__dirname, ".admin-session.json");

/**
 * Persist the seeded HR-admin (`hr@silverleaf.co.tz`) staff id. Specs needing a
 * signed-in *admin* session (e.g. the mobile-responsive sweep over /admin
 * routes) forge a cookie for this id; the server grants admin because the email
 * is in HR_ADMIN_EMAILS — the ed-admin directory only gates the UI sign-in, not
 * cookie validation, so a forged cookie reaches /admin without the live API.
 */
export function writeAdminFixture(staffId: string): void {
  writeFileSync(ADMIN_FIXTURE, JSON.stringify({ staffId }), "utf8");
}

/** Read the seeded HR-admin staff id captured by global-setup. */
export function readAdminStaffId(): string {
  const { staffId } = JSON.parse(readFileSync(ADMIN_FIXTURE, "utf8")) as {
    staffId?: string;
  };
  if (!staffId) {
    throw new Error(
      `[e2e] ${ADMIN_FIXTURE} is missing staffId — did global-setup run?`,
    );
  }
  return staffId;
}
