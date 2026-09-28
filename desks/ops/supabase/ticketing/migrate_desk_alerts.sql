-- In-app desk alerts (works without SMS)
-- Safe to re-run.

create table if not exists public.desk_alerts (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'manager'
    check (audience in ('manager', 'requester', 'all')),
  owner_token uuid,
  request_id text,
  display_id text,
  kind text not null default 'info',
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_desk_alerts_audience_created
  on public.desk_alerts (audience, created_at desc);

create index if not exists idx_desk_alerts_owner
  on public.desk_alerts (owner_token, created_at desc)
  where owner_token is not null;

alter table public.desk_alerts enable row level security;

drop policy if exists "desk_alerts_select" on public.desk_alerts;
drop policy if exists "desk_alerts_insert" on public.desk_alerts;
drop policy if exists "desk_alerts_update" on public.desk_alerts;

create policy "desk_alerts_select"
  on public.desk_alerts for select to anon, authenticated
  using (true);

create policy "desk_alerts_insert"
  on public.desk_alerts for insert to anon, authenticated
  with check (true);

create policy "desk_alerts_update"
  on public.desk_alerts for update to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
