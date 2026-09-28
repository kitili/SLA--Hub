# Staff users (Supabase Auth + profiles)

Provision Silverleaf staff accounts in Auth and set `profiles.role`.

## Roster

| Email | Role | Lands on | Notes |
|-------|------|----------|--------|
| `slt@silverleaf.co.tz` | `admin` | `/ops/admin` | **Super admin** — Ops overview + all dashboards |
| `baraka@silverleaf.co.tz` | `admin` | `/ops/admin` | Full access (all OPS departments) |
| `intern-shikunzi@silverleaf.co.tz` | `admin` | `/ops/admin` | Full access (all OPS departments) |
| `kusaduka@silverleaf.co.tz` | `ops_manager` | `/ops` | Kitchen + Facilities + Farm (+ ticketing) |
| `francis@silverleaf.co.tz` | `admin` | `/ops/admin` | Full access (all OPS departments) |
| `matron@silverleaf.co.tz` | `matron` | `/matron` | Boarding only |

Ticketing desk still uses manager PIN `Ops2026` (separate from Ops Auth).

## Required env

In `.env.local` (never commit this file):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS; server/scripts only) |
| `STAFF_SLT_PASSWORD` | Password for `slt@silverleaf.co.tz` (e.g. `slt2026`) |
| `STAFF_MATRON_PASSWORD` | Password for `matron@silverleaf.co.tz` |
| `STAFF_BARAKA_PASSWORD` | Password for Baraka (transport) |
| `STAFF_SHIKUNZI_PASSWORD` | Password for Shikunzi (transport) |
| `STAFF_KUSADUKA_PASSWORD` | Password for Kusaduka (ops lead) |
| `STAFF_FRANCIS_PASSWORD` | Password for Francis (ops lead) |

Optional: `STAFF_FINANCE_PASSWORD`, `STAFF_DRIVER_PASSWORD`, `STAFF_FARM_PASSWORD`.

For **many drivers** (not the shared demo `driver@`), use Admin → Drivers → **Bulk provision**, or:

```bash
node scripts/provision-drivers.mjs --all-unlinked
```

See [`DRIVER_GO_LIVE.md`](./DRIVER_GO_LIVE.md).

## One-time SQL

Before first provision of the new roles, run in Supabase SQL Editor **as two separate runs**
(enum labels must commit before they can be used):

1. [`supabase/migrate_staff_roster_roles_01_enum.sql`](../supabase/migrate_staff_roster_roles_01_enum.sql)
2. [`supabase/migrate_staff_roster_roles.sql`](../supabase/migrate_staff_roster_roles.sql)

## Run

```bash
# From repo root (loads .env.local automatically)
node scripts/provision-staff.mjs

# Or pass passwords once (still do not commit them)
node scripts/provision-staff.mjs \
  --slt-password 'slt2026' \
  --matron-password '…' \
  --baraka-password '…' \
  --francis-password '…' \
  --shikunzi-password '…' \
  --kusaduka-password '…'
```

Idempotent: creates missing Auth users, updates passwords when provided, upserts `profiles` with the correct role.

Only `@silverleaf.co.tz` emails are allowed by the script.

## Security

- **Never** commit passwords, `.env.local`, or service role keys.
- Prefer Google SSO for day-to-day login once configured (`docs/SSO.md`).
- After provisioning, confirm roles in Supabase **Table Editor → profiles**.
