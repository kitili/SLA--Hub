-- Tag boarding scans with the nearest route stop (when GPS is available).
-- Safe to re-run.

alter table public.boarding_events
  add column if not exists stop_id uuid references public.stops (id) on delete set null;

create index if not exists idx_boarding_events_stop
  on public.boarding_events (trip_id, stop_id)
  where stop_id is not null;

notify pgrst, 'reload schema';
