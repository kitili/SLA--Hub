-- Week 3 — Finance ledger: expenses, revenues, hire_outs, budgets
-- Run AFTER schema_maintenance.sql (and Week 1–2 schemas).

-- ── Expenses ─────────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  bus_id uuid references public.buses (id) on delete set null,
  category text not null default 'other'
    check (category in (
      'fuel',
      'maintenance',
      'salary',
      'insurance',
      'toll',
      'parts',
      'hire_cost',
      'other'
    )),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'TZS',
  spent_on date not null default current_date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_spent_on on public.expenses (spent_on desc);
create index if not exists idx_expenses_school on public.expenses (school_id);
create index if not exists idx_expenses_bus on public.expenses (bus_id);
create index if not exists idx_expenses_category on public.expenses (category);

-- Link maintenance → expenses (Week 2 placeholder → real FK)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'maintenance_records_expense_id_fkey'
  ) then
    alter table public.maintenance_records
      add constraint maintenance_records_expense_id_fkey
      foreign key (expense_id) references public.expenses (id) on delete set null;
  end if;
exception
  when undefined_table then
    raise notice 'maintenance_records missing — run schema_maintenance.sql first';
end $$;

-- ── Revenues ─────────────────────────────────────────────────────────────────
create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  bus_id uuid references public.buses (id) on delete set null,
  category text not null default 'other'
    check (category in (
      'transport_fees',
      'hire_out',
      'grant',
      'other'
    )),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'TZS',
  earned_on date not null default current_date,
  notes text,
  hire_out_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_revenues_earned_on on public.revenues (earned_on desc);
create index if not exists idx_revenues_school on public.revenues (school_id);
create index if not exists idx_revenues_category on public.revenues (category);

-- ── Hire-outs (wedding / burial / event bus rental) ───────────────────────────
create table if not exists public.hire_outs (
  id uuid primary key default gen_random_uuid(),
  bus_id uuid not null references public.buses (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  client_name text not null,
  purpose text not null default 'event'
    check (purpose in ('wedding', 'burial', 'event', 'other')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  quoted_amount numeric(12, 2) not null default 0 check (quoted_amount >= 0),
  currency text not null default 'TZS',
  status text not null default 'booked'
    check (status in ('inquiry', 'booked', 'in_progress', 'completed', 'cancelled')),
  notes text,
  revenue_id uuid references public.revenues (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_hire_outs_bus_time on public.hire_outs (bus_id, start_at, end_at);
create index if not exists idx_hire_outs_status on public.hire_outs (status);

-- revenues.hire_out_id FK after hire_outs exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'revenues_hire_out_id_fkey'
  ) then
    alter table public.revenues
      add constraint revenues_hire_out_id_fkey
      foreign key (hire_out_id) references public.hire_outs (id) on delete set null;
  end if;
end $$;

-- ── Budgets (period envelopes) ───────────────────────────────────────────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  name text not null,
  category text not null default 'ops'
    check (category in (
      'fuel',
      'maintenance',
      'salary',
      'insurance',
      'ops',
      'hire_cost',
      'other'
    )),
  period_start date not null,
  period_end date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'TZS',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists idx_budgets_period on public.budgets (period_start, period_end);
create index if not exists idx_budgets_school on public.budgets (school_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.expenses enable row level security;
alter table public.revenues enable row level security;
alter table public.hire_outs enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "Staff read expenses" on public.expenses;
create policy "Staff read expenses"
  on public.expenses for select
  using (
    public.is_admin()
    or public.current_user_role() in ('finance', 'matron')
  );

drop policy if exists "Finance write expenses" on public.expenses;
create policy "Finance write expenses"
  on public.expenses for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

drop policy if exists "Staff read revenues" on public.revenues;
create policy "Staff read revenues"
  on public.revenues for select
  using (
    public.is_admin()
    or public.current_user_role() in ('finance', 'matron')
  );

drop policy if exists "Finance write revenues" on public.revenues;
create policy "Finance write revenues"
  on public.revenues for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

drop policy if exists "Staff read hire_outs" on public.hire_outs;
create policy "Staff read hire_outs"
  on public.hire_outs for select
  using (
    public.is_admin()
    or public.current_user_role() in ('finance', 'matron', 'driver')
  );

drop policy if exists "Finance write hire_outs" on public.hire_outs;
create policy "Finance write hire_outs"
  on public.hire_outs for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

drop policy if exists "Staff read budgets" on public.budgets;
create policy "Staff read budgets"
  on public.budgets for select
  using (
    public.is_admin()
    or public.current_user_role() in ('finance')
  );

drop policy if exists "Finance write budgets" on public.budgets;
create policy "Finance write budgets"
  on public.budgets for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

-- ── Per-bus budgets ────────────────────────────────────────────────────────
-- Optional bus_id lets a budget be scoped to one specific vehicle (e.g.
-- "Coaster APW R&M 2026"), narrower than school_id (campus-wide) and null
-- (fleet-wide). getPeriodPnL's budget-burn matching (src/lib/db/finance.ts)
-- uses whichever scope is set, most specific first: bus_id, then school_id,
-- then fleet-wide -- see budgetMatchesExpense in that file.
alter table public.budgets
  add column if not exists bus_id uuid references public.buses (id) on delete set null;

-- ── Revenue targets (deliberately separate from budgets) ─────────────────────
-- A budget's "over 100%" means overspent (bad). A revenue target's "over 100%"
-- means collected more than expected (good) -- opposite meaning for the same
-- number. Rather than make every budget dashboard/gauge/alert direction-aware,
-- revenue targets get their own small table, own matching logic
-- (src/lib/finance/revenue-target-match.ts), and their own UI -- never mixed
-- into the budgets list/gauges/alerts.
--
-- Also deliberately separate from public.fee_balances (schema_v1.sql):
-- fee_balances is a per-student, overwrite-on-sync snapshot of what a family
-- currently owes -- it has no history, so there's no way to derive "how much
-- was collected this period" from it. "Reconciliation against a target"
-- (2026-08-19 decision) is handled entirely through this table vs. manually
-- entered `revenues` rows (category = 'transport_fees') -- finance staff
-- record what they actually collected; that's the source of truth for
-- collection reporting. fee_balances stays a separate, matron-facing arrears
-- check only (src/lib/fees/fee-check.ts) and never feeds into this table.
create table if not exists public.revenue_targets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  bus_id uuid references public.buses (id) on delete set null,
  category text not null default 'transport_fees'
    check (category in ('transport_fees', 'hire_out', 'grant', 'other')),
  name text not null,
  period_start date not null,
  period_end date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'TZS',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists idx_revenue_targets_period on public.revenue_targets (period_start, period_end);
create index if not exists idx_revenue_targets_school on public.revenue_targets (school_id);
create index if not exists idx_revenue_targets_bus on public.revenue_targets (bus_id);

alter table public.revenue_targets enable row level security;

-- 'transport' included alongside 'finance' below to match /api/revenue-targets's
-- own requireUser(["admin", "transport", "finance"]) role gate -- this table
-- isn't live yet, so there's no drift-vs-prod risk in getting the role list
-- right the first time (see the same fix, applied as an append instead,
-- for the already-live public.budgets policies further down this file).
drop policy if exists "Staff read revenue_targets" on public.revenue_targets;
create policy "Staff read revenue_targets"
  on public.revenue_targets for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'finance'));

drop policy if exists "Finance write revenue_targets" on public.revenue_targets;
create policy "Finance write revenue_targets"
  on public.revenue_targets for all
  using (public.is_admin() or public.current_user_role() in ('transport', 'finance'))
  with check (public.is_admin() or public.current_user_role() in ('transport', 'finance'));

create index if not exists idx_budgets_bus on public.budgets (bus_id);

-- ============================================================================
-- RLS fix (2026-08-19, pending -- not yet applied live) -- public.budgets is
-- already live, and its RLS ("Staff read budgets" / "Finance write budgets"
-- above) only ever allowed admin/finance, but /api/budgets has always gated
-- on requireUser(["admin", "transport", "finance"]) -- 'transport' is a real
-- role (Baraka + Shikunzi, per src/lib/roles.ts) with UI access to
-- /admin/ledger. Until this runs, a transport-role user sees an empty
-- Budgets tab (RLS silently filters every row) and any write they attempt
-- is silently no-op'd (deleteBudget previously had no .select() to even
-- notice -- fixed separately in src/lib/db/finance.ts). Appended as a new
-- block, not edited in place above, since that policy block is already
-- shipped and Kai could mistake an in-place edit for something already run.
-- ============================================================================

drop policy if exists "Staff read budgets" on public.budgets;
create policy "Staff read budgets"
  on public.budgets for select
  using (public.is_admin() or public.current_user_role() in ('transport', 'finance'));

drop policy if exists "Finance write budgets" on public.budgets;
create policy "Finance write budgets"
  on public.budgets for all
  using (public.is_admin() or public.current_user_role() in ('transport', 'finance'))
  with check (public.is_admin() or public.current_user_role() in ('transport', 'finance'));
