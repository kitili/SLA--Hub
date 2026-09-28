/**
 * mobile-responsive.spec.ts
 *
 * Regression guard for MOBILE FRIENDLINESS. Runs on the mobile device projects
 * defined in playwright.config.ts (iPhone SE, Pixel 5, iPad Mini) as well as
 * Desktop Chrome.
 *
 * Core guarantee: no element is clipped off the right edge of the viewport.
 *
 * IMPORTANT — why we don't just check `document.body.scrollWidth`:
 * globals.css sets `html, body { overflow-x: hidden }`, which HIDES horizontal
 * overflow rather than fixing it. So the body never reports a horizontal
 * scrollbar even when content spills past the viewport. Instead we walk the DOM
 * and flag any element whose right edge exceeds the viewport — EXCEPT elements
 * contained by an ancestor that legitimately scrolls horizontally
 * (`overflow-x: auto | scroll`), e.g. the admin data tables and nav tab strip,
 * which are accessible via swipe. Everything else that overflows would be
 * clipped by the global `overflow-x: hidden` and is therefore broken on mobile.
 */

import { test, expect, type BrowserContext } from "@playwright/test";

import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  readAdminStaffId,
} from "./auth-helpers";

/**
 * Establish a signed-in ADMIN session by forging a session cookie for the
 * seeded `hr@silverleaf.co.tz` account (id captured by global-setup). An admin
 * session is required so the sweep actually lands on the /admin routes — a
 * non-admin would be redirected to /en, silently skipping them. The cookie is
 * signed with the e2e SESSION_SECRET pinned in playwright.config's
 * webServer.env, so a fresh harness-started server accepts it. This avoids the
 * live ed-admin directory (the sole UI sign-in gate, unavailable in CI).
 */
async function signIn(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: mintSessionCookie(readAdminStaffId()),
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

/**
 * Returns short descriptors of elements that overflow the viewport horizontally
 * and are NOT inside a horizontally-scrollable ancestor — i.e. content the
 * global `overflow-x: hidden` would clip. An empty array means the page fits.
 */
function findBrokenOverflow(): string[] {
  const vw = document.documentElement.clientWidth;
  const broken: string[] = [];
  document.querySelectorAll("body *").forEach((el) => {
    if ((el as HTMLElement).closest("nextjs-portal")) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right <= vw + 1 && r.width <= vw + 1) return;

    // Accessible if some ancestor scrolls horizontally (table wrappers, tab strip).
    let p = el.parentElement;
    let scrollable = false;
    while (p && p !== document.documentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll") {
        scrollable = true;
        break;
      }
      p = p.parentElement;
    }
    if (scrollable) return;

    // Only report the outermost offender (skip children of an overflowing parent).
    const pr = el.parentElement?.getBoundingClientRect();
    if (pr && (pr.right > vw + 1 || pr.width > vw + 1)) return;

    const cls =
      typeof el.className === "string"
        ? el.className.replace(/\s+/g, ".").slice(0, 40)
        : "";
    broken.push(
      `${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} vw=${vw}`,
    );
  });
  return broken;
}

// Every primary user-facing route, member + admin. The `/plans/<slug>` entry
// uses a slug seeded by db:seed (see src/lib/db/scripts/seed.ts) so the lesson
// detail page renders real content rather than a not-found shell.
const ROUTES = [
  "/en",
  "/en/search",
  "/en/plans/g2-arithmetic-t1a-w2-l1",
  "/en/admin",
  "/en/admin/plans",
  "/en/admin/feedback",
  "/en/admin/ai-studio",
  "/en/admin/ai-studio/settings",
  "/en/admin/ai-studio/schemes",
  "/en/admin/ai-studio/textbooks",
  "/en/admin/ai-studio/batch",
];

test.describe("Mobile responsiveness", () => {
  test("viewport meta is present and zoom is not restricted", async ({
    page,
  }) => {
    await page.goto("/en");
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(content).toContain("width=device-width");
    // Accessibility: users must be able to pinch-zoom.
    expect(content ?? "").not.toContain("maximum-scale");
    expect(content ?? "").not.toContain("user-scalable=no");
  });

  for (const route of ROUTES) {
    test(`no clipped horizontal overflow @ ${route}`, async ({
      page,
      context,
    }) => {
      await signIn(context);
      await page.goto(route);
      await page.waitForLoadState("load");
      // Let any client islands (forms, tables) hydrate and lay out.
      await page.waitForTimeout(400);

      const broken = await page.evaluate(findBrokenOverflow);
      expect(
        broken,
        `Elements clipped off-screen at ${route}:\n${broken.join("\n")}`,
      ).toEqual([]);
    });
  }
});
