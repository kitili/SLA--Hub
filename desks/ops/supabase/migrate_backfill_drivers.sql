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
