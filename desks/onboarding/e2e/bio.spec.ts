/**
 * bio.spec.ts
 *
 * Verifies the /en/bio member bio page:
 *   - Signed-out: redirected to /en (sign-in overlay).
 *   - Signed-in: the bio form renders with the privacy notice section and
 *     consent checkbox.
 *   - Signed-in: the "My profile" journey link navigates to /en/bio.
 *
 * i18n regression guard: the bio messages are wrapped under a top-level "bio"
 * key in messages/<locale>/bio.json, so both the server page
 * (getTranslations("bio")) and the client BioForm (useTranslations("bio"))
 * resolve real translations. These tests therefore assert the actual
 * translated text (e.g. "Employee Bio-Data", "Privacy notice") rather than the
 * raw fallback keys ("bio.pageTitle", "bio.privacy.title") that appeared before
 * the namespace was wrapped.
 */

import { test, expect, type BrowserContext } from "@playwright/test";

import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  readNonAdminStaffId,
} from "./auth-helpers";

/**
 * Establish a signed-in NON-admin session without the live ed-admin API by
 * forging a session cookie for the seeded teacher@silverleaf.co.tz account (see
 * e2e/auth-helpers.ts) — the same hermetic mechanism the admin-gate and
 * member-journey specs use. The bio page renders for any signed-in user, so a
 * non-admin session is sufficient. (UI sign-in is gated solely by the live
 * ed-admin directory, which is unavailable in CI.)
 */
async function signInAsMember(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: mintSessionCookie(readNonAdminStaffId()),
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

test.describe("Bio page", () => {
  test("visiting /en/bio while signed out redirects to /en", async ({
    page,
  }) => {
    await page.goto("/en/bio");

    // Should redirect to /en (the member hub / sign-in overlay).
    await expect(page).toHaveURL(/\/en(\/|$)/, { timeout: 15_000 });

    // The StaffRegistration overlay should be present.
    await expect(
      page.getByRole("heading", { name: "Welcome" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("signed-in member sees bio form with privacy notice and consent checkbox", async ({
    page,
    context,
  }) => {
    await signInAsMember(context);

    // Navigate to bio page.
    await page.goto("/en/bio", { waitUntil: "domcontentloaded" });

    // Verify we stay on /en/bio (authenticated, not redirected away).
    await expect(page).toHaveURL(/\/en\/bio/, { timeout: 10_000 });

    // The page h1 is server-rendered via getTranslations("bio"); it must show
    // the real translated title, not the fallback key "bio.pageTitle".
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toHaveText("Employee Bio-Data", { timeout: 10_000 });

    // Privacy notice heading (h2, id="privacy-heading") is rendered by the
    // client BioForm via useTranslations("bio") — the exact call site from the
    // original bug. It must show the real translated text, not the fallback key
    // "bio.privacy.title". (Rendered heading text is "🔒 Privacy notice".)
    const privacyHeading = page.locator("#privacy-heading");
    await expect(privacyHeading).toBeVisible({ timeout: 10_000 });
    await expect(privacyHeading).toContainText("Privacy notice");

    // Consent checkbox must be present and unlocked.
    const consentCheckbox = page.locator("#f-consent");
    await expect(consentCheckbox).toBeVisible({ timeout: 10_000 });
    await expect(consentCheckbox).not.toBeChecked();

    // At least one form input must be present (the Surname field has id="f-surname").
    await expect(page.locator("#f-surname")).toBeVisible();
  });

  test("qualifications section shows the certificate upload bucket", async ({
    page,
    context,
  }) => {
    await signInAsMember(context);
    await page.goto("/en/bio", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/en\/bio/, { timeout: 10_000 });

    // Each qualification row has its own certificate upload bucket. A fresh
    // seeded profile may have no qualification rows yet, so add one first.
    const staySignedIn = page.getByRole("button", { name: "Stay signed in" });
    const addQualification = page.getByRole("button", {
      name: /Add qualification/,
    });
    const attachFile = page.getByText("+ Attach file").first();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await staySignedIn.isVisible().catch(() => false)) {
        await staySignedIn.click();
      }
      await addQualification.click();
      await page.waitForTimeout(250);
      if (await attachFile.isVisible().catch(() => false)) break;
    }

    await expect(attachFile).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.locator("input[id^='qual-doc-']").first()).toBeAttached({
      timeout: 10_000,
    });
  });

  test("document download proxy denies unauthenticated and unknown ids (404)", async ({
    page,
    context,
    request,
  }) => {
    const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

    // Signed-out (isolated request context, no session cookie) → 404, never 401.
    const anon = await request.get(`/api/bio/documents/${ZERO_UUID}`);
    expect(anon.status()).toBe(404);

    // Signed-in member requesting a non-existent document → also 404 (the route
    // never confirms which ids exist). Uses the page context's session cookie.
    await signInAsMember(context);
    const signedIn = await page.request.get(`/api/bio/documents/${ZERO_UUID}`);
    expect(signedIn.status()).toBe(404);
  });

  test("bio form is reachable from dashboard journey nav", async ({
    page,
    context,
  }) => {
    await signInAsMember(context);

    // Land on the dashboard.
    await page.goto("/en");
    await expect(page.getByText("Staff Onboarding Hub")).toBeVisible({
      timeout: 20_000,
    });

    // The "My profile" journey link should navigate to /en/bio.
    const bioLink = page.getByRole("link", { name: /my profile/i });
    await expect(bioLink).toBeVisible();

    // Verify href points to bio.
    const href = await bioLink.getAttribute("href");
    expect(href).toMatch(/\/bio/);

    // Click the link.
    await bioLink.click();

    // Wait for navigation to settle.
    await expect(page).toHaveURL(/\/en\/bio/, { timeout: 15_000 });

    // Bio page title h1 must be present.
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
