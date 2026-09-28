-- STEP 1 of 2 — run ALONE in Supabase SQL Editor, wait for success,
-- then run APPLY_INCIDENT_ALERTS.sql (step 2).
-- Postgres must commit new enum labels before policies can reference them.

alter type public.app_role add value if not exists 'director';
