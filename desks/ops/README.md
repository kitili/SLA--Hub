# Majundo Ops System

School transport ops for Majundo — boarding (QR), fees, fleet, finance KPIs.

## Team boards

| Person | Owns |
|--------|------|
| **Kai** | Backend, Supabase, APIs, finance |
| **Amos** | Matron field app (scan, GPS, QR print) |
| **Jfree** | Buses / trips / occupancy / maps |
| **Irene** | Admin dashboard / ledger UI / KPIs |

| Week | Board | Kai / Amos | Jfree / Irene |
|------|-------|------------|---------------|
| **1** | [`WEEK1_TEAM_BOARD.md`](./WEEK1_TEAM_BOARD.md) | ✅ | Days 4–6 UI open |
| **2** | [`WEEK2_TEAM_BOARD.md`](./WEEK2_TEAM_BOARD.md) | ✅ submitted | Admin/map/builder UI open |
| **3** | [`WEEK3_TEAM_BOARD.md`](./WEEK3_TEAM_BOARD.md) | ✅ submitted | Finance UI / demo open |

Daily tasks: **Week 1** · **Week 2** · **Week 3** (links in table).

## Run locally

```bash
cp .env.example .env.local
# fill Supabase URL + anon key (Kai)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## PRs, reviews, and Vercel

- Open PRs against `main` as usual — **you do not need Vercel project access** to contribute. Preview deploy logs/env are a Vercel membership issue; ask Kai if you need visibility, otherwise Kai watches deploys.
- [`.github/CODEOWNERS`](./.github/CODEOWNERS) marks **@kitili (Kai)** as code owner. Once branch protection is on for `main` with **Require review from Code Owners**, Kai’s approval is required before merge.

## Deploy / handover

**Production checklist:** [`docs/DEPLOY.md`](./docs/DEPLOY.md) (SQL order, env, Vercel, SSO, staff, SMS).  
**Prod SQL runner:** [`supabase/RUN_PROD.sql`](./supabase/RUN_PROD.sql).

## Supabase setup

**Full step-by-step:** [`supabase/LOAD_REAL_DATA.md`](./supabase/LOAD_REAL_DATA.md)

Run in SQL Editor **in order**:

1. `supabase/schema_auth.sql` — auth + profiles (Day 1)
2. `supabase/schema_v1.sql` — students, buses, trips, fees
3. `supabase/seed_silverleaf.sql` — **real roster** from transport master sheet (604 students, 5 campuses, 20 buses)
4. `supabase/schema_week2.sql` — routes, stops, trip_locations, left-school
5. `supabase/seed_routes.sql` — sample Usariver AM route on bus T 910 APW
6. `supabase/schema_incidents.sql` + `schema_maintenance.sql`
7. `supabase/schema_week3.sql` + `seed_finance.sql` — expenses, revenues, hire-outs, budgets

Legacy demo: `supabase/seed.sql` (20 Majundo placeholders — **do not use**).

Then provision staff users (Auth + `profiles.role`):

```bash
# Set STAFF_ADMIN_PASSWORD + STAFF_MATRON_PASSWORD in .env.local (never commit)
node scripts/provision-staff.mjs
```

See [`docs/STAFF_USERS.md`](./docs/STAFF_USERS.md). Google SSO: [`docs/SSO.md`](./docs/SSO.md). Roles matrix: [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md).

## Day 2 pages

| URL | What |
|-----|------|
| `/admin/students` | Student list + QR + fee balance |
| `/admin/buses` | Bus list + create AM/PM trip |
| `/api/students` | JSON student list |
| `/api/buses` | JSON bus list |
| `/api/trips` | GET today&apos;s trips · POST create trip |
| `/api/qr/resolve` | GET/POST — scan `MAJUNDO-001` or `OPS\|school\|student` token → student + fees |
| `/api/qr/generate` | POST (admin) — create or regenerate QR token for a student |
| `/api/boarding` | POST — time-in/out for a trip; rejects duplicates; returns fee + `parent_notify` |
| `/api/cron/sync-fees` | GET/POST — CSV → `fee_balances` (Bearer `CRON_SECRET`) |
| `/api/messages` | GET today’s message_logs · POST manual parent SMS |

## Day 4–6 (Kai)

1. Run `supabase/schema_day45.sql` then `supabase/schema_day6.sql` (or re-run updated `schema_v1.sql` on a fresh DB).
2. **If admin login sends you to matron:** run `supabase/fix_profiles_rls.sql` once (fixes profiles RLS + sets Baraka=`admin`).
3. Set `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET` in `.env.local`.
4. Board a student: `POST /api/boarding` with `{ "tripId", "code" or "studentId", "eventType"?: "in"|"out", "lat"?, "lng"? }`.
5. Sync fees stub: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-fees`
6. Parent SMS: boarding time-in writes `message_logs` and sends via Africa’s Talking when `AFRICASTALKING_*` keys are set; otherwise stubs (still logs).

## Week 2 (routes + live GPS)

1. Run `schema_week2.sql` + `seed_routes.sql`.
2. Matron on `/matron/scan?tripId=…`: live GPS pings (~20s), **We’ve left school**, next-stops (optimized + clock ETAs), **Report incident**, torch / offline toast.
3. APIs: `POST /api/trips/:id/locations`, `POST /api/trips/:id/depart`, `GET /api/trips/:id/stops?optimized=1`, `POST /api/routes/:id/optimize`, `POST /api/incidents`.
4. Also run `supabase/schema_incidents.sql`.
5. After real matron GPS accumulates, cluster stop pins (dry-run first):

```bash
node scripts/cluster-stops-from-trips.mjs
node scripts/cluster-stops-from-trips.mjs --apply
```

Not a replacement for `seed_majundo_demo_route.sql`. Admin API: `POST /api/admin/cluster-stops` with `{ "apply": false }`.

## Week 3 (finance + P&L — Kai + Amos submitted)

1. Run `schema_week3.sql` then `seed_finance.sql`.
2. APIs (admin/finance):
   - `GET|POST /api/expenses`
   - `GET|POST /api/revenues`
   - `GET|POST|PATCH /api/hire-outs`
   - `GET|POST /api/budgets`
   - `GET /api/finance/pnl?from=&to=`
3. Fee sync: `Authorization: Bearer $CRON_SECRET` + optional `?dryRun=1`.
4. Maintenance can set `createExpense: true` to link a ledger row.
5. Matron (Amos): fee freshness on scan · QA polish · print QR sheets at `/matron/students/print`.
6. Still open: Jfree hire-out calendar / map panel · Irene ledger UI / charts / demo script.

## Folders

- `src/app/(matron)/` — Amos  
- `src/app/(admin)/admin/buses` — Jfree  
- `src/app/(admin)/admin/dashboard` — Irene  
- `src/app/api/`, `src/lib/`, `supabase/` — Kai  
