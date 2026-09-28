-- Majundo Ops — Day 6 additive schema
-- Safe to run if schema_v1.sql was already applied earlier.
-- Adds: message_logs for parent SMS / WhatsApp audit.

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete set null,
  parent_phone text not null,
  channel text not null default 'sms'
    check (channel in ('sms', 'whatsapp', 'stub')),
  provider text not null default 'stub',
  template_key text,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  boarding_event_id uuid references public.boarding_events (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_message_logs_created_at
  on public.message_logs (created_at desc);

create index if not exists idx_message_logs_student_id
  on public.message_logs (student_id);

alter table public.message_logs enable row level security;

drop policy if exists "Staff read message_logs" on public.message_logs;
create policy "Staff read message_logs"
  on public.message_logs for select
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff insert message_logs" on public.message_logs;
create policy "Staff insert message_logs"
  on public.message_logs for insert
  to authenticated
  with check (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );

drop policy if exists "Staff update message_logs" on public.message_logs;
create policy "Staff update message_logs"
  on public.message_logs for update
  to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('matron', 'driver', 'finance')
  );
