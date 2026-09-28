-- Majundo Ops — Day 4–5 additive schema
-- Safe to run if schema_v1.sql was already applied earlier.
-- Adds: boarding duplicate guard + fee_sync_runs audit table.

create unique index if not exists idx_boarding_events_trip_student_type
  on public.boarding_events (trip_id, student_id, event_type);

create table if not exists public.fee_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'csv',
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  rows_upserted integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.fee_sync_runs enable row level security;

drop policy if exists "Admins read fee_sync_runs" on public.fee_sync_runs;
create policy "Admins read fee_sync_runs"
  on public.fee_sync_runs for select
  to authenticated
  using (public.is_admin() or public.current_user_role() = 'finance');
