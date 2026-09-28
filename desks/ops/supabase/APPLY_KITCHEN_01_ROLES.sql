-- Kitchen apply step 1/2 — run alone in Supabase SQL Editor, then Run.
-- Commits new app_role labels before policies reference them.

alter type public.app_role add value if not exists 'ops_manager';
alter type public.app_role add value if not exists 'finance_manager';
alter type public.app_role add value if not exists 'cfo';
