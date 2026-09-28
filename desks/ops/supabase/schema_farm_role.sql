-- Majundo Ops — Farm role (restricted: /admin/farm only, enforced by RLS + middleware)
--
-- RUN THIS FILE FIRST, ON ITS OWN (paste, click Run, wait for success) —
-- BEFORE re-running schema_farm.sql. Postgres enum labels must be committed
-- before any policy can reference them as a literal; bundling this with
-- other statements in the same script risks "invalid input value for enum
-- app_role: farm" if the editor runs everything in one transaction.
--
-- After this succeeds, re-run the updated supabase/schema_farm.sql (it's
-- idempotent — drops/recreates the same policies, now including 'farm').

alter type public.app_role add value if not exists 'farm';
