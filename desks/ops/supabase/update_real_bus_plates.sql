-- Real bus plate numbers, cross-checked against the sheets and confirmed directly
-- with the team (see team thread for the full back-and-forth). 19 of 20 buses --
-- Boma's HIACE (Sadala route) is still pending, not included here.
--
-- PROPOSAL ONLY -- not auto-run. Safe to re-run (idempotent updates by label +
-- school_id, since two labels ("Rental Hiace") are reused across campuses).
--
-- Two pairs below share a plate intentionally -- confirmed these are the SAME
-- physical vehicle covering two routes/campuses, not a data error:
--   - Coaster BAE - Young boys (Ngongongare) and BAE (Sabato- Bango latigo): T585 BAE
--   - Hiace DKS (Njiro/AM) and Hiaace DKS - Back up (Kijenge): T348 DKS
--   - Coaster CHE (Sakina/AM) and Coasster CHE - Back up (Ilboru): T199 CHE
--
-- "Rental Hiace" / Tengeru (Usariver) replaces a retired bus ("Hiace DEP") --
-- T452 DWX is the new vehicle's plate, not related to DEP's own repair history.

update public.buses set plate_number = 'T226 CPP'
  where label = 'CPP' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T585 BAE'
  where label = 'Coaster BAE - Young boys' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T483 DDA'
  where label = 'DDA' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T452 DWX'
  where label = 'Rental Hiace' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T585 BAE'
  where label = 'BAE' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T236 BHM'
  where label = 'BHM' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T177 DSD'
  where label = 'DSD' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T954 BUF'
  where label = 'Rental Coaster BUF) - Nkoaranga' and school_id = 'a1000000-0000-4000-8000-000000000001';

update public.buses set plate_number = 'T199 CHE'
  where label = 'Coaster  CHE' and school_id = 'a1000000-0000-4000-8000-000000000002';

update public.buses set plate_number = 'T418 EBM'
  where label = 'Hiace EBM' and school_id = 'a1000000-0000-4000-8000-000000000002';

update public.buses set plate_number = 'T348 DKS'
  where label = 'Hiace DKS' and school_id = 'a1000000-0000-4000-8000-000000000002';

update public.buses set plate_number = 'T400 BMC'
  where label = 'Rental Hiace' and school_id = 'a1000000-0000-4000-8000-000000000002';

update public.buses set plate_number = 'T215 DAU'
  where label = 'HIACE - Normal route' and school_id = 'a1000000-0000-4000-8000-000000000003';

update public.buses set plate_number = 'T348 DKS'
  where label = 'Hiaace DKS - Back up' and school_id = 'a1000000-0000-4000-8000-000000000003';

update public.buses set plate_number = 'T814 DVA'
  where label = 'HIACE - Normal route' and school_id = 'a1000000-0000-4000-8000-000000000004';

update public.buses set plate_number = 'T199 CHE'
  where label = 'Coasster CHE - Back up' and school_id = 'a1000000-0000-4000-8000-000000000004';

-- Already-real plates (T 910 APW / T 326 EBP / T 108 DYW) untouched -- no change needed.
