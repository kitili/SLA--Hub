# Admin Bulk PDF Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin select lesson plans in the admin table and download them as true server-generated PDFs — a `.zip` of one branded PDF per plan (a single `.pdf` when only one is selected).

**Architecture:** A headless Chromium (driven by `playwright-core`) navigates to a new bare, admin-only print route `/[locale]/print/plans/[slug]` carrying the admin's `__sla_session` cookie, and calls `page.pdf()`. This reuses the existing branded `LessonPlanDocument` and all its CSS/fonts verbatim. A POST API route orchestrates the renders and zips the results. Selection lives in the client `PlansBrowser`.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, next-intl, Playwright (`playwright-core` + `@sparticuz/chromium` for serverless), JSZip, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-06-26-admin-bulk-pdf-download-design.md`

---

## File Structure

**Create:**
- `src/lib/pdf/filename.ts` — pure helper: plan → stable, safe PDF filename.
- `src/lib/pdf/filename.test.ts` — unit tests for the above.
- `src/lib/pdf/request.ts` — pure helper: validate/dedupe/cap the POST body.
- `src/lib/pdf/request.test.ts` — unit tests for the above.
- `src/lib/pdf/browser.ts` — headless Chromium launcher (local + serverless).
- `src/app/[locale]/print/layout.tsx` — minimal layout (no admin shell).
- `src/app/[locale]/print/plans/[slug]/page.tsx` — bare admin-only print page.
- `src/app/api/admin/plans/pdf/route.ts` — POST: render + zip + download.

**Modify:**
- `src/components/admin/PlansTable.tsx` — per-row + header checkboxes.
- `src/components/admin/PlansTable.module.css` — checkbox styles.
- `src/components/admin/PlansBrowser.tsx` — selection state + download bar.
- `src/components/admin/PlansBrowser.module.css` — download-bar styles.
- `messages/en/lpadmin.json` — new strings.
- `messages/sw/lpadmin.json` — new strings.
- `package.json` — 3 new dependencies.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json` (+ lockfile)

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install playwright-core @sparticuz/chromium jszip
```
Expected: the three packages are added under `dependencies` and install succeeds. (`@playwright/test` is already present for e2e; `playwright-core` is the runtime driver.)

- [ ] **Step 2: Ensure a local Chromium exists for dev fallback**

Run:
```bash
npx playwright install chromium
```
Expected: Chromium is downloaded (or already present). This backs the dev launcher's fallback when Google Chrome is not installed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(admin): add playwright-core, @sparticuz/chromium, jszip for PDF export"
```

---

## Task 2: Filename helper (TDD)

**Files:**
- Create: `src/lib/pdf/filename.ts`
- Test: `src/lib/pdf/filename.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/pdf/filename.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { planPdfFilename } from "./filename";

describe("planPdfFilename", () => {
  const base = {
    slug: "g7-math-t1a-w1-l1",
    grade: "G7",
    subject: "Math",
    term: "1a",
    week: 1,
    lesson: 1,
  };

  it("builds a name from the structured parts", () => {
    expect(planPdfFilename(base)).toBe("G7-Math-T1a-W1-L1.pdf");
  });

  it("normalises a grade given without the leading G", () => {
    expect(planPdfFilename({ ...base, grade: "7" })).toBe("G7-Math-T1a-W1-L1.pdf");
  });

  it("strips unsafe characters from the subject", () => {
    expect(planPdfFilename({ ...base, subject: "Social Studies" })).toBe(
      "G7-SocialStudies-T1a-W1-L1.pdf",
    );
  });

  it("falls back to the slug when structured parts are blank", () => {
    expect(
      planPdfFilename({ slug: "my-plan", grade: "", subject: "", term: "", week: 1, lesson: 2 }),
    ).toBe("my-plan-W1-L2.pdf");
  });

  it("uses a safe default when everything is empty", () => {
    expect(
      planPdfFilename({ slug: "", grade: "", subject: "", term: "", week: NaN, lesson: NaN }),
    ).toBe("lesson-plan.pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pdf/filename.test.ts`
Expected: FAIL — `Cannot find module './filename'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/pdf/filename.ts`:
```ts
/**
 * Build a stable, filesystem-safe PDF filename for a lesson plan.
 *
 * Shape: "G7-Math-T1a-W1-L1.pdf", assembled from grade/subject/term/week/lesson.
 * Each token is stripped to alphanumerics; blank structured parts are skipped,
 * and the slug is used as a fallback so the result is never empty.
 */
export interface PlanFilenameParts {
  slug: string;
  grade: string;
  subject: string;
  term: string;
  week: number;
  lesson: number;
}

/** Keep only alphanumerics (drops spaces, slashes, punctuation, etc.). */
function safe(token: string): string {
  return token.replace(/[^A-Za-z0-9]+/g, "");
}

/** Like `safe`, but preserves hyphens — slugs are hyphenated and filename-safe. */
function safeSlug(slug: string): string {
  return slug.replace(/[^A-Za-z0-9-]+/g, "");
}

export function planPdfFilename(plan: PlanFilenameParts): string {
  const grade = safe(String(plan.grade));
  const subject = safe(String(plan.subject));
  const term = safe(String(plan.term));

  const parts = [
    grade ? `G${grade.replace(/^G/i, "")}` : "",
    subject,
    term ? `T${term.replace(/^T/i, "")}` : "",
    Number.isFinite(plan.week) ? `W${plan.week}` : "",
    Number.isFinite(plan.lesson) ? `L${plan.lesson}` : "",
  ].filter(Boolean);

  const slug = safeSlug(plan.slug);
  // Prefix the slug when it has to stand in for missing grade/subject/term.
  const hasStructuredHead = Boolean(grade || subject || term);
  let base: string;
  if (hasStructuredHead) {
    base = parts.join("-");
  } else if (slug) {
    base = [slug, ...parts].join("-");
  } else {
    base = parts.length > 0 ? parts.join("-") : "lesson-plan";
  }

  return `${base}.pdf`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pdf/filename.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/filename.ts src/lib/pdf/filename.test.ts
git commit -m "feat(admin): plan -> safe PDF filename helper"
```

---

## Task 3: Request validation + cap helper (TDD)

**Files:**
- Create: `src/lib/pdf/request.ts`
- Test: `src/lib/pdf/request.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/pdf/request.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { MAX_PDF_PLANS, normalizePdfRequest } from "./request";

describe("normalizePdfRequest", () => {
  it("accepts a valid body and trims + dedupes slugs", () => {
    const out = normalizePdfRequest({ slugs: [" a ", "a", "b"], locale: "en" });
    expect(out).toEqual({ ok: true, slugs: ["a", "b"], locale: "en", dropped: 0 });
  });

  it("rejects a non-array slugs field", () => {
    expect(normalizePdfRequest({ slugs: "a", locale: "en" })).toEqual({
      ok: false,
      error: "Invalid request body.",
    });
  });

  it("rejects a missing locale", () => {
    expect(normalizePdfRequest({ slugs: ["a"] })).toEqual({
      ok: false,
      error: "Invalid request body.",
    });
  });

  it("rejects when every slug is blank", () => {
    expect(normalizePdfRequest({ slugs: ["", "   "], locale: "en" })).toEqual({
      ok: false,
      error: "No plans selected.",
    });
  });

  it("caps at MAX_PDF_PLANS and reports the dropped count", () => {
    const slugs = Array.from({ length: MAX_PDF_PLANS + 3 }, (_, i) => `s${i}`);
    const out = normalizePdfRequest({ slugs, locale: "en" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.slugs).toHaveLength(MAX_PDF_PLANS);
      expect(out.dropped).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pdf/request.test.ts`
Expected: FAIL — `Cannot find module './request'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/pdf/request.ts`:
```ts
import { z } from "zod";

/** Max plans rendered per request — protects the serverless function. */
export const MAX_PDF_PLANS = 40;

const bodySchema = z.object({
  slugs: z.array(z.string()).min(1),
  locale: z.string().min(1),
});

export type NormalizedPdfRequest =
  | { ok: true; slugs: string[]; locale: string; dropped: number }
  | { ok: false; error: string };

/**
 * Validate and normalise the PDF-export POST body.
 *
 * Pure (no I/O): zod-validates the shape, then trims/drops-blank/dedupes the
 * slugs (preserving order) and caps the count at {@link MAX_PDF_PLANS},
 * reporting how many were dropped.
 */
export function normalizePdfRequest(input: unknown): NormalizedPdfRequest {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request body." };
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of parsed.data.slugs) {
    const s = raw.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      cleaned.push(s);
    }
  }

  if (cleaned.length === 0) {
    return { ok: false, error: "No plans selected." };
  }

  const dropped = Math.max(0, cleaned.length - MAX_PDF_PLANS);
  return {
    ok: true,
    slugs: cleaned.slice(0, MAX_PDF_PLANS),
    locale: parsed.data.locale.trim(),
    dropped,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pdf/request.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/request.ts src/lib/pdf/request.test.ts
git commit -m "feat(admin): validate/dedupe/cap the PDF-export request body"
```

---

## Task 4: Headless browser launcher

**Files:**
- Create: `src/lib/pdf/browser.ts`

(No unit test — launching a browser is integration-level; it is exercised by the manual verification in Task 9.)

- [ ] **Step 1: Write the launcher**

Create `src/lib/pdf/browser.ts`:
```ts
import "server-only";

import { chromium, type Browser } from "playwright-core";

/**
 * Launch a headless Chromium for server-side PDF rendering.
 *
 * - Serverless (Vercel / production): use the @sparticuz/chromium binary, which
 *   ships a Lambda-compatible Chromium.
 * - Local dev: prefer the installed Google Chrome (channel "chrome"); if it is
 *   not present, fall back to Playwright's bundled chromium
 *   (`npx playwright install chromium`).
 */
export async function launchBrowser(): Promise<Browser> {
  const isServerless =
    Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

  if (isServerless) {
    const chromiumPkg = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true,
    });
  }

  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    // Google Chrome not installed locally — use Playwright's bundled chromium.
    return chromium.launch({ headless: true });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors from the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/browser.ts
git commit -m "feat(admin): headless Chromium launcher (local + serverless)"
```

---

## Task 5: Print route + minimal layout

**Files:**
- Create: `src/app/[locale]/print/layout.tsx`
- Create: `src/app/[locale]/print/plans/[slug]/page.tsx`

- [ ] **Step 1: Write the minimal layout**

Create `src/app/[locale]/print/layout.tsx`:
```tsx
import type { ReactNode } from "react";

/**
 * Minimal layout for print/PDF routes.
 *
 * Renders only its children — no admin shell or sidebar — so a headless browser
 * captures just the document. The root [locale] layout still supplies the
 * next-intl context and brand fonts. Pages under here guard with requireAdmin().
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return children;
}
```

- [ ] **Step 2: Write the print page**

Create `src/app/[locale]/print/plans/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonPlans } from "@/lib/db/schema";
import LessonPlanDocument from "@/components/lesson/document/LessonPlanDocument";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";

/**
 * Bare, admin-only print page for a single lesson plan (ANY status).
 *
 * Rendered headlessly by the PDF API route (and directly viewable by an admin as
 * a preview). Renders the branded structured document when content_json is a
 * valid StructuredLessonPlan, else a minimal, escaped markdown fallback (never
 * dangerouslySetInnerHTML). No admin shell — see ../layout.tsx.
 */
export const dynamic = "force-dynamic";

export default async function PlanPrintPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;

  const [plan] = await db
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.slug, slug))
    .limit(1);

  if (!plan) {
    notFound();
  }

  const structured = structuredLessonPlanSchema.safeParse(plan.contentJson);
  if (structured.success) {
    return <LessonPlanDocument plan={structured.data} />;
  }

  // Fallback for legacy/markdown-only plans: escaped, whitespace-preserved body.
  return (
    <main
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: "2rem",
        whiteSpace: "pre-wrap",
        fontFamily: "Georgia, serif",
        color: "#1a1a1a",
      }}
    >
      <h1>{plan.title}</h1>
      {plan.contentMarkdown}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke (dev server running)**

With `npm run dev` running and signed in as an admin in the browser, open
`http://localhost:3000/en/print/plans/<a-real-slug>`.
Expected: the branded 3-page document renders with no admin sidebar. (Find a real slug in the admin plans list.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/print"
git commit -m "feat(admin): bare admin-only print route for a single plan"
```

---

## Task 6: PDF API route

**Files:**
- Create: `src/app/api/admin/plans/pdf/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/plans/pdf/route.ts`:
```ts
import "server-only";

import { cookies, headers } from "next/headers";
import { inArray } from "drizzle-orm";
import JSZip from "jszip";
import type { Browser } from "playwright-core";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonPlans } from "@/lib/db/schema";
import { launchBrowser } from "@/lib/pdf/browser";
import { planPdfFilename } from "@/lib/pdf/filename";
import { normalizePdfRequest } from "@/lib/pdf/request";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__sla_session";

/** Ensure each entry in the zip gets a distinct name. */
function uniqueName(used: Set<string>, name: string, slug: string): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const collisionFree = name.replace(/\.pdf$/i, `-${slug}.pdf`);
  used.add(collisionFree);
  return collisionFree;
}

export async function POST(req: Request): Promise<Response> {
  // Defensive admin check (the print page also guards). Avoids redirect-in-route.
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const normalized = normalizePdfRequest(rawBody);
  if (!normalized.ok) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }
  const { slugs, locale, dropped } = normalized;
  if (dropped > 0) {
    console.warn(`[admin/pdf] capped request: dropped ${dropped} plan(s) over the limit.`);
  }

  // Resolve rows we need for filenames; drop unknown slugs.
  const rows = await db
    .select({
      slug: lessonPlans.slug,
      grade: lessonPlans.grade,
      subject: lessonPlans.subject,
      term: lessonPlans.term,
      week: lessonPlans.week,
      lesson: lessonPlans.lesson,
    })
    .from(lessonPlans)
    .where(inArray(lessonPlans.slug, slugs));

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const known = slugs.filter((s) => bySlug.has(s));
  if (known.length === 0) {
    return Response.json(
      { error: "None of the selected plans were found." },
      { status: 404 },
    );
  }

  // Session cookie + origin so the headless browser can reach our own route.
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionValue) {
    return Response.json({ error: "No active session." }, { status: 401 });
  }
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: sessionValue,
        domain: host.split(":")[0]!,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const pdfs: { name: string; buf: Buffer }[] = [];
    const usedNames = new Set<string>();

    for (const slug of known) {
      const page = await context.newPage();
      try {
        const url = `${origin}/${locale}/print/plans/${encodeURIComponent(slug)}`;
        await page.goto(url, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const buf = Buffer.from(await page.pdf({ format: "A4", printBackground: true }));
        const name = uniqueName(usedNames, planPdfFilename(bySlug.get(slug)!), slug);
        pdfs.push({ name, buf });
      } finally {
        await page.close();
      }
    }

    if (pdfs.length === 1) {
      const only = pdfs[0]!;
      return new Response(only.buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${only.name}"`,
        },
      });
    }

    const zip = new JSZip();
    for (const { name, buf } of pdfs) zip.file(name, buf);
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(zipBuf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="lesson-plans.zip"`,
      },
    });
  } catch (err) {
    console.error("[admin/pdf] generation failed", err);
    return Response.json({ error: "Could not generate PDF." }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If `new Response(buf, ...)` complains about `Buffer`, wrap as `new Response(new Uint8Array(only.buf), ...)` and `new Uint8Array(zipBuf)`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/plans/pdf/route.ts
git commit -m "feat(admin): POST /api/admin/plans/pdf — render + zip lesson-plan PDFs"
```

---

## Task 7: i18n strings

**Files:**
- Modify: `messages/en/lpadmin.json`
- Modify: `messages/sw/lpadmin.json`

- [ ] **Step 1: Add English strings**

In `messages/en/lpadmin.json`, under `lpAdmin.plans.table`, add these keys (alongside `confirmDelete` / `genericError`):
```json
"selectRow": "Select {title}",
"selectAll": "Select all visible plans"
```

And add a new `download` block directly under `lpAdmin.plans` (sibling of `showMore`):
```json
"download": {
  "selected": "{count, plural, one {# plan selected} other {# plans selected}}",
  "label": "Download {count, plural, one {# plan} other {# plans}}",
  "generating": "Generating…",
  "error": "Could not generate the PDF. Try again."
}
```

- [ ] **Step 2: Add Swahili strings**

In `messages/sw/lpadmin.json`, under `lpAdmin.plans.table`, add:
```json
"selectRow": "Chagua {title}",
"selectAll": "Chagua mipango yote inayoonekana"
```

And under `lpAdmin.plans`:
```json
"download": {
  "selected": "{count, plural, one {mpango # umechaguliwa} other {mipango # imechaguliwa}}",
  "label": "Pakua {count, plural, one {mpango #} other {mipango #}}",
  "generating": "Inatengeneza…",
  "error": "Imeshindwa kutengeneza PDF. Jaribu tena."
}
```

- [ ] **Step 3: Validate JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en/lpadmin.json','utf8'));JSON.parse(require('fs').readFileSync('messages/sw/lpadmin.json','utf8'));console.log('ok')"
```
Expected: prints `ok` (both files parse).

- [ ] **Step 4: Commit**

```bash
git add messages/en/lpadmin.json messages/sw/lpadmin.json
git commit -m "i18n(admin): strings for plan selection + PDF download"
```

---

## Task 8: UI — checkboxes + download bar

**Files:**
- Modify: `src/components/admin/PlansTable.tsx`
- Modify: `src/components/admin/PlansTable.module.css`
- Modify: `src/components/admin/PlansBrowser.tsx`
- Modify: `src/components/admin/PlansBrowser.module.css`

- [ ] **Step 1: Add selection props to `PlansTable`**

In `src/components/admin/PlansTable.tsx`, change the props interfaces and thread selection down. Replace the `PlansTableProps` interface and the `PlanRowItem` signature/usage:

Replace:
```ts
export interface PlansTableProps {
  plans: PlanRow[];
}

function PlanRowItem({ plan }: { plan: PlanRow }) {
```
with:
```ts
export interface PlansTableProps {
  plans: PlanRow[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
  onToggleAllVisible: () => void;
  allVisibleSelected: boolean;
}

function PlanRowItem({
  plan,
  checked,
  onToggle,
}: {
  plan: PlanRow;
  checked: boolean;
  onToggle: (slug: string) => void;
}) {
```

- [ ] **Step 2: Render the per-row checkbox**

In `PlanRowItem`, replace the `cellTitle` block:
```tsx
      <div className={styles.cellTitle}>
        <Link href={`/admin/plans/${plan.slug}/edit`} className={styles.title}>
          {plan.title}
        </Link>
        <span className={styles.slug}>{plan.slug}</span>
      </div>
```
with:
```tsx
      <div className={styles.cellTitle}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={checked}
          onChange={() => onToggle(plan.slug)}
          aria-label={t("table.selectRow", { title: plan.title })}
        />
        <span className={styles.titleText}>
          <Link href={`/admin/plans/${plan.slug}/edit`} className={styles.title}>
            {plan.title}
          </Link>
          <span className={styles.slug}>{plan.slug}</span>
        </span>
      </div>
```
(`t` is already defined in `PlanRowItem` as `useTranslations("lpAdmin.plans.table")`.)

- [ ] **Step 3: Render the header select-all checkbox + pass props through**

Replace the default-export `PlansTable` function body:
```tsx
export default function PlansTable({ plans }: PlansTableProps) {
  const t = useTranslations("lpAdmin.plans");

  if (plans.length === 0) {
    return <p className={styles.empty}>{t("empty")}</p>;
  }

  return (
    <ul className={styles.list}>
      <li className={styles.headerRow} aria-hidden="true">
        <span>{t("table.plan")}</span>
        <span>{t("table.details")}</span>
        <span>{t("table.status")}</span>
        <span className={styles.headerActions}>{t("table.actions")}</span>
      </li>
      {plans.map((plan) => (
        <PlanRowItem key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}
```
with:
```tsx
export default function PlansTable({
  plans,
  selected,
  onToggle,
  onToggleAllVisible,
  allVisibleSelected,
}: PlansTableProps) {
  const t = useTranslations("lpAdmin.plans");

  if (plans.length === 0) {
    return <p className={styles.empty}>{t("empty")}</p>;
  }

  return (
    <ul className={styles.list}>
      <li className={styles.headerRow}>
        <span className={styles.headerSelect}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={allVisibleSelected}
            onChange={onToggleAllVisible}
            aria-label={t("table.selectAll")}
          />
          {t("table.plan")}
        </span>
        <span>{t("table.details")}</span>
        <span>{t("table.status")}</span>
        <span className={styles.headerActions}>{t("table.actions")}</span>
      </li>
      {plans.map((plan) => (
        <PlanRowItem
          key={plan.id}
          plan={plan}
          checked={selected.has(plan.slug)}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}
```
(Note: the header row drops `aria-hidden="true"` because it now contains an interactive control.)

- [ ] **Step 4: Add checkbox CSS to `PlansTable.module.css`**

Replace the `.cellTitle` rule:
```css
.cellTitle {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}
```
with:
```css
.cellTitle {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
}

.titleText {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.checkbox {
  width: 1.1rem;
  height: 1.1rem;
  flex: none;
  cursor: pointer;
  accent-color: var(--electric-blue);
}

.headerSelect {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
}
```

- [ ] **Step 5: Add selection state + download bar to `PlansBrowser`**

In `src/components/admin/PlansBrowser.tsx`, update the imports:
```ts
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
```
Inside the component, after the existing `useState`/`useTransition` hooks, add:
```tsx
  const locale = useLocale();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const visibleSlugs = plans.map((p) => p.slug);
  const allVisibleSelected =
    visibleSlugs.length > 0 && visibleSlugs.every((s) => selected.has(s));

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleSlugs.forEach((s) => next.delete(s));
      else visibleSlugs.forEach((s) => next.add(s));
      return next;
    });
  }

  async function onDownload() {
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/plans/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: [...selected], locale }),
      });
      if (!res.ok) throw new Error("request failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? "lesson-plans.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(t("download.error"));
    } finally {
      setDownloading(false);
    }
  }
```
Then replace the render's `<PlansTable plans={plans} />` with:
```tsx
      {selected.size > 0 ? (
        <div className={styles.downloadBar}>
          <span className={styles.downloadCount}>
            {t("download.selected", { count: selected.size })}
          </span>
          <button
            type="button"
            className={styles.downloadButton}
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading
              ? t("download.generating")
              : t("download.label", { count: selected.size })}
          </button>
          {downloadError ? (
            <p className={styles.error} role="alert">
              {downloadError}
            </p>
          ) : null}
        </div>
      ) : null}

      <PlansTable
        plans={plans}
        selected={selected}
        onToggle={toggle}
        onToggleAllVisible={toggleAllVisible}
        allVisibleSelected={allVisibleSelected}
      />
```

- [ ] **Step 6: Add download-bar CSS to `PlansBrowser.module.css`**

Append:
```css
.downloadBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: var(--light-blue-30);
  border: 1px solid var(--light-blue);
  border-radius: var(--radius-sm);
}

.downloadCount {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-muted);
}

.downloadButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.25rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--white);
  background: var(--electric-blue);
  border: 1px solid var(--electric-blue);
  border-radius: var(--radius-sm);
  transition: opacity 0.15s ease;
}

.downloadButton:hover {
  opacity: 0.9;
}

.downloadButton:disabled {
  opacity: 0.6;
  cursor: progress;
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/PlansTable.tsx src/components/admin/PlansTable.module.css src/components/admin/PlansBrowser.tsx src/components/admin/PlansBrowser.module.css
git commit -m "feat(admin): row selection + bulk PDF download bar"
```

---

## Task 9: Full-stack verification

**Files:** none (manual + test run)

- [ ] **Step 1: Run the unit suite**

Run: `npm run test`
Expected: PASS, including `filename.test.ts` and `request.test.ts`.

- [ ] **Step 2: Verify the end-to-end flow in dev**

With `npm run dev` running and signed in as an admin:
1. Go to `/en/admin/plans`.
2. Check two or more plan rows → the download bar shows "N plans selected".
3. Click "Download N plans".
Expected: a `lesson-plans.zip` downloads containing one branded PDF per plan,
each filename like `G7-Math-T1a-W1-L1.pdf`, each PDF the 3-page A4 document.

- [ ] **Step 3: Verify the single-plan path**

Select exactly one plan and download.
Expected: a single `.pdf` (not a zip) downloads.

- [ ] **Step 4: Verify the select-all header checkbox**

Click the header checkbox.
Expected: all visible rows toggle on/off together; the bar count matches.

- [ ] **Step 5: Final verification commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test(admin): verify bulk PDF download flow"
```
(Skip if Steps 1–4 needed no changes.)

---

## Notes / known risks

- **Serverless tuning:** `@sparticuz/chromium` on Vercel may need extra config
  (function memory, `maxDuration`, and possibly `chromium.setGraphicsMode = false`).
  This is wired but only fully validated at deploy time — Vercel deploy is still
  pending for this project. Local dev is the primary validation path now.
- **Buffer → Response:** if `tsc` rejects passing a `Buffer` as a `BodyInit`,
  wrap with `new Uint8Array(...)` as noted in Task 6, Step 2.
- **Cookie domain:** `addCookies` uses the bare host (no port). Playwright matches
  cookies by hostname, so `localhost` works in dev and the deployment host works
  in prod.
- **PDF e2e:** asserting the exact PDF bytes is out of scope for v1; the print
  route is smoke-tested manually (Task 5, Step 4) and via the full flow (Task 9).
