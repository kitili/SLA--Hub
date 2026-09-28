-- Alias: Schema_gurdian_qr.sql (typo spelling) → same as schema_guardian_qr.sql

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
