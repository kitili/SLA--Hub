-- Week 2 Day 11 — Incidents (manual report from matron)
-- Run AFTER schema_auth.sql + schema_v1.sql (needs public.trips, profiles helpers).
-- Prefer after schema_week2.sql so Week 2 baseline is complete.
-- After run: reload PostgREST schema cache (Settings → API → Reload schema,
-- or: notify pgrst, 'reload schema';). See supabase/LOAD_REAL_DATA.md Step 2c.

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  reported_by uuid references public.profiles (id) on delete set null,
  type text not null
    check (type in (
      'breakdown',
      'accident',
      'delay',
      'medical',
      'behavior',
      'other'
    )),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high')),
  notes text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists idx_incidents_trip on public.incidents (trip_id);
create index if not exists idx_incidents_created on public.incidents (created_at desc);

alter table public.incidents enable row level security;

drop policy if exists "Staff read incidents" on public.incidents;
create policy "Staff read incidents"
  on public.incidents for select
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff insert incidents" on public.incidents;
create policy "Staff insert incidents"
  on public.incidents for insert
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Admin update incidents" on public.incidents;
create policy "Admin update incidents"
  on public.incidents for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- incidents.type: overload, incomplete_roster, unlisted_child (2026-09-23/24,
-- pending -- not yet applied live) -- overload and incomplete_roster are
-- system-detected, not matron-reported: a boarding scan that pushes a bus's
-- aboard count past capacity, and a matron ending a trip while assigned
-- students still have no scan on it. unlisted_child is matron-reported: a
-- freehand name for a child who boarded but isn't in the system yet (new
-- student, or a master-sheet gap) -- there's no real student_id to attach a
-- boarding_events row to, so this rides the incidents pipeline instead.
-- Reusing the incidents -> incident_alerts -> admin Alerts pipeline instead
-- of building a parallel one. Postgres has no "add a value to a check
-- constraint" -- has to drop and re-add the whole thing, which is safe/
-- idempotent to re-run. See src/lib/db/queries.ts's recordBoarding(),
-- completeTrip(), and logUnlistedChildScan().
-- ============================================================================

alter table public.incidents drop constraint if exists incidents_type_check;
alter table public.incidents add constraint incidents_type_check
  check (type in (
    'breakdown',
    'accident',
    'delay',
    'medical',
    'behavior',
    'other',
    'overload',
    'incomplete_roster',
    'unlisted_child'
  ));
