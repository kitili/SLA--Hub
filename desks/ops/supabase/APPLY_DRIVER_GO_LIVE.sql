-- Driver app go-live (remaining DB pieces)
-- Run in Supabase SQL Editor AFTER schema_auth / week2 / drivers are already live.
-- Safe to re-run.
--
-- Already applied in prod (do not block on these):
--   migrate_driver_profile_link.sql  → profiles.driver_id exists
--
-- Still required for street Path lines (ORS cache):

create table if not exists public.route_geometry_cache (
  coord_hash text primary key,
  geometry jsonb not null,
  stop_count smallint not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.route_geometry_cache enable row level security;

comment on table public.route_geometry_cache is
  'Cached OpenRouteService road geometry per stop-coordinate sequence, service-role access only';

notify pgrst, 'reload schema';
