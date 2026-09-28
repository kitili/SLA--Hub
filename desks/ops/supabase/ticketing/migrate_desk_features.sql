-- Desk feature pack: attachments, owner_uid (auth), campus leads
-- Run AFTER migrate_desk_upgrades.sql. Safe to re-run.
-- After: notify pgrst, 'reload schema';
-- Also create Storage bucket "desk-attachments" (Dashboard → Storage) if RPC below fails.

alter table public.requests
  add column if not exists owner_uid uuid;

create index if not exists idx_requests_owner_uid
  on public.requests (owner_uid)
  where owner_uid is not null;

create table if not exists public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.requests (id) on delete cascade,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  storage_path text not null,
  public_url text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_request_attachments_request
  on public.request_attachments (request_id);

alter table public.request_attachments enable row level security;

drop policy if exists "desk_attachments_select" on public.request_attachments;
drop policy if exists "desk_attachments_insert" on public.request_attachments;

create policy "desk_attachments_select"
  on public.request_attachments for select to anon, authenticated
  using (true);

create policy "desk_attachments_insert"
  on public.request_attachments for insert to anon, authenticated
  with check (true);

-- Campus lead contacts (manager can edit via Settings → stored in settings)
insert into public.settings (key, value) values
  (
    'campus_leads',
    '{
      "Usariver Campus":{"name":"Usariver lead","phone":"","email":""},
      "Arusha Modern Campus":{"name":"Arusha Modern lead","phone":"","email":""},
      "Kijenge Campus":{"name":"Kijenge lead","phone":"","email":""},
      "Ilboru Campus":{"name":"Ilboru lead","phone":"","email":""},
      "Boma Campus":{"name":"Boma lead","phone":"","email":""}
    }'
  ),
  ('desk_notify_manager', 'true'),
  ('sla_urgent_hours', '4')
on conflict (key) do nothing;

-- Public storage bucket for desk photos (ignore if already exists / no permission)
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'desk-attachments',
    'desk-attachments',
    true,
    5242880,
    array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
  )
  on conflict (id) do update set public = excluded.public;
exception
  when others then
    raise notice 'Storage bucket desk-attachments not created automatically — create it in Dashboard → Storage.';
end $$;

drop policy if exists "desk_storage_read" on storage.objects;
drop policy if exists "desk_storage_insert" on storage.objects;

do $$
begin
  create policy "desk_storage_read"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'desk-attachments');
  create policy "desk_storage_insert"
    on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'desk-attachments');
exception
  when duplicate_object then null;
  when others then
    raise notice 'Storage policies skipped: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
