-- Remove Jfree QA test bus + campuses (FK order: bus first, then schools).
-- Safe to re-run (no-op if already gone).

delete from public.buses
where id = '06cb1ff7-879a-4a1c-900c-1dc208b6ef8f';

delete from public.schools
where id in (
  '36dc427b-cb57-4e71-8a6a-2c7b03871127',
  '728a95ea-948a-481a-bfe4-2e21b0770c0d'
);
