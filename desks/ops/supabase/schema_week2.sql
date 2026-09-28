-- Week 2 — Routes, stops, live trip locations, left-school marker
-- Run AFTER schema_auth.sql + schema_v1.sql in Supabase SQL Editor.

-- ── Trips: left school ───────────────────────────────────────────────────────
alter table public.trips
  add column if not exists departed_school_at timestamptz;

comment on column public.trips.departed_school_at is
  'When matron taps Left school — bus/driver/matron/students left campus';

-- ── Buses → optional default route ───────────────────────────────────────────
alter table public.buses
  add column if not exists route_id uuid;

-- ── Routes & stops ───────────────────────────────────────────────────────────
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  direction public.trip_direction not null default 'am',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name, direction)
);

create index if not exists idx_routes_school_id on public.routes (school_id);

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  lat double precision,
  lng double precision,
  kind text not null default 'pickup'
    check (kind in ('school', 'pickup', 'dropoff', 'waypoint')),
  created_at timestamptz not null default now()
);

create index if not exists idx_stops_school_id on public.stops (school_id);

create table if not exists public.route_stops (
  route_id uuid not null references public.routes (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete cascade,
  stop_order integer not null check (stop_order >= 0),
  eta_offset_minutes integer,
  primary key (route_id, stop_id),
  unique (route_id, stop_order)
);

create index if not exists idx_route_stops_route on public.route_stops (route_id, stop_order);

create table if not exists public.student_stop_assignments (
  student_id uuid not null references public.students (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  primary key (student_id, stop_id)
);

create index if not exists idx_ssa_stop on public.student_stop_assignments (stop_id);
create index if not exists idx_ssa_route on public.student_stop_assignments (route_id);

-- FK buses.route_id after routes exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'buses_route_id_fkey'
  ) then
    alter table public.buses
      add constraint buses_route_id_fkey
      foreign key (route_id) references public.routes (id) on delete set null;
  end if;
end $$;

-- ── Live GPS pings (matron phone) ────────────────────────────────────────────
create table if not exists public.trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_locations_trip_time
  on public.trip_locations (trip_id, recorded_at desc);

create index if not exists idx_trip_locations_recorded_at
  on public.trip_locations (recorded_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.routes enable row level security;
alter table public.stops enable row level security;
alter table public.route_stops enable row level security;
alter table public.student_stop_assignments enable row level security;
alter table public.trip_locations enable row level security;

drop policy if exists "Staff read routes" on public.routes;
create policy "Staff read routes"
  on public.routes for select
  using (public.is_admin() or public.current_user_role() in ('matron', 'driver', 'finance'));

drop policy if exists "Admin write routes" on public.routes;
create policy "Admin write routes"
  on public.routes for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read stops" on public.stops;
create policy "Staff read stops"
  on public.stops for select
  using (public.is_admin() or public.current_user_role() in ('matron', 'driver', 'finance'));

drop policy if exists "Admin write stops" on public.stops;
create policy "Admin write stops"
  on public.stops for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read route_stops" on public.route_stops;
create policy "Staff read route_stops"
  on public.route_stops for select
  using (public.is_admin() or public.current_user_role() in ('matron', 'driver', 'finance'));

drop policy if exists "Admin write route_stops" on public.route_stops;
create policy "Admin write route_stops"
  on public.route_stops for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read student_stop_assignments" on public.student_stop_assignments;
create policy "Staff read student_stop_assignments"
  on public.student_stop_assignments for select
  using (public.is_admin() or public.current_user_role() in ('matron', 'driver', 'finance'));

drop policy if exists "Admin write student_stop_assignments" on public.student_stop_assignments;
create policy "Admin write student_stop_assignments"
  on public.student_stop_assignments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read trip_locations" on public.trip_locations;
create policy "Staff read trip_locations"
  on public.trip_locations for select
  using (public.is_admin() or public.current_user_role() in ('matron', 'driver', 'finance'));

drop policy if exists "Staff insert trip_locations" on public.trip_locations;
create policy "Staff insert trip_locations"
  on public.trip_locations for insert
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

-- Realtime: enable trip_locations for admin live map (Day 10)
do $$
begin
  alter publication supabase_realtime add table public.trip_locations;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard';
end $$;

-- ── Trips: manual arrival time (2026-08-17, from the Transport Master sheet
-- admin review) ───────────────────────────────────────────────────────────────
-- The sheet's own "Bus Arrival Time" KPI was never GPS-derived -- a matron/
-- driver just typed the actual arrival clock-time per bus per school day.
-- This sidesteps GPS/stop-coordinate reliance entirely, since it never
-- touches coordinates. Same pattern as departed_school_at above.
-- (2026-08-19 correction: the "pings 14-21km off the recorded stop" finding
-- this comment used to cite turned out not to be a coordinate-quality
-- problem at all -- see [[gps-trip-completion-data-quality]] memory. The
-- trips behind it were started-and-abandoned within seconds/minutes, never
-- actually run; both the stop coordinates and the GPS pings were fine.)
alter table public.trips
  add column if not exists actual_arrival_at timestamptz;

comment on column public.trips.actual_arrival_at is
  'When the driver/matron marks "arrived at school" -- manually entered, not GPS-derived. Feeds the on-time % KPI.';

-- ============================================================================
-- RLS fix (2026-08-19, pending -- not yet applied live) -- routes/stops/
-- route_stops/student_stop_assignments/trip_locations are all already live,
-- and their "Staff read ..." policies above only ever allowed
-- admin/matron/driver/finance -- but every route that reads them
-- (/api/routes, /api/stops, /api/routes/[routeId]/stops, /api/student-stops,
-- /api/trips/live) has always gated on requireUser([..., "transport", ...])
-- too. 'transport' is a real role (Baraka + Shikunzi, per src/lib/roles.ts)
-- with UI access to nearly all of /admin -- including the live map and
-- routes pages. Until this runs, a transport-role user's live map loads but
-- shows every bus as "No GPS yet" (RLS silently blocks their read of
-- trip_locations), and route/stop editing pages come back empty. Appended
-- as a new block, not edited in place above, since those policy blocks are
-- already shipped and Kai could mistake an in-place edit for something
-- already run.
-- ============================================================================

drop policy if exists "Staff read routes" on public.routes;
create policy "Staff read routes"
  on public.routes for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'matron', 'driver', 'finance'));

drop policy if exists "Staff read stops" on public.stops;
create policy "Staff read stops"
  on public.stops for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'matron', 'driver', 'finance'));

drop policy if exists "Staff read route_stops" on public.route_stops;
create policy "Staff read route_stops"
  on public.route_stops for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'matron', 'driver', 'finance'));

drop policy if exists "Staff read student_stop_assignments" on public.student_stop_assignments;
create policy "Staff read student_stop_assignments"
  on public.student_stop_assignments for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'matron', 'driver', 'finance'));

drop policy if exists "Staff read trip_locations" on public.trip_locations;
create policy "Staff read trip_locations"
  on public.trip_locations for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'matron', 'driver', 'finance'));
