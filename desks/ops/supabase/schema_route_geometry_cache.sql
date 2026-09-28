-- Majundo Ops — Road-geometry cache (OpenRouteService)
-- Run AFTER schema_v1.sql. Safe to re-run.
--
-- Caches road-following polyline geometry per ordered stop-coordinate
-- sequence, keyed by a hash of the (rounded) coordinates -- so identical
-- stop sequences across different routes share one row, and repeat views of
-- the same route never re-hit OpenRouteService's free-tier daily quota.
-- Written and read exclusively via the service-role client inside
-- src/app/api/routes/geometry/route.ts (server-only, never queried by a
-- browser-session-bound client) -- deliberately no RLS policies below.

create table if not exists public.route_geometry_cache (
  coord_hash text primary key,
  geometry jsonb not null,
  stop_count smallint not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.route_geometry_cache enable row level security;

-- No policies: default-deny. Only the service-role client (which bypasses
-- RLS entirely) ever touches this table -- no browser session should be
-- able to read or write it, so there's nothing to write a policy for.

comment on table public.route_geometry_cache is
  'Cached OpenRouteService road geometry per stop-coordinate sequence, service-role access only';
