# Environment Variables

This document describes every environment variable used by the SLA Onboarding Hub (Next.js on Vercel).

## Variable Reference

| Variable | Purpose | Set by | Scope |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection string for Prisma / raw queries | Vercel-injected (Neon/Vercel Postgres) | dev · preview · prod |
| `ED_ADMIN_API_TOKEN` | Bearer token for the ed-admin staff directory. Staff sign in with **work email + Staff ID**, verified against this directory. The **sole sign-in gate** — without it nobody can sign in. | Developer (Vercel dashboard) | dev · preview · prod |
| `ED_ADMIN_STAFF_API_URL` | Override for the ed-admin directory endpoint (default: Silverleaf endpoint baked into code) | Developer (optional) | dev · preview · prod |
| `HR_ADMIN_EMAILS` | Comma-separated work emails granted `/admin` access. Does **not** bypass the ed-admin check — an admin email must also be an active ed-admin staff member to sign in. | Developer (Vercel dashboard) | dev · preview · prod |
| `ALLOWED_EMAIL_DOMAIN` | Informational only — **no longer the sign-in gate** (ed-admin membership is). Used for normalisation/placeholders (default `silverleaf.co.tz`) | Developer (optional) | dev · preview · prod |
| `SESSION_SECRET` | Secret used to HMAC-sign the session cookie. **Required in production** (the auth provider refuses to start without it outside development); min 32 chars. Rotating it invalidates all existing sessions. | Developer (Vercel dashboard) | preview · prod (dev optional) |
| `BLOB_READ_WRITE_TOKEN` | Auth token for Vercel Blob file-upload storage | Vercel-injected (after Blob is provisioned) | dev · preview · prod |

### "Set by" key

- **Vercel-injected** — Vercel adds this automatically once the linked integration (Postgres, Blob) is provisioned. Do not set it manually in the Vercel dashboard for preview/production.
- **Developer** — Must be set manually: in `.env.local` for local dev, and in the Vercel dashboard (or via `vercel env add`) for preview/production.

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

## Variables expected in future phases

| Variable | Purpose | Trigger |
|---|---|---|
| `NEXTAUTH_SECRET` | Required by NextAuth.js for session signing | When authentication is introduced |
| `NEXTAUTH_URL` | Canonical URL for OAuth callbacks | When authentication is introduced |
| Provider OAuth keys (e.g. `GOOGLE_CLIENT_ID`) | OAuth provider credentials | When a specific provider is configured |

---

## Provisioning & linking (manual steps)

These steps require your Vercel account and cannot be automated by this repository.

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
2. Click **Create Database** → choose **Postgres (Neon)**.
3. Follow the prompts; Vercel will inject `DATABASE_URL` (and `POSTGRES_*` variants) into all three environments automatically.

You can also use the CLI:

```bash
vercel storage create --type postgres
```

### 3. Add Vercel Blob

1. Open the Vercel dashboard → your project → **Storage** tab.
2. Click **Create Database** → choose **Blob**.
3. Follow the prompts; Vercel will inject `BLOB_READ_WRITE_TOKEN` automatically.

You can also use the CLI:

```bash
vercel storage create --type blob
```

### 4. Pull environment variables for local development

After provisioning, pull the auto-injected variables into your local `.env.local`:

```bash
vercel env pull .env.local
```

`.env.local` is gitignored. Run this command again whenever a new variable is added in the Vercel dashboard.

### 5. Set developer-managed variables

Add `ED_ADMIN_API_TOKEN`, `HR_ADMIN_EMAILS`, and `SESSION_SECRET` for each environment:

```bash
vercel env add ED_ADMIN_API_TOKEN
vercel env add HR_ADMIN_EMAILS
vercel env add SESSION_SECRET   # min 32 chars; e.g. `openssl rand -base64 48`
```

The CLI will prompt you for the value and which environments (development, preview, production) to apply it to. Alternatively, set them in the Vercel dashboard under **Project → Settings → Environment Variables**.

---

## Local development workflow (summary)

```
git clone <repo>
npm install
vercel link          # one-time
vercel env pull      # pulls DATABASE_URL etc. from Vercel into .env.local
cp .env.example .env.local   # then edit .env.local for any local overrides
npm run dev
```
