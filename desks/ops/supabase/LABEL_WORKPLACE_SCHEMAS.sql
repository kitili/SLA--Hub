-- Label every workplace lane in the Ops Supabase project.
-- public stays Ops-only. Other systems live in their own schemas.
-- Do not expose these schemas in PostgREST until a system is cut over.

create schema if not exists shared;

comment on schema public is
  'OPS ONLY — transport, facilities, kitchen, farm, ticketing. No other system stores tables here.';
comment on schema shared is
  'HUB / CODE — cross-system directory (shared.people, shared.systems). Not Ops live data.';
comment on schema onboarding is
  'ONBOARDING ONLY — staff, policies, hiring, document reads, signatures.';
comment on schema marketing is
  'MARKETING ONLY — leads, brand, student experience. Isolated from Ops public.';
comment on schema data_tech is
  'DATA & TECH ONLY — tickets, tools, system boards, 1-5s.';
comment on schema talent is
  'TALENT ACADEMY ONLY — fellows, trainers, courses, certificates.';
comment on schema uniforms is
  'UNIFORMS ONLY — stores, tailoring, parent orders.';
comment on schema visitors is
  'VISITORS ONLY — front-desk visits.';
comment on schema workboard is
  'WORKBOARD / CODE TASKS ONLY — Daily 5, boards, tasks.';
comment on schema lesson_plans is
  'LESSON PLANS ONLY — plans, schemes, AI studio.';
comment on schema mel is
  'MEL ONLY — monitoring, evaluation, learning.';

create table if not exists shared.systems (
  id text primary key,
  name text not null,
  lane text not null,
  schema_name text not null unique,
  repo_folder text not null,
  live_url text not null,
  notes text not null
);

grant usage on schema shared to postgres, service_role, authenticated;
grant select on shared.systems to postgres, service_role, authenticated;

truncate shared.systems;

insert into shared.systems (id, name, lane, schema_name, repo_folder, live_url, notes) values
  ('hub', 'Hub / Code', 'CODE', 'shared', 'src/', 'https://sla-hub-nu.vercel.app',
   'Front door. People directory and this catalog. Do not put Ops tables here.'),
  ('ops', 'Ops', 'OPS', 'public', 'desks/ops', 'https://ops-transport-system.vercel.app',
   'Live Ops only. Other systems never write here.'),
  ('onboarding', 'Onboarding', 'ONBOARDING', 'onboarding', 'desks/onboarding', 'https://onboarding.silverleaf.co.tz',
   'Staff, policies, hiring, document reads, signatures.'),
  ('marketing', 'Marketing', 'MARKETING', 'marketing', 'desks/marketing', 'https://sla-marketing-web.vercel.app',
   'Leads, brand, student experience.'),
  ('data-tech', 'Data & Tech', 'DATA & TECH', 'data_tech', 'desks/data-tech', 'https://dataandtech.silverleaf.co.tz',
   'Tickets, tools, system boards.'),
  ('talent-academy', 'Talent Academy', 'TALENT ACADEMY', 'talent', 'desks/talent-academy', 'https://talent-academy-sla.vercel.app',
   'Fellows, trainers, courses, certificates.'),
  ('uniforms', 'Uniforms', 'UNIFORMS', 'uniforms', 'desks/uniforms', 'https://school-uniforms-lyart.vercel.app',
   'Stores, tailoring, parent orders.'),
  ('visitors', 'Visitors', 'VISITORS', 'visitors', 'desks/visitors', 'https://v-isitors.vercel.app',
   'Front-desk visits.'),
  ('workboard-tasks', 'Workboard Tasks', 'WORKBOARD', 'workboard', 'desks/workboard-tasks', 'https://silverleaf-tasks.vercel.app',
   'Daily 5, boards, tasks.'),
  ('lesson-plans', 'Lesson Plans', 'LESSON PLANS', 'lesson_plans', 'desks/lesson-plans', 'https://silverleaf-lesson-plans-main.vercel.app',
   'Plans, schemes, AI studio.'),
  ('mel-dashboard', 'MEL Dashboard', 'MEL', 'mel', 'desks/mel-dashboard', 'https://silverleafmeldashboard-production.up.railway.app/#overview',
   'Live Railway site. Source was not available to copy.');
