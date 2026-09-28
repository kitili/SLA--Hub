# Admin area — modern design refresh

**Date:** 2026-06-25
**Branch:** `feat/ai-studio-v2` (build on top of the in-progress AI Studio v2 work)
**Status:** Design — awaiting review

## Goal

Give the whole `/[locale]/admin/**` area a modern visual upgrade while staying
unmistakably **Silverleaf**. Same brand palette, type, and tone; updated
structure, depth, spacing, iconography, and micro-interactions.

Reference points (from web research on 2025–2026 admin/SaaS UI): Linear, Vercel,
Notion, Stripe — restraint, a persistent sidebar, icon-led KPI cards, clear
hierarchy, soft depth, smooth transitions.

## Non-goals

- No change to the brand palette, Montserrat, or the cool-grey/white surface
  system. We *extend* tokens, we don't replace them.
- No data/logic changes. Server actions, queries, auth gating, and i18n keys
  stay as they are (we add a few nav/aria strings only).
- No component-library migration (no shadcn/Tailwind). Stays CSS Modules +
  `globals.css` tokens, matching the existing codebase.
- No redesign of the public/teacher-facing app — admin only.

## Current state (as built)

- `app/[locale]/admin/layout.tsx` — gate + a flat navy `<header>` (inline
  styles) + `<AdminNav />` (horizontal tabs) + centered `<main>` (max 1100px).
- `components/admin/AdminNav.tsx` + `.module.css` — horizontal tab bar:
  Dashboard · Plans · Feedback · AI Studio. Underline-active in gold.
- `app/[locale]/admin/ai-studio/layout.tsx` + `AiStudioNav.tsx` — a second
  horizontal tab row for Studio · Schemes · Textbooks · Prompts.
- `app/[locale]/admin/page.tsx` — dashboard built with heavy **inline styles**;
  `InsightCards` (KPI grid) + section cards (most/least viewed, no-result
  searches, lowest rated, recent comments, feedback hour).
- Inner pages: Plans (`PlansBrowser`, `PlansTable`, `PlansFilterBar`), Feedback
  (`FeedbackTable`), AI Studio panels — each with their own `.module.css`.
- Tokens live in `src/app/globals.css` (`:root`): navy/gold/light-blue palette,
  `--ink*` text tokens, `--app-bg`, `--card`, `--shadow*`, `--radius*`,
  `--focus-ring`.

## Design

### 1. Shell — sidebar + content top-bar

Replace the flat navy header + horizontal `AdminNav` tabs with a two-part shell:

**Left sidebar (`AdminSidebar`, new client component)**
- Navy surface (`--navy`), full-height, ~220px wide on desktop.
- Brand lockup at top (gold "S" mark + "Silverleaf" wordmark).
- Primary nav items with Tabler-style icons + labels:
  Dashboard · AI Studio · Plans · Feedback.
  Active item: subtle gold-tinted background + a gold left indicator bar.
  (Reuse the existing `isActive` prefix/exact logic from `AdminNav`.)
- Footer: current user (initials avatar + name + "Admin") and a logout control.
- Collapsible: a collapse toggle narrows it to an icon-only rail (~64px) on
  desktop; preference persisted in `localStorage`.

**Content top-bar (part of `admin/layout.tsx`)**
- Slim bar above page content: section/breadcrumb label + page title on the
  left; a "← Hub" link (back to teacher home) on the right. Search field is
  out of scope for now (visual placeholder only if cheap; otherwise omitted).
- Hosts the mobile hamburger (see responsive).

**Layout container**
- `admin/layout.tsx` becomes a flex shell: `<AdminSidebar />` + a right column
  holding the top-bar and `<main>`. `<main>` keeps a comfortable max content
  width and page padding.

**Responsive (preserve existing mobile-first behavior)**
- ≤900px: sidebar becomes an off-canvas drawer; a hamburger in the top-bar
  opens it; a scrim closes it. Body scroll lock while open.
- ≤600px: top-bar tightens; drawer is full-height. Touch targets ≥44px.

**Icons**
- Introduce a tiny inline-SVG icon set (`components/admin/icons.tsx`) for the
  nav + cards. No new dependency; outline style, `currentColor`, `aria-hidden`.

### 2. Tokens — extend `globals.css`

Add (do not remove/rename existing vars):
- `--sidebar-bg` (navy) and `--sidebar-active` (gold-tint) surfaces.
- `--shadow-hover` (slightly lifted) for interactive card hover.
- `--transition` (e.g. `0.15s ease`) shared timing token.
- `--ring-inset` focus helper if needed for sidebar items on navy.

Keep `--radius`/`--radius-sm`; introduce `--radius-lg` (e.g. 16px) for the
larger shell/card corners used by the refresh.

### 3. Dashboard

- Move `app/[locale]/admin/page.tsx` inline styles into a new
  `page.module.css` (or `Dashboard.module.css`). Server component stays; only
  styling moves.
- `InsightCards`: icon-led KPI cards — small icon top-right, label, big value,
  optional trend/sub-line. Hover lift. Keep the 1→2→4 responsive grid.
- Section cards: icon + title header, refined row dividers, hover lift,
  consistent spacing. "Recent comments" keeps its tinted inner bubbles.

### 4. Inner-page consistency pass

Apply the unified look so the area reads as one product:
- **AI Studio sub-nav** (`AiStudioNav`): restyle from a tab row into a modern
  **segmented/pill control** sitting at the top of the AI Studio content; keep
  the component + active logic, update `.module.css`.
- **Tables** (`PlansTable`, `FeedbackTable`): card-wrapped, lighter row
  dividers, gold/navy accents, hover row highlight, consistent header style.
- **Filter bars** (`PlansFilterBar`, `SearchFilters`): unified input/select/
  button styling (radius, border, focus ring) drawn from tokens.
- **Buttons & inputs**: a shared set of token-driven styles reused across
  panels (primary navy, secondary outline, subtle/ghost). No global element
  restyle that would leak into the public app — admin-scoped modules only.
- AI Studio panels (`ModelPromptPanel`, `SchemeLessonPanel`, `Panel`, etc.):
  align card chrome, headers, and spacing to the refreshed system.

## Components & files

New:
- `components/admin/AdminSidebar.tsx` + `.module.css`
- `components/admin/AdminTopBar.tsx` + `.module.css` (or inline in layout)
- `components/admin/icons.tsx`
- `app/[locale]/admin/Dashboard.module.css` (dashboard styles)

Changed:
- `app/[locale]/admin/layout.tsx` (shell composition)
- `app/[locale]/admin/page.tsx` (inline → module classes)
- `components/admin/InsightCards.{tsx,module.css}`
- `components/admin/AdminNav.tsx` → repurposed/retired in favor of sidebar
  (keep file only if a horizontal fallback is wanted; otherwise remove).
- `app/[locale]/admin/ai-studio/AiStudioNav.module.css` (segmented restyle)
- `globals.css` (token additions)
- Inner page modules (tables, filter bars, panels) — incremental.

i18n: reuse existing `lpAdmin.nav` / `lpStudio.subnav` keys; add aria labels
for sidebar/drawer/collapse as needed in `messages/{en,sw}`.

## Build phases (commit after each)

1. **Shell + tokens** — sidebar, top-bar, responsive drawer, token additions,
   layout wiring. Admin is fully navigable on desktop + mobile.
2. **Dashboard** — InsightCards + section cards + inline→module migration.
3. **Inner-page consistency** — AI Studio sub-nav, tables, filter bars,
   buttons/inputs, panel chrome.

## Testing / verification

- e2e `admin-gate.spec.ts` and `mobile-responsive.spec.ts` still pass (gate +
  responsive). Update selectors if nav markup changes.
- Manual: run the app, verify each admin route renders, sidebar active states
  are correct, drawer opens/closes on mobile, keyboard focus is visible on the
  navy sidebar, and no horizontal overflow at 360/600/900/1200px.
- Confirm contrast (AA) for text on navy sidebar and gold accents.

## Risks

- Layout sits on top of in-progress AI Studio v2 changes — coordinate with the
  uncommitted `AiStudioNav`/`PlansBrowser` work; phase 1 touches `layout.tsx`
  which is shared. Commit current WIP or proceed carefully on a clean-ish base.
- Sidebar on small screens must not regress the existing mobile-first behavior.
