# Tech Handover — Silverleaf Lesson Plans

**Audience:** the team taking over this repository.
**Goal:** rebuild the entire production setup on **your own Vercel account** — with no prior knowledge of this codebase.

The fastest path is to let a coding agent (Claude Code, Cursor, Codex, …) do the work: **section 3 contains ready-made prompts you can copy-paste to your agent verbatim.** Prefer doing it by hand? Follow [DEPLOYMENT.md](./DEPLOYMENT.md) — the authoritative runbook. Both paths take ~30–45 minutes.

---

## 1. What you are receiving

A **Next.js 15 (App Router, TypeScript strict)** app for Silverleaf Academy (Tanzania), bilingual **English/Swahili**:

- **Teachers** — full-text search over the lesson-plan library; plan detail pages that show the lesson either as the Silverleaf-branded booklet or as the **official Tanzanian government form**, with a one-click PDF download of that government form (the form is what the school files with an inspector); structured feedback with a points/streak system.
- **Admin** (`/admin`) — usage dashboard, plan management, and the **AI Studio**: generate structured lesson plans from scheme-of-work rows via OpenRouter — single plans, or batches via a foreground worker pool in the browser (the tab must stay open). The generation model and the editable prompt building-blocks live in a dedicated **Settings** tab, behind a "change these with care" warning; generation and batch resolve both **server-side**, so they can no longer be changed per-request from the generation screens (a deliberate safety guard). The textbook databank (upload + OCR) is a separate feature; it does **not** feed generation.

| Concern | Technology |
| --- | --- |
| Hosting / build | Vercel (framework preset: Next.js, Node ≥ 22.6 — see `engines` in `package.json`) |
| Database | Neon Postgres via Vercel Marketplace (prod) · embedded PGlite (local, zero-config) |
| ORM / migrations | Drizzle ORM — `npm run db:migrate` / `db:seed` / `db:import-textbooks` |
| File storage | Vercel Blob (prod) · local filesystem (dev) |
| AI | Vercel AI SDK + OpenRouter; batch generation is a foreground in-browser pool; textbook OCR ingest is a durable Workflow DevKit job (zero-config on Vercel) |
| Auth | Custom HMAC session cookie; sign-in verified against the ed-admin staff directory |

**State at handover:** `main` is verified green — typecheck, ESLint, 208 unit tests (Vitest), 55 Playwright e2e tests, full production build; GitHub Actions CI runs typecheck/lint/build/unit tests on pushes to `main` and on every pull request (the e2e job runs too, non-blocking). Local dev needs **no env vars and no external services**.

**Known gaps (be aware, not afraid):**

1. **AI generation has never run against a real OpenRouter key.** The code path is complete and unit-tested, but no end-to-end generation with live credentials had been executed at handover time. Your first production smoke test (Prompt 3, step 5) is the real first run.
2. **Production sign-in requires `ED_ADMIN_API_TOKEN`.** Without it, production sign-in **fails closed** — nobody (including admins) can sign in; the only override is the explicit `ALLOW_DEMO_AUTH=1` opt-in for demo/showcase deploys (strictly parsed — `0`/`false` do nothing). Outside production the app falls back to seeded demo users.
3. The real ~10k lesson-plan import (`/api/import` + `src/lib/db/scripts/import.ts`) is built but has not been run with real data; the seed provides 20 sample plans.

## 2. Secrets & access checklist (humans first)

Sort this out **before** starting the deploy prompt. Never commit any of these; set them as Vercel env vars.

| Item | How you get it |
| --- | --- |
| GitHub repo access | Transfer or invite from the previous team |
| Vercel account/team | Your own — everything is provisioned fresh on it |
| `OPENROUTER_API_KEY` | Create your own at [openrouter.ai](https://openrouter.ai) (pay-as-you-go; powers generation + OCR) |
| `ED_ADMIN_API_TOKEN` | Receive from Silverleaf/previous team — **rotate it in ed-admin** if it was ever shared in plaintext |
| `SESSION_SECRET` | Generate fresh: `openssl rand -hex 32` — never reuse the old one |
| `ADMIN_PIN` | Optional — the PIN self-elevation backend (`verifyAdminPin`) is currently **unreachable** (no UI collects a PIN); `HR_ADMIN_EMAILS` alone grants `/admin`. If you set one anyway, choose a fresh strong value |
| `HR_ADMIN_EMAILS` | Decide which work emails get `/admin` — each must **also** be an active ed-admin staff member |
| `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` | **Nothing to receive** — auto-injected when you provision Neon Postgres + Blob on your Vercel project |

## 3. Agent prompts — copy & paste

Use one prompt per agent session, in order, from the repo root of a fresh clone. Each prompt is self-contained; the agent finds the details in the repo docs. Have the secrets from section 2 at hand — the agent will ask for them (paste values only into env-var commands, never into files).

### Prompt 1 — Local setup & verification

```text
You are working in a fresh clone of the silverleaf-lesson-plans repository
(Next.js 15 App Router + TypeScript). Set it up locally and prove it works.

Context:
- Local dev needs NO env vars and no external services: with DATABASE_URL unset
  the app uses an embedded PGlite database (created under .pglite/); with
  OPENROUTER_API_KEY unset, AI features are disabled and degrade gracefully.
- Node >= 22.6 (the db scripts run TypeScript via --experimental-strip-types;
  CI uses 22). Package manager: npm.
- IMPORTANT: never run db:* scripts while the dev server is running — the
  embedded PGlite database allows only ONE connection.

Do this, in order:
1. npm ci
2. npm run typecheck && npm run lint && npm run test
   (expect: 0 type errors, 0 lint errors, 208 unit tests passing;
   optionally npm run e2e — 55 Playwright tests)
3. npm run db:seed
   (migrates, then seeds demo staff, 20 sample lesson plans, and the AI prompt parts)
4. npm run db:import-textbooks
   (loads the bundled 37-textbook OCR corpus from Textbooks_Markdown/ — ~4,000 pages)
5. npm run dev, then verify in a browser:
   a. /en renders the teacher home; /api/health returns "database":true
   b. sign in at /en/sign-in as teacher@silverleaf.co.tz with ANY Staff ID
      (local fallback auth), search for a plan, open its detail page
   c. sign in as hr@silverleaf.co.tz (any Staff ID) and open /en/admin and
      /en/admin/ai-studio — admin access is granted at sign-in via the
      HR_ADMIN_EMAILS allow-list; no PIN is requested anywhere
   d. the AI Studio shows the scheme-of-work picker (panels: Scheme & Lesson,
      Model & Prompt, Generate & Save) and /en/admin/ai-studio/textbooks lists
      the imported textbook databank (generation itself stays disabled without
      OPENROUTER_API_KEY — that is expected)
   e. /sw (Swahili) renders
6. Report a pass/fail checklist with evidence (command output, what you saw).

If anything is unclear, read README.md and DEPLOYMENT.md before improvising.
```

### Prompt 2 — Provision & deploy to Vercel (production)

```text
You are working in a fresh clone of the silverleaf-lesson-plans repository
(Next.js 15 App Router). Deploy it to production on OUR Vercel account so that
everything works. The authoritative runbook is DEPLOYMENT.md — follow it; this
prompt summarises it. Never echo secret values into logs, files, or chat.

I will provide when asked: OPENROUTER_API_KEY, ED_ADMIN_API_TOKEN,
HR_ADMIN_EMAILS, and the Vercel team/scope (I'll run `vercel login` if a
browser step is needed).

Steps:
1. vercel link — create a new Vercel project (framework preset: Next.js).
2. Provision storage on the project (Vercel dashboard → Storage, or CLI):
   - Postgres (Neon, via Vercel Marketplace) → auto-injects DATABASE_URL
   - Blob → auto-injects BLOB_READ_WRITE_TOKEN
   Do NOT set those two variables manually.
3. Set the manual env vars for Production (and Preview if desired):
   - SESSION_SECRET  (generate fresh: openssl rand -hex 32; required in prod)
   - ED_ADMIN_API_TOKEN, HR_ADMIN_EMAILS
   - OPENROUTER_API_KEY
   - optional: AI_MODEL_ID (default deepseek/deepseek-v4-pro),
     AI_OCR_MODEL_ID (default google/gemini-3.5-flash), SEARCH_TRIGRAM=1
     (ADMIN_PIN exists but its elevation backend has no UI — skip it)
4. Migrations do NOT run automatically on deploy. Point the db scripts at the
   production database and run:
     vercel env pull .env.prod.tmp --environment=production
     DATABASE_URL='<value from .env.prod.tmp>' npm run db:migrate
     DATABASE_URL='<...>' npm run db:seed
     DATABASE_URL='<...>' npm run db:import-textbooks
     rm .env.prod.tmp
5. Deploy: vercel --prod
   (Textbook OCR ingest uses Vercel's Workflow DevKit — it works on Vercel
   with zero extra configuration. Batch generation needs nothing extra either:
   it runs as a foreground worker pool in the admin's browser tab.)
6. Verify: the production URL renders /en and /sw, and /api/health returns
   "database":true.
7. Connect the GitHub repo in the Vercel dashboard so pushes to main deploy
   automatically (GitHub Actions CI already runs typecheck/lint/build/tests).
8. Report: production URL, which env vars are set in which environments (names
   only), and the checklist results.

Gotchas — these are deliberate, do not "fix" them:
- serverExternalPackages in next.config.ts (pglite, pdf-to-img) and the lazy DB
  proxy in src/lib/db/client.ts are load-bearing for Vercel builds.
- The postgres-js client uses prepare:false — required by Neon's pooler.
- If NOBODY can sign in on prod: ED_ADMIN_API_TOKEN is missing or wrong —
  production sign-in fails closed by design (only ALLOW_DEMO_AUTH=1 overrides).
- If /admin is unreachable: no HR_ADMIN_EMAILS address is an active ed-admin
  staff member — fix the list or add the person in ed-admin.
```

### Prompt 3 — Production smoke test & acceptance

```text
The silverleaf-lesson-plans app was just deployed to Vercel production. Run an
end-to-end smoke test and report a pass/fail checklist with evidence (URLs,
response snippets, screenshots if you have a browser tool).

1. GET /api/health → 200 with "database":true.
2. Sign-in gate: a real staff work email + Staff ID (verified against ed-admin)
   signs in; a bogus email is rejected with a clear error.
3. Teacher flow: search lesson plans, open a plan detail page, submit feedback.
4. Admin flow: sign in with an HR_ADMIN_EMAILS address (it must also be an
   active ed-admin staff member) and open /en/admin — dashboard renders with
   usage data. No PIN is requested; admin is granted at sign-in.
5. AI Studio (/en/admin/ai-studio): select a scheme-of-work lesson (upload a
   SOW docx/CSV under the Schemes panel first if none exist) and generate ONE
   lesson plan — generation is grounded in the scheme row + prompt parts only;
   there is no textbook input. NOTE: this is the first-ever generation with a
   live key — if it fails, capture the exact error and check
   OPENROUTER_API_KEY and the model slug (AI_MODEL_ID) before debugging code.
   Verify the branded document preview renders and the plan can be saved.
6. Batch (optional): start a small batch (2 plans) at /en/admin/ai-studio/batch
   and KEEP THE TAB OPEN until both finish — the batch is a foreground worker
   pool in your browser, not a durable workflow (the UI warns about this too).
   Vercel dashboard → Observability shows workflow runs only for textbook OCR
   ingest.
7. Locales: repeat one teacher check under /sw.
8. Check Vercel runtime logs for errors during all of the above and include
   anything suspicious in the report.

Acceptance = steps 1–5 and 7 all pass. List every failure with the evidence.
```

## 4. Where things live

| Path | What |
| --- | --- |
| `src/app/[locale]/` | Teacher pages (search, plan detail, sign-in) |
| `src/app/[locale]/admin/` | Admin dashboard, plans, feedback, `ai-studio/` (incl. `schemes`, `textbooks`, `settings`, `batch`) |
| `src/app/api/` | `ai/` (generate, batch, textbooks), `health`, `import` |
| `src/lib/db/` | Drizzle schema, migrations, `scripts/` (migrate, seed, importTextbooks) |
| `src/lib/ai/` | Model config (`model.ts` — defaults live here), lesson-plan prompt/schema/validation |
| `src/lib/auth/` | Session cookie + ed-admin directory verification |
| `Textbooks_Markdown/` | Bundled OCR corpus (37 books, G1–5) for `db:import-textbooks` |
| `docs/` | Topic deep-dives (environment, data layer, identity, i18n, …) |

## 5. Documentation index

| Doc | Contents |
| --- | --- |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | **Authoritative** local-dev + Vercel deploy runbook, troubleshooting, security hygiene |
| [README.md](./README.md) | Overview, quick start, commands |
| [CLAUDE.md](./CLAUDE.md) | Orientation for AI coding agents: gotchas, conventions, layout |
| [docs/ai-studio.md](docs/ai-studio.md) | AI Studio architecture (single + batch generation) |
| [docs/environment.md](docs/environment.md) | Every environment variable, full reference |
| [docs/data-layer.md](docs/data-layer.md) | Drizzle, migrations, PGlite fallback |
| [docs/schema-conventions.md](docs/schema-conventions.md) | Table/column naming, bilingual columns |
| [docs/identity.md](docs/identity.md) | Auth model (ed-admin gate, sessions, admin elevation) |
| [docs/i18n.md](docs/i18n.md) | Locales (en/sw) and message catalogs |
| [docs/server-actions.md](docs/server-actions.md) | The `ActionResult` contract |
| [docs/materials.md](docs/materials.md) | File storage adapters |
| [docs/typescript.md](docs/typescript.md) | Strict TS configuration |
