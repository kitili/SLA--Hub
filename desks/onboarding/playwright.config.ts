import path from "path";
import { defineConfig, devices } from "@playwright/test";

import { E2E_SESSION_SECRET } from "./e2e/auth-helpers";

/**
 * Playwright configuration for Silverleaf Onboarding Hub e2e tests.
 *
 * - webServer spins up `npm run dev` and waits for port 3000.
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
    baseURL: "http://localhost:3000",
    /* Keep traces on failure for debugging. */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /*
     * The app sets a strict Content-Security-Policy that intentionally excludes
     * `'unsafe-inline'` from script-src. Next.js App Router injects inline
     * <script> tags for RSC streaming / hydration, which the CSP blocks in a
     * real browser — leaving a blank page. In a real browser nonces or a
     * relaxed dev CSP would handle this, but for e2e test purposes we bypass
     * CSP entirely so Playwright sees the fully-hydrated DOM.
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
    command: `cd "${PROJECT_ROOT}" && DATABASE_URL="" npm run dev`,
    url: "http://localhost:3000/en",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      /* Point at the PGlite local DB (no external Postgres needed in dev). */
      DATABASE_URL: "",
      HR_ADMIN_EMAILS: "hr@silverleaf.co.tz",
      /*
       * Pin the session-signing secret so the admin-gate spec can forge a
       * valid non-admin session cookie (see e2e/auth-helpers.ts). Like
       * HR_ADMIN_EMAILS above, this only takes effect for a server started by
       * this config — not a reused, externally-started dev server.
       */
      SESSION_SECRET: E2E_SESSION_SECRET,
      /*
       * Shorten the idle-logout window so idle-logout.spec.ts can exercise the
       * inactivity warning + sign-out in seconds rather than the 15-min
       * production default. These are NEXT_PUBLIC_* so they reach the client
       * IdleLogout component (inlined by Next during dev compilation).
       */
      NEXT_PUBLIC_IDLE_TIMEOUT_MS: "8000",
      NEXT_PUBLIC_IDLE_WARN_MS: "4000",
    },
  },
});
