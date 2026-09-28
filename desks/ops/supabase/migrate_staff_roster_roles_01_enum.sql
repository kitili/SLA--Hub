-- STEP 1 of 2 — run ALONE, wait for success, then run migrate_staff_roster_roles.sql
-- Postgres must commit new enum labels before any function/policy can use them.

alter type public.app_role add value if not exists 'transport';
alter type public.app_role add value if not exists 'ops_manager';
alter type public.app_role add value if not exists 'finance_manager';
alter type public.app_role add value if not exists 'cfo';
