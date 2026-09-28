# Admin Bulk PDF Download — Design

**Date:** 2026-06-26
**Status:** Approved (pending spec review)

## Goal

Let an admin select multiple lesson plans in the admin plans table and download
them as PDFs — a `.zip` containing one branded PDF per plan (a single `.pdf`
when exactly one plan is selected). The PDFs are true, server-generated files,
not a browser "Save as PDF" prompt.

## Context

- Lesson plans live in the `lessonPlans` table. Each row has a structured
  `contentJson` (a `StructuredLessonPlan`) and a `contentMarkdown` fallback.
- A polished, branded **3-page A4 document** already exists:
  `src/components/lesson/document/LessonPlanDocument.tsx`, styled by
  `lessonPlanDocument.module.css` (653 lines, `@page` + `@media print` rules,
  7 brand fonts and 2 raster patterns served from `/public/brand`). It is
  rendered today on the public plan page `/[locale]/plans/[slug]`.
- The admin plans list (`PlansBrowser` → `PlansTable`) currently offers only
  Publish / Edit / Delete. `PlansBrowser` (client) owns the accumulating `plans`
  array and "Show more"; it remounts (resetting state) when filters change.
- Auth: a signed, httpOnly session cookie `__sla_session`. `requireAdmin()`
  (`@/lib/auth`) guards admin pages and server actions.

## Approach

**Navigate a headless browser to a dedicated, admin-only print route.** The API
route launches headless Chromium, copies the caller's `__sla_session` cookie
into the browser context, navigates to a bare `/[locale]/print/plans/[slug]`
page, and calls `page.pdf()`. Chromium renders the *real* Next page, so the
existing `LessonPlanDocument` and all its CSS + fonts are reused verbatim with
zero layout duplication, and the document's `@media print` rules apply (the
in-document print bar is already hidden in print).

Rejected alternative: render the component to an HTML string and use
`page.setContent()`. It avoids the cookie/origin handling but breaks with CSS
modules — the compiled CSS text is not available at runtime, only the hashed
class-name map.

## Components

### 1. Print route — `src/app/[locale]/print/plans/[slug]/page.tsx`

- `requireAdmin()` first (admin-only; navigated to by the headless browser
  carrying the admin's session cookie).
- Load the plan by `slug` at **any status** (admins need drafts, not just
  published).
- `safeParse` `contentJson` with `structuredLessonPlanSchema`:
  - valid → render `<LessonPlanDocument plan={...} />`
  - invalid/absent → render a minimal, safe markdown fallback (reuse the same
    no-`dangerouslySetInnerHTML` rendering already used on the public page).
- `notFound()` when the slug does not exist.

### 2. Minimal print layout — `src/app/[locale]/print/layout.tsx`

- Renders only `{children}` (plus whatever the root `[locale]/layout.tsx`
  already provides: i18n provider, fonts). Crucially it does **not** include the
  admin shell/sidebar, so the PDF contains only the document.

### 3. PDF API route — `src/app/api/admin/plans/pdf/route.ts`

- `export const runtime = "nodejs"` and a raised `maxDuration` (e.g. 60).
- POST. `requireAdmin()`.
- Body validated with zod: `{ slugs: string[], locale: string }`.
  - Trim/dedupe slugs; reject empty.
  - **Cap at 40 plans per request.** If more are requested, process the first 40
    and `console.warn` how many were dropped (no silent truncation).
- Read the incoming `__sla_session` cookie value via `cookies()`.
- Resolve the origin from request headers (`host` + `x-forwarded-proto`, falling
  back to `http`), so the browser can reach the app's own print route.
- Launch a browser (via the launcher below), create one context, add the
  `__sla_session` cookie scoped to the origin host.
- For each slug: open a page, `goto(\`${origin}/${locale}/print/plans/${slug}\`,
  { waitUntil: "networkidle" })`, wait for `document.fonts.ready`, then
  `page.pdf({ format: "A4", printBackground: true })` → `Buffer`.
- Always close the browser in a `finally`.
- Response:
  - exactly one PDF → return it directly as `application/pdf` with
    `Content-Disposition: attachment; filename="<plan>.pdf"`.
  - two or more → zip with `jszip` and return `application/zip` as
    `lesson-plans.zip`.
- Per-plan filename comes from the filename helper (below).
- Errors return a JSON `{ error }` with an appropriate status; the client shows
  it inline.

### 4. Browser launcher — `src/lib/pdf/browser.ts`

- Single `launchBrowser(): Promise<Browser>` using `playwright-core`.
- Serverless (`process.env.VERCEL` or `NODE_ENV === "production"`): use
  `@sparticuz/chromium` — `args`, `executablePath()`, `headless: true`.
- Local dev: try `chromium.launch({ channel: "chrome", headless: true })`; if
  that throws (Chrome not installed), fall back to a plain
  `chromium.launch({ headless: true })` using Playwright's bundled binary.

### 5. Filename helper — `src/lib/pdf/filename.ts`

- Pure function `planPdfFilename(plan): string` → a stable, filesystem-safe name
  such as `G7-Math-T1-W1-L1.pdf`, derived from grade/subject/term/week/lesson,
  with a slug fallback. Unit-tested.

### 6. UI — selection + download

- **`PlansBrowser`** owns selection state (`Set<string>` of slugs) so it
  survives "Show more" and resets on filter-driven remount.
  - Renders a download action bar when `selected.size > 0`:
    **"Download N selected"**, disabled while a request is in flight.
  - On click: POST `{ slugs, locale }` (locale via `useLocale`) to
    `/api/admin/plans/pdf`, read the response blob, create an object URL, click a
    temporary anchor with the `Content-Disposition` filename, revoke the URL.
  - Inline error message on failure; spinner/disabled state while pending.
- **`PlansTable`** gains a per-row checkbox and a header "select visible"
  checkbox, driven by props from `PlansBrowser`
  (`selected`, `onToggle(slug)`, `onToggleAllVisible()`). Existing row actions
  unchanged.
- New i18n strings under `lpAdmin.plans` (download label, generating, error,
  select-all aria-label, etc.).

## Data flow

```
admin checks rows  →  PlansBrowser.selected (Set<slug>)
   → "Download N selected"  →  POST /api/admin/plans/pdf { slugs, locale }
      → requireAdmin(); validate+cap; read __sla_session; resolve origin
      → launchBrowser(); context + cookie
      → for each slug: goto /[locale]/print/plans/[slug] → page.pdf() → Buffer
      → 1 file: application/pdf | N files: jszip → application/zip
   → client: blob → object URL → anchor download
```

## Error handling

- Non-admin → `requireAdmin()` redirects (page) / the route returns 401-style
  JSON for non-admin (defensive; the page guard is primary).
- Invalid body / empty slugs → 400 JSON.
- Unknown slug → that plan's print page `notFound()`s; the route records the
  failure for that slug and continues with the rest, surfacing a partial result
  message rather than failing the whole batch.
- Browser launch failure → 500 JSON with a clear message; the launcher's
  dev fallback covers the missing-Chrome case.
- Browser always closed in `finally`.

## Dependencies (new)

- `playwright-core` — drive headless Chromium at runtime.
- `@sparticuz/chromium` — serverless-compatible Chromium binary for Vercel.
- `jszip` — bundle multiple PDFs into a `.zip`.

(`@playwright/test` already present for e2e.)

## Testing

- **Unit (vitest):**
  - `filename.test.ts` — `planPdfFilename` for typical/edge inputs (missing
    fields, unsafe characters, slug fallback).
  - request validation/cap logic extracted to a pure helper and tested (empty
    slugs rejected, dedupe, cap at 40 with a reported drop count).
- **E2E (Playwright):** sign in as admin, hit `/[locale]/print/plans/[slug]` for
  a seeded plan, assert the branded document renders (and the admin shell does
  not). A full PDF-bytes assertion is out of scope for v1.

## Runtime / deployment notes

- Headless Chromium requires the Node runtime, more memory, and a longer
  `maxDuration` than defaults — configured on the API route.
- The headless browser navigates to the app's **own** deployment origin and must
  present the admin session cookie; both are derived from the incoming request.
- Vercel deployment is still pending in this project, so the serverless path is
  wired but only fully validated at deploy time. Local dev is the primary
  validation path for now.

## Out of scope (YAGNI)

- A single combined PDF (chose zip-of-separate).
- "Download all matching the current filter" shortcut (chose per-row checkboxes).
- Selecting across multiple "Show more" pages beyond what naturally accumulates
  in `PlansBrowser`.
- Customising page size / branding per download.
