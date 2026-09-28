# Environment Variables

This document describes every environment variable used by Silverleaf Lesson Plans (Next.js on Vercel).

The single source of truth is the Zod schema in [`src/lib/env.ts`](../src/lib/env.ts) —
every server-side read goes through the typed `env` export (the only sanctioned
exception is `src/lib/db/client.ts`, which stays self-contained for
bootstrap-order reasons). Every variable is **optional** there so local dev
runs with zero configuration (PGlite, demo auth, AI disabled); malformed
values fail fast at startup. AI model defaults live in
[`src/lib/ai/model.ts`](../src/lib/ai/model.ts).

## Variable Reference

| Variable | Purpose | Set by | Scope |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection string (Drizzle). Absent → embedded PGlite (local dev / tests). | Vercel-injected (Neon/Vercel Postgres) | dev · preview · prod |
| `SESSION_SECRET` | HMAC secret signing the auth session cookie. Absent → hard error, except in development, where an insecure fallback is used (with a warning). Rotating it invalidates all sessions. | Developer (Vercel dashboard) | dev · preview · prod |
| `AUTH_PROVIDER` | Auth provider implementation: `email` (default) or `inbound-trust` (stub). | Developer (optional) | dev · preview · prod |
| `ED_ADMIN_API_TOKEN` | Bearer token for the ed-admin staff directory. Staff sign in with **work email + Staff ID**, verified against this directory. Absent → sign-in falls back to the seeded staff table, but **only outside production** (or with `ALLOW_DEMO_AUTH`); production without it fails closed. | Developer (Vercel dashboard) | dev · preview · prod |
| `ALLOW_DEMO_AUTH` | Explicit opt-in for the seeded-staff demo sign-in fallback **in production** (demo/showcase deploys only — it skips Staff ID verification). Strictly parsed: only `1`/`true` enable it; `0`/`false` (or anything else) leave it disabled. | Developer (optional) | prod (demo only) |
| `ED_ADMIN_STAFF_API_URL` | Override for the ed-admin directory endpoint (default: Silverleaf endpoint baked into `src/lib/auth/ed-admin.ts`) | Developer (optional) | dev · preview · prod |
| `HR_ADMIN_EMAILS` | Comma-separated work emails granted `/admin` access at sign-in. Does **not** bypass the ed-admin check — an admin email must also be an active ed-admin staff member to sign in. | Developer (Vercel dashboard) | dev · preview · prod |
| `ADMIN_PIN` | PIN for the admin self-elevation backend (`verifyAdminPin`). Absent → elevation disabled. Currently **unreachable**: no UI collects a PIN — `HR_ADMIN_EMAILS` alone grants `/admin`. Kept for a future elevation flow. | Developer (optional) | dev · preview · prod |
| `BLOB_READ_WRITE_TOKEN` | Auth token for Vercel Blob file-upload storage. Absent → local filesystem adapter (ephemeral on serverless). | Vercel-injected (after Blob is provisioned) | dev · preview · prod |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI Studio generation + textbook OCR. Absent → AI generation disabled (UI degrades gracefully). | Developer (optional) | dev · preview · prod |
| `AI_MODEL_ID` | OpenRouter text-model slug **fallback** (default in `src/lib/ai/model.ts`: `deepseek/deepseek-v4-pro`). Must support structured output/tool calls. A model chosen in AI Studio → Settings takes precedence. | Developer (optional) | dev · preview · prod |
| `AI_OCR_MODEL_ID` | OpenRouter vision/OCR-model slug override (default: `google/gemini-3.5-flash`). Must be vision-capable. | Developer (optional) | dev · preview · prod |
| `SEARCH_TRIGRAM` | Set to `1`/`true` to enable Postgres `pg_trgm` fuzzy search (Postgres only; PGlite ignores it). | Developer (optional) | preview · prod |
| `NODE_ENV` | Standard Next.js environment (`development` / `production` / `test`). | Next.js | automatic |

Read directly by the data layer (not in the schema): `PGLITE_MEMORY=1` forces
the embedded PGlite into memory-only mode (`src/lib/db/client.ts`, test/dev
convenience only).

### "Set by" key

- **Vercel-injected** — Vercel adds this automatically once the linked integration (Postgres, Blob) is provisioned. Do not set it manually in the Vercel dashboard for preview/production.
- **Developer** — Must be set manually: in `.env.local` for local dev (start from `.env.example`), and in the Vercel dashboard (or via `vercel env add`) for preview/production (see `.env.production.example`).

### Scope key

- **dev** — used when running `next dev` locally (pulled via `vercel env pull`)
- **preview** — used in Vercel preview deployments (pull-request branches)
- **prod** — used in the production deployment

---

## Variables intentionally not present

| Variable (legacy) | Why removed |
|---|---|
| `PORT` | Vercel manages the port; it is not configurable by the application |
| `CORS_ORIGIN` | Not applicable — Next.js API routes handle CORS via middleware/response headers |
| `SERVE_CLIENT` | Not applicable — Next.js serves its own frontend |
| `PG_SOCKET_DIR` / socket connection | Vercel Postgres (Neon) uses a URL, not a Unix socket |
| `DEV_CLIENT_URL` | Removed with the Express + separate Vite client split |
| `DOCS_PATH` | Static files now live in `public/` or Vercel Blob |
| `ALERT_EMAIL` | Not yet wired; add when a notification mechanism is introduced |

---

## Provisioning & linking (manual steps)

These steps require your Vercel account and cannot be automated by this
repository. The full runbook, including migrations and post-deploy checks, is
[**DEPLOYMENT.md**](../DEPLOYMENT.md).

### 1. Link the repository to a Vercel project

```bash
# Install the Vercel CLI if you haven't already
npm install -g vercel

# Inside the repo root — follow the interactive prompts
vercel link
```

This creates `.vercel/project.json` (already gitignored) which stores the project and org IDs.

### 2. Add Vercel Postgres (Neon)

1. Open the Vercel dashboard → your project → **Storage** tab.
2. Click **Create Database** → choose **Postgres (Neon)** (Vercel Marketplace).
   (CLI alternative: `vercel integration add neon`.)
3. Follow the prompts; Vercel will inject `DATABASE_URL` (and `POSTGRES_*` variants) into all three environments automatically.

### 3. Add Vercel Blob

1. Open the Vercel dashboard → your project → **Storage** tab.
2. Click **Create** → choose **Blob**.
3. Follow the prompts; Vercel will inject `BLOB_READ_WRITE_TOKEN` automatically.

### 4. Pull environment variables for local development

After provisioning, pull the auto-injected variables into your local `.env.local`:

```bash
vercel env pull .env.local
```

`.env.local` is gitignored. Run this command again whenever a new variable is added in the Vercel dashboard.

### 5. Set developer-managed variables

Add `SESSION_SECRET`, `ED_ADMIN_API_TOKEN`, and `HR_ADMIN_EMAILS` for each
environment (plus `OPENROUTER_API_KEY` if AI Studio should be enabled):

```bash
vercel env add SESSION_SECRET
vercel env add ED_ADMIN_API_TOKEN
vercel env add HR_ADMIN_EMAILS
vercel env add OPENROUTER_API_KEY
```

The CLI will prompt you for the value and which environments (development, preview, production) to apply it to. Alternatively, set them in the Vercel dashboard under **Project → Settings → Environment Variables**.

---

## Local development workflow (summary)

```
git clone <repo>
npm install
npm run db:seed      # embedded PGlite — no env vars needed
npm run dev
```

Only if you want to develop against the real Vercel-provisioned services:

```
vercel link                  # one-time
vercel env pull .env.local   # pulls DATABASE_URL etc. from Vercel
# add local overrides to .env.local by hand (see .env.example for the
# annotated variable list — do NOT copy it over a pulled .env.local)
```
