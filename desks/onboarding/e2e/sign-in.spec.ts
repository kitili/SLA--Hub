import { expect, test } from "@playwright/test";

test.describe("Sign in", () => {
  test("submits work email and Staff ID, then renders the dashboard", async ({
    page,
  }) => {
    await page.goto("/en");

    await page.getByLabel("Work email").fill("mourine-fellow@silverleaf.co.tz");
    await page.getByLabel(/Staff ID/i).fill("401642");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Staff Onboarding Hub")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: /Welcome/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Work email")).not.toBeVisible();
  });

  test("rejects an email and Staff ID that are not in ed-admin", async ({
    page,
  }) => {
    await page.goto("/en");

    await page.getByLabel("Work email").fill("unknown@silverleaf.co.tz");
    await page.getByLabel(/Staff ID/i).fill("000000");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/ed admin account/i)).toBeVisible();
    await expect(page.getByText("Staff Onboarding Hub")).not.toBeVisible();
  });
});
