-- Temporary parent location changes + route discovery/change log.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Temporary stop overrides (e.g. parent asks for a different pickup for 1 week)
-- ---------------------------------------------------------------------------
create table if not exists public.student_stop_temporary_overrides (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  original_stop_id uuid not null references public.stops (id) on delete cascade,
  override_lat double precision not null,
  override_lng double precision not null,
  override_name text,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint student_stop_temp_override_dates check (ends_on >= starts_on)
);

create index if not exists idx_stop_temp_overrides_route_dates
  on public.student_stop_temporary_overrides (route_id, starts_on, ends_on);

create index if not exists idx_stop_temp_overrides_student
  on public.student_stop_temporary_overrides (student_id);

alter table public.student_stop_temporary_overrides enable row level security;

drop policy if exists "Staff read stop temp overrides" on public.student_stop_temporary_overrides;
create policy "Staff read stop temp overrides"
  on public.student_stop_temporary_overrides for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('transport', 'matron', 'driver', 'finance')
  );

drop policy if exists "Admin manage stop temp overrides" on public.student_stop_temporary_overrides;
create policy "Admin manage stop temp overrides"
  on public.student_stop_temporary_overrides for all
  to authenticated
  using (public.is_admin() or public.current_user_role() = 'transport')
  with check (public.is_admin() or public.current_user_role() = 'transport');

-- ---------------------------------------------------------------------------
-- 2. Route change / discovery log
-- ---------------------------------------------------------------------------
create table if not exists public.route_change_logs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.routes (id) on delete set null,
  event_type text not null
    check (event_type in ('created', 'optimized', 'stops_edited', 'discovered', 'override')),
  summary text not null,
  before_stop_ids uuid[],
  after_stop_ids uuid[],
  distance_km_before numeric,
  distance_km_after numeric,
  meta jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_route_change_logs_created
  on public.route_change_logs (created_at desc);

create index if not exists idx_route_change_logs_route
  on public.route_change_logs (route_id, created_at desc);

alter table public.route_change_logs enable row level security;

drop policy if exists "Staff read route change logs" on public.route_change_logs;
create policy "Staff read route change logs"
  on public.route_change_logs for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('transport', 'finance', 'driver', 'matron')
  );

drop policy if exists "Staff insert route change logs" on public.route_change_logs;
create policy "Staff insert route change logs"
  on public.route_change_logs for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('transport', 'driver', 'matron')
  );

notify pgrst, 'reload schema';
