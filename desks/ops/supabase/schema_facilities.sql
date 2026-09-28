-- Facilities module — 9 new tables. Run AFTER schema_auth.sql.

-- Facilities R&M issues
create table if not exists public.facilities_issues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  reported_by text,
  accountable text,
  responsible text,
  report_date date not null,
  deadline date,
  resolved_date date,
  next_steps text,
  notes text,
  cost numeric(12, 2),
  expense_id uuid references public.expenses (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Weekly checklist scores (1-5)
create table if not exists public.facilities_checklist_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  area text not null,
  walkthrough_date date not null,
  score smallint not null check (score between 1 and 5),
  comments text,
  inspector text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Generator checklist log (1-5)
create table if not exists public.facilities_generator_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  task text not null,
  log_date date not null,
  score smallint not null check (score between 1 and 5),
  comments text,
  inspector text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Staff housing + occupancy log
create table if not exists public.facilities_houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  house_letter text,
  house_name text not null,
  rooms_description text,
  furniture_status text default 'unfurnished'
    check (furniture_status in ('furnished', 'unfurnished')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facilities_house_occupancy (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.facilities_houses (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  occupant text not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Power meter log
create table if not exists public.facilities_power_usage (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  reading_date date not null,
  units_received numeric(10, 2),
  units_spent numeric(10, 2),
  balance_units numeric(10, 2),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- CCTV inventory
create table if not exists public.facilities_cctv (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  camera_type text,
  location text not null,
  quantity integer not null default 1,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Classroom inventory
create table if not exists public.facilities_classroom_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  grade text,
  item_name text not null,
  quantity integer,
  remarks text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SOPs
create table if not exists public.facilities_sops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  title text not null,
  category text,
  content text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facilities_issues_status on public.facilities_issues (status);
create index if not exists idx_facilities_issues_school on public.facilities_issues (school_id);
create index if not exists idx_facilities_checklist_date on public.facilities_checklist_scores (walkthrough_date);
create index if not exists idx_facilities_generator_date on public.facilities_generator_log (log_date);
create index if not exists idx_facilities_power_date on public.facilities_power_usage (reading_date);
create index if not exists idx_facilities_house_occupancy_house on public.facilities_house_occupancy (house_id);
create index if not exists idx_facilities_house_occupancy_period on public.facilities_house_occupancy (period_start);

-- RLS: admin-only
alter table public.facilities_issues enable row level security;
alter table public.facilities_checklist_scores enable row level security;
alter table public.facilities_generator_log enable row level security;
alter table public.facilities_houses enable row level security;
alter table public.facilities_house_occupancy enable row level security;
alter table public.facilities_power_usage enable row level security;
alter table public.facilities_cctv enable row level security;
alter table public.facilities_classroom_items enable row level security;
alter table public.facilities_sops enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'facilities_issues',
    'facilities_checklist_scores',
    'facilities_generator_log',
    'facilities_houses',
    'facilities_house_occupancy',
    'facilities_power_usage',
    'facilities_cctv',
    'facilities_classroom_items',
    'facilities_sops'
  ]
  loop
    execute format('drop policy if exists "Admin all %I" on public.%I;', t, t);
    execute format('drop policy if exists "Ops manage %I" on public.%I;', t, t);
    execute format(
      'create policy "Ops manage %I" on public.%I for all using (public.is_admin() or public.current_user_role() in (''finance'', ''ops_manager'', ''finance_manager'', ''cfo'')) with check (public.is_admin() or public.current_user_role() in (''finance'', ''ops_manager'', ''finance_manager'', ''cfo''));',
      t, t
    );
  end loop;
end $$;
