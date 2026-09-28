-- Real distance-based fee tiers from the "Transport Users" sheet.
-- PROPOSAL ONLY -- not auto-run. For Kai's review/decision, not a silent write.
-- Generated alongside scripts/extract-real-fee-tiers.py / data/import/student_fee_tiers.json.
--
-- Context: the fee AMOUNT is already captured today (parse_fee() in
-- scripts/import-from-sheet.py scans for it, already seeded into
-- fee_balances.balance in seed_silverleaf.sql -- cross-checked directly:
-- 568 of 569 extracted students agree with what's already seeded, the one
-- disagreement is an already-known duplicate-name case, not a new bug).
-- What's missing is distance_km / distance_category -- the *why* behind the
-- amount -- which has nowhere to land in the schema today.
--
-- Run AFTER schema_auth.sql + schema_v1.sql (fee_balances must already exist).

-- ── Reference table: the 4-tier fee schedule itself ──────────────────────────
-- Using the sheet's own verbatim category labels as the primary key keeps
-- joins/debugging trivial and matches how the source data already names things.
create table if not exists public.fee_distance_tiers (
  category   text primary key,
  min_km     numeric(5, 2) not null,
  max_km     numeric(5, 2) not null,
  amount_tzs numeric(12, 2) not null,
  currency   text not null default 'TZS'
);

insert into public.fee_distance_tiers (category, min_km, max_km, amount_tzs) values
  ('0 to 5', 0, 5, 550000),
  ('6 to 10', 6, 10, 700000),
  ('11 to 15', 11, 15, 800000),
  ('16 to 20', 16, 20, 900000)
on conflict (category) do update set
  min_km = excluded.min_km,
  max_km = excluded.max_km,
  amount_tzs = excluded.amount_tzs;

alter table public.fee_distance_tiers enable row level security;

drop policy if exists "Staff read fee_distance_tiers" on public.fee_distance_tiers;
create policy "Staff read fee_distance_tiers"
  on public.fee_distance_tiers for select
  to authenticated
  using (true);

drop policy if exists "Admins and finance manage fee_distance_tiers" on public.fee_distance_tiers;
create policy "Admins and finance manage fee_distance_tiers"
  on public.fee_distance_tiers for all
  to authenticated
  using (public.is_admin() or public.current_user_role() = 'finance')
  with check (public.is_admin() or public.current_user_role() = 'finance');

-- ── Add distance columns to fee_balances ─────────────────────────────────────
-- DECISION (Kai, 2026-07-31): APPROVED on fee_balances (not students).
-- Verified safe: src/lib/fees/sync-fees.ts upsert only sets
-- {student_id, balance, currency, synced_at}, so distance_* won't be wiped.
-- Distance is operationally tied to the fee amount row from the Transport Users
-- sheet; keep it next to balance until/unless we model home stop distance later.
alter table public.fee_balances
  add column if not exists distance_km numeric(5, 2);

alter table public.fee_balances
  add column if not exists distance_category text
    references public.fee_distance_tiers (category);
