-- Isolated department schemas inside the Ops Supabase project.
-- Ops live tables stay in public. These schemas are empty until a later cutover.
-- Do not add them to PostgREST "Exposed schemas" until a system is ready to use them.

create schema if not exists onboarding;
create schema if not exists talent;
create schema if not exists lesson_plans;
create schema if not exists workboard;
create schema if not exists uniforms;
create schema if not exists marketing;
create schema if not exists data_tech;
create schema if not exists visitors;
create schema if not exists mel;

comment on schema onboarding is 'Silverleaf Onboarding — empty until cutover; live site unchanged';
comment on schema talent is 'Silverleaf Talent Academy — empty until cutover; live site unchanged';
comment on schema lesson_plans is 'Silverleaf Lesson Plans — empty until cutover; live site unchanged';
comment on schema workboard is 'Silverleaf Workboard Tasks — empty until cutover; live site unchanged';
comment on schema uniforms is 'Silverleaf Uniforms — empty until cutover; live site unchanged';
comment on schema marketing is 'Silverleaf Marketing — empty until cutover; live site unchanged';
comment on schema data_tech is 'Silverleaf Data & Tech — empty until cutover; live site unchanged';
comment on schema visitors is 'Silverleaf Visitors — empty until cutover; live site unchanged';
comment on schema mel is 'Silverleaf MEL Dashboard — empty until cutover; live site unchanged';

revoke all on schema onboarding, talent, lesson_plans, workboard, uniforms, marketing, data_tech, visitors, mel from public;

grant usage, create on schema onboarding, talent, lesson_plans, workboard, uniforms, marketing, data_tech, visitors, mel
  to postgres, service_role;
