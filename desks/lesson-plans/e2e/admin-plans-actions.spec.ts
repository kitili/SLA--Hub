/**
 * admin-plans-actions.spec.ts
 *
 * Regression tests: the admin plans listing must reflect row mutations
 * (publish/unpublish) immediately — WITHOUT a manual page reload.
 *
 * Bug history: PlansBrowser seeds its accumulated rows into useState from
 * `initialPlans`; the router.refresh() issued after a mutation delivered
 * fresh props, but state initialised from props ignores prop updates, so
 * badges and button labels stayed stale until a manual reload. The fix has
 * PlansTable report each successful action back to PlansBrowser, which
 * reconciles the accumulated rows in place. These specs pin both halves:
 *
 *   - a first-page row flips Published → Draft → Published in place;
 *   - a row revealed via "Show more" flips too, and the accumulated list is
 *     NOT collapsed back to the first page by the refresh that follows.
 *
 * The seed inserts plans with `onConflictDoNothing`, so re-seeding does NOT
 * reset statuses. Each test therefore normalises its target plan back to
 * Published first (recovering from an interrupted earlier run) and ends with
 * the plan Published again, restoring the seeded state.
 *
 * Auth: forged HR-admin session cookie — same pattern as the /admin sweep in
 * mobile-responsive.spec.ts (see auth-helpers.ts).
 */

import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  readAdminStaffId,
} from "./auth-helpers";

/**
 * Target plans — seeded titles no other spec depends on. (The mobile sweep
 * needs g7-math-t1a-w1-l1 to stay published, so that one is off limits.)
 * FIRST_PAGE_PLAN sorts into the first batch of 12; ACCUMULATED_PLAN is the
 * canonically-last seeded row, so it only appears after "Show more".
 */
const FIRST_PAGE_PLAN = "Verbs and Simple Tenses"; // G7_English_T1a_W2_L1
const ACCUMULATED_PLAN = "Uandishi wa Insha ya Masimulizi"; // G8_Kiswahili_T1a_W2_L2

/**
 * The plan row (an <li>) for `title`. Filtering on the row's "Edit" link
 * keeps nav list items out; the table's header <li> is aria-hidden and never
 * matches the listitem role.
 */
function planRow(page: Page, title: string): Locator {
  return page
    .getByRole("listitem")
    .filter({ hasText: title })
    .filter({ has: page.getByRole("link", { name: "Edit", exact: true }) });
}

/** Every rendered plan row (first batch + whatever "Show more" appended). */
function planRows(page: Page): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: "Edit", exact: true }) });
}

/**
 * Open the listing and wait for it to go quiet — the buttons here drive
 * server actions through React handlers, so clicking before hydration would
 * silently do nothing.
 */
async function openPlans(page: Page): Promise<void> {
  await page.goto("/en/admin/plans");
  await page.waitForLoadState("networkidle");
  await expect(planRows(page).first()).toBeVisible();
}

/** Click a button that triggers a server action; wait for its POST round-trip. */
async function clickAction(page: Page, button: Locator): Promise<void> {
  const post = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/admin/plans"),
  );
  await button.click();
  await post;
}

/** Click "Show more" until the row for `title` is rendered, then return it. */
async function revealRow(page: Page, title: string): Promise<Locator> {
  const row = planRow(page, title);
  for (let i = 0; i < 10 && (await row.count()) === 0; i++) {
    const showMore = page.getByRole("button", {
      name: "Show more",
      exact: true,
    });
    if ((await showMore.count()) === 0) break;
    const before = await planRows(page).count();
    await clickAction(page, showMore);
    await expect.poll(() => planRows(page).count()).toBeGreaterThan(before);
  }
  await expect(row).toBeVisible();
  return row;
}

/**
 * Reset `title` to Published if an interrupted earlier run left it as Draft.
 * Deliberately reloads afterwards: normalisation must work even when the
 * in-place update is broken — that broken behaviour is exactly what the
 * tests below pin down.
 */
async function normalizeToPublished(page: Page, title: string): Promise<void> {
  let row = await revealRow(page, title);
  const publish = row.getByRole("button", { name: "Publish", exact: true });
  if ((await publish.count()) > 0) {
    await clickAction(page, publish);
    await page.reload();
    await page.waitForLoadState("networkidle");
    row = await revealRow(page, title);
  }
  await expect(row.getByText("Published", { exact: true })).toBeVisible();
}

test.describe("Admin plans row actions", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: mintSessionCookie(readAdminStaffId()),
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);
  });

  test("unpublish/publish flips the row in place without a reload", async ({
    page,
  }) => {
    await openPlans(page);
    await normalizeToPublished(page, FIRST_PAGE_PLAN);

    const row = planRow(page, FIRST_PAGE_PLAN);
    await row.getByRole("button", { name: "Unpublish", exact: true }).click();

    // The badge and the action label must flip WITHOUT any reload.
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();
    await expect(
      row.getByRole("button", { name: "Publish", exact: true }),
    ).toBeVisible();

    // Flip it back — verifies the opposite direction and restores the seed.
    await row.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(row.getByText("Published", { exact: true })).toBeVisible();
    await expect(
      row.getByRole("button", { name: "Unpublish", exact: true }),
    ).toBeVisible();
  });

  test("a row revealed via Show more flips in place and the accumulated list survives", async ({
    page,
  }) => {
    await openPlans(page);
    await normalizeToPublished(page, ACCUMULATED_PLAN);

    const row = planRow(page, ACCUMULATED_PLAN);
    const rowsBefore = await planRows(page).count();

    await row.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();

    // The refresh that follows the mutation must not throw away the
    // accumulated "Show more" pages.
    await expect(planRows(page)).toHaveCount(rowsBefore);

    await row.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(row.getByText("Published", { exact: true })).toBeVisible();
  });
});
