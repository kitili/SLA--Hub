-- Majundo Ops — matron parent-contact editing
-- Safe to run if schema_v1.sql was already applied earlier.
--
-- Matrons could only READ parents/student_parents ("Staff read parents" /
-- "Staff read student_parents" in schema_v1.sql); only admins could write
-- ("Admins manage parents" / "Admins manage student_parents"). The matron
-- app now lets a matron add or fix a parent's contact info for students on
-- her own bus when it's missing or wrong — that's an app-level business
-- rule (see saveParentContact / getStudentsForSession in the Next.js app),
-- not something expressed here. RLS just grants matron/driver insert+update
-- on these two tables — no delete, mirroring the read-only-elsewhere,
-- write-narrowly pattern already used for boarding_events/message_logs.

drop policy if exists "Staff insert parents" on public.parents;
create policy "Staff insert parents"
  on public.parents for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff update parents" on public.parents;
create policy "Staff update parents"
  on public.parents for update
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  )
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );

drop policy if exists "Staff insert student_parents" on public.student_parents;
create policy "Staff insert student_parents"
  on public.student_parents for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver')
  );
