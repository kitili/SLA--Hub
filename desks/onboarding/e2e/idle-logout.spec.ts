/**
 * idle-logout.spec.ts
 *
 * Verifies the inactivity auto-logout (src/components/IdleLogout.tsx):
 *   - After the idle window, a warning dialog appears, then the session is
 *     ended and the user is returned to the sign-in overlay.
 *   - Interacting during the warning ("Stay signed in") keeps the session.
 *
 * The production idle window is 15 min; playwright.config pins short values
 * (NEXT_PUBLIC_IDLE_TIMEOUT_MS=6000, NEXT_PUBLIC_IDLE_WARN_MS=3000) on the dev
 * server so this runs in seconds. As with admin-gate.spec.ts, we forge a
 * non-admin session cookie rather than driving the live ed-admin sign-in.
 *
 * Playwright's assertion polling does not dispatch input events, so the page
 * is genuinely idle while we wait — exactly what the timer needs.
 */

import { test, expect } from "@playwright/test";

import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  readNonAdminStaffId,
} from "./auth-helpers";

test.describe("Idle auto-logout", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: mintSessionCookie(readNonAdminStaffId()),
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);
  });

  test("warns then signs the user out after inactivity", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText("Staff Onboarding Hub")).toBeVisible({
      timeout: 20_000,
    });

    // Idle: the warning dialog (role=dialog, "Still there?") should surface.
    await expect(
      page.getByRole("dialog", { name: "Still there?" }),
    ).toBeVisible({ timeout: 10_000 });

    // Then, with continued inactivity, the session ends and we land back on the
    // sign-in overlay. Match its unique subtitle (absent from the dashboard) so
    // the assertion polls until the logout redirect completes.
    await expect(
      page.getByText("Sign in with your work email"),
    ).toBeVisible({ timeout: 10_000 });
    // The dashboard hero is gone — we are genuinely signed out.
    await expect(page.getByText("Staff Onboarding Hub")).toBeHidden();
  });

  test('"Stay signed in" cancels the logout', async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByText("Staff Onboarding Hub")).toBeVisible({
      timeout: 20_000,
    });

    const stay = page.getByRole("button", { name: "Stay signed in" });
    await expect(stay).toBeVisible({ timeout: 10_000 });
    await stay.click();

    // Dialog dismissed and we remain on the dashboard.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Staff Onboarding Hub")).toBeVisible();
  });
});
