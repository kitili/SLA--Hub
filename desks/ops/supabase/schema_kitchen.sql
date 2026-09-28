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

-- ============================================================================
-- v3 -- Compliance & checklists (spec module 4.1), driven by the same full
-- audit of the real sheet. Edited in place -- no schema_kitchen_v3.sql.
--
-- Two genuinely different scoring models exist in the real sheet, not one
-- scaled down: Daily is a raw 1-5 self-score; Weekly/Monthly is a boolean
-- per-item check aggregated to a percentage (COUNTIF(TRUE)/COUNTA). One
-- score_value column covers both -- its MEANING depends on the template's
-- cadence (1-5 raw for daily, 0/1 for weekly/monthly) -- aggregation math
-- lives in application code, matching how the two cadences already compute
-- their "actual score" differently in the source (daily divides by 5,
-- weekly/monthly don't, since their raw values are already a 0-1 fraction).
--
-- Deliberately NOT reproduced from the source: Monthly Checklists' own
-- %-complete formula includes the header row in its counted range (a real
-- off-by-one bug), and its Swahili column is a copy-paste of Daily's first
-- five rows, translating entirely different tasks. Monthly's item_text_sw
-- seeds as null here rather than carrying that wrong text forward -- it
-- needs a real human translation, not a migrated bug.
--
-- kitchen_checklist_templates.active exists specifically so items are
-- deactivated, never deleted -- the exact bug the source sheet's own
-- maintainers flagged: deleting a row there deletes that item's data from
-- every past walkthrough (Summary tab, verbatim, rows 6-8).
--
-- 'cook' and 'head_of_kitchens' roles, deferred from v2 ("adding a role with
-- nowhere to go yet is premature"), land here now that this module actually
-- has screens for them.
-- ============================================================================

alter type public.app_role add value if not exists 'cook';
alter type public.app_role add value if not exists 'head_of_kitchens';

create table if not exists public.kitchen_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  item_text_en text not null,
  item_text_sw text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cadence, item_text_en)
);

create index if not exists idx_kitchen_checklist_templates_cadence
  on public.kitchen_checklist_templates (cadence, sort_order);

create table if not exists public.kitchen_checklist_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.kitchen_checklist_templates (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  period_date date not null,
  -- 1-5 for daily items, 0 or 1 (boolean-as-numeric) for weekly/monthly --
  -- matches the template's own cadence, see header note above.
  score_value numeric(3, 1) not null,
  comment text,
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, school_id, period_date)
);

create index if not exists idx_kitchen_checklist_entries_lookup
  on public.kitchen_checklist_entries (school_id, period_date);

create table if not exists public.kitchen_sop_tasks (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('cook', 'head_of_kitchens', 'ops_manager')),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly', 'termly')),
  description text not null,
  sort_order int not null default 0,
  unique (role, cadence, sort_order)
);

alter table public.kitchen_checklist_templates enable row level security;
alter table public.kitchen_checklist_entries enable row level security;
alter table public.kitchen_sop_tasks enable row level security;

drop policy if exists "Kitchen roles read checklist templates" on public.kitchen_checklist_templates;
create policy "Kitchen roles read checklist templates"
  on public.kitchen_checklist_templates for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage checklist templates" on public.kitchen_checklist_templates;
create policy "Admin/ops manage checklist templates"
  on public.kitchen_checklist_templates for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Kitchen roles read checklist entries" on public.kitchen_checklist_entries;
create policy "Kitchen roles read checklist entries"
  on public.kitchen_checklist_entries for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Kitchen roles submit checklist entries" on public.kitchen_checklist_entries;
create policy "Kitchen roles submit checklist entries"
  on public.kitchen_checklist_entries for insert
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Kitchen roles update checklist entries" on public.kitchen_checklist_entries;
create policy "Kitchen roles update checklist entries"
  on public.kitchen_checklist_entries for update
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Kitchen roles read SOP tasks" on public.kitchen_sop_tasks;
create policy "Kitchen roles read SOP tasks"
  on public.kitchen_sop_tasks for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage SOP tasks" on public.kitchen_sop_tasks;
create policy "Admin/ops manage SOP tasks"
  on public.kitchen_sop_tasks for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'));

-- Seed: verbatim item text from the real Daily/Weekly Checklists tabs (see
-- header note on why Monthly's Swahili is left null).
insert into public.kitchen_checklist_templates (cadence, item_text_en, item_text_sw, sort_order) values
  ('daily', 'Wipe down food preparation areas between tasks with anti-bacterial cleaner (Soaps)', 'Futa maeneo ya maandalizi ya chakula kati ya kazi kwa kisafishaji cha kuua bakteria', 1),
  ('daily', 'Empty bins once they are full', 'Tupa taka mara zinapojaa', 2),
  ('daily', 'Disinfect waste areas', 'Kusafisha maeneo ya takataka kwa kutumia dawa ya kuua viini', 3),
  ('daily', 'Wash and sanitise all chopping and cutting boards and surfaces', 'Osha na sanitise mbao zote za kukatia', 4),
  ('daily', 'Sweep and mop the kitchen flooring', 'Fagia na kudeki sakafu ya jikoni.', 5),
  ('daily', 'Mop up any spillages immediately to prevent hazards', 'Safisha palipovuja ili kuondoa uwezekano wowote wa hatari.', 6),
  ('daily', 'Wash all aprons and chef hats', 'Osha na safisha mashati ya kazi na barakoa za wapishi wote.', 7),
  ('daily', 'Clean knives and cutlery', 'Safisha visu na vyombo vya kulia.', 8),
  ('daily', 'Clean plates', 'Safisha sahani', 9),
  ('daily', 'Wipe walls that have been splashed', 'Futa kuta ambazo zimerushwa', 10),
  ('daily', 'Wipe down equipment.', 'Futa vifaa.', 11),
  ('daily', 'Sweep storage areas', 'Fagia maeneo ya kuhifadhi na friji ya kuingilia', 12),
  ('daily', 'Refill soap dispensers and paper towels', null, 13),
  ('daily', 'Wash all utensils and glassware', 'Osha vyombo vyote vya kupikia na vyombo vya glasi', 14),
  ('daily', 'Wash cookware', 'Osha vyombo vya kupikia', 15),
  ('daily', 'Clean out the sinks', 'Safisha mabomba ya kunawa', 16),
  ('daily', 'Disinfect door handles and light switches', 'Safisha visanduku vya mlango na vipimio vya mwanga', 17),
  ('weekly', 'Thorough cleaning of sink areas with antibacterial cleaners', 'Safisha sinki kwa kutumia dawa / sabuni za kuuwa bakteria', 1),
  ('weekly', 'Disinfect the cutting boards and leave to dry fully in the sun.', 'Safisha vibao vya kukatia viungo/nyama kwa kutumia sabuni/ dawa za kusafishia na kuvikausha kabisha juani', 2),
  ('weekly', 'Clean stoves (Jiko), including racks', 'Safisha jiko na maeneo yote yanayozunguka jiko', 3),
  ('weekly', 'Clean drains with drain cleaners', 'Safisha maeneo yote ya mdomo wa sinki kwa kutumia sabuni na dawa', 4),
  ('weekly', 'Dust and clean lights', 'Safisha taa zote kwa kuondoa vumbi', 5),
  ('weekly', 'Wipe down doors', 'Safisha mlango, nje na ndani', 6),
  ('monthly', 'Wash behind your stoves (jikos) to eliminate grease and smoke deposits', null, 1),
  ('monthly', 'Clean underneath any appliances and other surfaces', null, 2),
  ('monthly', 'Wipe down dry storage areas', null, 3),
  ('monthly', 'Wash walls and ceilings', null, 4),
  ('monthly', 'Check cleaning stock', null, 5)
on conflict (cadence, item_text_en) do nothing;

-- Seed: verbatim SOP reference text from the "Kitchens SOPs" tab -- read-only
-- reference content, not something staff fill in. "KS" = Kitchen Supervisor,
-- the source sheet's own shorthand. Operations Manager has zero Daily duties
-- in the source -- confirmed, not an extraction gap -- flagged to Jfree as an
-- open question, seeded here exactly as the sheet has it (no Daily rows).
insert into public.kitchen_sop_tasks (role, cadence, description, sort_order) values
  ('cook', 'daily', 'Cook breakfast x2 (Boarding + Day), Lunch for Whole School, and Dinner for Boarding safely and in conjunction with all health and safety protocols', 1),
  ('cook', 'daily', 'Food preparation x4 -- i.e. chopping vegetables, cleaning produce, cooking rice, etc.', 2),
  ('cook', 'daily', 'Clean Kitchen 4x per day (before, between, and after each meal time) -- ensure all waste is properly disposed of in correct containers (compostable separated from disposable)', 3),
  ('cook', 'daily', 'Wash all dishes and cookware 3x per day (after each meal service and before breakfast in the morning)', 4),
  ('cook', 'daily', 'Be properly dressed in cookery uniforms (apron, boots, hat) and ensure these uniforms are clean and properly prepared for use.', 5),
  ('cook', 'daily', 'Serve food for students and staff 4x per day (Bx2, L, D)', 6),
  ('cook', 'daily', 'Ensure all H&S protocols around handwashing, food preparation, and cleanliness are followed to ensure safe preparation and storage of food.', 7),
  ('cook', 'daily', 'Follow minute by minute procedures for student meals.', 8),
  ('cook', 'daily', 'Report equipment or repair issues to Kitchen Supervisor as needed.', 9),
  ('cook', 'daily', 'Report low stock on any inventory to Kitchen Supervisor as needed.', 10),
  ('cook', 'weekly', 'Attend team meeting with Kitchen Supervisor -- i.e. review upcoming schedule to plan cooking times, prep times, etc. Review kitchen data from previous week, etc.', 1),
  ('cook', 'weekly', 'Attend a weekly 1:1 with Kitchen Supervisor', 2),
  ('cook', 'weekly', 'Deep Clean of Kitchen space (washing walls, non-cooking surfaces, etc.)', 3),
  ('cook', 'monthly', 'Assist Kitchen Supervisor with full stock inventory of consumable goods.', 1),
  ('cook', 'monthly', 'Attend Ops/Kitchen meeting with Ops Manager', 2),
  ('cook', 'termly', 'Assist Kitchen Supervisor with full stock inventory of all kitchen supplies (cooking utensils, sufurias, etc.).', 1),
  ('head_of_kitchens', 'daily', 'Ensure all cooking, kitchen prep, dining area prep, etc. is done in accordance with H&S protocols on a daily basis', 1),
  ('head_of_kitchens', 'daily', 'Visual inspection of kitchen and dining area for cleanliness and H&S protocol adherence -- ensure waste disposal protocols are followed.', 2),
  ('head_of_kitchens', 'daily', 'Report equipment or repair issues to Ops Manager as needed.', 3),
  ('head_of_kitchens', 'daily', 'Report low stock on any inventory to Ops Manager as needed.', 4),
  ('head_of_kitchens', 'daily', 'Ensure staff follow minute by minute procedures for student meals.', 5),
  ('head_of_kitchens', 'daily', 'Visual inspection to ensure staff are properly dressed in cookery uniforms (apron, boots, hat) and clean/properly prepared for use -- hold accountable as needed.', 6),
  ('head_of_kitchens', 'weekly', 'Run Kitchen team meeting with Cooks -- i.e. review upcoming schedule to plan cooking times, prep times, etc. Review kitchen data from previous week, etc.', 1),
  ('head_of_kitchens', 'weekly', 'Hold 1:1 meetings with Cooks to review data and problem solve any ongoing issues', 2),
  ('head_of_kitchens', 'weekly', 'Analyse the Kitchen KPI data for trends and identify areas to improve.', 3),
  ('head_of_kitchens', 'weekly', 'Audit Kitchen space weekly for cleanliness and H&S adherence, as well as deep clean completion -- hold cooks accountable.', 4),
  ('head_of_kitchens', 'weekly', 'Attend a weekly 1:1 with Ops Manager -- come prepared with data analysis and areas for collaboration', 5),
  ('head_of_kitchens', 'weekly', 'Complete inventory of vegetables order upon delivery and ensure proper storage.', 6),
  ('head_of_kitchens', 'monthly', 'Attend Ops/Kitchen meeting with Ops Manager', 1),
  ('head_of_kitchens', 'monthly', 'Complete full stock inventory of consumable goods and submit orders to Ops Manager.', 2),
  ('head_of_kitchens', 'monthly', 'Complete inventory of dry goods / grains order upon delivery and ensure proper storage.', 3),
  ('head_of_kitchens', 'monthly', 'Conduct a physical inspection of kitchen facilities and equipment to assess any potential repairs/maintenance issues, safety hazards, etc.', 4),
  ('head_of_kitchens', 'termly', 'Run Health & Safety trainings / drills with Kitchen staff to ensure adherence to protocols.', 1),
  ('head_of_kitchens', 'termly', 'Complete full stock inventory of all kitchen supplies (cooking utensils, sufurias, etc.).', 2),
  ('ops_manager', 'weekly', 'Physical walkthrough of kitchen for visual confirmation of cleanliness / health & safety data', 1),
  ('ops_manager', 'weekly', 'Review data inputs from KS (Kitchen Supervisor) for completion and hold accountable.', 2),
  ('ops_manager', 'weekly', 'Hold weekly 1:1 with KS and review data, problem solve, coaching, etc.', 3),
  ('ops_manager', 'weekly', 'Analysis of data collected for week, identify trends, plan KS check in, etc.', 4),
  ('ops_manager', 'monthly', 'Physical check of inventory to verify outcomes of staff inventory.', 1),
  ('ops_manager', 'monthly', 'Run Ops/Kitchen meeting with Kitchen Team -- data review, problem solving, professional development, etc.', 2),
  ('ops_manager', 'monthly', 'Complete a full meal service observation to ensure protocols are being adhered to and see problems in real time -- not to problem solve in real time, but to gather data for later debrief', 3),
  ('ops_manager', 'monthly', 'Analysis of data collected for month, identify trends, plan for LT Meeting, etc.', 4),
  ('ops_manager', 'termly', 'Support KS (Kitchen Supervisor) on Health & Safety Drills with students and staff to ensure protocol adherence.', 1),
  ('ops_manager', 'termly', 'Support KS on audit of general kitchen inventory & repairs done by fundis / reviewing against budget.', 2),
  ('ops_manager', 'termly', 'Termly Risk Audit of Kitchen policies, procedures, and top-down programme', 3)
on conflict (role, cadence, sort_order) do nothing;

-- ============================================================================
-- v4 -- Food quality & satisfaction (spec module 4.4). Edited in place -- no
-- schema_kitchen_v4.sql.
--
-- The real source has TWO forms, not one live feed: "Food Quality Tracker"
-- (43 real responses, a single Oct 2025 pilot month, no campus field at all
-- -- class/location is a messy free-text field mixing real classes, bare
-- numbers, and locations like "Dining hall"/"Day care") and "Learner Food
-- Satisfaction Surve" (zero submissions ever, but has a proper campus field
-- -- looks like the intended successor form that was set up but never
-- linked to real intake). school_id is nullable here specifically because
-- the one source with real data can't populate it.
--
-- Enum values below are the REAL observed answer values from all 43 Food
-- Quality Tracker responses, not guessed: quality_rating matches the spec's
-- own poor/fair/good/excellent exactly; consistency_rating and
-- satisfaction_level are slugged from the actual free-text answer options
-- found (3 distinct values each, not a binary).
-- ============================================================================

create table if not exists public.kitchen_survey_responses (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  school_id uuid references public.schools (id) on delete set null,
  class_or_grade text,
  source text not null default 'food_quality_tracker'
    check (source in ('food_quality_tracker', 'learner_survey')),
  quality_rating text
    check (quality_rating in ('poor', 'fair', 'good', 'excellent')),
  served_on_time boolean,
  sufficient_quantity boolean,
  consistency_rating text
    check (consistency_rating in ('very_consistent', 'somewhat_consistent', 'not_consistent')),
  satisfaction_level text
    check (satisfaction_level in ('most_satisfied', 'some_not_satisfied', 'many_not_satisfied')),
  comment_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_kitchen_survey_responses_school
  on public.kitchen_survey_responses (school_id, submitted_at desc);

alter table public.kitchen_survey_responses enable row level security;

drop policy if exists "Kitchen roles read survey responses" on public.kitchen_survey_responses;
create policy "Kitchen roles read survey responses"
  on public.kitchen_survey_responses for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens', 'matron'));

drop policy if exists "Kitchen roles submit survey responses" on public.kitchen_survey_responses;
create policy "Kitchen roles submit survey responses"
  on public.kitchen_survey_responses for insert
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens', 'matron'));

-- ============================================================================
-- v5 -- Staff roster, the StaffMember half of spec module 4.5 (SOP reference
-- is already covered by kitchen_sop_tasks, v3). Edited in place -- no
-- schema_kitchen_v5.sql.
--
-- Deliberately NOT seeded from the real June/September 2025 roster names
-- found in the audit (Quizert, Lily, Zulea, Hawa, ... Guard 1/2/3, Matron,
-- "Boys Aunt"/"Girls Aunt") -- that list mixes genuine kitchen staff with
-- guards, boarding house-parents, and the matron role, none of which are
-- Kitchen department staff. Seeding it as-is would misattribute non-Kitchen
-- people as Kitchen staff; needs a real role review with Jfree/Baraka
-- before any of those names go in, not a guess.
--
-- PerformanceRating (the appraisal/scoring half of 4.5) is deliberately NOT
-- built here -- the only source for it anywhere in the workbook is the
-- hidden "test test" tab's unshipped mini-appraisal template, with zero
-- real historical data and placeholder text ("Write Staff Name Here") still
-- sitting in every cell. Building a scoring schema against a format nobody
-- has actually used yet would be guessing, not modeling something real.
-- ============================================================================

create table if not exists public.kitchen_staff_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  role text not null default 'cook' check (role in ('cook', 'head_of_kitchens', 'other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kitchen_staff_members_school
  on public.kitchen_staff_members (school_id, active);

alter table public.kitchen_staff_members enable row level security;

drop policy if exists "Kitchen roles read staff members" on public.kitchen_staff_members;
create policy "Kitchen roles read staff members"
  on public.kitchen_staff_members for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage staff members" on public.kitchen_staff_members;
create policy "Admin/ops manage staff members"
  on public.kitchen_staff_members for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'));

-- ============================================================================
-- v6 -- Kitchen supplies/consumables (cleaning soap, sanitizer, toilet paper,
-- etc.) -- deliberately a separate catalog + purchases pair from
-- kitchen_ingredients/kitchen_purchases, not a "cleaning" category bolted
-- onto the food ingredient table. Food ingredients have a computed monthly
-- REQUIREMENT (person-days / ratio); supplies don't -- there's no
-- consumption-rate formula for soap, they're just bought and tracked, so a
-- ratio/calc_method column would be permanently null noise here.
--
-- Catalog seeded from the real "Cleaning items requirements" tab (7 named
-- items, reference unit costs, real TZS 273,000 monthly total in the source).
-- Deliberately NOT seeded as a purchase record for any specific campus --
-- that tab has no campus column anywhere in the source workbook, so
-- attributing the 273,000 to one campus would be a guess, not a fact.
-- Two further unlabeled numbers in that same tab (600,000 / 1,250,000, no
-- description/unit/campus given) are not seeded anywhere for the same
-- reason -- ambiguous source data, not modeled data.
-- ============================================================================

create table if not exists public.kitchen_supplies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'unit',
  default_unit_price numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kitchen_supply_purchases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  month date not null,
  supply_id uuid not null references public.kitchen_supplies (id),
  quantity numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  purchased_on date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kitchen_supply_purchases_school_month
  on public.kitchen_supply_purchases (school_id, month);

alter table public.kitchen_supplies enable row level security;
alter table public.kitchen_supply_purchases enable row level security;

drop policy if exists "Kitchen roles read supplies" on public.kitchen_supplies;
create policy "Kitchen roles read supplies"
  on public.kitchen_supplies for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/finance manage supplies" on public.kitchen_supplies;
create policy "Admin/finance manage supplies"
  on public.kitchen_supplies for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Kitchen roles read supply purchases" on public.kitchen_supply_purchases;
create policy "Kitchen roles read supply purchases"
  on public.kitchen_supply_purchases for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/finance manage supply purchases" on public.kitchen_supply_purchases;
create policy "Admin/finance manage supply purchases"
  on public.kitchen_supply_purchases for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

-- Seed from the real "Cleaning items requirements" tab of the 2026 Kitchens
-- Master Sheet -- reference catalog only, no campus attribution (see header).
insert into public.kitchen_supplies (name, unit, default_unit_price)
values
  ('Handwashing soap', 'litre', 10000),
  ('Toilet washing disinfectant soap', 'litre', 10000),
  ('Powder soap', 'sack', 35000),
  ('Toilet paper', 'bundle', 10000),
  ('Steel wire', 'bundle', 10000),
  ('Bar soap (half carton)', 'carton', 24000),
  ('Hand sanitizer', 'litre', 15000)
on conflict (name) do nothing;

-- ============================================================================
-- v7 -- Kitchen equipment/utensils (pots, pans, ovens, cutting boards, ...).
-- Per-campus, not a shared catalog like ingredients/supplies -- a physical
-- oven lives at one specific campus, unlike a food item that's conceptually
-- the same ingredient everywhere. Deliberately NOT seeded with any rows --
-- there is no equipment/utensils list anywhere in the 2026 Kitchens Master
-- Sheet (confirmed by a full audit of all 60 tabs), so seeding placeholder
-- items would be fabricating data. This is an empty shell ready for real
-- entry, same pattern already used for kitchen_staff_members.
-- ============================================================================

create table if not exists public.kitchen_equipment (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  category text not null default 'other'
    check (category in ('cookware', 'appliance', 'furniture', 'other')),
  quantity int not null default 1,
  condition text not null default 'good'
    check (condition in ('good', 'fair', 'poor', 'needs_repair')),
  purchased_on date,
  replacement_cost numeric(12, 2),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kitchen_equipment_school
  on public.kitchen_equipment (school_id, active);

-- Repair/maintenance events for a piece of equipment -- mirrors the
-- catalog+events shape already used for ingredients/purchases and
-- supplies/supply_purchases.
create table if not exists public.kitchen_equipment_maintenance_log (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.kitchen_equipment (id) on delete cascade,
  logged_on date not null default current_date,
  description text not null,
  cost numeric(12, 2),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kitchen_equipment_maintenance_log_equipment
  on public.kitchen_equipment_maintenance_log (equipment_id, logged_on desc);

alter table public.kitchen_equipment enable row level security;
alter table public.kitchen_equipment_maintenance_log enable row level security;

drop policy if exists "Kitchen roles read equipment" on public.kitchen_equipment;
create policy "Kitchen roles read equipment"
  on public.kitchen_equipment for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/finance manage equipment" on public.kitchen_equipment;
create policy "Admin/finance manage equipment"
  on public.kitchen_equipment for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Kitchen roles read equipment maintenance log" on public.kitchen_equipment_maintenance_log;
create policy "Kitchen roles read equipment maintenance log"
  on public.kitchen_equipment_maintenance_log for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/finance manage equipment maintenance log" on public.kitchen_equipment_maintenance_log;
create policy "Admin/finance manage equipment maintenance log"
  on public.kitchen_equipment_maintenance_log for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

-- ============================================================================
-- v8 -- Vendor/supplier catalog. Two real vendors already exist as free-text
-- inside kitchen_purchases.notes ("[Imported: ... Utele/Palate May 2026]")
-- from the master-sheet import -- this gives them a real entity instead of
-- buried text, and lets a purchase optionally link to one. vendor_id is
-- nullable on both purchase tables: most purchases (e.g. the ones cooks log
-- day to day) won't have a formal vendor, only the two real recurring ones
-- imported from the sheet do.
-- ============================================================================

create table if not exists public.kitchen_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_person text,
  contact_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kitchen_purchases
  add column if not exists vendor_id uuid references public.kitchen_vendors (id);
alter table public.kitchen_supply_purchases
  add column if not exists vendor_id uuid references public.kitchen_vendors (id);

alter table public.kitchen_vendors enable row level security;

drop policy if exists "Kitchen roles read vendors" on public.kitchen_vendors;
create policy "Kitchen roles read vendors"
  on public.kitchen_vendors for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/finance manage vendors" on public.kitchen_vendors;
create policy "Admin/finance manage vendors"
  on public.kitchen_vendors for all
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo'));

-- Seed the two real vendors already referenced in imported purchase notes.
insert into public.kitchen_vendors (name)
values ('Utele'), ('Palate')
on conflict (name) do nothing;

-- Backfill vendor_id on the real imported purchase rows that already name
-- one of these vendors in their notes -- traceable to exact existing text,
-- not a guess.
update public.kitchen_purchases p
set vendor_id = v.id
from public.kitchen_vendors v
where p.vendor_id is null
  and p.notes ilike '%' || v.name || '%';

-- ============================================================================
-- v9 -- Menu planning. Deliberately an empty shell -- there is no real menu
-- for the 5 main-kitchen campuses anywhere in the 2026 Kitchens Master
-- Sheet (the only real weekly menu found in the whole 60-tab audit belongs
-- to the separate Daycare program, a different population, not modeled
-- here). menu_items is a reusable dish catalog; menu_plans assigns one to a
-- campus/date/meal-slot. Both start empty, ready for real entry.
-- ============================================================================

create table if not exists public.kitchen_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kitchen_menu_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  serve_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  menu_item_id uuid not null references public.kitchen_menu_items (id),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, serve_date, meal_slot, menu_item_id)
);

create index if not exists idx_kitchen_menu_plans_school_date
  on public.kitchen_menu_plans (school_id, serve_date);

alter table public.kitchen_menu_items enable row level security;
alter table public.kitchen_menu_plans enable row level security;

drop policy if exists "Kitchen roles read menu items" on public.kitchen_menu_items;
create policy "Kitchen roles read menu items"
  on public.kitchen_menu_items for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage menu items" on public.kitchen_menu_items;
create policy "Admin/ops manage menu items"
  on public.kitchen_menu_items for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'));

drop policy if exists "Kitchen roles read menu plans" on public.kitchen_menu_plans;
create policy "Kitchen roles read menu plans"
  on public.kitchen_menu_plans for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage menu plans" on public.kitchen_menu_plans;
create policy "Admin/ops manage menu plans"
  on public.kitchen_menu_plans for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'));

-- ============================================================================
-- v10 -- Waste tracking. No real data anywhere in the source workbook --
-- empty shell, ready for real entry. ingredient_id is nullable because not
-- every wasted item is a tracked food ingredient (e.g. spoiled supplies or
-- something outside the 21-item catalog) -- item_name always holds a plain
-- label either way so the record is never meaningless if ingredient_id is
-- null.
-- ============================================================================

create table if not exists public.kitchen_waste_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  logged_on date not null default current_date,
  ingredient_id uuid references public.kitchen_ingredients (id) on delete set null,
  item_name text not null,
  quantity numeric(10, 2) not null default 0,
  unit text not null default 'kg',
  reason text not null default 'other'
    check (reason in ('leftover', 'spoiled', 'prep_waste', 'other')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kitchen_waste_logs_school_date
  on public.kitchen_waste_logs (school_id, logged_on desc);

alter table public.kitchen_waste_logs enable row level security;

drop policy if exists "Kitchen roles read waste logs" on public.kitchen_waste_logs;
create policy "Kitchen roles read waste logs"
  on public.kitchen_waste_logs for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Kitchen roles log waste" on public.kitchen_waste_logs;
create policy "Kitchen roles log waste"
  on public.kitchen_waste_logs for insert
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage waste logs" on public.kitchen_waste_logs;
create policy "Admin/ops manage waste logs"
  on public.kitchen_waste_logs for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'));

-- ============================================================================
-- v11 -- Meal attendance. Deliberately NOT a pull from Transport's boarding/
-- QR-scan data -- that's a different domain owned by other teammates, and
-- headcount_lines' categories (day_student, boarding_dinner_student, ...)
-- don't cleanly map to which meal slots each category actually eats, so a
-- precise per-meal-slot "expected" figure would be a guess, not a fact.
-- This is a standalone log of the headcount actually served/counted at
-- serving time, kept simple; reconciliation against the month's planned
-- headcount happens in the UI as an explicit approximation, not hidden math.
-- ============================================================================

create table if not exists public.kitchen_meal_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  serve_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  actual_headcount int not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, serve_date, meal_slot)
);

create index if not exists idx_kitchen_meal_attendance_school_date
  on public.kitchen_meal_attendance (school_id, serve_date desc);

alter table public.kitchen_meal_attendance enable row level security;

drop policy if exists "Kitchen roles read meal attendance" on public.kitchen_meal_attendance;
create policy "Kitchen roles read meal attendance"
  on public.kitchen_meal_attendance for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Kitchen roles log meal attendance" on public.kitchen_meal_attendance;
create policy "Kitchen roles log meal attendance"
  on public.kitchen_meal_attendance for insert
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage meal attendance" on public.kitchen_meal_attendance;
create policy "Admin/ops manage meal attendance"
  on public.kitchen_meal_attendance for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'));

-- ============================================================================
-- v12 -- Nutrition & allergens, per ingredient (global, not per-campus --
-- rice's protein content doesn't change by campus, unlike price/ratio).
-- kitchen_allergens is seeded with the standard named categories (a fixed,
-- well-known taxonomy, not a claim about any specific ingredient) --
-- kitchen_ingredient_allergens (which ingredients actually contain which)
-- and kitchen_ingredient_nutrition (actual calorie/macro values) both start
-- completely empty. Nobody has verified real nutrition data for any of
-- these 21 ingredients as prepared here, so seeding plausible-looking
-- numbers would be a guess dressed up as a fact -- this is ready for admin
-- to fill in, not pre-filled.
-- ============================================================================

create table if not exists public.kitchen_allergens (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.kitchen_ingredient_allergens (
  ingredient_id uuid not null references public.kitchen_ingredients (id) on delete cascade,
  allergen_id uuid not null references public.kitchen_allergens (id) on delete cascade,
  primary key (ingredient_id, allergen_id)
);

create table if not exists public.kitchen_ingredient_nutrition (
  ingredient_id uuid primary key references public.kitchen_ingredients (id) on delete cascade,
  calories_per_100g numeric(8, 2),
  protein_g numeric(8, 2),
  carbs_g numeric(8, 2),
  fat_g numeric(8, 2),
  fiber_g numeric(8, 2),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.kitchen_allergens enable row level security;
alter table public.kitchen_ingredient_allergens enable row level security;
alter table public.kitchen_ingredient_nutrition enable row level security;

drop policy if exists "Kitchen roles read allergens" on public.kitchen_allergens;
create policy "Kitchen roles read allergens"
  on public.kitchen_allergens for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage allergens" on public.kitchen_allergens;
create policy "Admin/ops manage allergens"
  on public.kitchen_allergens for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Kitchen roles read ingredient allergens" on public.kitchen_ingredient_allergens;
create policy "Kitchen roles read ingredient allergens"
  on public.kitchen_ingredient_allergens for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage ingredient allergens" on public.kitchen_ingredient_allergens;
create policy "Admin/ops manage ingredient allergens"
  on public.kitchen_ingredient_allergens for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'));

drop policy if exists "Kitchen roles read ingredient nutrition" on public.kitchen_ingredient_nutrition;
create policy "Kitchen roles read ingredient nutrition"
  on public.kitchen_ingredient_nutrition for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage ingredient nutrition" on public.kitchen_ingredient_nutrition;
create policy "Admin/ops manage ingredient nutrition"
  on public.kitchen_ingredient_nutrition for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo'));

insert into public.kitchen_allergens (name)
values ('Nuts'), ('Dairy'), ('Gluten'), ('Egg'), ('Soy'), ('Shellfish'), ('Fish'), ('Other')
on conflict (name) do nothing;

-- ============================================================================
-- v13 -- Daycare (2026-08-17). Confirmed in scope by Jfree, but deliberately
-- NOT modeled as a row in public.schools -- schools is shared with Transport
-- (buses.school_id, routes.school_id), so a "Daycare" school would leak into
-- Transport's campus pickers with no real meaning there. The source sheet's
-- own "Daycare" tab has no ongoing time-series data either (just a one-time
-- kid-count/menu/cost snapshot, nothing dated) -- so this is intentionally a
-- single small standalone table, not a mirror of the 5-campus machinery
-- (kitchen_headcount_lines/purchases/budgets), which would be over-built for
-- what's actually being tracked here.
-- ============================================================================

create table if not exists public.kitchen_daycare_records (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  kid_count int,
  monthly_cost numeric(12, 2),
  currency text not null default 'TZS',
  menu_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month)
);

create index if not exists idx_kitchen_daycare_records_month
  on public.kitchen_daycare_records (month desc);

alter table public.kitchen_daycare_records enable row level security;

drop policy if exists "Kitchen roles read daycare records" on public.kitchen_daycare_records;
create policy "Kitchen roles read daycare records"
  on public.kitchen_daycare_records for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Admin/ops manage daycare records" on public.kitchen_daycare_records;
create policy "Admin/ops manage daycare records"
  on public.kitchen_daycare_records for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens'));

-- ============================================================================
-- v14 -- Inventory / stock on hand (2026-08-17). The source sheet never had
-- this either -- its own "Notes" tab flags "ensure the inventory sheet is
-- linked on the kitchen master sheet" as an unresolved team ask from 2024,
-- and no such sheet exists anywhere in the 60 tabs. Per campus, per
-- ingredient, one row per stock count date -- same time-series shape as
-- kitchen_meal_attendance, so a count history builds up rather than one
-- mutable "current stock" number. Starts completely empty; admin fills it in.
-- ============================================================================

create table if not exists public.kitchen_inventory_counts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  ingredient_id uuid not null references public.kitchen_ingredients (id) on delete cascade,
  counted_on date not null,
  quantity_on_hand numeric(10, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, ingredient_id, counted_on)
);

create index if not exists idx_kitchen_inventory_counts_school_date
  on public.kitchen_inventory_counts (school_id, counted_on desc);

alter table public.kitchen_inventory_counts enable row level security;

drop policy if exists "Kitchen roles read inventory counts" on public.kitchen_inventory_counts;
create policy "Kitchen roles read inventory counts"
  on public.kitchen_inventory_counts for select
  using (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

drop policy if exists "Kitchen roles log inventory counts" on public.kitchen_inventory_counts;
create policy "Kitchen roles log inventory counts"
  on public.kitchen_inventory_counts for insert
  with check (public.is_admin() or public.current_user_role() in ('finance', 'ops_manager', 'finance_manager', 'cfo', 'cook', 'head_of_kitchens'));

-- Update/delete deliberately include finance/cook, matching the insert policy
-- above -- whoever can log a count (including a cook) needs to be able to
-- correct or remove it, or upsertKitchenInventoryCount's ON CONFLICT DO
-- UPDATE path silently fails RLS for those roles on a re-save.
drop policy if exists "Admin/ops manage inventory counts" on public.kitchen_inventory_counts;
create policy "Admin/ops manage inventory counts"
  on public.kitchen_inventory_counts for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens', 'finance', 'cook'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens', 'finance', 'cook'));

-- ============================================================================
-- RLS fix (2026-08-18) -- found by a live-crash sweep of already-shipped
-- Kitchen tables (not schema-pending, these are all live). Two shapes:
--
-- 1. kitchen_waste_logs / kitchen_meal_attendance: the API routes' DELETE/
--    PATCH handlers allow finance+cook (matching every other Kitchen write
--    route's broad role list), but each table's own "manage" (update/delete)
--    policy was narrower and excluded both -- so a finance or cook user
--    editing/deleting their own logged entry got either a false "ok:true"
--    (delete, see src/lib/db/kitchen.ts's deleteKitchenWasteLog/
--    deleteKitchenMealAttendance -- no .select() to detect an RLS-blocked
--    0-row delete) or a raw PostgREST "Cannot coerce the result to a single
--    JSON object" error (update, via .select().single() on a 0-row result).
--    Fixed the same way as kitchen_inventory_counts above: widen the manage
--    policy to match insert, since whoever can log an entry should be able
--    to correct/remove it.
--
-- 2. kitchen_survey_responses: had SELECT and INSERT policies but no UPDATE
--    or DELETE policy at all -- confirmed live (an admin-role test user's
--    update returned `error: null, data: []`, i.e. RLS silently blocked it
--    for literally every role, including admin). The API's PATCH/DELETE
--    route already only allows admin/ops_manager (narrower than who can
--    submit a response), so the new policy matches that existing intent
--    exactly rather than widening to everyone who can insert.
-- ============================================================================

drop policy if exists "Admin/ops manage waste logs" on public.kitchen_waste_logs;
create policy "Admin/ops manage waste logs"
  on public.kitchen_waste_logs for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens', 'finance', 'cook'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens', 'finance', 'cook'));

drop policy if exists "Admin/ops manage meal attendance" on public.kitchen_meal_attendance;
create policy "Admin/ops manage meal attendance"
  on public.kitchen_meal_attendance for all
  using (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens', 'finance', 'cook'))
  with check (public.is_admin() or public.current_user_role() in ('ops_manager', 'finance_manager', 'cfo', 'head_of_kitchens', 'finance', 'cook'));

drop policy if exists "Admin/ops manage survey responses" on public.kitchen_survey_responses;
create policy "Admin/ops manage survey responses"
  on public.kitchen_survey_responses for all
  using (public.is_admin() or public.current_user_role() = 'ops_manager')
  with check (public.is_admin() or public.current_user_role() = 'ops_manager');

-- ============================================================================
-- Schema fix (2026-08-19, pending -- not yet applied live) -- kitchen_menu_plans
-- had no constraint stopping two rows for the same (school_id, serve_date,
-- meal_slot), so re-assigning a dish to an already-planned slot (or a
-- double-clicked Assign button) created a duplicate instead of replacing the
-- existing plan -- both would then show on the Menu Plans calendar for that
-- slot. App-layer code (createKitchenMenuPlan in src/lib/db/kitchen.ts) now
-- checks for an existing row for the slot and updates it instead of
-- inserting, so this already works without waiting on this constraint --
-- this index is a data-integrity backstop for anything that writes to this
-- table outside that function (a script, a future direct-SQL fix, etc.).
-- ============================================================================

create unique index if not exists kitchen_menu_plans_school_date_slot_key
  on public.kitchen_menu_plans (school_id, serve_date, meal_slot);
