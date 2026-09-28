/**
 * locale.spec.ts
 *
 * Verifies that locale routing works correctly:
 *   - /sw renders the Swahili version ("Karibu", "Endelea").
 *   - /en renders the English version.
 *   - The LocaleSwitcher select element allows toggling between locales.
 */

import { test, expect } from "@playwright/test";

test.describe("Locale routing", () => {
  test("/sw shows Swahili welcome text ('Karibu')", async ({ page }) => {
    await page.goto("/sw");

    // The StaffRegistration overlay welcome heading is "Karibu" in Swahili.
    await expect(
      page.getByRole("heading", { name: "Karibu" }),
    ).toBeVisible({ timeout: 15_000 });

    // The "Continue" button is "Endelea" in Swahili.
    await expect(
      page.getByRole("button", { name: "Endelea" }),
    ).toBeVisible();
  });

  test("/en shows English welcome text ('Welcome')", async ({ page }) => {
    await page.goto("/en");

    await expect(
      page.getByRole("heading", { name: "Welcome" }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByRole("button", { name: "Continue" }),
    ).toBeVisible();
  });

  test("locale switcher changes the active locale (EN → SW)", async ({
    page,
  }) => {
    // Start at English.
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { name: "Welcome" }),
    ).toBeVisible({ timeout: 15_000 });

    // The LocaleSwitcher is a <select> with aria-label="Language".
    // It uses `useLocale` + `useTranslations("common")` → label is "Language" in en.
    const switcher = page.getByRole("combobox", { name: /language/i });
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveValue("en");

    // Switch to Swahili.
    await switcher.selectOption("sw");

    // URL should now include /sw and the heading should be in Swahili.
    await expect(page).toHaveURL(/\/sw/, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Karibu" }),
    ).toBeVisible({ timeout: 10_000 });

    // On the /sw page the switcher label becomes "Lugha" (Swahili for "Language").
    // We use a regex that matches both to be resilient.
    const switcherSw = page.getByRole("combobox", { name: /language|lugha/i });
    await expect(switcherSw).toBeVisible({ timeout: 5_000 });
    await expect(switcherSw).toHaveValue("sw");
  });

  test("root / redirects to a locale-prefixed path", async ({ page }) => {
    // The root has no page; the middleware negotiates a locale and redirects
    // (e.g. / → /en). Visiting / must land on a localized dashboard, not 404.
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|sw)(\/|$)/, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /Welcome|Karibu/ }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
