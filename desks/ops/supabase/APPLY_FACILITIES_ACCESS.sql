-- Widen Facilities RLS so Ops hub roles can see sheet-imported data.
-- Previously admin-only — finance / ops_manager / finance_manager / cfo
-- got empty lists (list* helpers return [] on RLS errors).
-- Safe to re-run. Paste into Supabase SQL Editor → Run.

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

notify pgrst, 'reload schema';
