-- Kitchen apply step 3B/3B — run AFTER APPLY_KITCHEN_03A_ROLES.sql has succeeded.
-- Creates checklist / SOP / survey / staff tables + seeds + PostgREST reload.
-- Source: schema_kitchen.sql v3–v5 on Jfree/kitchen-dashboard

-- v3 -- Compliance & checklists (spec module 4.1)

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
  -- 1-5 for daily items, 0 or 1 (boolean-as-numeric) for weekly/monthly
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

-- v4 -- Food quality & satisfaction

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

-- v5 -- Staff roster

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

notify pgrst, 'reload schema';
