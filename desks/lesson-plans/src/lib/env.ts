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
 *
 * The ONLY sanctioned raw `process.env` reads outside this module are in
 * `src/lib/db/client.ts` (the data layer stays self-contained for
 * bootstrap-order reasons documented there).
 */

import { z } from "zod";

/**
 * Strict opt-in flag: ONLY "1" / "true" (trimmed, case-insensitive) parse to
 * `true`. Everything else — absent, "", "0", "false", "no" — parses to
 * `false`, so a natural "disable" spelling can never accidentally opt in
 * (setting ALLOW_DEMO_AUTH=false must not ENABLE the demo fallback).
 */
const booleanFlag = z
  .string()
  .optional()
  .transform((value) => {
    const v = value?.trim().toLowerCase();
    return v === "1" || v === "true";
  });

const envSchema = z.object({
  /**
   * Full Postgres connection string.
   * Absent → fall back to local PGlite (in-process SQLite-compatible DB).
   */
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid URL." }).optional(),

  /**
   * Comma-separated list of email addresses that are granted admin access
   * automatically at sign-in / registration.
   * Example: "alice@school.edu,bob@school.edu"
   */
  HR_ADMIN_EMAILS: z.string().optional(),

  /**
   * PIN required to self-register as an admin.
   * Absent → admin self-registration is disabled.
   */
  ADMIN_PIN: z.string().optional(),

  /**
   * Per-admin bootstrap passwords: `email:password` pairs (comma-separated).
   * Same format as onboarding hub. Optional fallback: ADMIN_PIN.
   */
  ADMIN_PASSWORDS: z.string().optional(),

  /**
   * Local/dev only: allow password-verified HR admins missing from ed-admin.
   * Do not set on Vercel production.
   */
  ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK: z.string().optional(),

  /**
   * Secret used to HMAC-sign the auth session cookie.
   * Absent → development falls back to an insecure constant (with a console
   * warning); everywhere else signing is a hard error.
   * See `src/lib/auth/session-codec.ts`.
   */
  SESSION_SECRET: z.string().optional(),

  /**
   * Which auth provider implementation resolves the current user
   * (see `src/lib/auth/identity.ts`). Absent → "email".
   */
  AUTH_PROVIDER: z
    .enum(["email", "inbound-trust"], {
      error: 'AUTH_PROVIDER must be "email" or "inbound-trust".',
    })
    .default("email"),

  /**
   * Bearer token for the ed-admin staff directory API. Required for staff
   * sign-in: the email + Staff ID entered at login are verified against this
   * directory. Absent → sign-in falls back to the seeded staff table, but only
   * outside production or with ALLOW_DEMO_AUTH set — a production deploy
   * without the token otherwise fails closed (see `signInMemberAction`).
   */
  ED_ADMIN_API_TOKEN: z.string().optional(),

  /**
   * Explicit opt-in for the seeded-staff demo sign-in fallback IN PRODUCTION
   * (outside production the fallback is always available). Set to 1/true only
   * for demo/showcase deployments — it accepts any non-empty Staff ID. Any
   * other value (including "0"/"false") leaves the fallback DISABLED.
   */
  ALLOW_DEMO_AUTH: booleanFlag,

  /**
   * Ed-admin staff directory endpoint. Optional — defaults in code to the
   * Silverleaf instance (see `src/lib/auth/ed-admin.ts`).
   */
  ED_ADMIN_STAFF_API_URL: z.url({ error: "ED_ADMIN_STAFF_API_URL must be a valid URL." }).optional(),

  /**
   * Vercel Blob read/write token for document-asset storage.
   * Absent → local filesystem or mock storage is used.
   */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  /**
   * OpenRouter API key for AI lesson-plan generation.
   * Absent → AI generation is disabled.
   */
  OPENROUTER_API_KEY: z.string().optional(),

  /**
   * Override the model id used for AI generation.
   * Absent → a default model id is used in code (see `src/lib/ai/model.ts`).
   */
  AI_MODEL_ID: z.string().optional(),

  /**
   * Override the model id used for vision/OCR extraction.
   * Absent → a default model id is used in code (see `src/lib/ai/model.ts`).
   */
  AI_OCR_MODEL_ID: z.string().optional(),

  /**
   * Toggle Postgres trigram (pg_trgm) fuzzy search. Set to 1/true to enable;
   * absent or any other value → disabled.
   */
  SEARCH_TRIGRAM: booleanFlag,

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
  HR_ADMIN_EMAILS: process.env["HR_ADMIN_EMAILS"],
  ADMIN_PIN: process.env["ADMIN_PIN"],
  ADMIN_PASSWORDS: process.env["ADMIN_PASSWORDS"],
  ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK:
    process.env["ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  AUTH_PROVIDER: process.env["AUTH_PROVIDER"],
  ED_ADMIN_API_TOKEN: process.env["ED_ADMIN_API_TOKEN"],
  ALLOW_DEMO_AUTH: process.env["ALLOW_DEMO_AUTH"],
  ED_ADMIN_STAFF_API_URL: process.env["ED_ADMIN_STAFF_API_URL"],
  BLOB_READ_WRITE_TOKEN: process.env["BLOB_READ_WRITE_TOKEN"],
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"],
  AI_MODEL_ID: process.env["AI_MODEL_ID"],
  AI_OCR_MODEL_ID: process.env["AI_OCR_MODEL_ID"],
  SEARCH_TRIGRAM: process.env["SEARCH_TRIGRAM"],
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
