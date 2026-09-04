-- Private, function-only document center for SIM-SPPG.
insert into storage.buckets (id, name, public, file_size_limit)
values ('sppg-documents', 'sppg-documents', false, 15728640)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

create table if not exists public."DOC_FOLDERS" (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public."DOC_FOLDERS"(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  sppg text not null default '',
  yayasan text not null default '',
  is_template boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create table if not exists public."DOC_FILES" (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public."DOC_FOLDERS"(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 240),
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sppg text not null default '',
  yayasan text not null default '',
  is_template boolean not null default false,
  classification text not null default 'INTERNAL'
    check (classification in ('INTERNAL','SPPG_RESTRICTED','CONFIDENTIAL','PERSONAL_DATA')),
  source_type text not null default 'UPLOAD'
    check (source_type in ('UPLOAD','IN_APP')),
  created_by uuid not null references auth.users(id),
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create table if not exists public."DOC_FAVORITES" (
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public."DOC_FILES"(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, file_id)
);

create table if not exists public."DOC_AUDIT_LOG" (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  user_email text not null,
  user_role text not null,
  action text not null,
  entity_type text not null check (entity_type in ('FILE','FOLDER')),
  entity_id uuid,
  entity_name text not null,
  sppg text not null default '',
  yayasan text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists doc_folders_scope_parent_idx
  on public."DOC_FOLDERS" (sppg, yayasan, parent_id) where deleted_at is null;
create index if not exists doc_files_scope_folder_idx
  on public."DOC_FILES" (sppg, yayasan, folder_id) where deleted_at is null;
create index if not exists doc_files_name_search_idx
  on public."DOC_FILES" using gin (to_tsvector('simple', name));
create unique index if not exists doc_folders_unique_active_name
  on public."DOC_FOLDERS" (
    sppg,
    yayasan,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name),
    is_template
  ) where deleted_at is null;

alter table public."DOC_FOLDERS" enable row level security;
alter table public."DOC_FILES" enable row level security;
alter table public."DOC_FAVORITES" enable row level security;
alter table public."DOC_AUDIT_LOG" enable row level security;

revoke all on table public."DOC_FOLDERS" from anon, authenticated;
revoke all on table public."DOC_FILES" from anon, authenticated;
revoke all on table public."DOC_FAVORITES" from anon, authenticated;
revoke all on table public."DOC_AUDIT_LOG" from anon, authenticated;
revoke all on sequence public."DOC_AUDIT_LOG_id_seq" from anon, authenticated;

-- No storage.objects policy is intentionally added: objects are only accessed
-- by the authenticated Edge Function after checking SPPG scope.
