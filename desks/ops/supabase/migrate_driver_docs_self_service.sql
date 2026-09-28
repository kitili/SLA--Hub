-- Driver documents self-service + TZ compliance pack
-- Safe to re-run. Run in Supabase SQL Editor, then:
--   notify pgrst, 'reload schema';
--
-- Adds CV / licence scan / PSV badge / medical cert / vehicle service dates,
-- lets linked drivers manage their own row + storage folder, allows PDF uploads.

-- ---------------------------------------------------------------------------
-- 1. Extra columns on drivers
-- ---------------------------------------------------------------------------
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
  add column if not exists passport_photo_url text,
  add column if not exists cv_url text,
  add column if not exists license_photo_url text,
  add column if not exists psv_badge_photo_url text,
  add column if not exists medical_cert_photo_url text,
  add column if not exists last_service_date date,
  add column if not exists next_service_due date;

alter table public.buses
  add column if not exists driver_id uuid references public.drivers (id) on delete set null,
  add column if not exists insurance_expiry date;

-- ---------------------------------------------------------------------------
-- 2. Alert dedupe log (renewal SMS ~7 days before)
-- ---------------------------------------------------------------------------
create table if not exists public.driver_compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  alert_key text not null,
  channel text not null default 'sms',
  sent_at timestamptz not null default now(),
  unique (driver_id, alert_key, channel)
);

create index if not exists idx_driver_compliance_alerts_sent
  on public.driver_compliance_alerts (sent_at desc);

alter table public.driver_compliance_alerts enable row level security;

drop policy if exists "Admins read driver compliance alerts" on public.driver_compliance_alerts;
create policy "Admins read driver compliance alerts"
  on public.driver_compliance_alerts for select
  using (public.is_admin());

-- Writes go through service role (cron); no insert policy for browser sessions.

-- ---------------------------------------------------------------------------
-- 3. RLS: admins full access; linked drivers read/update own row
-- ---------------------------------------------------------------------------
alter table public.drivers enable row level security;

drop policy if exists "Admins manage drivers" on public.drivers;
drop policy if exists "Drivers read own record" on public.drivers;
drop policy if exists "Drivers update own record" on public.drivers;

create policy "Admins manage drivers"
  on public.drivers for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Drivers read own record"
  on public.drivers for select
  using (
    id = (
      select p.driver_id from public.profiles p where p.id = auth.uid()
    )
  );

create policy "Drivers update own record"
  on public.drivers for update
  using (
    id = (
      select p.driver_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    id = (
      select p.driver_id from public.profiles p where p.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Storage bucket: images + PDF, 8MB; admin + own-folder driver access
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-documents',
  'driver-documents',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins manage driver documents" on storage.objects;
drop policy if exists "Drivers manage own documents" on storage.objects;

create policy "Admins manage driver documents"
  on storage.objects for all
  using (bucket_id = 'driver-documents' and public.is_admin())
  with check (bucket_id = 'driver-documents' and public.is_admin());

-- Path convention: {driver_uuid}/slot.ext — first folder must match profiles.driver_id
create policy "Drivers manage own documents"
  on storage.objects for all
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = (
      select p.driver_id::text from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = (
      select p.driver_id::text from public.profiles p where p.id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
