-- Majundo Ops — Farm management (school_farms branch)
-- Run AFTER schema_auth.sql (needs public.profiles, is_admin(), current_user_role())
-- AND AFTER schema_farm_role.sql (adds the 'farm' app_role enum label).
-- Safe to re-run.
--
-- Replaces the manual "2026 Farms Master sheet" (10-tab Google Sheet) with real
-- tables: plots, crop plantings, activity schedule, input stock, expenses,
-- budgets, harvests, weekly walkthroughs, and an alert log (overdue tasks,
-- budget overruns, low stock — reuses notifyAdminSms from schema_incidents.sql's
-- pattern, dispatched from app code, not from SQL).
--
-- Scope note: gated to admin/finance/farm, matching the /admin middleware gate.
-- The 'farm' role is restricted to /admin/farm only (see src/proxy.ts) — a real
-- account for farm staff, not just a UI-level nav restriction. Field-first
-- mobile access for farm staff (a separate concern) is still deferred.

-- ---------------------------------------------------------------------------
-- 1. Plots (Farm Plan / Site Utilisation & Staging tabs)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_plots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  acreage numeric not null default 0,
  location text,
  lat numeric,
  lng numeric,
  status text not null default 'fallow'
    check (status in ('fallow', 'staged', 'active', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_farm_plots_status on public.farm_plots (status);

-- ---------------------------------------------------------------------------
-- 2. Crop plantings (Crop Inventory / Farm Plan tabs — season/rotation aware)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_crop_plantings (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.farm_plots (id) on delete cascade,
  crop text not null,
  season text,
  planted_on date,
  expected_harvest_on date,
  target_yield_kg numeric,
  status text not null default 'planned'
    check (status in ('planned', 'planted', 'growing', 'harvested', 'failed')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_farm_plantings_plot on public.farm_crop_plantings (plot_id);
create index if not exists idx_farm_plantings_season on public.farm_crop_plantings (season);
create index if not exists idx_farm_plantings_status on public.farm_crop_plantings (status);

-- ---------------------------------------------------------------------------
-- 3. Activities / schedule (Farm Schedule + Tasks tabs)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_activities (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid references public.farm_plots (id) on delete set null,
  planting_id uuid references public.farm_crop_plantings (id) on delete set null,
  activity_type text not null
    check (activity_type in (
      'prep', 'plant', 'weed', 'inspect', 'fertilize', 'irrigate', 'harvest', 'other'
    )),
  title text not null,
  due_on date,
  assignee text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'skipped')),
  completed_at timestamptz,
  alert_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_farm_activities_plot on public.farm_activities (plot_id);
create index if not exists idx_farm_activities_due on public.farm_activities (due_on);
create index if not exists idx_farm_activities_status on public.farm_activities (status);

-- ---------------------------------------------------------------------------
-- 4. Input stock (seed / fertilizer / tools) + movement ledger
-- ---------------------------------------------------------------------------
create table if not exists public.farm_inputs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unit',
  quantity_on_hand numeric not null default 0,
  reorder_threshold numeric not null default 0,
  last_restocked_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farm_input_movements (
  id uuid primary key default gen_random_uuid(),
  input_id uuid not null references public.farm_inputs (id) on delete cascade,
  delta numeric not null,
  reason text not null
    check (reason in ('restock', 'used', 'adjustment', 'waste')),
  expense_id uuid,
  activity_id uuid references public.farm_activities (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_farm_input_movements_input on public.farm_input_movements (input_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Expenses (Farms Expenses tab)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in (
      'seed', 'fertilizer', 'labor', 'tools', 'irrigation', 'pest_control', 'other'
    )),
  amount numeric not null,
  currency text not null default 'TZS',
  spent_on date not null default current_date,
  plot_id uuid references public.farm_plots (id) on delete set null,
  planting_id uuid references public.farm_crop_plantings (id) on delete set null,
  input_id uuid references public.farm_inputs (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.farm_input_movements
    add constraint farm_input_movements_expense_fk
    foreign key (expense_id) references public.farm_expenses (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_farm_expenses_plot on public.farm_expenses (plot_id);
create index if not exists idx_farm_expenses_category on public.farm_expenses (category, spent_on desc);

-- ---------------------------------------------------------------------------
-- 6. Budgets (Farms Budget tab — planned vs actual, by category + period)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in (
      'seed', 'fertilizer', 'labor', 'tools', 'irrigation', 'pest_control', 'other', 'all'
    )),
  period text not null,
  planned_amount numeric not null,
  currency text not null default 'TZS',
  notes text,
  created_at timestamptz not null default now(),
  unique (category, period)
);

-- ---------------------------------------------------------------------------
-- 7. Harvests (Farm P&L / KPIs — yield + value, incl. photo evidence)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_harvests (
  id uuid primary key default gen_random_uuid(),
  planting_id uuid references public.farm_crop_plantings (id) on delete set null,
  plot_id uuid not null references public.farm_plots (id) on delete cascade,
  harvested_on date not null default current_date,
  quantity_kg numeric not null,
  value_amount numeric,
  currency text not null default 'TZS',
  destination text not null default 'kitchen'
    check (destination in ('kitchen', 'sold', 'seed_stock', 'waste', 'other')),
  photo_url text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_farm_harvests_plot on public.farm_harvests (plot_id, harvested_on desc);
create index if not exists idx_farm_harvests_planting on public.farm_harvests (planting_id);

-- ---------------------------------------------------------------------------
-- 8. Weekly walkthroughs (quality checklist, incl. photo evidence)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_walkthroughs (
  id uuid primary key default gen_random_uuid(),
  week_of date not null,
  plot_id uuid references public.farm_plots (id) on delete set null,
  checklist jsonb not null default '{}'::jsonb,
  overall_score numeric,
  photo_url text,
  notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_farm_walkthroughs_week on public.farm_walkthroughs (week_of desc);
create index if not exists idx_farm_walkthroughs_plot on public.farm_walkthroughs (plot_id);

-- ---------------------------------------------------------------------------
-- 9. Alert log (overdue activity / budget overrun / low stock)
--    Written by app code (checkFarmAlerts()), dispatched via notifyAdminSms
--    (src/lib/messaging/admin-alert.ts) — same helper schema_incidents.sql's
--    /api/incidents route already uses.
-- ---------------------------------------------------------------------------
create table if not exists public.farm_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('activity_overdue', 'budget_overrun', 'low_stock')),
  activity_id uuid references public.farm_activities (id) on delete cascade,
  budget_id uuid references public.farm_budgets (id) on delete cascade,
  input_id uuid references public.farm_inputs (id) on delete cascade,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'notified', 'acked')),
  created_at timestamptz not null default now()
);

-- Dedupe: don't re-raise the same open/notified alert for the same source row.
create unique index if not exists idx_farm_alerts_dedupe_activity
  on public.farm_alerts (activity_id)
  where activity_id is not null and status in ('open', 'notified');

create unique index if not exists idx_farm_alerts_dedupe_budget
  on public.farm_alerts (budget_id)
  where budget_id is not null and status in ('open', 'notified');

create unique index if not exists idx_farm_alerts_dedupe_input
  on public.farm_alerts (input_id)
  where input_id is not null and status in ('open', 'notified');

-- ---------------------------------------------------------------------------
-- RLS — admin/finance/farm (mirrors /admin middleware gate).
-- NOTE: 'farm' is only a valid app_role label after schema_farm_role.sql has
-- been run and committed. Run that file first, then this one (idempotent —
-- safe to re-run even if this file already ran with the old finance-only
-- policies).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'farm_plots', 'farm_crop_plantings', 'farm_activities', 'farm_inputs',
    'farm_input_movements', 'farm_expenses', 'farm_budgets', 'farm_harvests',
    'farm_walkthroughs', 'farm_alerts'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'drop policy if exists "Ops staff read %1$s" on public.%1$I', t
    );
    execute format(
      $p$create policy "Ops staff read %1$s" on public.%1$I for select
        using (public.is_admin() or public.current_user_role() in ('finance', 'farm'))$p$,
      t
    );

    execute format(
      'drop policy if exists "Ops staff write %1$s" on public.%1$I', t
    );
    execute format(
      $p$create policy "Ops staff write %1$s" on public.%1$I for insert
        with check (public.is_admin() or public.current_user_role() in ('finance', 'farm'))$p$,
      t
    );

    execute format(
      'drop policy if exists "Ops staff update %1$s" on public.%1$I', t
    );
    execute format(
      $p$create policy "Ops staff update %1$s" on public.%1$I for update
        using (public.is_admin() or public.current_user_role() in ('finance', 'farm'))
        with check (public.is_admin() or public.current_user_role() in ('finance', 'farm'))$p$,
      t
    );

    execute format(
      'drop policy if exists "Admin delete %1$s" on public.%1$I', t
    );
    execute format(
      $p$create policy "Admin delete %1$s" on public.%1$I for delete
        using (public.is_admin())$p$,
      t
    );
  end loop;
end $$;

comment on table public.farm_plots is 'Plots A–J, ~8.01 acres — replaces Site Utilisation & Staging tab';
comment on table public.farm_crop_plantings is 'Per-plot crop cycles, season-tagged for rotation planning';
comment on table public.farm_activities is 'Farm Schedule + Tasks tabs — prep/plant/weed/inspect/fertilize/irrigate/harvest';
comment on table public.farm_inputs is 'Seed/fertilizer/tool stock levels, with reorder threshold for low-stock alerts';
comment on table public.farm_expenses is 'Farms Expenses tab, categorized, linkable to plot/planting/input';
comment on table public.farm_budgets is 'Farms Budget tab — planned amount per category per period';
comment on table public.farm_harvests is 'Farm P&L / KPIs — yield + value, destination tracks kitchen use for food-cost ROI';
comment on table public.farm_walkthroughs is 'Weekly quality checklist, replaces manual walkthrough tab';
comment on table public.farm_alerts is 'Overdue activity / budget overrun / low stock — dispatched via notifyAdminSms';
