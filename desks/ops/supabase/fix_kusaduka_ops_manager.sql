-- Ensure Kusaduka (ops lead) can sign in to /ops with role ops_manager.
-- Safe to re-run after provision-staff.mjs or Google first-login.

update public.profiles
set
  role = 'ops_manager',
  full_name = coalesce(full_name, 'Kusaduka'),
  updated_at = now()
where id = (
  select id from auth.users where lower(email) = 'kusaduka@silverleaf.co.tz'
);
