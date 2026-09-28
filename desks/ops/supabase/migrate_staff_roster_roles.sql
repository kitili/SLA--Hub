-- STEP 2 of 2 — run AFTER migrate_staff_roster_roles_01_enum.sql succeeds.
-- 1) Transport leads share admin DB write surface (is_admin includes transport).
-- 2) ops_manager (Kusaduka) can read/write farm tables.
-- Safe to re-run. Matches policy names from schema_farm.sql.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role in ('admin', 'transport')
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'farm_plots',
    'farm_crop_plantings',
    'farm_activities',
    'farm_schedule_weeks',
    'farm_inputs',
    'farm_input_movements',
    'farm_expenses',
    'farm_budgets',
    'farm_harvests',
    'farm_walkthroughs',
    'farm_alerts'
  ])
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'drop policy if exists %I on public.%I',
      'Ops staff read ' || t,
      t
    );
    execute format(
      $p$create policy %I on public.%I for select
        using (
          public.is_admin()
          or public.current_user_role() in ('finance', 'farm', 'ops_manager')
        )$p$,
      'Ops staff read ' || t,
      t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'Ops staff write ' || t,
      t
    );
    execute format(
      $p$create policy %I on public.%I for insert
        with check (
          public.is_admin()
          or public.current_user_role() in ('finance', 'farm', 'ops_manager')
        )$p$,
      'Ops staff write ' || t,
      t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'Ops staff update ' || t,
      t
    );
    execute format(
      $p$create policy %I on public.%I for update
        using (
          public.is_admin()
          or public.current_user_role() in ('finance', 'farm', 'ops_manager')
        )
        with check (
          public.is_admin()
          or public.current_user_role() in ('finance', 'farm', 'ops_manager')
        )$p$,
      'Ops staff update ' || t,
      t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'Admin delete ' || t,
      t
    );
    execute format(
      $p$create policy %I on public.%I for delete
        using (public.is_admin())$p$,
      'Admin delete ' || t,
      t
    );

    -- Remove botched all-access policy from earlier migration attempt (if any).
    execute format(
      'drop policy if exists %I on public.%I',
      'Ops manage ' || t,
      t
    );
  end loop;
end $$;
