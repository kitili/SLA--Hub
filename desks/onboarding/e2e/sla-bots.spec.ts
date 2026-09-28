/**
 * Smoke: learner SLA-bot on the hub, admin HR-bot on /admin, never both.
 */
import { expect, test, type BrowserContext } from "@playwright/test";

import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  readAdminStaffId,
  readNonAdminStaffId,
} from "./auth-helpers";

async function signInAs(
  context: BrowserContext,
  staffId: string,
): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: mintSessionCookie(staffId),
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

test("learner dashboard shows SLA-bot and not HR-bot", async ({
  page,
  context,
}) => {
  await signInAs(context, readNonAdminStaffId());
  await page.goto("/en");
  await expect(page.getByText("Staff Onboarding Hub")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("SLA-bot", { exact: true })).toBeVisible();
  await expect(page.getByText("HR-bot", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Ask SLA-bot/i }).click();
  await expect(page.getByRole("dialog", { name: "SLA-bot" })).toBeVisible();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.getByText(/I am SLA-bot/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/hiring candidate/i)).toHaveCount(0);
});

test("admin portal shows HR-bot and not SLA-bot", async ({ page, context }) => {
  await signInAs(context, readAdminStaffId());
  await page.goto("/en/admin");
  await expect(
    page.getByText("Content management & member monitoring"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("HR-bot", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask SLA-bot/i })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: /Ask HR-bot/i }).click();
  await expect(page.getByRole("dialog", { name: "HR-bot" })).toBeVisible();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.getByText(/I am HR-bot/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Members:/)).toBeVisible();
});
