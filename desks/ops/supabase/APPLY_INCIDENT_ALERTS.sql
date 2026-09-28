-- STEP 2 of 2 — incident escalation alerts + transport read access
-- Run AFTER APPLY_INCIDENT_ALERTS_01_enum.sql succeeds (separate paste/run).
-- Requires: public.incidents already exists (schema_incidents.sql).
-- Safe to re-run.

create table if not exists public.incident_alerts (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  severity text not null,
  type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles (id) on delete set null
);

create index if not exists idx_incident_alerts_created_at
  on public.incident_alerts (created_at desc);
create index if not exists idx_incident_alerts_incident_id
  on public.incident_alerts (incident_id);
create index if not exists idx_incident_alerts_unacked
  on public.incident_alerts (acknowledged_at nulls first, created_at desc);

alter table public.incident_alerts enable row level security;

-- Transport leads (is_admin()) + directors can read the escalation feed.
drop policy if exists "Admin and director read incident_alerts" on public.incident_alerts;
drop policy if exists "Staff read incident_alerts" on public.incident_alerts;
create policy "Staff read incident_alerts"
  on public.incident_alerts for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() = 'director'
  );

drop policy if exists "Admin update incident_alerts" on public.incident_alerts;
create policy "Admin update incident_alerts"
  on public.incident_alerts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Directors + transport/admin/finance can read incidents log.
drop policy if exists "Staff read incidents" on public.incidents;
create policy "Staff read incidents"
  on public.incidents for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance', 'director')
  );

notify pgrst, 'reload schema';
