# Vercel deploy runbook

Step-by-step checklist for going live on Vercel. Run these steps in order against a clean `main` branch.

---

## 1. Link the repository

```bash
npm install -g vercel    # install CLI once
vercel link              # follow the interactive prompts
```

This creates `.vercel/project.json` (gitignored). Note the project name for the steps below.

---

## 2. Provision Vercel Postgres

1. Vercel dashboard → your project → **Storage** tab.
2. **Create Database** → **Postgres (Neon)**.
3. Accept defaults; Vercel injects `DATABASE_URL` (and `POSTGRES_*` variants) into all three environments automatically.

CLI equivalent:

```bash
vercel storage create --type postgres
```

---

## 3. Provision Vercel Blob

1. Vercel dashboard → your project → **Storage** tab.
2. **Create Database** → **Blob**.
3. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically.

CLI equivalent:

```bash
vercel storage create --type blob
```

---

## 4. Set developer-managed environment variables

```bash
vercel env add HR_ADMIN_EMAILS   # comma-separated admin emails, e.g. hr@silverleaf.co.tz
vercel env add ED_ADMIN_API_TOKEN # bearer token for ed-admin directory sign-in
vercel env add SESSION_SECRET    # min 32 chars; e.g. `openssl rand -base64 48`
```

The CLI prompts for the value and which environments (development / preview / production) to apply it to. Alternatively set them in **Project → Settings → Environment Variables** in the dashboard.

---

## 5. Pull env vars for local access (optional)

```bash
vercel env pull .env.local
```

`.env.local` is gitignored. Re-run this whenever new variables are added.

---

## 6. Run migrations against the production database

Migrations must be applied **before** the app first starts serving. Run them manually from your local machine using the production `DATABASE_URL`:

```bash
# Pull DATABASE_URL if not already in .env.local
vercel env pull .env.local

DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) npm run db:migrate
DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) npm run db:seed
```

Or supply the connection string directly:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
DATABASE_URL="postgresql://..." npm run db:seed
```

`db:migrate` is idempotent — re-running on an already-migrated database is safe. `db:seed` inserts demo data idempotently (upsert semantics).

---

## 7. Deploy

Push to `main` (or merge a PR) — Vercel builds and deploys automatically via its Git integration.

To deploy manually:

```bash
vercel --prod
```

---

## 8. Smoke check

After the deploy completes, verify the following:

| Check | URL / command |
|---|---|
| Health endpoint responds 200 | `GET /api/health` |
| Home redirects to locale | `GET /` → 302 to `/en` |
| Sign-in page loads | `GET /en/sign-in` |
| Admin page loads for admin email | sign in with an `HR_ADMIN_EMAILS` address, visit `/en/admin` |

```bash
# Quick curl check (replace with your production domain)
curl -I https://<your-domain>/api/health
```

---

## Re-deploying after schema changes

Whenever a new migration is generated (`npm run db:generate`), run the migration against production before or as part of the deploy:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

Do not rely on lazy migration at request time — see `docs/data-layer.md` for rationale.

---

## Environment variable reference

See [`docs/environment.md`](./environment.md) for the full variable list, including which are Vercel-injected vs. developer-managed.
