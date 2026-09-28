-- Majundo Ops — APPLY ONCE: drivers + guardian QR + proximity + matron parent contacts
-- Paste entire file into Supabase SQL Editor → Run
-- Safe to re-run. Requires schema_v1 + schema_week2 + schema_auth already applied.
-- Drivers table shape matches Jfree phase 1 (column: name).
-- After this: optionally run seed_per_bus_finance.sql

-- ========== 1. Drivers (Schema_directors / schema_drivers) ==========
-- Jfree — Driver compliance, phase 1 (license + insurance expiry alerts)
-- Run AFTER schema_v1.sql (needs public.buses, public.is_admin()).
-- After run: reload PostgREST schema cache (Settings -> API -> Reload schema,
-- or: notify pgrst, 'reload schema';).
--
-- Phase 2 (deferred, not built here) will add columns to this same table --
-- photo_url, national_id_number, national_id_photo_url, passport_number,
-- passport_photo_url, next_of_kin_name/phone/relationship -- once Supabase
-- Storage + a stricter access review are in place. Nothing here needs to
-- change shape to support that later.

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_number text,
  license_expiry date,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drivers_active on public.drivers (active);

-- One driver per bus at a time; deleting a driver unlinks the bus, doesn't
-- touch the bus row itself. No school_id -- admin already sees the whole
-- fleet, and nothing in phase 1 needs a driver scoped to one campus.
alter table public.buses
  add column if not exists driver_id uuid references public.drivers (id) on delete set null;
alter table public.buses
  add column if not exists insurance_expiry date;

create index if not exists idx_buses_driver_id on public.buses (driver_id);

alter table public.drivers enable row level security;

-- Admin-only, both read and write -- deliberately narrower than buses' own
-- "Staff read buses in scope" policy. License number + phone is more
-- sensitive than a bus label/plate, and there's no current use case for
-- matron/driver roles to see it.
drop policy if exists "Admins manage drivers" on public.drivers;
create policy "Admins manage drivers"
  on public.drivers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ========== 2. Backfill drivers + demo expiry dates ==========
-- Backfill drivers from buses.driver_name + demo compliance dates
-- Run AFTER schema_drivers.sql (Jfree phase 1 — column is `name`, not full_name).
-- Prefer this OR seed_drivers_from_buses.sql / apply-driver-migration.mjs — all are safe to re-run.
-- This variant also staggers license_expiry + insurance_expiry for compliance UI demos.

-- 1) Insert one driver row per distinct trimmed driver_name
insert into public.drivers (name, active)
select distinct
  trim(b.driver_name),
  true
from public.buses b
where b.driver_name is not null
  and trim(b.driver_name) <> ''
  and lower(trim(b.driver_name)) not in ('tba', 'n/a', 'na', '-', 'new driver')
  and not exists (
    select 1
    from public.drivers d
    where lower(trim(d.name)) = lower(trim(b.driver_name))
  );

-- 2) Link buses → drivers
update public.buses b
set driver_id = d.id
from public.drivers d
where b.driver_id is null
  and b.driver_name is not null
  and trim(b.driver_name) <> ''
  and lower(trim(d.name)) = lower(trim(b.driver_name));

-- 3) Stagger demo insurance + license expiries so compliance UI has signal
update public.buses b
set insurance_expiry = case (abs(hashtext(b.id::text)) % 10)
  when 0 then current_date - 14
  when 1 then current_date - 3
  when 2 then current_date + 7
  when 3 then current_date + 21
  when 4 then current_date + 45
  else current_date + 120 + (abs(hashtext(b.id::text)) % 180)
end
where b.insurance_expiry is null;

update public.drivers d
set
  license_number = coalesce(
    d.license_number,
    'TZ-DL-' || upper(substr(replace(d.id::text, '-', ''), 1, 8))
  ),
  license_expiry = coalesce(
    d.license_expiry,
    case (abs(hashtext(d.id::text)) % 10)
      when 0 then current_date - 10
      when 1 then current_date + 5
      when 2 then current_date + 25
      else current_date + 90 + (abs(hashtext(d.id::text)) % 200)
    end
  ),
  updated_at = now();

-- ========== 3. Guardian QR (Schema_gurdian_qr / schema_guardian_qr) ==========
-- Majundo Ops — Guardian / parent pickup QR codes
-- Run AFTER schema_v1.sql (parents, students, student_parents, qr_codes)
-- Safe to re-run.
--
-- Students already have qr_codes. Guardians need their own scannable code so
-- matrons can verify the adult collecting a child (pickup / handover).

create table if not exists public.guardian_qr_codes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents (id) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_guardian_qr_parent on public.guardian_qr_codes (parent_id);
create index if not exists idx_guardian_qr_active on public.guardian_qr_codes (active)
  where active = true;

-- Optional scan audit when a guardian QR is checked on a trip
create table if not exists public.guardian_scan_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  parent_id uuid references public.parents (id) on delete set null,
  guardian_qr_id uuid references public.guardian_qr_codes (id) on delete set null,
  event_type text not null default 'pickup_verify'
    check (event_type in ('pickup_verify', 'handover', 'denied', 'other')),
  matched boolean not null default true,
  lat double precision,
  lng double precision,
  scanned_by uuid references public.profiles (id) on delete set null,
  notes text,
  scanned_at timestamptz not null default now()
);

create index if not exists idx_guardian_scans_trip on public.guardian_scan_events (trip_id);
create index if not exists idx_guardian_scans_student on public.guardian_scan_events (student_id);
create index if not exists idx_guardian_scans_at on public.guardian_scan_events (scanned_at desc);

alter table public.guardian_qr_codes enable row level security;
alter table public.guardian_scan_events enable row level security;

drop policy if exists "Staff read guardian_qr" on public.guardian_qr_codes;
create policy "Staff read guardian_qr"
  on public.guardian_qr_codes for select
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff write guardian_qr" on public.guardian_qr_codes;
create policy "Staff write guardian_qr"
  on public.guardian_qr_codes for all
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  )
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff read guardian_scans" on public.guardian_scan_events;
create policy "Staff read guardian_scans"
  on public.guardian_scan_events for select
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff insert guardian_scans" on public.guardian_scan_events;
create policy "Staff insert guardian_scans"
  on public.guardian_scan_events for insert
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

comment on table public.guardian_qr_codes is
  'Pickup QR for parents/guardians — separate from student qr_codes';

-- ========== 4. Proximity alerts ==========
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

-- ========== 5. Matron parent contacts ==========
-- Majundo Ops — matron parent-contact editing
-- Safe to run if schema_v1.sql was already applied earlier.
--
-- Matrons could only READ parents/student_parents ("Staff read parents" /
-- "Staff read student_parents" in schema_v1.sql); only admins could write
-- ("Admins manage parents" / "Admins manage student_parents"). The matron
-- app now lets a matron add or fix a parent's contact info for students on
-- her own bus when it's missing or wrong — that's an app-level business
-- rule (see saveParentContact / getStudentsForSession in the Next.js app),
-- not something expressed here. RLS just grants matron/driver insert+update
-- on these two tables — no delete, mirroring the read-only-elsewhere,
-- write-narrowly pattern already used for boarding_events/message_logs.

drop policy if exists "Staff insert parents" on public.parents;
create policy "Staff insert parents"
  on public.parents for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff update parents" on public.parents;
create policy "Staff update parents"
  on public.parents for update
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  )
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff insert student_parents" on public.student_parents;
create policy "Staff insert student_parents"
  on public.student_parents for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

notify pgrst, 'reload schema';

-- Verify:
-- select to_regclass('public.drivers'), to_regclass('public.guardian_qr_codes'), to_regclass('public.proximity_alerts');
-- select count(*) drivers from drivers; select count(*) linked from buses where driver_id is not null;
