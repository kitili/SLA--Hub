import path from "path";
import { defineConfig, devices } from "@playwright/test";

import { E2E_SESSION_SECRET } from "./e2e/auth-helpers";

/**
 * Playwright configuration for Silverleaf Lesson Plans e2e tests.
 *
 * - webServer spins up `npm run dev` and waits for the e2e port (3000 unless
 *   E2E_PORT overrides it).
 * - globalSetup migrates + seeds the PGlite dev DB before any test runs.
 * - Single Chromium project; sensible timeouts for a Next.js dev server.
 * - `reuseExistingServer` allows running against an already-running dev server
 *   locally; CI always starts fresh.
 *
 * NOTE: We run the server from the worktree directory explicitly to avoid
 * Next.js picking up a parent-level package-lock.json when run from a nested
 * git worktree.
 */

/** Absolute path to the project root (this file's directory). */
const PROJECT_ROOT = path.resolve(__dirname);

/**
 * Port for the e2e dev server. Defaults to 3000; override with E2E_PORT when
 * another dev server (e.g. a sibling worktree's) already occupies it —
 * `reuseExistingServer` would otherwise latch onto that foreign server, which
 * runs different code and lacks the pinned SESSION_SECRET / HR_ADMIN_EMAILS.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  /* Default timeout for each test. Next.js dev can be slow on first request. */
  timeout: 60_000,

  /* Expect timeout (for individual assertions). */
  expect: { timeout: 15_000 },

  /* Run tests serially in CI; parallel locally is fine too. */
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: !process.env.CI,

  /* Reporter */
  reporter: process.env.CI ? "github" : "list",

  /* Shared browser settings */
  use: {
    baseURL: `http://localhost:${PORT}`,
    /* Keep traces on failure for debugging. */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /*
     * The CSP (next.config.ts) currently ships script-src WITH 'unsafe-inline',
     * so Next.js App Router hydration works in real browsers and this bypass is
     * not strictly required today. We keep it anyway: CSP behaviour is not what
     * these tests verify, and next.config.ts carries a hardening TODO (swap
     * 'unsafe-inline' for per-request nonces) that would otherwise blank every
     * page under test the day it lands.
     */
    bypassCSP: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    /*
     * Mobile + tablet regression projects for mobile-responsive.spec.ts only.
     *
     * We emulate mobile via Chromium (isMobile + a narrow viewport) rather than
     * the named webkit device descriptors (iPhone SE / iPad Mini) so `npm run
     * e2e` works with just the already-installed Chromium — no extra webkit
     * download required locally or in CI. Widths mirror the audit: a small
     * phone (360 ≈ Galaxy/older iPhone), a modern phone (390 ≈ iPhone 12/13),
     * and a tablet (768 ≈ iPad portrait).
     *
     * `testMatch` scopes these to the responsive spec; the existing functional
     * specs (which assume the desktop layout) keep running only on Desktop
     * Chrome.
     */
    {
      name: "phone-360",
      testMatch: /mobile-responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-390",
      testMatch: /mobile-responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-768",
      testMatch: /mobile-responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  /* Start the Next.js dev server before the test suite.
   *
   * We `cd` explicitly into PROJECT_ROOT so Next.js does not walk up to a
   * parent workspace root (which happens when the project lives inside a git
   * worktree subdirectory with multiple package-lock.json files above it).
   *
   * We use /en as the readiness URL because the root / returns 404 (the
   * next-intl middleware issues a 307 redirect, but Playwright's health-check
   * only accepts 200, so we point it at a URL that genuinely returns 200). */
  webServer: {
    command: `cd "${PROJECT_ROOT}" && npm run dev`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      /* `next dev` honours PORT (see E2E_PORT above; default 3000). */
      PORT: String(PORT),
      /* Point at the PGlite local DB (no external Postgres needed in dev). */
      HR_ADMIN_EMAILS: "hr@silverleaf.co.tz",
      /*
       * Pin the session-signing secret so the admin-gate spec can forge a
       * valid non-admin session cookie (see e2e/auth-helpers.ts). Like
       * HR_ADMIN_EMAILS above, this only takes effect for a server started by
       * this config — not a reused, externally-started dev server.
       */
      SESSION_SECRET: E2E_SESSION_SECRET,
    },
  },
});
