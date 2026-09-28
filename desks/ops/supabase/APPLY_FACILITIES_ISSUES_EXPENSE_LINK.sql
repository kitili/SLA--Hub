-- Lets an R&M issue carry a cost and optionally link to the actual ledger
-- expense it created, so Facilities spend shows up in Transport's budget
-- burn tracking. Safe to re-run. Paste into Supabase SQL Editor -> Run.

alter table public.facilities_issues
  add column if not exists cost numeric(12, 2);

alter table public.facilities_issues
  add column if not exists expense_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'facilities_issues_expense_id_fkey'
  ) then
    alter table public.facilities_issues
      add constraint facilities_issues_expense_id_fkey
      foreign key (expense_id) references public.expenses (id) on delete set null;
  end if;
exception
  when undefined_table then
    raise notice 'expenses missing — run schema_week3.sql first';
end $$;

create index if not exists idx_facilities_issues_expense
  on public.facilities_issues (expense_id)
  where expense_id is not null;

notify pgrst, 'reload schema';
