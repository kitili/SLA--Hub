-- Sample finance ledger for Week 3 demo (Usariver campus + first bus)
-- Run AFTER schema_week3.sql + seed_silverleaf.sql
-- UUIDs must be hex-only (0-9 a-f).

-- Clear prior demo finance rows (safe re-run by fixed IDs)
delete from public.hire_outs where id in (
  'e3400000-0000-4000-8000-000000000001',
  'e3400000-0000-4000-8000-000000000002'
);
delete from public.revenues where id in (
  'e3300000-0000-4000-8000-000000000001',
  'e3300000-0000-4000-8000-000000000002',
  'e3300000-0000-4000-8000-000000000003'
);
delete from public.expenses where id in (
  'e3200000-0000-4000-8000-000000000001',
  'e3200000-0000-4000-8000-000000000002',
  'e3200000-0000-4000-8000-000000000003',
  'e3200000-0000-4000-8000-000000000004'
);
delete from public.budgets where id in (
  'e3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000002'
);

insert into public.budgets (
  id, school_id, name, category, period_start, period_end, amount, currency, notes
) values
(
  'e3100000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Usariver Fuel Q3',
  'fuel',
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '3 months - 1 day')::date,
  8000000,
  'TZS',
  'Demo fuel envelope'
),
(
  'e3100000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'Usariver Ops Q3',
  'ops',
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '3 months - 1 day')::date,
  15000000,
  'TZS',
  'Catch-all ops budget'
)
on conflict (id) do update set amount = excluded.amount, notes = excluded.notes;

insert into public.expenses (
  id, school_id, bus_id, category, title, amount, currency, spent_on, notes
) values
(
  'e3200000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'fuel',
  'Diesel fill — T 910 APW',
  450000,
  'TZS',
  current_date - 2,
  'Demo expense'
),
(
  'e3200000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'maintenance',
  'Brake pads',
  280000,
  'TZS',
  current_date - 5,
  null
),
(
  'e3200000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000001',
  null,
  'insurance',
  'Fleet third-party top-up',
  1200000,
  'TZS',
  current_date - 10,
  null
),
(
  'e3200000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000001',
  null,
  'salary',
  'Matron stipend (week)',
  350000,
  'TZS',
  current_date - 1,
  null
)
on conflict (id) do update set amount = excluded.amount;

insert into public.revenues (
  id, school_id, bus_id, category, title, amount, currency, earned_on, notes
) values
(
  'e3300000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  null,
  'transport_fees',
  'Transport fees — week collection',
  5200000,
  'TZS',
  current_date - 1,
  'Demo fee intake'
),
(
  'e3300000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'hire_out',
  'Weekend wedding hire',
  900000,
  'TZS',
  current_date - 3,
  null
)
on conflict (id) do update set amount = excluded.amount;

insert into public.hire_outs (
  id, bus_id, school_id, client_name, purpose, start_at, end_at,
  quoted_amount, currency, status, notes, revenue_id
) values
(
  'e3400000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Mwangi family',
  'wedding',
  (current_date - 3)::timestamptz + interval '8 hours',
  (current_date - 3)::timestamptz + interval '20 hours',
  900000,
  'TZS',
  'completed',
  'Demo hire-out',
  'e3300000-0000-4000-8000-000000000002'
)
on conflict (id) do update set quoted_amount = excluded.quoted_amount, status = excluded.status;

update public.revenues
set hire_out_id = 'e3400000-0000-4000-8000-000000000001'
where id = 'e3300000-0000-4000-8000-000000000002';

-- Upcoming booked hire (calendar demo)
insert into public.hire_outs (
  id, bus_id, school_id, client_name, purpose, start_at, end_at,
  quoted_amount, currency, status, notes
) values
(
  'e3400000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'Community burial committee',
  'burial',
  (current_date + 2)::timestamptz + interval '7 hours',
  (current_date + 2)::timestamptz + interval '18 hours',
  650000,
  'TZS',
  'booked',
  'Upcoming — bus CPP'
)
on conflict (id) do update set status = excluded.status;
