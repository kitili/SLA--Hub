/**
 * env.ts — parse and validate process.env at module-load time.
 *
 * Import `env` anywhere server-side to get typed, validated environment
 * variables instead of raw strings that may be undefined at runtime.
 *
 * All variables are OPTIONAL so the app can run locally without a full
 * `.env.local` file (PGlite is used when DATABASE_URL is absent, etc.).
 *
 * If a variable is present but malformed, the schema throws at startup
 * (fail-fast) rather than silently producing a broken value later.
 */

import "server-only";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalUrl = (message: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ error: message }).optional(),
  );

const envSchema = z.object({
  /**
   * Full Postgres connection string (owner / migrations).
   * Absent → fall back to local PGlite.
   */
  DATABASE_URL: optionalUrl("DATABASE_URL must be a valid URL."),

  /**
   * Least-privilege Postgres URL for request traffic (RLS applies).
   * Never expose as NEXT_PUBLIC_*. Absent → runtime uses DATABASE_URL.
   */
  DATABASE_PUBLIC_URL: optionalUrl("DATABASE_PUBLIC_URL must be a valid URL."),

  /**
   * Comma-separated list of email addresses that are granted admin access
   * automatically at sign-in / registration.
   * Example: "alice@school.edu,bob@school.edu"
   */
  HR_ADMIN_EMAILS: optionalNonEmptyString,

  /**
   * Password/PIN required when an HR admin signs in from the staff sign-in form.
   * The email must still be listed in HR_ADMIN_EMAILS and active in ed-admin.
   */
  ADMIN_PIN: optionalNonEmptyString,

  /**
   * Optional comma-separated per-admin bootstrap passwords:
   * `admin@example.com:change-me`.
   * A changed password stored in the DB takes precedence after first update.
   */
  ADMIN_PASSWORDS: optionalNonEmptyString,

  /**
   * When "1"/"true", allow HR_ADMIN_EMAILS accounts that pass the admin password
   * check to sign in even if they are missing from the ed-admin directory.
   * Local/dev bootstrap only — leave unset in production.
   */
  ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK: optionalNonEmptyString,

  /**
   * Secret used to HMAC-sign the session cookie. A missing or weak secret would
   * let anyone forge `{ staffId }` sessions, so it is REQUIRED in production —
   * enforced server-side in `src/lib/auth/providers/email.ts` (getSigningKey),
   * which throws outside development when this is unset. The schema additionally
   * rejects a present-but-too-short secret at startup. Min 32 chars.
   *
   * (Enforcement lives in getSigningKey rather than a schema superRefine because
   * this module is imported broadly; a throwing refinement could fail the client
   * bundle where the secret is legitimately absent.)
   */
  SESSION_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters.")
      .optional(),
  ),

  /**
   * Allowed email domain for staff sign-in (e.g. silverleaf.co.tz).
   *
   * NOTE: as of the ed-admin login change this is NO LONGER the sign-in gate —
   * ed-admin directory membership is. The helpers in `src/lib/email.ts` remain
   * for normalisation; the domain is only informational now.
   */
  ALLOWED_EMAIL_DOMAIN: optionalNonEmptyString,

  /**
   * Bearer token for the ed-admin staff directory API. Required for staff
   * sign-in: the email + Staff ID entered at login are verified against this
   * directory. Absent → non-admin sign-in fails (only HR admins can get in).
   */
  ED_ADMIN_API_TOKEN: optionalNonEmptyString,

  /**
   * Ed-admin staff directory endpoint. Optional — defaults in code to the
   * Silverleaf instance (see `src/lib/auth/ed-admin.ts`).
   */
  ED_ADMIN_STAFF_API_URL: optionalUrl(
    "ED_ADMIN_STAFF_API_URL must be a valid URL.",
  ),

  /**
   * Vercel Blob read/write token for document-asset storage.
   * Absent → local filesystem or mock storage is used.
   */
  BLOB_READ_WRITE_TOKEN: optionalNonEmptyString,

  /**
   * Optional OpenAI key used to write policy briefing scripts from uploaded
   * PDFs. When absent, an extractive summary is used instead.
   */
  OPENAI_API_KEY: optionalNonEmptyString,

  /** Optional chat model override (default gpt-4o-mini). */
  OPENAI_MODEL: optionalNonEmptyString,

  /**
   * AES-256-GCM key for bio PII at rest. REQUIRED in production (32+ chars).
   * Dev falls back to SESSION_SECRET. Never expose as NEXT_PUBLIC_*.
   */
  DATA_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .min(32, "DATA_ENCRYPTION_KEY must be at least 32 characters.")
      .optional(),
  ),

  /**
   * Cloudflare Turnstile secret for the public apply form. Absent → skip
   * (honeypot + timing still run). Never expose as NEXT_PUBLIC_*.
   */
  TURNSTILE_SECRET_KEY: optionalNonEmptyString,

  /**
   * Standard Next.js env — "development" | "production" | "test"
   */
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parsed, typed environment.  Import this instead of `process.env` in
 * server-side code.
 *
 * NOTE: this module runs at import time.  If you need env vars in Edge
 * runtimes, import only the specific values you need to keep the bundle small.
 */
export const env: Env = envSchema.parse({
  DATABASE_URL: process.env["DATABASE_URL"],
  DATABASE_PUBLIC_URL: process.env["DATABASE_PUBLIC_URL"],
  HR_ADMIN_EMAILS: process.env["HR_ADMIN_EMAILS"],
  ADMIN_PIN: process.env["ADMIN_PIN"],
  ADMIN_PASSWORDS: process.env["ADMIN_PASSWORDS"],
  ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK:
    process.env["ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ALLOWED_EMAIL_DOMAIN: process.env["ALLOWED_EMAIL_DOMAIN"],
  ED_ADMIN_API_TOKEN: process.env["ED_ADMIN_API_TOKEN"],
  ED_ADMIN_STAFF_API_URL: process.env["ED_ADMIN_STAFF_API_URL"],
  BLOB_READ_WRITE_TOKEN: process.env["BLOB_READ_WRITE_TOKEN"],
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
  OPENAI_MODEL: process.env["OPENAI_MODEL"],
  DATA_ENCRYPTION_KEY: process.env["DATA_ENCRYPTION_KEY"],
  TURNSTILE_SECRET_KEY: process.env["TURNSTILE_SECRET_KEY"],
  NODE_ENV: process.env["NODE_ENV"],
});

/**
 * Convenience helper: split HR_ADMIN_EMAILS into a normalised array.
 * Returns [] when the variable is absent.
 */
export function getHrAdminEmails(): string[] {
  if (!env.HR_ADMIN_EMAILS) return [];
  return env.HR_ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true when `email` is in the HR_ADMIN_EMAILS list.
 */
export function isHrAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getHrAdminEmails().includes(email.trim().toLowerCase());
}

/** Local/dev: allow password-verified admins missing from ed-admin. */
export function allowLocalAdminDirectoryFallback(): boolean {
  const raw = env.ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
