-- Fix: profiles RLS infinite recursion
-- Cause: "Admins can read all profiles" queried profiles inside its own policy.
-- Run this once in Supabase SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Confirm Baraka is admin
update public.profiles
set role = 'admin',
    full_name = coalesce(full_name, 'Baraka Admin')
where id = (
  select id from auth.users where email = 'baraka@silverleaf.co.tz'
);

update public.profiles
set role = 'matron'
where id = (
  select id from auth.users where email = 'matron@silverleaf.co.tz'
);
