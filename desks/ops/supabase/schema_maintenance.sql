-- Kai Week 2 Day 12 — Maintenance / repairs (cost fields for Irene expense link)
-- Run AFTER schema_week2.sql

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  bus_id uuid not null references public.buses (id) on delete cascade,
  title text not null,
  category text not null default 'repair'
    check (category in (
      'service',
      'repair',
      'tyre',
      'fuel_system',
      'body',
      'inspection',
      'other'
    )),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  -- Actual spend (may differ from budget_amount)
  cost numeric(12, 2) not null default 0,
  -- Planned / estimated cost before work; nullable when unknown
  budget_amount numeric(12, 2),
  currency text not null default 'TZS',
  notes text,
  service_date date,
  due_date date,
  -- Week 3: Irene can link to expenses.id when finance ledger exists
  expense_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent for DBs that already created maintenance_records without budget
alter table public.maintenance_records
  add column if not exists budget_amount numeric(12, 2);

create index if not exists idx_maintenance_bus on public.maintenance_records (bus_id);
create index if not exists idx_maintenance_status on public.maintenance_records (status);
create index if not exists idx_maintenance_due on public.maintenance_records (due_date);

alter table public.maintenance_records enable row level security;

drop policy if exists "Staff read maintenance" on public.maintenance_records;
create policy "Staff read maintenance"
  on public.maintenance_records for select
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Admin write maintenance" on public.maintenance_records;
create policy "Admin write maintenance"
  on public.maintenance_records for all
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

-- ── Allow fleet-wide charges (no single bus) ──────────────────────────────────
-- e.g. "Labour charges" from an invoice covering multiple buses at once, not
-- attributable to one specific vehicle. bus_id null = fleet-wide. Until this
-- migration is applied live, the CREATE form and CSV import both require a
-- real bus (bus_id is still NOT NULL live) -- re-enable the "fleet-wide"
-- option in MaintenanceClient.tsx and the blank-bus-is-valid case in
-- src/lib/import/maintenance-import.ts once this actually runs.
alter table public.maintenance_records alter column bus_id drop not null;

-- ── Vendor/VAT/labour breakdown (2026-08-17, from the Transport Master sheet
-- admin review) ───────────────────────────────────────────────────────────────
-- The sheet's real "BUSES MAINTENANCE" log tracks which garage supplied a
-- part (for a per-vendor spend rollup), and separates VAT from material cost
-- and labour from parts cost -- none of which existed here. Purely additive:
-- `cost` keeps meaning whatever total the admin already enters, unchanged for
-- every existing record and for anyone who leaves these new fields blank.
-- Nothing in budget burn / expense-linking depends on them.
alter table public.maintenance_records
  add column if not exists vendor_name text;
alter table public.maintenance_records
  add column if not exists vat_amount numeric(12, 2);
alter table public.maintenance_records
  add column if not exists labour_cost numeric(12, 2);
