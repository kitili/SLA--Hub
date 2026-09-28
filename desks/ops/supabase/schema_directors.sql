-- Majundo Ops — director role + incident escalation alerts
-- Safe to run if schema_auth.sql and schema_incidents.sql were already applied.
--
-- Adds:
--   1. 'director' as a new app_role value — read-only oversight, not a
--      full admin. This migration does NOT retrofit every existing RLS
--      policy across the app to grant directors read access everywhere;
--      it only covers profiles (read own), incidents, and incident_alerts.
--      Opening up the rest of the admin surface (dashboard KPIs, buses,
--      students, finance) to directors is a separate follow-up.
--   2. incident_alerts — a dashboard-queryable record raised whenever a
--      matron reports a high-severity incident, independent of the SMS
--      delivery log (message_logs), so a director's dashboard has a
--      first-class feed to query rather than parsing SMS logs.

alter type public.app_role add value if not exists 'director';

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

alter table public.incident_alerts enable row level security;

-- Read for transport leads (is_admin) and directors; admins acknowledge.
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

-- No insert policy for authenticated roles: rows are created server-side
-- via the service-role client when an incident is reported, not directly
-- by matrons/admins/directors through PostgREST.

-- Directors get the same read access to incidents that admin/finance
-- already have, so the incident log itself is visible to them too.
drop policy if exists "Staff read incidents" on public.incidents;
create policy "Staff read incidents"
  on public.incidents for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance', 'director')
  );
