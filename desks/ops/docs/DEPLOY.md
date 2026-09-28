# Production deploy & handover

Single entrypoint for shipping Majundo Ops. Detailed SQL steps live in [`supabase/LOAD_REAL_DATA.md`](../supabase/LOAD_REAL_DATA.md); this file is the ordered checklist.

**Release:** tag `v1.0.0` on `main` (same commit as `kiki` at soft-launch merge).

---

## 1. Supabase SQL (prod)

Open Supabase → **SQL Editor**. Run files **in order** from [`supabase/RUN_PROD.sql`](../supabase/RUN_PROD.sql) (checklist + final reload). Do **not** run `seed.sql` or `schema_transport.sql`.

| # | File | Purpose |
|---|------|---------|
| 1 | `schema_auth.sql` | `profiles` + roles |
| 2 | `fix_profiles_rls.sql` | Fix profiles RLS recursion; admin read |
| 3 | `schema_v1.sql` | Schools, students, buses, trips, fees, QR |
| 4 | `schema_day45.sql` | Boarding unique index + `fee_sync_runs` |
| 5 | `schema_day6.sql` | `message_logs` |
| 6 | `schema_week2.sql` | Routes, stops, trip GPS |
| 7 | `schema_incidents.sql` | Incidents |
| 8 | `schema_maintenance.sql` | Maintenance records |
| 9 | `schema_week3.sql` | Expenses, revenues, hire-outs, budgets |
| 10 | `seed_silverleaf.sql` | Real roster (~604 students) — large |
| 11 | `seed_routes.sql` | 18 fleet AM routes |
| 12 | `seed_majundo_demo_route.sql` | Soft-launch optimize demo route |
| 13 | `seed_finance.sql` | Sample P&L / budget |
| 14 | *(optional)* `normalize_parent_phones.sql` | Phone format cleanup |
| 15 | `ticketing/schema.sql` | Ops Ticket Desk (`settings`, `requests`, `messages`) — same project |
| 15b | `ticketing/migrate_desk_upgrades.sql` | Short IDs (`TKT-####`), owner tokens, RLS split |
| 15c | `ticketing/migrate_desk_features.sql` | Attachments bucket, campus leads, owner_uid |
| 16 | `APPLY_ONCE_COMPLIANCE.sql` | Drivers + backfill, guardian QR, proximity alerts, matron parent RLS (or run the individual `schema_*.sql` files) |
| 17 | `seed_per_bus_finance.sql` | Per-bus expenses/revenues for all 20 buses |
| 18 | *(SQL)* `notify pgrst, 'reload schema';` | PostgREST cache (also at end of APPLY_ONCE) |

Ticketing desk uses the **same** Supabase URL/anon key as transport (`NEXT_PUBLIC_SUPABASE_*`). Run `npm run ticketing:config` (or `predev` / `prebuild`) to write `public/ticketing/js/config.js`.

**Verify counts:** see LOAD_REAL_DATA Step 4 (`schools` 5, `students` ~604, `buses` 20, `qr_codes` ~604).

Auth users are **not** created by seeds — use staff provision below.

---

## 2. Staff passwords / provision

```bash
# Set passwords in .env.local (never commit) or pass once:
STAFF_ADMIN_PASSWORD=… STAFF_MATRON_PASSWORD=… \
  node scripts/provision-staff.mjs
```

Creates/updates:

| Email | Role |
|-------|------|
| `baraka@silverleaf.co.tz` | admin |
| `matron@silverleaf.co.tz` | matron |
| `finance@…` / `driver@…` | optional if passwords set |

Full detail: [`docs/STAFF_USERS.md`](./STAFF_USERS.md).

---

## 3. Google SSO (Supabase dashboard)

Cannot be enabled from this repo — needs a Google Cloud OAuth client.

1. Follow [`docs/SSO.md`](./SSO.md) (provider enable + redirect URIs).
2. Site URL + redirect URLs must include production `/auth/callback`.
3. App already restricts to `@silverleaf.co.tz` after callback.

---

## 4. Vercel + env + domain

```bash
npx vercel login          # if not already
npx vercel link           # link this repo to a project
npx vercel env add …      # or paste in dashboard
npx vercel --prod
```

### Required env (Vercel project)

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — never expose to client |
| `NEXT_PUBLIC_APP_URL` | Production origin (`https://…`) |
| `CRON_SECRET` | Bearer for `/api/cron/sync-fees` |

### Optional env

| Name | Notes |
|------|--------|
| `AFRICASTALKING_API_KEY` | Live SMS; omit → stub + `message_logs` |
| `AFRICASTALKING_USERNAME` | |
| `AFRICASTALKING_FROM` | Sender ID / shortcode |
| `ADMIN_ALERT_PHONE` | High-severity incident SMS |
| `ORS_API_KEY` | Live road-geometry polylines; omit → straight-line fallback |

After deploy: attach custom domain in Vercel → Domains; add that origin to Supabase Auth URL config (SSO.md).

### GitHub preview URLs blocked?

If PR / branch preview links open a Vercel login wall (or show `BLOCKED` / `UNKNOWN` in `vercel ls`), SSO Deployment Protection is on. For public team previews:

```bash
npx vercel project protection disable ops-transport-system --sso
```

Keep **Git fork protection** on (`gitForkProtection: true`) so random forks cannot deploy. Re-enable SSO later only if you want every `*.vercel.app` URL gated:

```bash
npx vercel project protection enable ops-transport-system --sso
```

---

## 5. Soft-launch demo gate

Walk [`DEMO.md`](../DEMO.md) (7 checklist items) on production or a seeded staging project. Matron station needs a real phone for QR + GPS.

---

## 6. Live SMS (Africa’s Talking)

Without `AFRICASTALKING_*`, boarding still writes `message_logs` with channel/provider stub.

To go live:

1. Create an Africa’s Talking account + SMS product.
2. Set the three env vars on Vercel (and `.env.local` for local).
3. Redeploy; board a student; confirm Messages + delivery.

---

## 7. Official release (git)

```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Majundo Ops soft-launch v1.0.0"
git push origin v1.0.0
```

`kiki` and `main` should match the tagged commit.

---

## Quick links

| Topic | Doc |
|-------|-----|
| SQL detail + verify | [`supabase/LOAD_REAL_DATA.md`](../supabase/LOAD_REAL_DATA.md) |
| Prod SQL order | [`supabase/RUN_PROD.sql`](../supabase/RUN_PROD.sql) |
| Staff | [`docs/STAFF_USERS.md`](./STAFF_USERS.md) |
| Google SSO | [`docs/SSO.md`](./SSO.md) |
| Roles | [`docs/PERMISSIONS.md`](./PERMISSIONS.md) |
| Demo script | [`DEMO.md`](../DEMO.md) |
