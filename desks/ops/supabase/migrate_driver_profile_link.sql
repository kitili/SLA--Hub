-- Link auth profiles to fleet drivers for the Driver app.
-- Safe to re-run.

alter table public.profiles
  add column if not exists driver_id uuid references public.drivers (id) on delete set null;

create index if not exists idx_profiles_driver_id on public.profiles (driver_id);

comment on column public.profiles.driver_id is
  'Optional link to public.drivers — used by /driver to prefer the assigned bus.';

notify pgrst, 'reload schema';
