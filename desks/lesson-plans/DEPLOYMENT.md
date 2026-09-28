# Deployment — Silverleaf Lesson Plans

The authoritative runbook for deploying this Next.js (App Router) app to
**Vercel**, backed by **Neon Postgres** (Vercel Marketplace) and **Vercel
Blob**. It also covers local development.

> Taking over the project? Start with [HANDOVER.md](./HANDOVER.md) — it has
> copy-paste prompts that walk a coding agent through this runbook.

The app is built so that **local dev needs zero configuration** (embedded
PGlite, AI disabled). Everything below the local section is about wiring the
real services for preview/production.

---

## Local development

```bash
npm install
npm run db:seed             # seeds demo data into embedded PGlite (runs migrate first)
npm run db:import-textbooks # optional: load the bundled 37-book OCR corpus (~4,000 pages)
npm run dev                 # http://localhost:3000
```

No environment variables are required for local dev:

- **Database** — with `DATABASE_URL` unset the app runs on embedded
  [PGlite](https://electric-sql.com/docs/api/clients/pglite) (in-process, no
  external Postgres). Data lives under `.pglite/`.
  ⚠️ PGlite allows **one connection**: never run `db:*` scripts while the dev
  server is running.
- **AI Studio** — with `OPENROUTER_API_KEY` unset, AI generation is disabled and
  the UI degrades gracefully. Set the key (below) to enable it locally.
- **Session secret** — with `SESSION_SECRET` unset the auth cookie is signed
  with an insecure dev-only fallback (a warning is logged). Fine for local;
  **required** in production (see below).

### Demo logins (local / seeded data)

Sign in at `/sign-in` with a seeded work email and **any non-empty Staff ID**
(locally, when `ED_ADMIN_API_TOKEN` is unset, the Staff ID is not checked — the
email is matched against the seeded staff table):

| Role    | Email                     | Staff ID    |
| ------- | ------------------------- | ----------- |
| Teacher | `teacher@silverleaf.co.tz` | any value   |
| HR / admin | `hr@silverleaf.co.tz`   | any value   |

The HR account reaches `/admin` directly after sign-in: `HR_ADMIN_EMAILS` alone
grants admin — no PIN is involved (a PIN-based elevation backend exists but no
UI invokes it, see [docs/identity.md](docs/identity.md)).

> **Production fails closed:** this demo fallback is only active outside
> production. A production deploy without `ED_ADMIN_API_TOKEN` rejects all
> sign-ins (with a server-side error log) unless `ALLOW_DEMO_AUTH=1` is set
> explicitly — reserve that for demo/showcase deployments. Only `1`/`true`
> enable it; `0`/`false` (or anything else) leave it disabled.

### Useful scripts (see `package.json`)

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (needs network — next/font fetches Montserrat) |
| `npm run start` | Run the production build locally |
| `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply pending migrations to the active DB |
| `npm run db:seed` | Seed demo data + AI prompt parts (idempotent; migrates first) |
| `npm run db:import` | Bulk-import lesson plans from a JSON manifest (idempotent) |
| `npm run db:import-textbooks` | Import the `Textbooks_Markdown/` OCR corpus (idempotent; optional dir arg) |
| `npm run db:studio` | Drizzle Studio DB browser |

All `db:*` scripts run through the `db:run` helper (Node's
`--experimental-strip-types` TS loader — Node ≥ 22.6, see `engines`) and target
whatever `DATABASE_URL` points at (unset → PGlite) — that is also how you run
them against production.

---

## Prerequisites (for deploying)

- A [Vercel](https://vercel.com) account with access to the target team/project.
- The Vercel CLI: `npm i -g vercel`, then `vercel login`.
- This repo linked to a Vercel project: run `vercel link` from the repo root.
- An OpenRouter account + API key for AI Studio (https://openrouter.ai).
- Node ≥ 22.6 locally (`engines` in `package.json`; CI uses Node 22).

---

## 1. Provision Postgres (Neon via Vercel Marketplace)

1. In the Vercel dashboard: **Project → Storage → Create Database → Postgres
   (Neon)** (Vercel Marketplace). Follow the prompts to create the database and
   connect it to this project. (CLI alternative: `vercel integration add neon`.)
2. Vercel **auto-injects** the connection env vars — `DATABASE_URL` (plus
   `POSTGRES_*` variants) — into the Development, Preview, and Production
   environments. **Do not set `DATABASE_URL` manually.**
3. (Optional) Enable fuzzy search: after the `pg_trgm` extension is available on
   the database, set `SEARCH_TRIGRAM=1`. Leave unset to use plain search.

## 2. Provision Blob storage

1. **Project → Storage → Create → Blob**.
2. Vercel **auto-injects** `BLOB_READ_WRITE_TOKEN` into the project. **Do not set
   it manually.** (Without it, uploads fall back to the local filesystem, which
   is ephemeral on serverless — Blob is required for persistent uploads.)

---

## 3. Environment variables in Vercel

Set these in **Project → Settings → Environment Variables** (or via
`vercel env add <NAME> <environment>`). Auto-injected vars are added for you by
the integrations above — do not duplicate them. Every server-side read goes
through the typed schema in `src/lib/env.ts` (malformed values fail fast at
startup). Full reference with all optional vars:
[docs/environment.md](docs/environment.md).

| Variable | Who sets it | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Auto-injected** (Neon) | Do not set manually. |
| `BLOB_READ_WRITE_TOKEN` | **Auto-injected** (Blob) | Do not set manually. |
| `SESSION_SECRET` | **Manual** | **Required in production** — signs the auth cookie; missing in prod is a hard error. Generate fresh: `openssl rand -hex 32`. Rotating it logs everyone out. |
| `ED_ADMIN_API_TOKEN` | **Manual** | Bearer token for the ed-admin staff directory; **required in prod** to verify staff sign-in (email + Staff ID). Without it production sign-in **fails closed** (only `ALLOW_DEMO_AUTH=1` overrides). |
| `ALLOW_DEMO_AUTH` | **Manual** (optional) | Set to `1`/`true` (strict — `0`/`false` do nothing) to allow the seeded-staff demo sign-in fallback **in production**. Demo/showcase deploys only — it skips Staff ID verification. |
| `HR_ADMIN_EMAILS` | **Manual** | Comma-separated work emails granted `/admin` at sign-in. Each must **also** be active ed-admin staff to sign in. |
| `ADMIN_PIN` | **Manual** (optional) | PIN for the admin self-elevation backend (`verifyAdminPin`). Currently **unreachable** — no UI collects a PIN; `HR_ADMIN_EMAILS` alone grants `/admin`. Kept for a future elevation flow. |
| `AUTH_PROVIDER` | **Manual** (optional) | Auth provider implementation. Default `email`; `inbound-trust` is a stub — leave unset. |
| `OPENROUTER_API_KEY` | **Manual** | Enables AI Studio (generation + textbook OCR). Absent → AI disabled. |
| `AI_MODEL_ID` | **Manual** (optional) | OpenRouter slug for generation, used when no model is set in AI Studio → Settings (which takes precedence). Default `deepseek/deepseek-v4-pro` (see `src/lib/ai/model.ts`). Must support structured output/tool calls. |
| `AI_OCR_MODEL_ID` | **Manual** (optional) | OpenRouter slug for textbook OCR. Default `google/gemini-3.5-flash`. Must be vision-capable. |
| `ED_ADMIN_STAFF_API_URL` | **Manual** (optional) | Overrides the default ed-admin endpoint baked into the code. |
| `SEARCH_TRIGRAM` | **Manual** (optional) | `1`/`true` to enable Postgres `pg_trgm` fuzzy search. |

---

## 4. Run migrations + seed against the production database

Migrations are **not** run automatically on deploy — run them explicitly before
(or right after) the first production deploy. The db scripts target whatever
`DATABASE_URL` points at:

```bash
vercel env pull .env.prod.tmp --environment=production
# read DATABASE_URL out of that file, then:

DATABASE_URL='<prod-postgres-url>' npm run db:migrate
DATABASE_URL='<prod-postgres-url>' npm run db:seed              # demo/reference data + AI prompt parts (idempotent)
DATABASE_URL='<prod-postgres-url>' npm run db:import-textbooks  # 37-book OCR corpus for the textbook databank (idempotent)

rm .env.prod.tmp   # don't leave prod credentials on disk
```

> The `db:seed` step also seeds the **AI prompt parts** the AI Studio needs;
> `db:import-textbooks` fills the textbook databank. Skip the latter only if
> you plan to upload/OCR textbooks manually via the admin UI.
> The scripts run TypeScript via Node's `--experimental-strip-types` — use
> Node ≥ 22.6 (the repo's `engines` requirement).

---

## 5. Build & deploy

With the project linked (`vercel link`) and env vars set:

```bash
vercel            # preview deployment (unique URL)
vercel --prod     # production deployment
```

Alternatively, connect the Git repo in the Vercel dashboard: pushes to `main`
deploy to production, branches get preview deployments. GitHub Actions CI
(`.github/workflows/ci.yml`) independently runs typecheck/lint/build/unit tests
on pushes to `main` and on every pull request (plus a non-blocking Playwright
e2e job).

**Workflow DevKit:** textbook OCR ingest runs as a durable workflow
(`workflow` package, wired via `withWorkflow` in `next.config.ts`). On Vercel
this uses the managed *Vercel World* backend — **zero extra configuration**.
Workflow runs appear under the project's Observability tab. Batch generation
is **not** durable: it is a bounded worker pool in the admin's browser
(`src/app/[locale]/admin/ai-studio/batch/batchPool.ts`), so the tab must stay
open while a batch runs — see [docs/ai-studio.md](docs/ai-studio.md).

### Post-deploy verification checklist

- [ ] `/api/health` returns `"database": true`.
- [ ] `/en` and `/sw` render.
- [ ] A real staff member (email + Staff ID) can sign in; a bogus email is rejected.
- [ ] An `HR_ADMIN_EMAILS` address (that is also active in ed-admin) can sign in
      and reaches `/admin` directly — no PIN is requested.
- [ ] AI Studio generates one lesson plan and the branded preview renders (first
      live-key generation — see Troubleshooting if it fails).
- [ ] Vercel runtime logs are clean while doing the above.

---

## Security & handover hygiene

- **Rotate every secret when the project changes hands.** Provisioning on a new
  Vercel account mints fresh Neon credentials and a fresh Blob token
  automatically; generate a new `SESSION_SECRET` by hand.
- **`ED_ADMIN_API_TOKEN`** belongs to ed-admin (not Vercel) and grants read
  access to the full staff directory — if it was ever shared in plaintext,
  rotate it in ed-admin and re-set it on Vercel.
- **Never commit `.env.local`** (gitignored; the committed `.env.example` /
  `.env.production.example` are placeholder templates only).
- The admin model is **interim**: the `HR_ADMIN_EMAILS` allow-list alone grants
  `/admin` at sign-in. A shared-PIN elevation backend (`verifyAdminPin` +
  `ADMIN_PIN`) exists but no UI invokes it. A real identity provider is stubbed
  in `src/lib/auth/providers/inbound-trust.ts`.
- Production sign-in **fails closed** without `ED_ADMIN_API_TOKEN`; the only
  override is the explicit `ALLOW_DEMO_AUTH=1` opt-in (strictly parsed — never
  set it on a real production deploy).
- Rotating `SESSION_SECRET` invalidates all sessions — the way to force
  everyone through the current sign-in gate (cookies live 30 days otherwise).
- CSP allows `script-src 'unsafe-inline'` (required for App Router hydration);
  hardening to a per-request nonce is a known TODO (`next.config.ts`).

---

## Troubleshooting / gotchas (carried over from the build)

These are baked into the repo config — know why they exist before changing them:

- **PGlite + Next.js:** `next.config.ts` sets
  `serverExternalPackages: ["@electric-sql/pglite", "pdf-to-img"]`. Removing
  either breaks the embedded driver (WASM path mangling under Node ≥ 23) or the
  `/api/ai/textbooks` route (pdfjs ESM crash under webpack).
- **Lazy DB client:** `src/lib/db/client.ts` is a lazy `Proxy`; the driver
  initialises on first query, never at import — eager init aborts the Vercel
  build-time prerender. Don't change this.
- **Transaction-pooled Postgres:** the postgres-js client uses
  `{ prepare: false }` — required by Neon/PgBouncer transaction-mode poolers.
- **Migrations are not lazy:** always run `db:migrate` against prod
  before/with a deploy that ships a new migration; the app never migrates at
  request time.
- **`@vercel/blob`** reads `BLOB_READ_WRITE_TOKEN` itself; without it, storage
  falls back to the local filesystem (ephemeral on serverless).
- **Nobody can sign in on prod** → `ED_ADMIN_API_TOKEN` is unset/wrong (sign-in
  fails closed by design) or the ed-admin API is unreachable (directory is
  cached in-process ~5 min, `src/lib/auth/ed-admin.ts`).
- **Admin lockout:** `/admin` needs an email that is both in `HR_ADMIN_EMAILS`
  **and** active ed-admin staff. If none qualifies, fix the list or add the
  person in ed-admin.
- **AI generation fails on first run** → check `OPENROUTER_API_KEY` and that
  the `AI_MODEL_ID` slug supports structured output/tool calls, before
  debugging app code. Same for OCR and `AI_OCR_MODEL_ID` (vision-capable).
- **`npm run build` needs network** — next/font fetches Montserrat from Google
  Fonts at build time (fine on Vercel/CI; sandboxed/offline builds fail).
- **SOW uploads** are base64-encoded through a Server Action; the body limit is
  raised to 8 MB in `next.config.ts` — schemes bigger than ~6 MB raw will be
  rejected.

---

## Pre-deploy checklist

- [ ] Postgres (Neon) added → `DATABASE_URL` auto-injected.
- [ ] Blob added → `BLOB_READ_WRITE_TOKEN` auto-injected.
- [ ] `SESSION_SECRET` set (strong, random, fresh) in Production.
- [ ] `HR_ADMIN_EMAILS` and `ED_ADMIN_API_TOKEN` set.
- [ ] `OPENROUTER_API_KEY` set (+ optional `AI_MODEL_ID` / `AI_OCR_MODEL_ID`).
- [ ] Migrations + seed + textbook import applied against the production DB.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run e2e`, and
      `npm run build` pass locally.
