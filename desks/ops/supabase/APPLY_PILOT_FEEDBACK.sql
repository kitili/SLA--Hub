-- Pilot feedback: the "+" widget any logged-in user sees on every page during
-- the soft-launch pilot, so testing a department (Kitchen, Facilities, Farm,
-- Transport, etc.) can flag what needs fixing right where they noticed it.
-- Safe to re-run. Paste into Supabase SQL Editor -> Run.

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_by_label text not null,
  department text not null,
  page_path text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pilot_feedback_submitted_by
  on public.pilot_feedback (submitted_by);
create index if not exists idx_pilot_feedback_status
  on public.pilot_feedback (status);
create index if not exists idx_pilot_feedback_department
  on public.pilot_feedback (department);

alter table public.pilot_feedback enable row level security;

drop policy if exists "Anyone logged in can submit feedback" on public.pilot_feedback;
create policy "Anyone logged in can submit feedback"
  on public.pilot_feedback for insert
  with check (auth.uid() is not null);

drop policy if exists "Users see their own feedback" on public.pilot_feedback;
create policy "Users see their own feedback"
  on public.pilot_feedback for select
  using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "Admin manages all feedback" on public.pilot_feedback;
create policy "Admin manages all feedback"
  on public.pilot_feedback for update
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
