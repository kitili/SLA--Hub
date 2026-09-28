# Silverleaf transport data (from Google Sheet)

Source: [2026 Transport Master sheet](https://docs.google.com/spreadsheets/d/1BDkvHWhJnJXS9vx1c2reyXkab494ZF7bji8z76Ck-mw/edit)

Raw CSV exports live in `data/sheet_import/` (one file per tab `gid`).  
Parsed JSON lives in `data/import/`.

## Regenerate

```bash
# Re-download tabs (optional — already committed)
python3 scripts/fetch-sheet-tabs.py

# Parse → JSON + supabase/seed_silverleaf.sql
python3 scripts/import-from-sheet.py
```

## What we scraped

| Tab | gid | Contents |
|-----|-----|----------|
| Dashboard | 1481461008 | KPIs — 621 students, 696 bus seats across 5 campuses |
| Transport Users | 2024890881 | **Master roster** — students, routes, buses, phones, fees, GPS |
| QR Code | 90679730 | Student names per route (**QR values are images — not in CSV**) |
| Transport scan log | 356330456 | Timestamped boarding log (~318 unique names) |
| AttendanceA/B | 1756657284 / 1795930256 | Daily attendance matrix |
| Bus Incidence | 699362141 | Incident reports |
| Bus Arrival Time | 600620859 | AM arrival times per bus |
| Transport P/L | 590546887 | Budget vs actual by campus |

## Counts (parsed)

See `data/import/summary.json` after running the import script.

**5 campuses:** Usariver · Arusha Modern · Kijenge · Ilboru · Boma  
**~25 buses · ~600 students** (from Transport Users tab)

## Fee sync sample (Day 5)

`data/fees/sample-fee-balances.csv` feeds the `/api/cron/sync-fees` stub when no CSV body is posted.

Until image payloads are extracted, `import-from-sheet.py` assigns deterministic dev codes:

`SLV-USR-0001`, `SLV-AM-0001`, `SLV-KIJ-0001`, etc.

These work with `POST /api/qr/resolve` after loading `supabase/seed_silverleaf.sql`.

## Load into Supabase

Run in SQL Editor **after** `schema_auth.sql` + `schema_v1.sql`:

```sql
-- Optional: keep Majundo demo OR replace with real Silverleaf data
\i supabase/seed_silverleaf.sql
```

The demo `seed.sql` (20 Majundo students) remains for Week 1 dev; use `seed_silverleaf.sql` when ready for real roster.
