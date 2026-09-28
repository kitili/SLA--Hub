-- Majundo Ops — Proximity alerts (bus near stop / school / home)
-- Run AFTER schema_week2.sql (trips, stops, trip_locations, student_stop_assignments)
-- Safe to re-run.
--
-- Written when GPS pings show the bus approaching or leaving a stop within
-- a distance threshold. Parent notify can attach via message_logs later.

create table if not exists public.proximity_alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  stop_id uuid references public.stops (id) on delete set null,
  bus_id uuid references public.buses (id) on delete set null,
  kind text not null
    check (kind in (
      'approaching_stop',
      'at_stop',
      'departed_stop',
      'approaching_school',
      'left_school',
      'near_home',
      'other'
    )),
  distance_m double precision,
  threshold_m double precision not null default 150,
  lat double precision,
  lng double precision,
  status text not null default 'open'
    check (status in ('open', 'notified', 'acked', 'suppressed', 'expired')),
  notified_at timestamptz,
  message_log_id uuid references public.message_logs (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_proximity_trip on public.proximity_alerts (trip_id, created_at desc);
create index if not exists idx_proximity_student on public.proximity_alerts (student_id);
create index if not exists idx_proximity_status on public.proximity_alerts (status);
create index if not exists idx_proximity_kind on public.proximity_alerts (kind);

-- Avoid spamming the same kind for the same trip+stop within a short window
create unique index if not exists idx_proximity_dedupe
  on public.proximity_alerts (trip_id, stop_id, kind)
  where stop_id is not null and status in ('open', 'notified');

alter table public.proximity_alerts enable row level security;

drop policy if exists "Staff read proximity_alerts" on public.proximity_alerts;
create policy "Staff read proximity_alerts"
  on public.proximity_alerts for select
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff insert proximity_alerts" on public.proximity_alerts;
create policy "Staff insert proximity_alerts"
  on public.proximity_alerts for insert
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff update proximity_alerts" on public.proximity_alerts;
create policy "Staff update proximity_alerts"
  on public.proximity_alerts for update
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  )
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

comment on table public.proximity_alerts is
  'GPS-derived near-stop / near-home alerts for parent notify and admin live map';
