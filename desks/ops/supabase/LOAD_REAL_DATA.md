# Load real Silverleaf data into Supabase

Source spreadsheet: [2026 Transport Master sheet](https://docs.google.com/spreadsheets/d/1BDkvHWhJnJXS9vx1c2reyXkab494ZF7bji8z76Ck-mw/edit)

After a successful load you should have:

| Table | Expected count |
|-------|----------------|
| `schools` | **5** (Usariver, Arusha Modern, Kijenge, Ilboru, Boma) |
| `students` | **604** |
| `buses` | **20** |
| `qr_codes` | **604** (codes like `SLV-USR-0001`) |
| `fee_balances` | **604** |

Auth users (`profiles`, Baraka admin, matron login) are **not** touched by the seed.

---

## Before you start

1. Open your Supabase project: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Confirm `.env.local` on your laptop has the **same project** URL + keys
3. Have login users already created in **Authentication → Users** (Day 1)

---

## Step 1 — Auth schema (once)

1. Supabase → **SQL Editor** → **New query**
2. Open `supabase/schema_auth.sql` from this repo
3. Copy all → paste → **Run**

**Expected:** `profiles` table exists.  
**If error:** `app_role already exists` → **ignore**, auth was already run. Continue.

---

## Step 2 — Transport schema (once)

1. **New query** in SQL Editor
2. Open `supabase/schema_v1.sql`
3. Copy all → paste → **Run**

**Expected:** Tables `schools`, `students`, `parents`, `qr_codes`, `buses`, `trips`, `boarding_events`, `fee_balances` appear in **Table Editor**.

**If error:** `type already exists` on enums → safe to ignore on re-run.

---

## Step 2b — Week 2 routes + live GPS (once)

Run in this order (schemas first, then roster, then route seeds):

1. **New query** → run `supabase/schema_week2.sql`
2. After roster seed (Step 3 / `seed_silverleaf.sql`), run `supabase/seed_routes.sql` — **real fleet**
3. Then run `supabase/seed_majundo_demo_route.sql` — **soft-launch optimize demo** (optional but needed for DEMO.md beat 4)

**Expected after `seed_routes.sql`:** `routes` = **18** real AM names from `data/import/buses.json` (Usariver 11, Arusha Modern 4, Kijenge 1, Ilboru 1, Boma 1); all **20** buses get `route_id` (Kijenge/Ilboru backups share the campus route). No GPS stop pins yet — stop pins come later from clustering `trip_locations` (see [Cluster real stop GPS](#cluster-real-stop-gps) below). Trips still get `departed_school_at` from the schema.

**Expected after `seed_majundo_demo_route.sql`:** one extra route **Majundo Soft-Launch Demo AM** (`e2000000-…001`) with **7** zigzag stops (`f2000000-…`). Uses Usariver school id; does **not** steal fleet buses or touch the 18 real routes (`e1000000-…`). Re-run after any `seed_silverleaf` wipe (cascade deletes routes).

### Soft-launch demo route (quick reference)

| Step | File | Purpose |
|------|------|---------|
| Schemas | `schema_week2.sql` | `routes`, `stops`, `route_stops` |
| Roster | `seed_silverleaf.sql` | Usariver + fleet IDs |
| Real fleet | `seed_routes.sql` | 18 AM routes, link 20 buses |
| Demo win | `seed_majundo_demo_route.sql` | Suboptimal stop order for optimize before/after |

---

## Step 2c — Incidents + maintenance (once)

**Required for** `/admin/incidents`, `/matron/incidents`, and `GET|POST /api/incidents`.  
If you see `Could not find the table 'public.incidents' in the schema cache`, this step was skipped (or PostgREST has not reloaded yet).

Run **after** `schema_week2.sql` (needs `public.trips` from `schema_v1.sql`; week2 is the documented Week 2 baseline):

1. **New query** → run `supabase/schema_incidents.sql`  
   - Creates `public.incidents` + RLS (staff read; matron/driver insert; admin update)
2. **New query** → run `supabase/schema_maintenance.sql`  
   - Creates `public.maintenance_records` (Week 2 Day 12)
3. **Reload PostgREST schema cache** (see [Reload schema cache](#reload-schema-cache) below)

**Expected:** Table Editor shows `incidents` (empty is fine). Or:

```sql
select count(*) from public.incidents;
```

---

## Step 2d — Week 3 finance (once)

1. Confirm `supabase/schema_maintenance.sql` already ran (Step 2c).
2. Run `supabase/schema_week3.sql`
3. After roster seed, run `supabase/seed_finance.sql`

**Expected:** Tables `expenses`, `revenues`, `hire_outs`, `budgets`; sample P&L rows for Usariver.

---

## Step 2e — Driver compliance (once)

**Required for** `/admin/drivers`, `GET|POST /api/drivers`, and the license/insurance compliance
badges on `/admin/buses/[id]` + the `/admin/dashboard` alert banner.

1. **New query** → run `supabase/schema_drivers.sql`
   - Creates `public.drivers` (admin-only RLS) + `buses.driver_id`/`buses.insurance_expiry`
2. **Reload PostgREST schema cache** (see [Reload schema cache](#reload-schema-cache) below)
3. After confirming the schema is live, run the one-time migration:
   `node scripts/apply-driver-migration.mjs --apply` — backfills `drivers` from the 20 existing
   buses' `driver_name` values (17 distinct real names; the `DDA` bus's placeholder `"New Driver"`
   is deliberately skipped) and links each bus's `driver_id`.

**Expected:** `public.drivers` has 17 rows. 19 of 20 buses have `driver_id` set (`DDA` doesn't).

---

## Step 3 — Real roster seed

1. **New query** in SQL Editor
2. Open `supabase/seed_silverleaf.sql` (~400 KB — may take 10–30 seconds)
3. Copy all → paste → **Run**

**What it does:**

- Deletes old demo data (Majundo 20 students) and any prior seed
- Inserts 5 campuses, 20 buses, 604 students, QR codes, fee balances, parent phones

**Expected:** Success, no errors.

---

## Reload schema cache

After creating **any** new table (especially `incidents`), PostgREST must see it or the app returns PGRST205 / “schema cache”.

Do **one** of:

1. **Dashboard:** Project → **Settings** → **API** → **Reload schema** (button label may be “Reload schema cache”)
2. **SQL Editor:**

```sql
notify pgrst, 'reload schema';
```

3. Or wait ~30–60s for an automatic reload, then hard-refresh the app.

---

## Step 4 — Verify in Table Editor

Open **Table Editor** and check:

| Table | Check |
|-------|--------|
| `schools` | 5 rows, slugs: `usariver`, `arusha-modern`, `kijenge`, `ilboru`, `boma` |
| `students` | ~604 rows |
| `buses` | 20 rows |
| `qr_codes` | ~604 rows, first codes `SLV-USR-0001`, `SLV-USR-0002`, … |
| `incidents` | Table exists (0 rows OK until matrons report) |
| `profiles` | Still has admin + matron (unchanged) |

Or run this in SQL Editor:

```sql
select 'schools' as tbl, count(*)::text as n from public.schools
union all select 'students', count(*)::text from public.students
union all select 'buses', count(*)::text from public.buses
union all select 'qr_codes', count(*)::text from public.qr_codes
union all select 'fee_balances', count(*)::text from public.fee_balances;
```

---

## Step 5 — Test the app

```bash
npm run dev
```

1. Login as **admin** → `/admin/students` — should list hundreds of students (all campuses)
2. Login as **matron** → `/matron/students` — same roster
3. Matron → **Open scanner** → manual code `SLV-USR-0001` → should resolve a student + fee

---

## Re-sync when the spreadsheet changes

On your laptop:

```bash
python3 scripts/fetch-sheet-tabs.py
python3 scripts/import-from-sheet.py
```

Then re-run **`seed_silverleaf.sql`** in Supabase (Step 3). It clears and reloads transport tables.

---

## Bus plates + crew note

The Transport Users sheet has **BUS NO**, **DRIVER**, **BUS ATTENDANT**, and **OWNER** — not a separate vehicle plate column.

- `plate_number` is set to **`TBA`** unless BUS NO already looks like a Tanzania plate (`T ### …`). Re-seed when real registration numbers are sourced.
- Do not duplicate `label` into `plate_number` (that made the UI show the same string twice).
- Crew fields: `driver_name`, `attendant_name`, `owner_name`.
- Sheet backup capacities **6** (Kijenge Hiace) and **4** (Ilboru Coaster) were student-on-bus counts; seed corrects them to **30** / **40**.

## QR codes note

The Google Sheet **QR Code** tab stores images, not text. The seed uses generated codes:

- `SLV-USR-0001` … Usariver  
- `SLV-AM-0001` … Arusha Modern  
- `SLV-KIJ-0001` … Kijenge  
- `SLV-ILB-0001` … Ilboru  
- `SLV-BOM-0001` … Boma  

Print/display these in the matron app until physical sheet QR payloads are exported as text.

---

## Cluster real stop GPS

After matrons run live trips and `trip_locations` fills up, derive pickup pins for fleet routes that still have few/no `route_stops`.

**This is not a replacement for** `seed_majundo_demo_route.sql` (soft-launch optimize demo).

```bash
# Dry-run (default) — prints clusters only
node scripts/cluster-stops-from-trips.mjs

# Optional filters
node scripts/cluster-stops-from-trips.mjs --bus-id <uuid> --radius-m 75

# Write stops + route_stops
node scripts/cluster-stops-from-trips.mjs --apply
```

Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

Admin API (same logic, dry-run unless `apply: true`):

```bash
curl -X POST http://localhost:3000/api/admin/cluster-stops \
  -H "Cookie: …" \
  -H "Content-Type: application/json" \
  -d '{"apply":false}'
```

---

## Staff logins

See [`docs/STAFF_USERS.md`](../docs/STAFF_USERS.md) (`node scripts/provision-staff.mjs`) and Google SSO in [`docs/SSO.md`](../docs/SSO.md).

---

## Do NOT run

- `supabase/seed.sql` — old 20-student Majundo **demo** (obsolete)

---

## Real history / fee-tier backfills (Kai-reviewed)

Proposal SQLs under `supabase/seed_real_*.sql` + `schema_fee_tiers.sql`.

**Status as of 2026-07-31 (prod):**

| File | Status |
|------|--------|
| `seed_real_incidents.sql` | Already in DB (~13 historical + live test rows) |
| `seed_real_maintenance.sql` | Applied (24 records) |
| `seed_real_maintenance_budget.sql` | Applied (12 monthly budgets + 3 actual expense rows) |
| `cleanup_qa_test_rows.sql` | Applied (QA bus + 2 campuses deleted) |
| `schema_fee_tiers.sql` + `seed_real_fee_tiers.sql` | **Still need SQL Editor** (DDL — REST cannot alter tables) |
| `seed_real_boarding_history.sql` | **Blocked** until `seed_real_stops_and_assignments.sql` is generated (`scripts/extract-real-stops-roster.py`) |

### Fee tiers (run in SQL Editor)

1. `schema_fee_tiers.sql` — **Approved:** put `distance_km` / `distance_category` on `fee_balances` (fee sync only touches balance/currency/synced_at).
2. `notify pgrst, 'reload schema';`
3. `seed_real_fee_tiers.sql` — backfills ~569 distance rows; does not change balances.

Known caveats (do not “fix” in SQL): Hiace DEP / shared-visit attributions in maintenance; 2 unresolved incident buses; Nicole fee amount mismatch flagged in fee-tier seed header.
