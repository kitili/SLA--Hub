-- Kitchen ops: menu/ingredient planning, procurement, and budget tracking.
--
-- Replaces the manual "2026 Kitchens Master Sheet.xlsx" workflow, where each
-- campus/month combination was a hand-copied ~70-row block (menu, ingredient
-- requirements, purchases, budget vs actual). Ingredient requirements are
-- now computed from headcount + a per-ingredient ratio instead of being
-- retyped every month -- see src/lib/kitchen/ingredient-calc.ts.
--
-- Campuses map 1:1 to the existing public.schools rows (Usa River, Arusha
-- Modern, Kijenge, Ilboru, Boma) -- no separate "campus" table needed.

create table if not exists public.kitchen_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'kg',
  category text not null default 'grain'
    check (category in ('grain', 'vegetable', 'other')),
  -- headcount_ratio: requirement driven by (day/boarding headcount x days in
  -- month) / people_per_kg -- matches the sheet's "No. of ppl/Kg" tables.
  -- flat_weekly: requirement is a fixed kg_per_week x weeks in month --
  -- matches the sheet's vegetable procurement table.
  calc_method text not null default 'headcount_ratio'
    check (calc_method in ('headcount_ratio', 'flat_weekly')),
  people_per_kg numeric(10, 2),
  kg_per_week numeric(10, 2),
  default_unit_price numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kitchen_headcounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  month date not null,
  day_students int not null default 0,
  boarding_students int not null default 0,
  day_staff int not null default 0,
  boarding_staff int not null default 0,
  weekdays_in_month int not null default 0,
  weekend_days_in_month int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, month)
);

create table if not exists public.kitchen_budgets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  month date not null,
  budget_amount numeric(14, 2) not null default 0,
  currency text not null default 'TZS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, month)
);

create table if not exists public.kitchen_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  month date not null,
  ingredient_id uuid not null references public.kitchen_ingredients (id),
  quantity numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  purchased_on date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kitchen_headcounts_school_month
  on public.kitchen_headcounts (school_id, month);
create index if not exists idx_kitchen_budgets_school_month
  on public.kitchen_budgets (school_id, month);
create index if not exists idx_kitchen_purchases_school_month
  on public.kitchen_purchases (school_id, month);

alter table public.kitchen_ingredients enable row level security;
alter table public.kitchen_headcounts enable row level security;
alter table public.kitchen_budgets enable row level security;
alter table public.kitchen_purchases enable row level security;

drop policy if exists "Admin/finance manage kitchen ingredients" on public.kitchen_ingredients;
create policy "Admin/finance manage kitchen ingredients"
  on public.kitchen_ingredients for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

drop policy if exists "Admin/finance manage kitchen headcounts" on public.kitchen_headcounts;
create policy "Admin/finance manage kitchen headcounts"
  on public.kitchen_headcounts for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

drop policy if exists "Admin/finance manage kitchen budgets" on public.kitchen_budgets;
create policy "Admin/finance manage kitchen budgets"
  on public.kitchen_budgets for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

drop policy if exists "Admin/finance manage kitchen purchases" on public.kitchen_purchases;
create policy "Admin/finance manage kitchen purchases"
  on public.kitchen_purchases for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

-- Seed ingredient ratios/prices from the live "Usa River - January 2026" tab
-- of the master sheet -- these are a starting point, not campus-verified;
-- Baraka should review/adjust per campus via the Kitchen ingredients admin UI.
insert into public.kitchen_ingredients (name, unit, category, calc_method, people_per_kg, default_unit_price)
values
  ('Rice', 'kg', 'grain', 'headcount_ratio', 6, 3000),
  ('Beans', 'kg', 'grain', 'headcount_ratio', 15, 3500),
  ('Maize flour (ugali)', 'kg', 'grain', 'headcount_ratio', 8, 1600),
  ('Maize for makande', 'kg', 'grain', 'headcount_ratio', 10, 1700),
  ('Cooking oil', 'litre', 'grain', 'headcount_ratio', 40, 6500),
  ('Sugar', 'kg', 'grain', 'headcount_ratio', 41, 3000),
  ('Choroko', 'kg', 'grain', 'headcount_ratio', 15, 3500),
  ('Salt', 'kg', 'grain', 'flat_weekly', null, 20000),
  ('Tea leaf', 'kg', 'grain', 'flat_weekly', null, 35000),
  ('Tomatoes', 'kg', 'vegetable', 'flat_weekly', null, 3000),
  ('Onions', 'kg', 'vegetable', 'flat_weekly', null, 3500),
  ('Green pepper', 'kg', 'vegetable', 'flat_weekly', null, 3000),
  ('Carrots', 'kg', 'vegetable', 'flat_weekly', null, 3000),
  ('Spices', 'kg', 'vegetable', 'flat_weekly', null, 15000),
  ('Garlic', 'kg', 'vegetable', 'flat_weekly', null, 13000),
  ('Ginger', 'kg', 'vegetable', 'flat_weekly', null, 6000),
  ('Watermelon/pineapple', 'kg', 'vegetable', 'flat_weekly', null, 1200),
  ('Bananas', 'kg', 'vegetable', 'flat_weekly', null, 1600),
  ('Oranges/Avocado', 'kg', 'vegetable', 'flat_weekly', null, 1000)
on conflict (name) do nothing;

-- Salt/tea leaf were flat monthly totals in the sheet, not a weekly kg rate --
-- set a rough weekly equivalent so the flat_weekly formula (kg_per_week x
-- weeks in month) lands close to the sheet's historical monthly totals.
update public.kitchen_ingredients set kg_per_week = 3 where name = 'Salt' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 0.25 where name = 'Tea leaf' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 28 where name = 'Tomatoes' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 20 where name = 'Onions' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 20 where name = 'Green pepper' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 25 where name = 'Carrots' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 1 where name = 'Spices' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 3 where name = 'Garlic' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 3 where name = 'Ginger' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 35 where name = 'Watermelon/pineapple' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 35 where name = 'Bananas' and kg_per_week is null;
update public.kitchen_ingredients set kg_per_week = 35 where name = 'Oranges/Avocado' and kg_per_week is null;

-- ============================================================================
-- v2 -- driven by a full audit of the real "2026 Kitchens Master Sheet.xlsx"
-- against a written management spec. Edited in place per the standing rule
-- (see schema_drivers.sql's header) -- no schema_kitchen_v2.sql.
--
-- Changes:
--  1. Ingredient category gains 'meat' -- a real line item ("Meat - boarding")
--     the original 3-value enum had no bucket for.
--  2. kitchen_ingredients keeps its ratios as GLOBAL DEFAULTS. Per-campus
--     overrides now live in kitchen_ingredient_campus_settings -- confirmed
--     with Jfree that campuses genuinely use different "people per kg" /
--     "weeks in a month" constants and the new system should keep using each
--     campus's own numbers as-is, not normalize them to one "correct" value.
--  3. kitchen_ingredient_prices adds the unit-cost time series the sheet's
--     own maintainers sketched (a monthly price-tracking table) and never
--     finished -- it currently just overwrites one price cell, losing
--     history. default_unit_price on kitchen_ingredients remains as a
--     fallback/seed default only.
--  4. kitchen_headcounts (4 fixed columns: day/boarding students/staff) is
--     dropped and replaced by kitchen_headcount_lines. The real sheet's
--     headcount "DETAIL" block has 6 independent categories (day student,
--     boarding-dinner student, day staff, boarding-dinner staff,
--     boarding-weekend kids, boarding-weekend staff), each with its OWN
--     headcount/days/price-per-person, expanding to as many as 16 during
--     holiday months (including cross-campus billing lines, e.g. one
--     campus's kitchen billing for another campus's staff). Four fixed
--     columns can't represent that; category is free text with a curated
--     common set, not a hard enum, specifically so ad hoc holiday/
--     cross-campus lines don't need a schema change. kitchen_headcounts was
--     never applied to prod (confirmed via live query), so dropping it here
--     is not a data-loss risk.
--  5. New Kitchen-department roles -- this is a brand-new department with
--     brand-new screens; none of the existing roles (admin/matron/finance/
--     driver/director) represent Ops Manager / Finance Manager / CFO.
--     Cook and Head of Kitchens (phone/tablet, in-kitchen, the compliance-
--     checklist module) are deferred until that module actually has screens
--     for them -- adding a role with nowhere to go yet is premature.
-- ============================================================================

-- Must run BEFORE any policy below references these values -- Postgres
-- rejects a new enum label in the same value the moment it's used by a
-- statement that ran earlier than the ADD VALUE that created it.
alter type public.app_role add value if not exists 'ops_manager';
alter type public.app_role add value if not exists 'finance_manager';
alter type public.app_role add value if not exists 'cfo';

alter table public.kitchen_ingredients drop constraint if exists kitchen_ingredients_category_check;
alter table public.kitchen_ingredients add constraint kitchen_ingredients_category_check
  check (category in ('grain', 'vegetable', 'meat', 'other'));

create table if not exists public.kitchen_ingredient_campus_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  ingredient_id uuid not null references public.kitchen_ingredients (id) on delete cascade,
  people_per_kg numeric(10, 2),
  kg_per_week numeric(10, 2),
  weeks_in_month numeric(4, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, ingredient_id)
);

create table if not exists public.kitchen_ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.kitchen_ingredients (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  effective_date date not null,
  unit_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (ingredient_id, school_id, effective_date)
);

create index if not exists idx_kitchen_ingredient_prices_lookup
  on public.kitchen_ingredient_prices (ingredient_id, school_id, effective_date desc);

drop table if exists public.kitchen_headcounts;

create table if not exists public.kitchen_headcount_lines (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  month date not null,
  category text not null default 'other',
  label text,
  headcount int not null default 0,
  days_in_period int not null default 0,
  price_per_person numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kitchen_headcount_lines_school_month
  on public.kitchen_headcount_lines (school_id, month);

alter table public.kitchen_ingredient_campus_settings enable row level security;
alter table public.kitchen_ingredient_prices enable row level security;
alter table public.kitchen_headcount_lines enable row level security;

-- Widened role check reused on every kitchen_* table (existing ones included
-- below) -- Ops Manager / Finance Manager / CFO are real Kitchen operators,
-- same trust tier as finance today.
drop policy if exists "Admin/finance manage kitchen ingredients" on public.kitchen_ingredients;
create policy "Admin/finance manage kitchen ingredients"
  on public.kitchen_ingredients for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Admin/finance manage kitchen budgets" on public.kitchen_budgets;
create policy "Admin/finance manage kitchen budgets"
  on public.kitchen_budgets for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Admin/finance manage kitchen purchases" on public.kitchen_purchases;
create policy "Admin/finance manage kitchen purchases"
  on public.kitchen_purchases for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Admin/finance manage kitchen ingredient campus settings" on public.kitchen_ingredient_campus_settings;
create policy "Admin/finance manage kitchen ingredient campus settings"
  on public.kitchen_ingredient_campus_settings for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Admin/finance manage kitchen ingredient prices" on public.kitchen_ingredient_prices;
create policy "Admin/finance manage kitchen ingredient prices"
  on public.kitchen_ingredient_prices for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Admin/finance manage kitchen headcount lines" on public.kitchen_headcount_lines;
create policy "Admin/finance manage kitchen headcount lines"
  on public.kitchen_headcount_lines for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

-- Standardize the ingredient catalog across all 5 campuses (confirmed with
-- Jfree) -- Kijenge's "Dagaa" is the one campus-specific substitute found in
-- the audit; add it to the shared catalog rather than modeling per-campus
-- ingredient variants.
insert into public.kitchen_ingredients (name, unit, category, calc_method, kg_per_week, default_unit_price)
values ('Dagaa', 'kg', 'other', 'flat_weekly', 5, 8000)
on conflict (name) do nothing;

-- Reload PostgREST so kitchen_* appears in the API
notify pgrst, 'reload schema';
