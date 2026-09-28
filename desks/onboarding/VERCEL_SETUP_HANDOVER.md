# Vercel Setup — Consolidated Hand-over TODO

> **For:** the colleague who will own the Vercel account/deployment.
> **How to use:** open this file in Claude Code (or paste it to your Claude) inside a clone of
> the repo, with the Vercel CLI logged in to **your** account. Work top to bottom — every box is
> a concrete action with a verify step. You can tell Claude *"work through VERCEL_SETUP_HANDOVER.md,
> stopping at each ⛔ for me."*
>
> **What this covers:** one consolidated checklist merging the two repo runbooks
> (`VERCEL_RECREATE_RUNBOOK.md`, `docs/runbooks/vercel-provisioning.md`) **plus** the Vercel-relevant
> changes from all of today's (2026-06-24) open PRs and commits. After this, staff can sign in,
> read onboarding content (EN/SW), upload qualification certificates, and admins can download them.
>
> **Last updated:** 2026-06-24.

---

## 0. What changed today (why this hand-over exists)

The deployment must reflect four streams of work merged to `main`. Each row says what *you* must do
on Vercel for it. Pure-UI changes need nothing.

| PR / commits | What it is | Action needed on Vercel |
|---|---|---|
| **PR #6** `security/hardening → main` | Session/cookie hardening, materials route auth-gated, input caps, **`ADMIN_PIN` removed** | `SESSION_SECRET` now **required in prod, min 32 chars** (app refuses to boot otherwise). **Delete any `ADMIN_PIN`** env var. |
| **PR #8** `feat/qualification-uploads → security/hardening` | Member certificate uploads + admin download (private Vercel Blob) | **Provision Vercel Blob** (`BLOB_READ_WRITE_TOKEN`). New DB tables → **run migrations** (`member_documents`, `member_qualifications`). |
| **PR #7** `feat/mobile-header-menu → main` | Mobile hamburger nav | None (UI only). |
| **PR #9** `content/swahili-onboarding-materials → main` | Swahili (Kiswahili) onboarding docs committed as source | None now. (Optional later: load `sw` files to Blob tagged `language:"sw"` — explicitly **out of scope** for this hand-over.) |
| `main` today: `f3a5764` private-Blob auth proxy · `7363135` 15-min idle auto-logout | Already on `main` | Blob proxy needs the Blob store (covered above). Idle timeout is configurable via optional `NEXT_PUBLIC_IDLE_*` build-time vars (Step 4). |

> ⛔ **Merge order matters.** PR #8 is stacked on PR #6 which is stacked on `main`. To get uploads
> live, **#6 must merge to `main` first, then #8**. Confirm `main` contains both before deploying,
> or you'll deploy the upload UI without the hardened session / Blob wiring.

---

## 1. Prerequisites & inputs to collect first

The run **cannot finish** without these — gather them up front:

- [ ] **Node ≥ 20** and latest CLI: `node -v`; `npm i -g vercel@latest`
- [ ] `vercel login` → logged into **your** target team/account
- [ ] Repo cloned, `npm ci` run
- [ ] **`ED_ADMIN_API_TOKEN`** — Bearer token for the ed-admin staff directory (from the client / Silverleaf). *This is the sole sign-in gate — without it nobody can sign in.*
- [ ] **`HR_ADMIN_EMAILS`** — comma-separated work emails for `/admin`. ⚠️ each must **also** be an active ed-admin staff member, or it can't sign in.
- [ ] **`SESSION_SECRET`** — generate fresh: `openssl rand -base64 48` (≥ 32 chars; do **not** reuse any old value)

Optional inputs (only if overriding code defaults): `ALLOWED_EMAIL_DOMAIN` (default `silverleaf.co.tz`),
`ED_ADMIN_STAFF_API_URL` (defaults to the Silverleaf endpoint), `NEXT_PUBLIC_IDLE_TIMEOUT_MS` /
`NEXT_PUBLIC_IDLE_WARN_MS` (idle-logout tuning; default 15 min).

**Sanity check the app builds locally first (zero env vars — uses embedded PGlite):**
- [ ] `npm run db:migrate && npm run db:seed && npm run build` → clean build

---

## 2. Link the Vercel project

- [ ] `vercel link` → pick your team/scope, create the project (accept or set a name)
- [ ] **Verify:** `.vercel/project.json` exists with your `orgId`/`projectId`
- **On failure:** wrong team → `vercel switch`, re-run. (Framework auto-detects as **Next.js**; no `vercel.json` needed.)

---

## 3. Provision Neon Postgres (Marketplace) → injects `DATABASE_URL`

- [ ] Dashboard → project → **Storage → Create Database → Neon (Serverless Postgres)** → connect to project
      *(CLI equivalent: `vercel storage create` → choose Neon. Marketplace DBs are most reliable in the dashboard / authenticated CLI — they can't be scripted headlessly in some MCP contexts.)*
- [ ] **Verify:** `vercel env ls` shows `DATABASE_URL` for Production (+ Preview). This auto-injects ~18 `POSTGRES_*`/`PG*`/`NEON_*` vars into all 3 environments — only `DATABASE_URL` is actually read by the app; the rest are harmless.

---

## 4. Provision Vercel Blob → injects `BLOB_READ_WRITE_TOKEN`  ⟵ required for uploads (PR #8)

- [ ] Dashboard → project → **Storage → Create Database → Blob** → name it (e.g. `onboarding-uploads`) → connect to project (all environments)
      *(CLI equivalent: `vercel storage create` → choose Blob.)*
- [ ] **Verify:** `vercel env ls` shows `BLOB_READ_WRITE_TOKEN` for Production (+ Preview)
- ⛔ **Hard stop if missing:** with no token, the app silently falls back to the local filesystem adapter, which does **not** persist on Vercel serverless — uploads appear to work then vanish. Blobs are stored **private** and served only through the app's auth-gated proxy (`/api/materials`, `/api/bio/documents/{id}`), never the public CDN.

---

## 5. Set developer-managed env vars (Production; repeat for Preview if you want working PR previews)

Paste values at the prompt — do **not** pass secrets as positional args.

- [ ] `vercel env add SESSION_SECRET production` → paste `openssl rand -base64 48` output (≥ 32 chars)
- [ ] `vercel env add ED_ADMIN_API_TOKEN production` → paste the ed-admin Bearer token
- [ ] `vercel env add HR_ADMIN_EMAILS production` → comma-separated admin emails (each must be active in ed-admin)
- [ ] Repeat the three for **`development`** (local) — and for **`preview`** if PR previews must serve authenticated pages (without a Preview `SESSION_SECRET`, preview builds fail to serve auth pages)
- [ ] **Delete `ADMIN_PIN`** anywhere it lingers: `vercel env rm ADMIN_PIN production` (and any other env). The app no longer reads it.
- [ ] *(Optional)* idle-logout tuning — **build-time, must exist before Step 7's build:**
      `vercel env add NEXT_PUBLIC_IDLE_TIMEOUT_MS production` · `vercel env add NEXT_PUBLIC_IDLE_WARN_MS production`
- [ ] *(Optional)* `ED_ADMIN_STAFF_API_URL`, `ALLOWED_EMAIL_DOMAIN` — only to override code defaults. Leave `AUTH_PROVIDER` unset (defaults to `email`).
- [ ] **SMTP for email OTP sign-in** (required if staff should receive sign-in codes by email):
      `vercel env add SMTP_HOST production` · `SMTP_PORT` (usually `587`) · `SMTP_SECURE` (`false` for STARTTLS) · `SMTP_USER` · `SMTP_PASS`
      Repeat for **`preview`** if PR previews should send codes. Without these, the **Email me a sign-in code** page explains that codes are unavailable and directs staff to **Staff ID** sign-in — production will **not** fake a “code sent” success.
- [ ] **Verify:** `vercel env ls` lists `SESSION_SECRET`, `ED_ADMIN_API_TOKEN`, `HR_ADMIN_EMAILS` for Production; cross-check against `.env.example`. If using email OTP, confirm `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set.

---

## 6. Pull env locally & run migrations against the new prod DB

The schema must exist **before** the app serves traffic. The migrate script does **not** auto-load `.env.local`, so source it explicitly.

- [ ] `vercel env pull .env.local --yes`
- [ ] `set -a; . ./.env.local; set +a`
- [ ] `npm run db:migrate` — applies `src/lib/db/migrations/*` (idempotent). Must create **`member_documents`** and **`member_qualifications`** (the PR #8 upload tables).
- [ ] `npm run db:seed` — loads onboarding content (12 sections / 37 items / 12 quizzes); idempotent upsert.
- [ ] **Verify:** migrator exits 0; those two tables exist in the Neon DB.
- **On failure:** `DATABASE_URL` unset → confirm Step 3 and that `.env.local` was sourced. Connection refused → DB paused/unreachable.
- ⚠️ `.env.local` now holds real secrets — it's gitignored; never commit it.

---

## 7. Deploy

- [ ] `vercel --prod` (build runs `next build` with the env from Steps 4–5)
- [ ] **Verify:** status `Ready`; note the URL.
- **On failure:** a startup **Zod error on `SESSION_SECRET`** = not set for Production or < 32 chars → re-add (Step 5) and redeploy.
- [ ] *(Optional, recommended)* **Git auto-deploy:** Dashboard → Settings → **Git** → connect the GitHub repo, so pushes to the production branch deploy and PRs get preview URLs.
- ⛔ **Future deploys:** the build is just `next build` — migrations are **not** auto-applied. Re-run Step 6 whenever a new migration lands (or add a `vercel-build` script that runs `db:migrate` first, only if the build can reach the DB).

---

## 8. End-to-end verification (done = correctly set up)

**Platform / auth**
- [ ] `curl -I https://<domain>/api/health` → `200`; `curl -s …/api/health` → JSON `"database":true`
- [ ] `GET /` → 302 → `/en`; `/en/sign-in` loads
- [ ] Sign in as a real staff member (**work email + ed-admin Staff ID**) → succeeds; an unknown email/ID shows the "need an ed-admin account" message
- [ ] **Email OTP:** `/en/sign-in` shows **Email me a sign-in code**; without SMTP it explains codes are unavailable and links back to Staff ID; with SMTP set, a code arrives and sign-in succeeds
- [ ] `/admin`: sign in with an address that is **both** in `HR_ADMIN_EMAILS` **and** active in ed-admin → reach `/en/admin` (no PIN step)
- [ ] `GET /api/materials/<anything>` while **signed out** → `404` (members-only)

**Uploads feature (PR #8)**
- [ ] Bio → **Qualifications & education** → **Save** once (captures consent, creates the profile row)
- [ ] Upload a **PDF** and a **PNG** → they list with name + size; PDF/PNG open inline, a `.docx` downloads as attachment
- [ ] Confirm objects appear in the Blob store (dashboard → store → objects)
- [ ] **Privacy:** the raw Vercel Blob URL is inaccessible without auth; signed-out `GET /api/bio/documents/{id}` → `404`
- [ ] As **admin** → Members → a member → `/{locale}/admin/members/{memberId}` → download their certificate + the Bio PDF
- [ ] **Pass criteria:** uploads persist across reloads (proves Blob, not local FS), non-owners get 404, admin can download

**i18n content (PR #9)**
- [ ] `/sw/...` renders Swahili UI; onboarding sections load. *(Swahili document files are committed as source but not yet served from Blob — that's a separate, deferred task.)*

---

## 9. Full environment-variable reference

| Variable | Category | Set by | Environments | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | A — Neon | auto-injected | Prod·Preview·Dev | only PG var the app reads |
| ~17 other `POSTGRES_*` / `PG*` / `NEON_*` | A — Neon | auto-injected | Prod·Preview·Dev | unused but harmless |
| `BLOB_READ_WRITE_TOKEN` | B — Blob | auto-injected | Prod·Preview·Dev | required for persistent uploads |
| `SESSION_SECRET` | **C — manual** | **you** | Prod·Dev (+Preview) | **≥ 32 chars; required in prod** |
| `ED_ADMIN_API_TOKEN` | **C — manual** | **you** | Prod·Dev (+Preview) | sole sign-in gate |
| `HR_ADMIN_EMAILS` | **C — manual** | **you** | Prod·Dev (+Preview) | only admin gate; must also be ed-admin staff |
| `ED_ADMIN_STAFF_API_URL` | C — optional | you (override) | — | defaults to Silverleaf endpoint |
| `ALLOWED_EMAIL_DOMAIN` | C — optional | you (override) | — | informational; default `silverleaf.co.tz` |
| `AUTH_PROVIDER` | C — optional | you (override) | — | default `email` |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MS` / `_WARN_MS` | C — optional | you (override) | build-time | idle-logout tuning; default 15 min |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | **C — manual** | **you** | Prod·Dev (+Preview) | required for email OTP delivery; without them Staff ID sign-in still works |
| `ADMIN_PIN` | ❌ removed | — | — | **delete it** — no longer read |

---

## 10. Gotchas (baked into the repo — know why, don't change)

- **`SESSION_SECRET` missing/short in prod** → app throws at startup (`src/lib/env.ts`). Set ≥ 32 chars and redeploy.
- **Ed-admin is the SOLE sign-in gate.** If `ED_ADMIN_API_TOKEN` is unset/unreachable, **nobody can sign in**. Directory is cached ~5 min with single-flight + negative-cache backoff.
- **Admin lockout risk.** `/admin` needs an email in `HR_ADMIN_EMAILS` **and** active in ed-admin. If none qualify, admin is unreachable.
- **Blob token absence** → silent local-FS fallback that doesn't persist on serverless. Always provision Blob.
- **Migrations are not lazy** — always `db:migrate` against prod before/with a deploy that ships a new migration.
- **Don't touch:** `serverExternalPackages: ["@electric-sql/pglite"]` in `next.config.ts`, the lazy DB `Proxy` in `src/lib/db/client.ts`, and `{ prepare: false }` on postgres-js (required by Neon's transaction pooler).
- **Rotate everything from any old account** — `SESSION_SECRET`, Blob token, Neon creds. Rotating `SESSION_SECRET` invalidates all existing sessions.
- Security headers/CSP live in `next.config.ts` (HSTS, nosniff, X-Frame-Options, Permissions-Policy, CSP).

---

## 11. Source runbooks & PRs (for deeper detail)

- `VERCEL_RECREATE_RUNBOOK.md` — full fresh-account recreation (hardened-auth baseline; on `security/hardening`)
- `docs/runbooks/vercel-provisioning.md` — uploads/Blob-focused provisioning (on `feat/qualification-uploads`)
- `docs/deploy.md` · `docs/environment.md` · `.env.example` — original deploy + env reference
- Open PRs: #6 (security), #7 (mobile nav), #8 (uploads), #9 (Swahili docs) — repo `kitili/SLA-Onboarding-hub`
