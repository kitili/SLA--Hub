-- Jfree — Driver compliance
-- Run AFTER schema_v1.sql (needs public.buses, public.is_admin()).
-- After run: reload PostgREST schema cache (Settings -> API -> Reload schema,
-- or: notify pgrst, 'reload schema';).
--
-- Kept as one file, edited in place as the driver record grows, rather than
-- spawning a new schema_drivers_phaseN.sql per addition -- every alter here
-- is `add column if not exists`, so re-running the whole file after an edit
-- is always safe regardless of what's already live.
--
-- Next-of-kin (name/phone/relationship) and PSV permit/health/training
-- fields (psv_permit_number/expiry, first_aid_cert_expiry,
-- personal_insurance_expiry, medical_exam_date, medical_cert_expiry,
-- license_class, police_clearance_date, child_safety_training_date,
-- defensive_driving_training_date) came from a real driver interview.
-- medical_cert_expiry is deliberately separate from medical_exam_date: it
-- only matters for compliance alerting if an admin explicitly sets it, since
-- there's no fixed known regulatory renewal interval to derive it from.
--
-- Photo/national ID/passport document fields (photo_url, national_id_number,
-- national_id_photo_url, passport_number, passport_photo_url) are this app's
-- first Supabase Storage feature -- private bucket, admin-only RLS on
-- storage.objects mirroring the table's own policy below, and no server
-- route ever touches the file bytes (browser uploads directly to Storage
-- under the admin's own session; only the resulting object path is ever
-- PATCHed through the normal drivers API). The *_url columns store object
-- paths, not URLs -- signed URLs are resolved server-side per view, never
-- stored, matching this file's existing naming convention.

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

alter table public.drivers
  add column if not exists next_of_kin_name text,
  add column if not exists next_of_kin_phone text,
  add column if not exists next_of_kin_relationship text,
  add column if not exists psv_permit_number text,
  add column if not exists psv_permit_expiry date,
  add column if not exists first_aid_cert_expiry date,
  add column if not exists personal_insurance_expiry date,
  add column if not exists medical_exam_date date,
  add column if not exists medical_cert_expiry date,
  add column if not exists license_class text,
  add column if not exists police_clearance_date date,
  add column if not exists child_safety_training_date date,
  add column if not exists defensive_driving_training_date date,
  add column if not exists photo_url text,
  add column if not exists national_id_number text,
  add column if not exists national_id_photo_url text,
  add column if not exists passport_number text,
  add column if not exists passport_photo_url text;

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

-- Driver documents (photo, national ID, passport scans) -- private bucket,
-- admin-only, mirroring the drivers table's own policy above. Path
-- convention: {driver_id}/photo.<ext>, {driver_id}/national-id.<ext>,
-- {driver_id}/passport.<ext>. file_size_limit/allowed_mime_types here are
-- the ONLY real enforcement of file type/size -- there's no server route in
-- the upload path to double-check them, since the browser uploads directly
-- to Storage under the admin's own session.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-documents',
  'driver-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Admins manage driver documents" on storage.objects;
create policy "Admins manage driver documents"
  on storage.objects for all
  using (bucket_id = 'driver-documents' and public.is_admin())
  with check (bucket_id = 'driver-documents' and public.is_admin());
