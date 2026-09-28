-- Majundo soft-launch demo route — deliberately suboptimal stop order
-- so POST /api/routes/[id]/optimize shows a clear before/after win.
--
-- Run order (Supabase SQL Editor):
--   1. schema_week2.sql  (routes / stops tables)
--   2. seed_silverleaf.sql  (Usariver school id a100…001 must exist)
--   3. seed_routes.sql  (18 real AM fleet routes — e100… IDs; do not skip)
--   4. THIS FILE  (demo optimize win — e200… / f200… IDs; never overlaps real routes)
--
-- Safe to re-run. Does NOT reassign any fleet bus (seed_routes keeps DDA on Town - Sakina).
-- Optimize works without a linked bus (capacity gate allows 0 assigned / 0 seats).

-- Fixed demo route id (also referenced in admin UI / DEMO.md / majundoDemoRoute.ts)
-- e2000000-0000-4000-8000-000000000001 = Majundo Soft-Launch Demo AM

-- Detach any bus still pointing at the demo route (should be none after seed_routes)
update public.buses
set route_id = null
where route_id = 'e2000000-0000-4000-8000-000000000001';

delete from public.route_stops
where route_id = 'e2000000-0000-4000-8000-000000000001';

delete from public.student_stop_assignments
where route_id = 'e2000000-0000-4000-8000-000000000001'
   or stop_id in (
     'f2000000-0000-4000-8000-000000000001',
     'f2000000-0000-4000-8000-000000000002',
     'f2000000-0000-4000-8000-000000000003',
     'f2000000-0000-4000-8000-000000000004',
     'f2000000-0000-4000-8000-000000000005',
     'f2000000-0000-4000-8000-000000000006',
     'f2000000-0000-4000-8000-000000000007'
   );

delete from public.stops where id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000003',
  'f2000000-0000-4000-8000-000000000004',
  'f2000000-0000-4000-8000-000000000005',
  'f2000000-0000-4000-8000-000000000006',
  'f2000000-0000-4000-8000-000000000007'
);
delete from public.routes where id = 'e2000000-0000-4000-8000-000000000001';

insert into public.routes (id, school_id, name, direction, active)
values (
  'e2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001', -- Usariver Campus (seed_silverleaf)
  'Majundo Soft-Launch Demo AM',
  'am',
  true
)
on conflict (id) do update set
  school_id = excluded.school_id,
  name = excluded.name,
  direction = excluded.direction,
  active = true;

-- Stops around Usariver / Arusha corridor (school first, then zigzag pickups)
insert into public.stops (id, school_id, name, lat, lng, kind) values
  ('f2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'Usariver Campus (Demo depot)', -3.3725, 36.6942, 'school'),
  ('f2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'Ngaramtoni West Gate', -3.3500, 36.6550, 'pickup'),
  ('f2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   'Tengeru Far East', -3.3850, 36.8450, 'pickup'),
  ('f2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001',
   'Nkoaranga North', -3.3300, 36.7100, 'pickup'),
  ('f2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001',
   'USA River Town Centre', -3.3680, 36.8700, 'pickup'),
  ('f2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001',
   'Moshono Junction', -3.3600, 36.7300, 'pickup'),
  ('f2000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000001',
   'Kisongo Spur', -3.4000, 36.6800, 'pickup')
on conflict (id) do update set
  school_id = excluded.school_id,
  name = excluded.name,
  lat = excluded.lat,
  lng = excluded.lng,
  kind = excluded.kind;

-- Suboptimal order: school → far west → far east → north → farther east → mid → south
-- Optimize (NN + 2-opt) should collapse zigzags and cut km + ETA.
insert into public.route_stops (route_id, stop_id, stop_order, eta_offset_minutes) values
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 0, 0),
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002', 1, 22),
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000003', 2, 55),
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000004', 3, 72),
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000005', 4, 95),
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000006', 5, 110),
  ('e2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000007', 6, 125)
on conflict (route_id, stop_id) do update set
  stop_order = excluded.stop_order,
  eta_offset_minutes = excluded.eta_offset_minutes;
