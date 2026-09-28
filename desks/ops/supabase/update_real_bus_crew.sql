-- Real bus crew/owner corrections, cross-checked against the Transport Users sheet
-- and confirmed directly with Jfree (see team thread). All 5 buses found missing
-- crew data on the admin Buses page -- including T246 CGL (Boma), owner confirmed
-- as SLA directly by Jfree.
--
-- APPLIED LIVE 2026-08-01 (Jfree + Claude, via service-role key, verified with a
-- fresh read after write). Kept here as the record of what changed and why --
-- re-running is still safe/idempotent (updates by label + school_id, same
-- convention as update_real_bus_plates.sql) in case this needs to run again
-- against another environment (e.g. staging).

-- Owner-only gap -- driver + attendant already correct in the DB.
update public.buses set owner_name = 'Rental'
  where label = 'HIACE - Normal route' and school_id = 'a1000000-0000-4000-8000-000000000003'; -- T215 DAU, Kijenge

update public.buses set owner_name = 'Rental'
  where label = 'HIACE - Normal route' and school_id = 'a1000000-0000-4000-8000-000000000004'; -- T814 DVA, Ilboru

-- Backup-route rows -- these have their OWN distinct attendant/owner in the sheet,
-- not a copy of the paired primary-route bus.
update public.buses set attendant_name = 'Adeliqueen', owner_name = 'SLA'
  where label = 'Coasster CHE - Back up' and school_id = 'a1000000-0000-4000-8000-000000000004'; -- T199 CHE, Ilboru

update public.buses set attendant_name = 'Marriam', owner_name = 'SLA'
  where label = 'Hiaace DKS - Back up' and school_id = 'a1000000-0000-4000-8000-000000000003'; -- T348 DKS, Kijenge

update public.buses set owner_name = 'SLA'
  where label = 'HIACE' and school_id = 'a1000000-0000-4000-8000-000000000005'; -- T246 CGL, Boma

-- Plate for the same Boma bus -- confirmed directly by Jfree as "T246CGL", the
-- last of the 20 buses without a real plate (update_real_bus_plates.sql explicitly
-- left this one as "still pending"). Applied 2026-08-03.
update public.buses set plate_number = 'T246 CGL'
  where label = 'HIACE' and school_id = 'a1000000-0000-4000-8000-000000000005'; -- Boma
