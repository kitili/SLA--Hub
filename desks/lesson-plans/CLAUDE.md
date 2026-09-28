# Silverleaf Lesson Plans

Lesson-plan library for Silverleaf Academy (Tanzania): teachers search/view
plans and leave feedback (points/streaks); admins manage plans, schemes of
work, textbooks, and AI generation. Next.js 15 App Router, React 19, Drizzle
(Postgres, embedded PGlite fallback), next-intl (en/sw), vitest, zod v4,
AI SDK v6 + OpenRouter. Not in production yet.

## Run it

```bash
npm run db:seed   # migrate + seed the embedded PGlite (Node >= 22.6)
npm run dev       # http://localhost:3000
```

Demo sign-in (any non-empty Staff ID): `teacher@silverleaf.co.tz` (teacher),
`hr@silverleaf.co.tz` (admin).

The seed is deliberately small and real: one scheme of work parsed from
`SOW-examples/grade2-health-environment-sow.docx`, plus six Grade 2 Term-1A
lesson plans (`src/lib/db/scripts/sampleLessonPlans.ts`) authored in the same
structured shape AI Studio generation writes.

## Verify before committing

```bash
npm run typecheck && npm run lint && npm run test
```

`npm run e2e` runs Playwright (starts its own dev server + seeds the DB).

## Critical gotchas

- **PGlite is single-connection.** NEVER run `db:*` scripts while `next dev`
  is running — the dev server's `.pglite/` lock wedges sign-in/writes. Stop
  dev first. (Tests are safe: in-memory PGlite per vitest worker.)
- **`db:seed` never updates.** Every insert is `onConflictDoNothing`, so
  re-seeding an already-seeded DB silently changes nothing and warns about
  nothing. After editing `sampleLessonPlans.ts`, run `npm run db:reset` (drops
  `.pglite/`, re-migrates, re-seeds) — it refuses to run when `DATABASE_URL`
  is set, so it can never touch a real Postgres.
- **A plan renders the branded document only if its `content_json` parses**
  against `structuredLessonPlanSchema`; one wrong key silently demotes it to
  the plain-markdown fallback. `sampleLessonPlans.test.ts` guards the seeded
  corpus, and `db:seed` throws on an invalid sample rather than inserting it.
- **The government form's labels are literal bilingual strings, NOT i18n.**
  `ComplianceDocument` prints the official Kiswahili/English form text whatever
  the locale, and its content is English; only the tabs and download button go
  through next-intl. Wrapping a form label in `t()` looks like a bug fix and
  produces a form the school cannot file (`ComplianceDocument.test.tsx` guards
  every label). The form is also **landscape** A4 — that is why `PrintButton`
  takes an `orientation`; portrait squeezes 297mm onto 210mm.
- **Teachers cannot download the branded document** — `LessonPlanDocument`'s
  `showPrint` defaults to `false` and only the AI Studio preview opts in. What
  a teacher downloads is the government form.
- **Feedback Hour:** feedback submitted 15:00–17:00 EAT earns a +5 bonus and
  the home page changes (`src/lib/time/eat.ts`). Tests pin the clock with fake
  timers, so they are deterministic — but manual testing inside that window
  looks different from outside it.
- `OPENROUTER_API_KEY` unset (the default) ⇒ AI Studio generation is disabled
  and its UI says so; everything else works. Textbook PDF upload is NOT gated:
  the ingest still starts and every page then fails at runtime with no UI
  notice (known gap — `src/lib/ai/workflows/textbookIngest.ts`). Model
  resolution is Settings tab (`app_settings`) → `AI_MODEL_ID` →
  `deepseek/deepseek-v4-pro` (`src/lib/ai/modelSetting.ts`, `model.ts`).

## Naming convention (load-bearing)

Plan filenames are `G7_Math_T1a_W1_L1` = `Grade_Subject_Term_Week_Lesson`.
Terms are `1a | 1b | 2a | 2b`; weeks restart each term, lessons each week.
Single source of truth: `src/lib/naming/` (parse/format/constants).

## Where things live

- `src/app/[locale]/` — all pages (locale-prefixed; teacher at root, admin under `/admin`)
- `src/app/[locale]/admin/ai-studio/` — AI Studio UI (single, batch, schemes, textbooks, prompts) — see `docs/ai-studio.md`
- `src/app/api/ai/` — generation/OCR route handlers; `src/app/api/health/` — health check
- `src/lib/actions/` — server actions; `src/lib/db/` — schema, migrations, client, scripts
- `src/lib/ai/` — model wiring, prompt assembly (`lessonPlan/`), OCR workflow
- `src/lib/naming/`, `src/lib/points.ts`, `src/lib/streak.ts`, `src/lib/search/` — domain logic
- `src/lib/compliance/` — the deterministic plan → official government form mapping
  (ported from the school's `compliance.py` handover; no model calls)
- `messages/en|sw/` — i18n catalogs; `test/` — cross-cutting tests + fixtures
- `Textbooks_Markdown/` — pre-OCR'd textbook corpus consumed by `npm run db:import-textbooks`
- `docs/superpowers/` — historical plans/specs, not current contracts

## Conventions

- **Server actions** return the `ActionResult` contract (`@/lib/contracts`):
  `error` is a machine code the UI maps to i18n, never prose; wrap failures
  with `actionFailure(code, { cause })`. See `docs/server-actions.md`.
- **Env access** only via `src/lib/env.ts` (`import { env }`); the one
  sanctioned raw `process.env` reader is `src/lib/db/client.ts`.
- **db CLI scripts** run through `npm run db:run` (Node strip-types + a
  resolver hook), which supports the `@/` alias and extensionless imports.
- **i18n:** `messages/en/*` and `messages/sw/*` must stay in exact key parity;
  each file's top-level keys are the `t()` namespaces it owns — both enforced
  by `test/messages-parity.test.ts`. Write plain, simple Swahili.
- **`updated_at` maintains itself** via `$onUpdate` — never set it manually.
- Prefer typed schema exports (`$inferSelect`, `.$type<...>()` unions) over
  re-declaring types at call sites. See `docs/schema-conventions.md`.
