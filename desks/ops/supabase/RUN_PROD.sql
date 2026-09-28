-- Majundo Ops — PRODUCTION SQL RUN ORDER
-- ========================================
-- This file is a CHECKLIST, not a mega-script.
-- Paste/run each referenced file in Supabase SQL Editor, in order.
-- Do NOT run: seed.sql, schema_transport.sql (deprecated).
-- ⚠ Do NOT re-run seed_silverleaf.sql (step 10) on prod casually -- see the
--   warning at that step. It already wiped prod once (2026-08-01).
-- Full narrative: supabase/LOAD_REAL_DATA.md
-- Handover entrypoint: docs/DEPLOY.md
--
-- After all schemas/seeds, run the notify at the bottom of this file.

-- ---------------------------------------------------------------------------
-- 1. Auth + profiles
--    → run entire file: schema_auth.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. Profiles RLS fix (admin list / no recursion)
--    → run entire file: fix_profiles_rls.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Core transport (schools, students, buses, trips, fees, QR)
--    → run entire file: schema_v1.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4. Day 4–5 additive (boarding unique index, fee_sync_runs)
--    → run entire file: schema_day45.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Day 6 messaging audit
--    → run entire file: schema_day6.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. Week 2 routes + live GPS
--    → run entire file: schema_week2.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. Incidents
--    → run entire file: schema_incidents.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 8. Maintenance
--    → run entire file: schema_maintenance.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 9. Week 3 finance
--    → run entire file: schema_week3.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 9a. Driver compliance (additive) — run once, on a fresh DB or if this
--     hasn't been applied yet on prod
--     → run entire file: schema_drivers.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 10. Real roster seed (~400 KB — 10–30s)
--     ⚠ DANGER — DO NOT RE-RUN THIS ON PROD WITHOUT TEAM AWARENESS. ⚠
--     This file OPENS with `delete from` on boarding_events, trips,
--     fee_balances, qr_codes, student_parents, students, parents, buses,
--     schools -- and maintenance_records/incidents/hire_outs/stops/
--     route_stops/student_stop_assignments all CASCADE-DELETE off those via
--     foreign keys, even though this file never touches them directly. This
--     has already wiped prod once (2026-08-01) and needed a full-day manual
--     restore. Only re-run this if the source spreadsheet actually changed
--     AND the whole team knows it's happening -- never as a "let me just
--     re-run everything to be safe" step.
--     → run entire file: seed_silverleaf.sql
--     Expected: schools=5, students~604, buses=20, qr_codes~604
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 11. Fleet AM routes (after roster)
--     → run entire file: seed_routes.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 12. Soft-launch optimize demo route (DEMO.md beat 4)
--     → run entire file: seed_majundo_demo_route.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 13. Finance sample rows (DEMO.md beats 6–7)
--     → run entire file: seed_finance.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 14. OPTIONAL — normalize parent phone formats
--     → run entire file: normalize_parent_phones.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 15. Ops Ticket Desk (same project as transport)
--     → run entire file: ticketing/schema.sql
--     Then upgrades: ticketing/migrate_desk_upgrades.sql
--       (display_id TKT-####, owner_token, desk_next_display_id, RLS split)
--     Then features: ticketing/migrate_desk_features.sql
--       (attachments, owner_uid, campus_leads, storage bucket desk-attachments)
--     Then alerts: ticketing/migrate_desk_alerts.sql (in-app Alerts bell)
--     Tables: settings, requests, messages
--     Skip ticketing/migrate_align_desk.sql unless upgrading an old desk DB
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 16. Drivers + guardian QR + proximity + matron parent write RLS
--     Fast path (recommended): APPLY_ONCE_COMPLIANCE.sql
--       ⚠ Its inlined drivers block is currently STALE (phase-1 columns only
--       — name/license/phone). schema_drivers.sql now also has next-of-kin
--       and PSV permit/health/training columns folded in. Kai should re-sync
--       APPLY_ONCE_COMPLIANCE.sql's drivers section, or until then run
--       schema_drivers.sql directly instead of the bundle for this table.
--     Or run individually:
--       schema_drivers.sql  (alias: schema_directors.sql) — Jfree, name/
--         license/insurance + next-of-kin + PSV permit/health/training,
--         all in one file, always safe to re-run in full
--       migrate_backfill_drivers.sql  (or seed_drivers_from_buses.sql / apply-driver-migration.mjs)
--       schema_guardian_qr.sql  (alias: schema_gurdian_qr.sql)
--       schema_proximity_alerts.sql
--       schema_matron_parent_contact.sql  (alias: schema_matron_parent_contacts.sql)
--       migrate_driver_profile_link.sql — profiles.driver_id for /driver app
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 17. Per-bus finance rows (all 20 buses — expenses + revenues)
--     → run entire file: seed_per_bus_finance.sql
--     After schema_week3 + seed_silverleaf. Safe re-run (fixed id range).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 18. Director role (read-only oversight) + incident escalation alerts
--     → run entire file: schema_directors.sql
--     NOT the same thing as step 16's "schema_drivers.sql (alias:
--     schema_directors.sql)" note — two different people independently
--     used this exact filename for two different features while working
--     in parallel. After the merge, schema_directors.sql on disk is the
--     director-role + incident_alerts migration (adds 'director' to the
--     app_role enum + the incident_alerts table); the driver-compliance
--     content step 16 refers to lives only in schema_drivers.sql now.
--     Must run AFTER step 7 (schema_incidents.sql) — needs public.incidents
--     to already exist — and BEFORE step 16's guardian_qr_codes RLS, which
--     references the 'director' role value this adds.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 19. Kitchen ops (menu/ingredient planning, procurement, budget vs actual)
--     → run entire file: schema_kitchen.sql
--     Needs public.schools (step 3) and public.profiles (step 1) to exist.
--     Seeds a starter kitchen_ingredients list from the "2026 Kitchens
--     Master Sheet.xlsx" — Baraka should review/adjust ratios and prices
--     per campus via the Kitchen ingredients admin UI.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 20b. Staff roster roles (SLT super-admin, transport, ops_manager farm access)
--     Run as TWO separate pastes (enum must commit first):
--       a) migrate_staff_roster_roles_01_enum.sql
--       b) migrate_staff_roster_roles.sql
--     Then: node scripts/provision-staff.mjs  (see docs/STAFF_USERS.md)
--
-- ---------------------------------------------------------------------------
-- 20. Farm management (school_farms branch)
--     Run IN ORDER, each as its own paste-and-run (enum label must commit
--     before schema_farm.sql's RLS can reference it as a literal):
--       a) schema_farm_role.sql   — adds 'farm' to the app_role enum
--       b) schema_farm.sql        — tables + RLS (admin/finance/farm)
--       c) migrate_farm_sections_and_schedule.sql — plot sections + weekly plan
--       d) migrate_farm_plot_coordinates.sql — optional lat/lng pins per plot
--
-- 17. Driver self-service documents (CV, licence, PSV, medical, service dates,
--     upload/delete, ~7-day SMS alerts). Safe to re-run:
--       migrate_driver_docs_self_service.sql
--     Then confirm Vercel cron: /api/cron/driver-compliance (daily 06:00) + CRON_SECRET.
--     Tables: farm_plots, farm_crop_plantings, farm_activities, farm_inputs,
--       farm_input_movements, farm_expenses, farm_budgets, farm_harvests,
--       farm_walkthroughs, farm_alerts.
--     'farm' role is restricted to /admin/farm only (src/proxy.ts).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- FINAL — reload PostgREST schema cache (ALWAYS run after new tables)
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- Optional verify:
-- select 'schools' as tbl, count(*)::text as n from public.schools
-- union all select 'students', count(*)::text from public.students
-- union all select 'buses', count(*)::text from public.buses
-- union all select 'qr_codes', count(*)::text from public.qr_codes
-- union all select 'routes', count(*)::text from public.routes
-- union all select 'message_logs', count(*)::text from public.message_logs
-- union all select 'requests', count(*)::text from public.requests
-- union all select 'settings', count(*)::text from public.settings
-- union all select 'drivers', count(*)::text from public.drivers
-- union all select 'guardian_qr_codes', count(*)::text from public.guardian_qr_codes
-- union all select 'proximity_alerts', count(*)::text from public.proximity_alerts;
