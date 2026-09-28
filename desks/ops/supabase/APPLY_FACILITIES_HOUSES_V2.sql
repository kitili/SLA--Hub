-- facilities_houses was created from an earlier version of schema_facilities.sql,
-- before it split into house definitions + a separate occupancy log. Table is
-- empty (never seeded), so this drops and recreates it rather than altering.

drop table if exists public.facilities_houses cascade;

create table public.facilities_houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  house_letter text,
  house_name text not null,
  rooms_description text,
  furniture_status text default 'unfurnished'
    check (furniture_status in ('furnished', 'unfurnished')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facilities_house_occupancy (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.facilities_houses (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  occupant text not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_facilities_house_occupancy_house on public.facilities_house_occupancy (house_id);
create index if not exists idx_facilities_house_occupancy_period on public.facilities_house_occupancy (period_start);

alter table public.facilities_houses enable row level security;
alter table public.facilities_house_occupancy enable row level security;

drop policy if exists "Admin all facilities_houses" on public.facilities_houses;
create policy "Admin all facilities_houses" on public.facilities_houses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin all facilities_house_occupancy" on public.facilities_house_occupancy;
create policy "Admin all facilities_house_occupancy" on public.facilities_house_occupancy
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
