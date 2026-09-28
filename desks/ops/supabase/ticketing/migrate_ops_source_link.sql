-- Link Ticket Desk requests back to Ops domain records (optional soft FK).
-- Safe to re-run. Apply in Supabase SQL Editor, then: notify pgrst, 'reload schema';

alter table public.requests
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_url text;

comment on column public.requests.source_type is
  'Originating Ops domain record type, e.g. facilities_issue, farm_alert, incident, maintenance_record';
comment on column public.requests.source_id is
  'UUID/id of the originating domain row';
comment on column public.requests.source_url is
  'Deep link back into the Ops app for the source record';

create index if not exists idx_requests_source
  on public.requests (source_type, source_id)
  where source_type is not null;

notify pgrst, 'reload schema';
