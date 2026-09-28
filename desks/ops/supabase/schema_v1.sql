-- Majundo Ops — Day 2 transport schema
-- Run AFTER schema_auth.sql in Supabase SQL Editor.
-- Do NOT re-run schema_auth.sql — app_role already exists from Day 1.
-- Safe to re-run this file (enums/tables use idempotent creates).

-- ── Enums ────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.trip_direction as enum ('am', 'pm');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.trip_status as enum ('scheduled', 'active', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.boarding_event_type as enum ('in', 'out');
exception when duplicate_object then null;
end $$;

-- ── Schools (multi-school ready) ─────────────────────────────────────────────

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Optional: tie matron/staff to one school (admin sees all)
alter table public.profiles
  add column if not exists school_id uuid references public.schools (id) on delete set null;

create index if not exists idx_profiles_school_id on public.profiles (school_id);

-- ── Core tables ──────────────────────────────────────────────────────────────

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  class_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_school_id on public.students (school_id);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_parents (
  student_id uuid not null references public.students (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (student_id, parent_id)
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_codes_student_id on public.qr_codes (student_id);

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null,
  -- Vehicle plate when known; seed uses TBA when sheet only has BUS NO (not a plate)
  plate_number text not null,
  capacity integer not null default 40 check (capacity > 0),
  -- Fleet-sheet crew columns (not auth / app roles):
  -- driver_name = sheet DRIVER
  -- attendant_name = sheet "BUS ATTENDANT" (on-bus crew); NOT the app matron login role
  -- owner_name = fleet owner/operator from sheet (SLA, Karume, Rental, etc.)
  -- Matron login is trips.matron_id / profiles role — separate from attendant_name.
  driver_name text,
  attendant_name text,
  owner_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Idempotent for DBs that already created buses without crew columns
alter table public.buses add column if not exists driver_name text;
alter table public.buses add column if not exists attendant_name text;
alter table public.buses add column if not exists owner_name text;

create index if not exists idx_buses_school_id on public.buses (school_id);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  bus_id uuid not null references public.buses (id) on delete cascade,
  trip_date date not null default current_date,
  direction public.trip_direction not null,
  status public.trip_status not null default 'scheduled',
  matron_id uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bus_id, trip_date, direction)
);

create index if not exists idx_trips_bus_date on public.trips (bus_id, trip_date);

create table if not exists public.boarding_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  event_type public.boarding_event_type not null,
  scanned_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  scanned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_boarding_events_trip_id on public.boarding_events (trip_id);
create index if not exists idx_boarding_events_student_id on public.boarding_events (student_id);

-- One time-in and one time-out per student per trip (rejects duplicate scans)
create unique index if not exists idx_boarding_events_trip_student_type
  on public.boarding_events (trip_id, student_id, event_type);

create table if not exists public.fee_balances (
  student_id uuid primary key references public.students (id) on delete cascade,
  balance numeric(12, 2) not null default 0,
  currency text not null default 'TZS',
  synced_at timestamptz not null default now()
);

-- Day 5: fee CSV / EdAdmin sync audit log
create table if not exists public.fee_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'csv',
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  rows_upserted integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Day 6: parent SMS / WhatsApp audit
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete set null,
  parent_phone text not null,
  channel text not null default 'sms'
    check (channel in ('sms', 'whatsapp', 'stub')),
  provider text not null default 'stub',
  template_key text,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  boarding_event_id uuid references public.boarding_events (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_message_logs_created_at
  on public.message_logs (created_at desc);

create index if not exists idx_message_logs_student_id
  on public.message_logs (student_id);

-- ── RLS helpers ──────────────────────────────────────────────────────────────

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

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

create or replace function public.user_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- ── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.schools enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parents enable row level security;
alter table public.qr_codes enable row level security;
alter table public.buses enable row level security;
alter table public.trips enable row level security;
alter table public.boarding_events enable row level security;
alter table public.fee_balances enable row level security;
alter table public.fee_sync_runs enable row level security;
alter table public.message_logs enable row level security;

-- ── Policies: schools ────────────────────────────────────────────────────────

drop policy if exists "Authenticated users can read schools" on public.schools;
create policy "Authenticated users can read schools"
  on public.schools for select
  to authenticated
  using (true);

drop policy if exists "Admins manage schools" on public.schools;
create policy "Admins manage schools"
  on public.schools for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Policies: students ───────────────────────────────────────────────────────

drop policy if exists "Staff read students in scope" on public.students;
create policy "Staff read students in scope"
  on public.students for select
  to authenticated
  using (
    public.is_admin()
    or school_id = public.user_school_id()
    or public.user_school_id() is null
  );

drop policy if exists "Admins manage students" on public.students;
create policy "Admins manage students"
  on public.students for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Policies: parents & links ──────────────────────────────────────────────────

drop policy if exists "Staff read parents" on public.parents;
create policy "Staff read parents"
  on public.parents for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.student_parents sp
      join public.students s on s.id = sp.student_id
      where sp.parent_id = parents.id
        and (public.user_school_id() is null or s.school_id = public.user_school_id())
    )
  );

drop policy if exists "Admins manage parents" on public.parents;
create policy "Admins manage parents"
  on public.parents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read student_parents" on public.student_parents;
create policy "Staff read student_parents"
  on public.student_parents for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and (public.user_school_id() is null or s.school_id = public.user_school_id())
    )
  );

drop policy if exists "Admins manage student_parents" on public.student_parents;
create policy "Admins manage student_parents"
  on public.student_parents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Policies: qr_codes ─────────────────────────────────────────────────────────

drop policy if exists "Staff read qr_codes" on public.qr_codes;
create policy "Staff read qr_codes"
  on public.qr_codes for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = qr_codes.student_id
        and (public.user_school_id() is null or s.school_id = public.user_school_id())
    )
  );

drop policy if exists "Admins manage qr_codes" on public.qr_codes;
create policy "Admins manage qr_codes"
  on public.qr_codes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Policies: buses ────────────────────────────────────────────────────────────

drop policy if exists "Staff read buses in scope" on public.buses;
create policy "Staff read buses in scope"
  on public.buses for select
  to authenticated
  using (
    public.is_admin()
    or school_id = public.user_school_id()
    or public.user_school_id() is null
  );

drop policy if exists "Admins manage buses" on public.buses;
create policy "Admins manage buses"
  on public.buses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Policies: trips ────────────────────────────────────────────────────────────

drop policy if exists "Staff read trips" on public.trips;
create policy "Staff read trips"
  on public.trips for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.buses b
      where b.id = trips.bus_id
        and (public.user_school_id() is null or b.school_id = public.user_school_id())
    )
  );

drop policy if exists "Staff create trips" on public.trips;
create policy "Staff create trips"
  on public.trips for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff update trips" on public.trips;
create policy "Staff update trips"
  on public.trips for update
  to authenticated
  using (
    public.is_admin()
    or matron_id = auth.uid()
    or public.current_user_role() in ('matron', 'driver')
  );

-- ── Policies: boarding_events ──────────────────────────────────────────────────

drop policy if exists "Staff read boarding_events" on public.boarding_events;
create policy "Staff read boarding_events"
  on public.boarding_events for select
  to authenticated
  using (true);

drop policy if exists "Staff insert boarding_events" on public.boarding_events;
create policy "Staff insert boarding_events"
  on public.boarding_events for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'matron', 'driver')
  );

-- ── Policies: fee_balances ───────────────────────────────────────────────────

drop policy if exists "Staff read fee_balances" on public.fee_balances;
create policy "Staff read fee_balances"
  on public.fee_balances for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'finance')
    or exists (
      select 1 from public.students s
      where s.id = fee_balances.student_id
        and (public.user_school_id() is null or s.school_id = public.user_school_id())
    )
  );

drop policy if exists "Admins and finance manage fee_balances" on public.fee_balances;
create policy "Admins and finance manage fee_balances"
  on public.fee_balances for all
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() = 'finance'
  )
  with check (
    public.is_admin()
    or public.current_user_role() = 'finance'
  );

-- ── Policies: fee_sync_runs ──────────────────────────────────────────────────

drop policy if exists "Admins read fee_sync_runs" on public.fee_sync_runs;
create policy "Admins read fee_sync_runs"
  on public.fee_sync_runs for select
  to authenticated
  using (public.is_admin() or public.current_user_role() = 'finance');

-- Inserts/updates go through service role (cron); no authenticated write policy.

-- ── Policies: message_logs ───────────────────────────────────────────────────

drop policy if exists "Staff read message_logs" on public.message_logs;
create policy "Staff read message_logs"
  on public.message_logs for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff insert message_logs" on public.message_logs;
create policy "Staff insert message_logs"
  on public.message_logs for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff update message_logs" on public.message_logs;
create policy "Staff update message_logs"
  on public.message_logs for update
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

-- ── Updated_at trigger ─────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ── Registered vs. max capacity (2026-08-17, from the Transport Master sheet
-- admin review) ───────────────────────────────────────────────────────────────
-- The sheet tracks "REG CARD CAPACITY" (the legal/registered seat count) as a
-- separate, usually-lower number from "BUS MAX CAPACITY" -- real buses have
-- run over both. `capacity` keeps its existing meaning unchanged (max
-- capacity, used by the occupancy KPI and every existing form) -- this is a
-- new, optional field, null = not yet recorded, not a fabricated default.
alter table public.buses
  add column if not exists registered_capacity integer;

-- ============================================================================
-- RLS fix (2026-08-19, pending -- not yet applied live) -- public.buses is
-- already live, and its "Admins manage buses" (write) policy above has
-- always been admin-only, no role list at all -- but /api/buses's POST
-- (and the bus create/edit forms it backs) has always gated on
-- requireUser(["admin", "transport"]). 'transport' is a real role
-- (Baraka + Shikunzi, per src/lib/roles.ts) whose whole job is fleet
-- management, so this has likely been silently blocking their bus
-- create/edit attempts this whole time. Read is unaffected -- "Staff read
-- buses in scope" above already has no role restriction. Appended as a new
-- block, not edited in place, since that policy is already shipped and Kai
-- could mistake an in-place edit for something already run.
-- ============================================================================

drop policy if exists "Admins manage buses" on public.buses;
create policy "Admins manage buses"
  on public.buses for all
  to authenticated
  using (public.is_admin() or public.current_user_role() = 'transport')
  with check (public.is_admin() or public.current_user_role() = 'transport');

-- ============================================================================
-- boarding_events.voided_at / voided_by (2026-09-23, pending -- not yet
-- applied live) -- lets a matron undo a mis-scan (wrong student, scanned by
-- accident) without hard-deleting the row, so trip history stays auditable
-- ("she scanned X by mistake, then voided it" is visible, not silently
-- erased). The existing unique index blocked a fresh re-scan of the same
-- (trip, student, event_type) once a row existed at all, voided or not --
-- replaced with a partial index so only *live* (non-voided) rows count
-- toward the one-scan-per-trip rule. boarding_events also had no update
-- policy at all (only select + insert) -- voiding needs one, or the update
-- silently affects zero rows. Code isolates this with a self-activating
-- retry (see voidBoardingEvent()/recordBoarding()/countAboard() etc. in
-- src/lib/db/queries.ts) so a pending column here can't affect anything
-- already shipped.
-- ============================================================================

alter table public.boarding_events
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null;

drop index if exists idx_boarding_events_trip_student_type;
create unique index if not exists idx_boarding_events_trip_student_type
  on public.boarding_events (trip_id, student_id, event_type)
  where voided_at is null;

drop policy if exists "Staff void boarding_events" on public.boarding_events;
create policy "Staff void boarding_events"
  on public.boarding_events for update
  to authenticated
  using (public.current_user_role() in ('admin', 'matron', 'driver'))
  with check (public.current_user_role() in ('admin', 'matron', 'driver'));

-- ============================================================================
-- trips.driver_id (2026-09-23, pending -- not yet applied live) -- who was
-- actually driving this specific trip, snapshotted at trip-creation time
-- from buses.driver_id (the current assignment, already live). trips.
-- matron_id already works this way for the matron; driver was never
-- captured per-trip at all, only as buses' current (mutable) assignment --
-- so a bus's driver history was unrecoverable once reassigned. Nullable and
-- non-FK-cascading on driver delete (set null, not block) since a trip
-- record should outlive the driver row referencing it. Code already
-- handles this column missing via a self-activating retry, isolated from
-- the rest of trip creation/lookup so a pending migration here can't affect
-- anything else -- see src/lib/db/queries.ts's createTrip()/
-- getTripDriverName().
-- ============================================================================

alter table public.trips
  add column if not exists driver_id uuid references public.drivers (id) on delete set null;
