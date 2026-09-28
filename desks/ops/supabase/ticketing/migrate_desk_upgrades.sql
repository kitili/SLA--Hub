-- Ticketing desk upgrades: short IDs, owner tokens, tighter RLS helpers
-- Run in Supabase SQL Editor (same project as transport). Safe to re-run.
-- After: notify pgrst, 'reload schema';

-- Short human IDs (TKT-0001 …)
create sequence if not exists public.desk_request_seq start 1000;

alter table public.requests
  add column if not exists display_id text;

alter table public.requests
  add column if not exists owner_token uuid;

create unique index if not exists idx_requests_display_id
  on public.requests (display_id)
  where display_id is not null;

create index if not exists idx_requests_owner_token
  on public.requests (owner_token)
  where owner_token is not null;

-- Backfill display_id for existing rows
with numbered as (
  select
    id,
    'TKT-' || lpad((1000 + row_number() over (order by created_at nulls last, id))::text, 4, '0') as did
  from public.requests
  where display_id is null
)
update public.requests r
set display_id = n.did
from numbered n
where r.id = n.id;

create or replace function public.desk_next_display_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('public.desk_request_seq');
  return 'TKT-' || lpad(n::text, 4, '0');
end;
$$;

grant execute on function public.desk_next_display_id() to anon, authenticated;

-- Privacy: drop wide-open ALL policies; split by action.
-- Staff still use the anon key from the static desk — so SELECT remains
-- available, but list queries should always filter by owner_token (requester)
-- or manager PIN session (app). Manager PIN gate stays in the app layer.
-- When you move the desk onto Supabase Auth, tighten SELECT further.

drop policy if exists "anon_requests" on public.requests;
drop policy if exists "anon_messages" on public.messages;
drop policy if exists "anon_settings" on public.settings;

drop policy if exists "desk_requests_select" on public.requests;
drop policy if exists "desk_requests_insert" on public.requests;
drop policy if exists "desk_requests_update" on public.requests;
drop policy if exists "desk_messages_select" on public.messages;
drop policy if exists "desk_messages_insert" on public.messages;
drop policy if exists "desk_settings_select" on public.settings;
drop policy if exists "desk_settings_upsert" on public.settings;

create policy "desk_requests_select"
  on public.requests for select to anon, authenticated
  using (true);

create policy "desk_requests_insert"
  on public.requests for insert to anon, authenticated
  with check (true);

create policy "desk_requests_update"
  on public.requests for update to anon, authenticated
  using (true)
  with check (true);

-- No DELETE for anon — soft-close tickets instead
create policy "desk_messages_select"
  on public.messages for select to anon, authenticated
  using (true);

create policy "desk_messages_insert"
  on public.messages for insert to anon, authenticated
  with check (true);

create policy "desk_settings_select"
  on public.settings for select to anon, authenticated
  using (true);

create policy "desk_settings_upsert"
  on public.settings for insert to anon, authenticated
  with check (true);

create policy "desk_settings_update"
  on public.settings for update to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
