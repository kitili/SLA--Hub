# Vercel Setup — Recreation Runbook (Handover)

> **Purpose.** An executable, step-by-step runbook for recreating the **entire Vercel
> hosting setup** of the SLA Onboarding Hub on a **fresh Vercel account**. Hand it to a new
> agent/engineer who has the Git repository and a new (empty) Vercel account. Following it in
> order reproduces the database, storage, environment variables, build, and deployment.
>
> **Audience.** An engineer or AI agent with: the repo cloned, Node ≥ 20, and admin access to
> the *new* Vercel account.
>
> **Reading time → working setup:** ~20–30 minutes.
>
> **Last updated:** 2026-06-24 — reflects the security-hardening pass: the legacy `ADMIN_PIN`
> admin-elevation step was **removed**, and `SESSION_SECRET` is now **required in production**
> (min 32 chars; the app refuses to boot without it). See §5.

---

## 0. TL;DR — what you are recreating

A **Next.js 15 (App Router)** app deployed on **Vercel**, backed by:

| Concern | Technology | How it's provisioned |
|---|---|---|
| Hosting / build / CDN | Vercel (framework preset: **Next.js**) | `vercel link` + deploy |
| Database (prod/preview) | **Neon Postgres** via Vercel Marketplace | Marketplace integration → auto-injects env vars |
| Database (local/test) | **PGlite** (embedded, zero-config) | Automatic when `DATABASE_URL` is unset |
| File/document storage | **Vercel Blob** (private) | Vercel Storage → auto-injects `BLOB_READ_WRITE_TOKEN` |
| ORM / migrations | **Drizzle ORM** (`drizzle-kit`) | `npm run db:migrate` + `npm run db:seed` |
| i18n | next-intl (EN/SW) | source-only, no env vars |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | independent of Vercel |

```
                        ┌─────────────────────────────────────────┐
   Git repo  ──push──▶  │            VERCEL PROJECT                 │
 (your fork of SLA-     │         "sla-onboarding-hub"             │
  Onboarding-hub)       │   framework preset: Next.js (auto)       │
                        │   build: `next build`  ·  Node ≥ 20      │
                        └───────────────┬─────────────────────────┘
                                        │ env vars injected at build+runtime
              ┌─────────────────────────┼───────────────────────────┐
              ▼                         ▼                            ▼
   ┌──────────────────┐     ┌────────────────────┐      ┌────────────────────┐
   │  Neon Postgres   │     │   Vercel Blob      │      │  Developer secrets │
   │ (Marketplace)    │     │  (private store)   │      │  SESSION_SECRET    │
   │ → DATABASE_URL + │     │ → BLOB_READ_WRITE_ │      │  ED_ADMIN_API_TOKEN│
   │   ~17 PG vars    │     │   TOKEN            │      │  HR_ADMIN_EMAILS   │
   └──────────────────┘     └────────────────────┘      └────────────────────┘
```

The app reads only a handful of these (see §4). The Neon integration injects ~18 variables;
most are unused by app code but harmless.

> **There are exactly three developer-managed secrets:** `SESSION_SECRET`,
> `ED_ADMIN_API_TOKEN`, `HR_ADMIN_EMAILS`. (The old `ADMIN_PIN` was removed — admin access is
> now granted purely by `HR_ADMIN_EMAILS` membership.)

---

## 1. Snapshot of the CURRENT (source) setup — for reference only

> ⚠️ The new account will generate its **own** project ID, org ID, database credentials, and
> tokens. The values below describe the *old* account so you can recognise equivalents. **Do
> not reuse the old secrets** — they belong to a different account and must be rotated.

**Vercel project**

| Field | Value (old account) |
|---|---|
| Project name | `sla-onboarding-hub` |
| Project ID | `prj_68aDeFEpUzmMkBddM14CNo4UPNUG` |
| Org / team slug | `pauls-projects-d906e357` |
| Org ID | `team_XcQaXUKMGw0DY66v2f2yl30F` |
| Plan | Hobby |
| Production URL | `https://sla-onboarding-hub.vercel.app` |
| Git integration | **Not connected** — deployed via CLI (`vercel --prod`) |
| `vercel.json` | **None** — uses framework defaults |

**Database (Neon, via Vercel Marketplace)**

| Field | Value (old account) |
|---|---|
| Integration name | `neon-bistre-dog` |
| Neon project ID | `proud-grass-74044913` |
| Database name | `neondb` |
| Role / user | `neondb_owner` |
| Region | AWS `us-east-1` |
| Endpoint host | `ep-green-pine-at6hxnl7` (pooled) / `…` (unpooled) |
| Driver in app | `postgres-js` when `DATABASE_URL` set; otherwise PGlite |

**Storage:** Vercel Blob — one **private** store; token injected into all three environments.
Files are served through the app's own `/api/materials` route (auth-gated), never the public CDN.

---

## 2. Environment variable inventory (authoritative)

There are **three categories**. Only category C is set by hand.

### A. Auto-injected by the Neon Postgres integration — DO NOT set manually
Provisioning the Neon Marketplace integration injects all of these into **Production, Preview,
and Development** automatically:

```
DATABASE_URL              DATABASE_URL_UNPOOLED
POSTGRES_URL              POSTGRES_URL_NON_POOLING      POSTGRES_URL_NO_SSL
POSTGRES_PRISMA_URL       POSTGRES_HOST                 POSTGRES_USER
POSTGRES_PASSWORD         POSTGRES_DATABASE
PGHOST                    PGHOST_UNPOOLED               PGUSER
PGPASSWORD                PGDATABASE
NEON_PROJECT_ID           NEON_AUTH_BASE_URL            VITE_NEON_AUTH_URL
```
> The app code only actually reads **`DATABASE_URL`** (see `src/lib/db/client.ts`). The rest are
> injected by Neon for convenience and are harmless if unused. `VERCEL_OIDC_TOKEN` also appears
> automatically when you run `vercel env pull` locally.

### B. Auto-injected by the Vercel Blob store — DO NOT set manually
```
BLOB_READ_WRITE_TOKEN     (Production, Preview, Development)
```

### C. Developer-managed secrets — YOU set these by hand
| Variable | Required? | Purpose | Environments to set |
|---|---|---|---|
| `SESSION_SECRET` | **Yes (prod)** | HMAC-signs the auth session cookie (`src/lib/auth/providers/email.ts`). **Min 32 chars.** Production **refuses to boot** without it; the schema also rejects a too-short value at startup (`src/lib/env.ts`). Development falls back to an insecure constant with a console warning. | Production, Development |
| `ED_ADMIN_API_TOKEN` | **Yes** | Bearer token for the ed-admin staff directory. Staff sign in with **work email + Staff ID**, verified against this directory (`src/lib/auth/ed-admin.ts`). This is the **sole sign-in gate** — without it (or if the API is down) **nobody can sign in**. | Production, Development |
| `HR_ADMIN_EMAILS` | **Yes** | Comma-separated emails granted `/admin` access. This is the **only** admin gate now. These do **NOT** bypass the ed-admin check — an admin email must **also** be an active ed-admin staff member to sign in. | Production, Development |
| `ED_ADMIN_STAFF_API_URL` | Optional | Ed-admin directory endpoint. **Defaults in code** to `https://silverleafacademy.ed-space.net/api/general/v1/staff` (`src/lib/auth/ed-admin.ts`) — only set to override. | (not set; uses default) |
| `ALLOWED_EMAIL_DOMAIN` | Optional | **No longer the sign-in gate** — ed-admin membership is. Informational/normalisation only; defaults to `silverleaf.co.tz` (`src/lib/email.ts`). | (not set; uses default) |
| `AUTH_PROVIDER` | Optional | Auth strategy. **Defaults to `email`** (`src/lib/auth/identity.ts`). Set to `inbound-trust` only when the trusted-header provider is wired. | (not set; uses default) |

> **`ADMIN_PIN` is gone.** Earlier versions used a shared PIN to "elevate" to admin after sign-in.
> That step was inert (admin already == `HR_ADMIN_EMAILS` membership) and was removed. If you see
> `ADMIN_PIN` in old notes or an old `.env`, ignore it — the app no longer reads it.

> **Note on Preview:** by default the category-C secrets are set for **Production + Development
> only** — not Preview. If you need working PR preview deployments, set them for Preview too
> (see §4, step 4 note). Without a Preview `SESSION_SECRET`, preview builds will fail to serve
> authenticated pages.

All category-A/-B/-C variables are validated in `src/lib/env.ts` (Zod). The app still boots
locally with none of them (PGlite + insecure dev fallback), but **production requires the three
category-C secrets** — and `SESSION_SECRET` is enforced at startup.

---

## 3. Prerequisites on the new machine / account

```bash
node -v        # must be >= 20
npm i -g vercel@latest
vercel login   # log in to the NEW Vercel account
git clone <your-fork-of-the-repo> && cd SLA-Onboarding-hub
npm install
```

Sanity check the app builds locally with the embedded DB (no env vars needed):

```bash
npm run db:migrate   # migrates embedded PGlite (.pglite/)
npm run db:seed      # idempotent demo data
npm run build        # expect: clean build, all routes generated
```

---

## 4. Step-by-step recreation on the new account

### Step 1 — Create & link the Vercel project
From the repo root:

```bash
vercel link
```
Follow the prompts (choose the new account's scope/team, create a new project — accept the
name or pick your own). This writes `.vercel/project.json` (gitignored) with the new
`projectId` / `orgId`. Framework is auto-detected as **Next.js**; no `vercel.json` is needed.

### Step 2 — Provision Neon Postgres (Marketplace integration)
Dashboard route (recommended — Marketplace integrations are easiest in the UI):

1. Vercel dashboard → the new project → **Storage** tab.
2. **Create Database** → **Neon (Serverless Postgres)** (Marketplace).
3. Accept defaults (pick a region close to your users). Connect it to this project.
4. Vercel injects `DATABASE_URL` + all category-A vars into **all three environments**
   automatically.

CLI equivalent: `vercel storage create` (then follow prompts to pick Neon).

> If your tooling can't create a Marketplace DB (some automated/MCP contexts can't), do this
> step in the dashboard with the authenticated CLI account — it cannot be scripted headlessly.

### Step 3 — Provision Vercel Blob
1. Vercel dashboard → the new project → **Storage** tab.
2. **Create Database** → **Blob**.
3. Connect to the project → Vercel injects `BLOB_READ_WRITE_TOKEN` into all three environments.

CLI equivalent: `vercel storage create` → choose **Blob**.

> The app stores blobs with `access: "private"` and serves them through `/api/materials`
> (members-only, token stays server-side). No extra config needed — provisioning the store is enough.

### Step 4 — Set the developer-managed secrets (category C)
Generate a **fresh** session secret (do **not** reuse the old one). It must be **≥ 32 chars** —
`openssl rand -base64 48` gives plenty:

```bash
openssl rand -base64 48
```

Add the required secrets to Production and Development. Paste the value at the prompt — do
**not** pass it as a positional argument:

```bash
vercel env add SESSION_SECRET production       # paste the openssl output (>= 32 chars)
vercel env add SESSION_SECRET development       # paste the same (or a different) value

vercel env add ED_ADMIN_API_TOKEN production    # paste the ed-admin Bearer token
vercel env add ED_ADMIN_API_TOKEN development

vercel env add HR_ADMIN_EMAILS production       # active ed-admin staff email(s), comma-separated
vercel env add HR_ADMIN_EMAILS development       # ⚠️ each must ALSO be active in ed-admin, or it can't sign in
```

Optional overrides (skip unless you need them):

```bash
vercel env add ED_ADMIN_STAFF_API_URL production # only to override the default ed-admin endpoint
vercel env add ALLOWED_EMAIL_DOMAIN production    # informational only; defaults to silverleaf.co.tz
# AUTH_PROVIDER — leave unset (defaults to "email")
```

> **For working PR previews**, also add the secrets to `preview`
> (`vercel env add SESSION_SECRET preview`, `vercel env add ED_ADMIN_API_TOKEN preview`,
> `vercel env add HR_ADMIN_EMAILS preview`). A preview build with no `SESSION_SECRET` will fail
> to serve authenticated pages.

### Step 5 — Pull env locally and migrate the new production database
The schema must exist in the new Neon DB before the app serves traffic. Migrations are run
**manually** from your machine against the production connection string:

```bash
vercel env pull .env.local        # pulls DATABASE_URL + everything from the new project

# run migrations + seed against the new Neon DB
DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"') npm run db:migrate
DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"') npm run db:seed
```

- `db:migrate` applies the SQL migrations under `src/lib/db/migrations/` — **idempotent**, safe to re-run.
- `db:seed` loads the onboarding content (12 sections / 37 items / 12 quizzes) — idempotent (upsert).
- `.env.local` is gitignored. After `env pull` it will contain a real `SESSION_SECRET` etc. —
  treat it as a secret and never commit it.

### Step 6 — Deploy
```bash
vercel --prod
```
This builds (`next build`) and promotes to production. Note the deployment URL it prints.

> If the build **fails at startup with a Zod error on `SESSION_SECRET`**, you either didn't set
> it for Production or set a value shorter than 32 chars — re-add it (Step 4) and redeploy.

> **Optional — Git auto-deploy:** the old account deployed via CLI (Git was *not* connected).
> To get automatic deploys on push instead: Vercel dashboard → project → **Settings → Git** →
> connect the GitHub repo. Thereafter pushes to the production branch deploy automatically and
> PRs get preview URLs.

### Step 7 — Smoke test
```bash
curl -I https://<new-deployment-domain>/api/health     # expect 200
curl -s  https://<new-deployment-domain>/api/health     # expect JSON with "database":true
```
Then in a browser:
- `GET /` → 302 redirect to `/en`
- `/en/sign-in` loads
- Sign in as a staff member with their **work email + ed-admin Staff ID** (verifies `ED_ADMIN_API_TOKEN` works); an unknown email/ID shows the "need an ed-admin account" message
- For `/admin`: sign in with an address that is **both** in `HR_ADMIN_EMAILS` **and** an active
  ed-admin staff member — you reach `/en/admin` directly (no PIN step). ⚠️ If no `HR_ADMIN_EMAILS`
  address exists in ed-admin, **admin access is impossible** — add one to ed-admin or use a staff
  email that is.
- `GET /api/materials/<anything>` while **signed out** → `404` (the route is members-only).

---

## 5. Security & hand-over hygiene

- **Rotate every secret.** Do not carry over `SESSION_SECRET`, the Blob token, or any
  Neon/Postgres credential from the old account. Provisioning on the new account mints fresh Neon
  credentials and a fresh Blob token automatically; generate a new `SESSION_SECRET` by hand
  (`openssl rand -base64 48`, ≥ 32 chars).
- **`ED_ADMIN_API_TOKEN`** is the ed-admin staff-directory Bearer token (the *same* token across
  Vercel accounts — it belongs to ed-admin, not Vercel). It grants read access to the **full
  staff directory**, so if it has ever been shared in plaintext, rotate it in ed-admin and re-set
  it on Vercel (`vercel env add ED_ADMIN_API_TOKEN …`).
- **Never commit `.env.local`.** It is gitignored (`.gitignore` ignores `.env*` and `.vercel`).
  Treat the old account's `.env.local` as compromised once shared and rotate it.
- **Admin model:** admin access is the `HR_ADMIN_EMAILS` allow-list only — and, since ed-admin is
  the sole sign-in gate, an `HR_ADMIN_EMAILS` address must **also** be an active ed-admin staff
  member to reach `/admin`. A real identity provider (`inbound-trust`) is stubbed in
  `src/lib/auth/providers/inbound-trust.ts`.
- **Session cookie:** signed with `SESSION_SECRET` (HMAC-SHA256) and carries an absolute expiry.
  In production it is named `__Host-sla_session` (host-locked, `Secure`); over local http dev it
  is `__sla_session`. Rotating `SESSION_SECRET` invalidates **all** existing sessions.
- **Security headers / CSP** are set in `next.config.ts` (HSTS, `nosniff`, `X-Frame-Options`,
  `Permissions-Policy`, CSP). CSP still allows `script-src 'unsafe-inline'` (required for Next App
  Router hydration); hardening to a per-request nonce is a known TODO.

---

## 6. Verification checklist (done = recreated)

- [ ] `vercel link` created the project on the new account (`.vercel/project.json` present).
- [ ] Neon Postgres integration connected → category-A vars visible in `vercel env ls`.
- [ ] Vercel Blob connected → `BLOB_READ_WRITE_TOKEN` visible in `vercel env ls`.
- [ ] `SESSION_SECRET` (≥ 32 chars), `ED_ADMIN_API_TOKEN`, `HR_ADMIN_EMAILS` set (Prod + Dev, optionally Preview).
- [ ] `npm run db:migrate` + `npm run db:seed` ran against the new prod `DATABASE_URL`.
- [ ] `vercel --prod` deployed successfully (no `SESSION_SECRET` startup error).
- [ ] `/api/health` returns `database:true`.
- [ ] Member journey (email + ed-admin Staff ID) works; an unknown email/ID is rejected.
- [ ] `/admin` works with an `HR_ADMIN_EMAILS` address that is **also active in ed-admin** (no PIN).
- [ ] `GET /api/materials/<key>` while signed out returns `404`.

Confirm the full env inventory on the new account at any time with:
```bash
vercel env ls
```

---

## 7. Troubleshooting / gotchas (carried over from the build)

These are baked into the repo config — you shouldn't need to change them, but know why they exist:

- **`SESSION_SECRET` missing/short in prod:** the app throws at startup (`src/lib/env.ts` rejects
  a value < 32 chars; `getSigningKey` in `src/lib/auth/providers/email.ts` hard-fails when it's
  unset outside development). Set it for Production (Step 4) and redeploy.
- **PGlite + Next.js:** `next.config.ts` sets `serverExternalPackages: ["@electric-sql/pglite"]`.
  Removing it breaks the embedded driver under Node ≥ 23 (WASM path mangling). Local/test only —
  on Vercel `DATABASE_URL` is set so `postgres-js` is used.
- **Lazy DB client:** `src/lib/db/client.ts` is a lazy `Proxy`; the driver initialises on first
  query, never at import — eager init aborts the Vercel build-time prerender. Don't change this.
- **Transaction-pooled Postgres:** the postgres-js client uses `{ prepare: false }` — required by
  Neon/PgBouncer transaction-mode poolers (they reject prepared statements).
- **Migrations are not lazy:** always run `db:migrate` against prod *before/with* a deploy that
  ships a new migration. The app does not migrate at request time.
- **`@vercel/blob`** reads `BLOB_READ_WRITE_TOKEN` itself; with no token set, storage falls back
  to local filesystem (ephemeral on serverless) — which is why Blob must be provisioned for
  persistent uploads. Blobs are stored **private** and proxied through `/api/materials`.
- **Ed-admin is the SOLE sign-in gate.** If `ED_ADMIN_API_TOKEN` is unset or the ed-admin API is
  unreachable, `verifyEdAdminStaff` fails and **nobody can sign in** (sign-in shows "Could not
  sign you in"). The directory is fetched and cached in-process for ~5 min, with single-flight +
  short negative-cache backoff on failure (`src/lib/auth/ed-admin.ts`).
- **Admin lockout risk.** `/admin` requires an email that is **both** in `HR_ADMIN_EMAILS` **and**
  an active ed-admin staff member. If none of the `HR_ADMIN_EMAILS` addresses exist in ed-admin,
  admin is unreachable — add one to ed-admin, or set `HR_ADMIN_EMAILS` to a staff email that is.
- **Changing the auth gate does not log existing users out.** A signed-in user keeps their session
  cookie (up to its 30-day expiry) regardless of later sign-in-policy changes — the gate only runs
  at sign-in. To force everyone to re-authenticate, rotate `SESSION_SECRET` (invalidates all
  sessions) and redeploy.

---

## 8. Appendix — full variable reference (copy/paste)

| Variable | Category | Set by | Environments | App reads it? |
|---|---|---|---|---|
| `DATABASE_URL` | A — Neon | auto-injected | Prod·Preview·Dev | ✅ `db/client.ts` |
| `DATABASE_URL_UNPOOLED` | A — Neon | auto-injected | Prod·Preview·Dev | — |
| `POSTGRES_URL` / `…_NON_POOLING` / `…_NO_SSL` / `…_PRISMA_URL` | A — Neon | auto-injected | Prod·Preview·Dev | — |
| `POSTGRES_HOST` / `_USER` / `_PASSWORD` / `_DATABASE` | A — Neon | auto-injected | Prod·Preview·Dev | — |
| `PGHOST` / `PGHOST_UNPOOLED` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | A — Neon | auto-injected | Prod·Preview·Dev | — |
| `NEON_PROJECT_ID` / `NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL` | A — Neon | auto-injected | Prod·Preview·Dev | — |
| `BLOB_READ_WRITE_TOKEN` | B — Blob | auto-injected | Prod·Preview·Dev | ✅ `storage/vercel-blob.ts` |
| `SESSION_SECRET` | C — manual | **you** | Prod·Dev (+Preview if needed) | ✅ `env.ts` + `auth/providers/email.ts` |
| `ED_ADMIN_API_TOKEN` | C — manual | **you** | Prod·Dev (+Preview if needed) | ✅ `auth/ed-admin.ts` |
| `HR_ADMIN_EMAILS` | C — manual | **you** | Prod·Dev (+Preview if needed) | ✅ `env.ts` |
| `ED_ADMIN_STAFF_API_URL` | C — optional | you (override) | — (default Silverleaf endpoint) | ✅ `auth/ed-admin.ts` |
| `ALLOWED_EMAIL_DOMAIN` | C — optional | you (override) | — (default `silverleaf.co.tz`) | ✅ `email.ts` |
| `AUTH_PROVIDER` | C — optional | you (override) | — (default `email`) | ✅ `auth/identity.ts` |
| `NODE_ENV` | runtime | Vercel/Next | automatic | ✅ `env.ts` |
| `PGLITE_MEMORY` | test-only | test harness | local tests | ✅ `db/client.ts` |
| `VERCEL_OIDC_TOKEN` | platform | auto (on `env pull`) | Dev | — |

> **Removed:** `ADMIN_PIN` — no longer read by the app (admin == `HR_ADMIN_EMAILS`). Drop it from
> any environment where it lingers.

---

### Related repo docs
- `docs/deploy.md` — original go-live runbook
- `docs/environment.md` — environment variable reference
- `docs/data-layer.md` — Drizzle/migrations rationale
- `docs/identity.md` — auth provider contract
- `README.md` — project overview & quick start
