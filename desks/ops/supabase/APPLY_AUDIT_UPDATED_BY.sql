-- System-wide edit attribution (security / audit).
-- Idempotent / safe to re-run in Supabase SQL Editor.
--
-- Problem: most tables only had created_by (set once). Edits had no who/when.
-- Fix: ensure every public base table has updated_at + updated_by, and BEFORE
-- UPDATE triggers stamp auth.uid() + now(). Also fill created_by on INSERT
-- when the column exists and the client left it null.
--
-- App code should still pass updated_by explicitly when using the service role.

create or replace function public.set_updated_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_created_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Keep legacy name working for older schemas (updated_at only).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  r record;
  has_created boolean;
  sql text;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in (
        'spatial_ref_sys',
        'schema_migrations',
        'supabase_migrations'
      )
      and c.relname not like 'pg_%'
  loop
    -- updated_at
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
      r.table_name
    );

    -- updated_by → profiles
    execute format(
      'alter table public.%I add column if not exists updated_by uuid',
      r.table_name
    );

    begin
      execute format(
        'alter table public.%I
           add constraint %I
           foreign key (updated_by) references public.profiles (id) on delete set null',
        r.table_name,
        r.table_name || '_updated_by_fkey'
      );
    exception
      when duplicate_object then null;
      when undefined_table then null; -- profiles not ready
    end;

    -- UPDATE trigger (always — columns now exist)
    execute format(
      'drop trigger if exists %I on public.%I',
      r.table_name || '_updated_attribution',
      r.table_name
    );
    execute format(
      'create trigger %I
         before update on public.%I
         for each row execute function public.set_updated_attribution()',
      r.table_name || '_updated_attribution',
      r.table_name
    );

    -- INSERT created_by stamp when column exists
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = r.table_name
        and column_name = 'created_by'
    ) into has_created;

    if has_created then
      execute format(
        'drop trigger if exists %I on public.%I',
        r.table_name || '_created_attribution',
        r.table_name
      );
      execute format(
        'create trigger %I
           before insert on public.%I
           for each row execute function public.set_created_attribution()',
        r.table_name || '_created_attribution',
        r.table_name
      );
    end if;
  end loop;
end $$;

comment on function public.set_updated_attribution() is
  'Stamps updated_at=now() and updated_by=auth.uid() on every UPDATE.';
comment on function public.set_created_attribution() is
  'Fills created_by=auth.uid() on INSERT when the client left it null.';
