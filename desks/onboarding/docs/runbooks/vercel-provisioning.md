# Runbook — Provision SLA Onboarding Hub on a new Vercel account

**Audience:** an automation agent (or engineer) standing the app up on a Vercel
account/team it has not been deployed to before.
**Goal:** a working Production deployment where staff can sign in, complete their
bio, upload qualification certificates (Vercel Blob), and admins can download
them.

Steps are idempotent — each has a **Verify** gate and an **On failure** branch.
The authoritative environment-variable reference is [`.env.example`](../../.env.example);
`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are **Vercel-injected** by the steps
below — do not set them by hand in Preview/Production.

## 0. Inputs you must have before starting

Collect these first — the run **cannot complete** without them:

| Secret / value | Where it comes from | Notes |
|---|---|---|
| Vercel access (CLI logged in) | `vercel login` | Rights to create resources on the target team. |
| Target team/scope slug | Vercel dashboard | Chosen during `vercel link` / `--scope`. |
| Git repo access | this repository | The project deploys from this repo. |
| `ED_ADMIN_API_TOKEN` | the client (ed-admin / Silverleaf) | Required for staff sign-in; external secret, **not** provided by Vercel. |
| `HR_ADMIN_EMAILS` | the client | Comma-separated work emails granted `/admin`. |
| `SESSION_SECRET` | generate: `openssl rand -base64 48` | Min 32 chars; required in production. |
| (optional) `ALLOWED_EMAIL_DOMAIN` | the client | Defaults to `silverleaf.co.tz`. |
| (optional) `ED_ADMIN_STAFF_API_URL` | the client | Defaults in code to the Silverleaf endpoint. |
| (optional) `NEXT_PUBLIC_IDLE_TIMEOUT_MS`, `NEXT_PUBLIC_IDLE_WARN_MS` | product decision | Idle-logout tuning; build-time (`NEXT_PUBLIC_*`). |

**Tooling:** Node 20+, `vercel` CLI (`npm i -g vercel@latest`), repo dependencies
installed (`npm ci`).

## 1. Link the repo to a Vercel project

```bash
vercel link            # pick the target team/scope; create or select the project
vercel project ls      # verify the project now exists
```

**Verify:** `.vercel/project.json` exists with the right `orgId`/`projectId`.
**On failure:** wrong team → `vercel switch` then re-run.

## 2. Provision Postgres (Neon via Marketplace) → injects `DATABASE_URL`

Prefer Marketplace auto-provisioning (creates the DB and injects env vars into
all environments).

```bash
vercel integration add neon     # or: dashboard → Storage → Create → Neon, connect to this project
vercel integration list         # confirm Neon is attached
```

**Verify:** `vercel env ls` shows `DATABASE_URL` for Production (and Preview).
**On failure / external DB required:** create the DB on the provider, then
`vercel env add DATABASE_URL production` (and `preview`) with the connection
string.

## 3. Provision Vercel Blob → injects `BLOB_READ_WRITE_TOKEN`  ← the upload requirement

This powers the qualification-certificate uploads. The app uses **private** blobs
and proxies every read through an authenticated route, so the store must be the
project's own.

```bash
# Dashboard path (most reliable today): Storage → Create Database → Blob →
#   name it (e.g. "onboarding-uploads") → Connect to this project (all environments).
vercel env ls          # confirm BLOB_READ_WRITE_TOKEN appears for Production + Preview
```

**Verify:** `BLOB_READ_WRITE_TOKEN` is present in `vercel env ls`. (The storage
factory switches to Vercel Blob whenever this token is set —
[`src/lib/storage/index.ts`](../../src/lib/storage/index.ts).)
**On failure:** if the token is missing at runtime the app silently falls back to
the **local filesystem** adapter, which does **not** persist on Vercel's
serverless filesystem — uploads will appear to work then vanish. Treat a missing
token as a hard stop.

## 4. Set the application env vars

Set these for **Production** (repeat for **Preview** if previews should be
usable). `NEXT_PUBLIC_*` are build-time — they must exist *before* the build in
step 7.

```bash
printf '%s' "<openssl-rand-base64-48>"     | vercel env add SESSION_SECRET production
printf '%s' "<ed-admin-token>"             | vercel env add ED_ADMIN_API_TOKEN production
printf '%s' "hr@client.example"            | vercel env add HR_ADMIN_EMAILS production
# optional:
printf '%s' "client.example"               | vercel env add ALLOWED_EMAIL_DOMAIN production
printf '%s' "https://.../v1/staff"         | vercel env add ED_ADMIN_STAFF_API_URL production
```

**Verify:** `vercel env ls` lists every required key for Production. Cross-check
against [`.env.example`](../../.env.example).
**On failure:** never echo secret values into logs; if a value was mistyped,
`vercel env rm <KEY> production` then re-add.

## 5. Sync env locally and run database migrations

Vercel-injected vars (`DATABASE_URL`) are only in the cloud until pulled. The
migrate script is a plain Node script and does **not** auto-load `.env.local`, so
export it explicitly.

```bash
vercel env pull .env.local --yes
# export the pulled vars for the Node migrate script, then migrate:
set -a; . ./.env.local; set +a
npm run db:migrate        # applies src/lib/db/migrations/*  (creates member_documents et al.)
# optional first-run reference data:
npm run db:seed
```

**Verify:** the migrator prints applied migrations and exits 0; `member_documents`
and `member_qualifications` exist in the target DB.
**On failure:** `DATABASE_URL` unset → confirm step 2 and that `.env.local` was
sourced. Connection refused → check the DB is reachable / not paused.

## 6. (Decision) How migrations run on future deploys

The build is just `next build`; migrations are **not** auto-applied on deploy.
Choose one and record it:

- **Manual (default):** re-run step 5 whenever new migrations land. Simplest,
  safest.
- **Automated:** add a `vercel-build` script that runs `db:migrate` before
  `next build`. Only do this if the build environment can reach the DB and you
  accept migrations gated on deploys.

## 7. Deploy

```bash
vercel deploy --prod      # build runs with the env vars from steps 3–4
```

**Verify:** deployment status is `Ready`; open the deployment URL.
**On failure:** read the build logs — a crash referencing
`DATABASE_URL`/`SESSION_SECRET` means an env var is missing for the build scope;
fix in step 4 and redeploy.

## 8. End-to-end verification (the actual feature)

1. Sign in as a real staff member (work email + ed-admin Staff ID).
2. Go to **Bio → Qualifications & education**, **Save** once (captures consent →
   creates the profile row that uploads attach to).
3. Upload a **PDF** and a **PNG**; confirm they list with name + size. Click each
   link: PDF/PNG render inline; a `.docx` downloads as an attachment.
4. Confirm the file landed in the Blob store (dashboard → the store → objects).
5. **Privacy check:** the object's raw Vercel Blob URL must be inaccessible
   without auth — only `/api/bio/documents/{id}` (signed-in owner/admin) serves
   it. A signed-out request to that path returns **404**.
6. Sign in as an admin → open **Members → (a member)** →
   `/{locale}/admin/members/{memberId}` → download the member's certificate and
   the Bio PDF.

**Pass criteria:** uploads persist across page reloads (proving Blob, not local
FS), non-owners get 404, admin can download.

## 9. Rollback / teardown

- Bad deploy: `vercel rollback` (or promote a previous Ready deployment).
- Remove resources: detach Neon/Blob via `vercel integration` / dashboard
  Storage. **Deleting the Blob store destroys uploaded certificates** — export
  first if they must be retained.
- Rotate `SESSION_SECRET` to invalidate all sessions; rotate `ED_ADMIN_API_TOKEN`
  with the client if leaked.
