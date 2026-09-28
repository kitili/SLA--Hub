-- Kitchen apply step 3A/3B — run ALONE in Supabase SQL Editor, then Run.
-- Postgres requires new enum labels to be committed before policies use them.
-- After this succeeds, run APPLY_KITCHEN_03B_COMPLIANCE.sql.

alter type public.app_role add value if not exists 'cook';
alter type public.app_role add value if not exists 'head_of_kitchens';
