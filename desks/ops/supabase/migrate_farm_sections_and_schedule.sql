-- Farm schedule foundation — Usa River Campus
-- Run after schema_farm.sql. Safe to re-run.
--
-- Workbook decision: A1/A2/D1/D2 etc. are sections inside parent plots A/D,
-- not separate farms. The weekly plan is stored separately from actual
-- activities so changing a plan never rewrites field history.

create table if not exists public.farm_plot_sections (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.farm_plots (id) on delete cascade,
  code text not null,
  name text,
  acreage numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plot_id, code)
);

create index if not exists idx_farm_plot_sections_plot
  on public.farm_plot_sections (plot_id);

create table if not exists public.farm_schedule_weeks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.farm_plot_sections (id) on delete cascade,
  week_of date not null,
  stage_code text not null check (stage_code in (
    'ON', 'OFF', 'FPR', 'PLT', 'WDN', 'INS', 'FTL', 'HVT'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, week_of)
);

create index if not exists idx_farm_schedule_weeks_week
  on public.farm_schedule_weeks (week_of);

alter table public.farm_plot_sections enable row level security;
alter table public.farm_schedule_weeks enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['farm_plot_sections', 'farm_schedule_weeks'])
  loop
    execute format('drop policy if exists "Ops staff read %1$s" on public.%1$I', t);
    execute format(
      $p$create policy "Ops staff read %1$s" on public.%1$I for select
        using (public.is_admin() or public.current_user_role() in ('finance', 'farm'))$p$,
      t
    );

    execute format('drop policy if exists "Ops staff write %1$s" on public.%1$I', t);
    execute format(
      $p$create policy "Ops staff write %1$s" on public.%1$I for insert
        with check (public.is_admin() or public.current_user_role() in ('finance', 'farm'))$p$,
      t
    );

    execute format('drop policy if exists "Ops staff update %1$s" on public.%1$I', t);
    execute format(
      $p$create policy "Ops staff update %1$s" on public.%1$I for update
        using (public.is_admin() or public.current_user_role() in ('finance', 'farm'))
        with check (public.is_admin() or public.current_user_role() in ('finance', 'farm'))$p$,
      t
    );

    execute format('drop policy if exists "Admin delete %1$s" on public.%1$I', t);
    execute format(
      $p$create policy "Admin delete %1$s" on public.%1$I for delete
        using (public.is_admin())$p$,
      t
    );
  end loop;
end $$;

comment on table public.farm_plot_sections is
  'Workbook sub-plots such as A1/A2/D1/D2, grouped beneath physical farm plots A–J.';
comment on table public.farm_schedule_weeks is
  'Planned weekly farm stage: ON/OFF/FPR/PLT/WDN/INS/FTL/HVT. Actual work remains in farm_activities.';
