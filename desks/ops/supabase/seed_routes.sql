-- Real Silverleaf AM routes from data/import/buses.json (18 unique names).
-- Run AFTER schema_week2.sql + seed_silverleaf.sql (school/bus IDs must exist).
-- No GPS stop pins yet — stop pins come later from clustering trip_locations (radar).

-- Clear prior fabricated "Usariver AM Loop" sample (safe re-run)
delete from public.route_stops where route_id = 'e1000000-0000-4000-8000-000000000001';
delete from public.student_stop_assignments where route_id = 'e1000000-0000-4000-8000-000000000001';
delete from public.stops where id in (
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000004',
  'f1000000-0000-4000-8000-000000000005'
);

-- ── Routes (one row per unique route name; direction = am) ───────────────────
-- Usariver (11)
insert into public.routes (id, school_id, name, direction, active) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Kiwawa', 'am', true),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'East Africa - Moshono', 'am', true),
  ('e1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Ngongongare', 'am', true),
  ('e1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Nshupu via Usariver', 'am', true),
  ('e1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Town - Sakina', 'am', true),
  ('e1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001', 'Kikatiti', 'am', true),
  ('e1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000001', 'Tengeru', 'am', true),
  ('e1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000001', 'Sabato- Bango latigo', 'am', true),
  ('e1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000001', 'Kambini', 'am', true),
  ('e1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000001', 'Maji ya chai Tuvaila', 'am', true),
  ('e1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000001', 'Nkoaranga', 'am', true),
-- Arusha Modern (4)
  ('e1000000-0000-4000-8000-00000000000c', 'a1000000-0000-4000-8000-000000000002', 'Sakina', 'am', true),
  ('e1000000-0000-4000-8000-00000000000d', 'a1000000-0000-4000-8000-000000000002', 'Morombo', 'am', true),
  ('e1000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-000000000002', 'Njiro', 'am', true),
  ('e1000000-0000-4000-8000-00000000000f', 'a1000000-0000-4000-8000-000000000002', 'Ngaramtoni', 'am', true),
-- Kijenge (1, shared by normal + backup)
  ('e1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000003', 'Kijenge', 'am', true),
-- Ilboru (1, shared by normal + backup)
  ('e1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000004', 'Iliboru', 'am', true),
-- Boma (1)
  ('e1000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000005', 'Sadala', 'am', true)
on conflict (id) do update set
  school_id = excluded.school_id,
  name = excluded.name,
  direction = excluded.direction,
  active = true;

-- ── Link all 20 buses to their route (seed_silverleaf bus ids) ───────────────
-- Usariver
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000001' where id = 'c1000000-0000-4000-8000-000000000001'; -- T 910 APW → Kiwawa
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000002' where id = 'c1000000-0000-4000-8000-000000000002'; -- CPP → East Africa - Moshono
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000003' where id = 'c1000000-0000-4000-8000-000000000003'; -- Coaster BAE - Young boys → Ngongongare
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000004' where id = 'c1000000-0000-4000-8000-000000000004'; -- T 326 EBP → Nshupu via Usariver
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000005' where id = 'c1000000-0000-4000-8000-000000000005'; -- DDA → Town - Sakina
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000006' where id = 'c1000000-0000-4000-8000-000000000006'; -- T 108 DYW → Kikatiti
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000007' where id = 'c1000000-0000-4000-8000-000000000007'; -- Rental Hiace → Tengeru
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000008' where id = 'c1000000-0000-4000-8000-000000000008'; -- BAE → Sabato- Bango latigo
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000009' where id = 'c1000000-0000-4000-8000-000000000009'; -- BHM → Kambini
update public.buses set route_id = 'e1000000-0000-4000-8000-00000000000a' where id = 'c1000000-0000-4000-8000-000000000010'; -- DSD → Maji ya chai Tuvaila
update public.buses set route_id = 'e1000000-0000-4000-8000-00000000000b' where id = 'c1000000-0000-4000-8000-000000000011'; -- Rental Coaster BUF) - Nkoaranga → Nkoaranga
-- Arusha Modern
update public.buses set route_id = 'e1000000-0000-4000-8000-00000000000c' where id = 'c1000000-0000-4000-8000-000000000012'; -- Coaster  CHE → Sakina
update public.buses set route_id = 'e1000000-0000-4000-8000-00000000000d' where id = 'c1000000-0000-4000-8000-000000000013'; -- Hiace EBM → Morombo
update public.buses set route_id = 'e1000000-0000-4000-8000-00000000000e' where id = 'c1000000-0000-4000-8000-000000000014'; -- Hiace DKS → Njiro
update public.buses set route_id = 'e1000000-0000-4000-8000-00000000000f' where id = 'c1000000-0000-4000-8000-000000000015'; -- Rental Hiace → Ngaramtoni
-- Kijenge (shared route)
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000010' where id = 'c1000000-0000-4000-8000-000000000016'; -- HIACE - Normal route → Kijenge
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000010' where id = 'c1000000-0000-4000-8000-000000000017'; -- Hiaace DKS - Back up → Kijenge
-- Ilboru (shared route)
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000011' where id = 'c1000000-0000-4000-8000-000000000018'; -- HIACE - Normal route → Iliboru
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000011' where id = 'c1000000-0000-4000-8000-000000000019'; -- Coasster CHE - Back up → Iliboru
-- Boma
update public.buses set route_id = 'e1000000-0000-4000-8000-000000000012' where id = 'c1000000-0000-4000-8000-000000000020'; -- HIACE → Sadala
