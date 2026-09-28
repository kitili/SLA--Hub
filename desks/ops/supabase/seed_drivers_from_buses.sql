-- Jfree — one-time backfill: public.drivers from buses.driver_name
-- Run AFTER schema_drivers.sql (needs public.drivers, buses.driver_id).
--
-- Equivalent to scripts/apply-driver-migration.mjs --apply -- either one
-- works, this is a reference for anyone who'd rather run it directly in the
-- SQL Editor. Reads live driver_name values rather than a hardcoded list, so
-- it can't go stale.
--
-- Skips 'New Driver' (the DDA bus's placeholder, not a real person) and any
-- bus whose driver_id is already set (safe to re-run).

with distinct_drivers as (
  select distinct trim(driver_name) as name
  from public.buses
  where driver_name is not null
    and trim(driver_name) <> ''
    and lower(trim(driver_name)) <> 'new driver'
    and driver_id is null
),
new_drivers as (
  insert into public.drivers (name)
  select name from distinct_drivers
  returning id, name
)
update public.buses b
set driver_id = nd.id
from new_drivers nd
where trim(b.driver_name) = nd.name;
