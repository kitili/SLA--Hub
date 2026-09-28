/**
 * admin-gate.spec.ts
 *
 * Verifies the admin gate behaviour:
 *   - /en/admin while signed OUT redirects to /en (sign-in overlay).
 *   - /en/admin while signed in as a NON-admin also redirects to /en.
 *
 * Neither case should render admin UI. The redirect is performed by the admin
 * layout (src/app/[locale]/admin/layout.tsx) via the locale-aware redirect.
 */

import { test, expect } from "@playwright/test";

import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  readNonAdminStaffId,
} from "./auth-helpers";

test.describe("Admin gate", () => {
  test("visiting /en/admin while signed out redirects to /en", async ({
    page,
  }) => {
    // No cookies — fresh context.
    await page.goto("/en/admin");

    // Should be redirected to /en (the member hub root).
    await expect(page).toHaveURL(/\/en(\/|$)/, { timeout: 15_000 });

    // The StaffRegistration overlay should be present (user is not signed in).
    await expect(
      page.getByRole("heading", { name: "Welcome" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("visiting /en/admin as a non-admin redirects to /en", async ({
    page,
    context,
  }) => {
    // Establish a NON-admin session without the live ed-admin API: inject a
    // forged session cookie for the seeded teacher@silverleaf.co.tz account
    // (isAdmin: false). The cookie is signed with the e2e SESSION_SECRET pinned
    // in playwright.config's webServer.env, so the server accepts it. (HR-admin
    // sign-in can't be used here — it grants admin and would NOT be redirected.)
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: mintSessionCookie(readNonAdminStaffId()),
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);

    // Confirm the non-admin is actually signed in: the sign-in overlay (its
    // "Continue" submit button) is gone once a valid session cookie is present.
    // This is time-independent, unlike the dashboard body which swaps between
    // the normal home and the Feedback-Hour home depending on the server clock.
    await page.goto("/en");
    await expect(
      page.getByRole("button", { name: "Continue" }),
    ).toHaveCount(0, { timeout: 20_000 });

    // Now navigate to /en/admin — should be redirected back to /en.
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en(\/|$)/, { timeout: 15_000 });

    // The URL regex alone is weak (it matches "/en/admin" too), so assert the
    // admin-only "Back to hub" link (rendered only by the admin shell header) is
    // absent — proving we were redirected, not shown the admin area.
    await expect(page.getByText("Back to hub")).not.toBeVisible();

    // And the sign-in overlay must still be absent — we are signed in, just not
    // an admin (redirected to the member home, not bounced to sign-in).
    await expect(
      page.getByRole("button", { name: "Continue" }),
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test("admin UI is NOT accessible without the admin role", async ({
    page,
  }) => {
    await page.goto("/en/admin");

    // Should redirect to /en — not stay at /admin.
    await expect(page).toHaveURL(/\/en(\/|$)/, { timeout: 15_000 });

    // The admin shell (header + AdminNav) must not be present. The "Back to hub"
    // link is rendered only by the admin layout header, so its absence proves we
    // were redirected out of the admin area.
    await expect(page.getByText("Back to hub")).not.toBeVisible();

    // With no session cookie the user is signed out, so the StaffRegistration
    // sign-in overlay (its "Continue" submit button) should be visible instead.
    await expect(
      page.getByRole("button", { name: "Continue" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
