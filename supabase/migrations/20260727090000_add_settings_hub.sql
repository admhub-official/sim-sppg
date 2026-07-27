create table if not exists public."APP_ANNOUNCEMENTS" (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  target_roles text[] not null,
  priority text not null default 'INFORMASI'
    check (priority in ('INFORMASI', 'PENTING', 'MENDESAK')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  constraint app_announcements_roles_check
    check (
      cardinality(target_roles) > 0
      and target_roles <@ array['ADMIN', 'USER']::text[]
    ),
  constraint app_announcements_period_check
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists app_announcements_active_period_idx
  on public."APP_ANNOUNCEMENTS" (is_active, starts_at desc, ends_at);
create index if not exists app_announcements_created_by_idx
  on public."APP_ANNOUNCEMENTS" (created_by);

alter table public."APP_ANNOUNCEMENTS" enable row level security;
revoke all on table public."APP_ANNOUNCEMENTS" from anon, authenticated;
grant all on table public."APP_ANNOUNCEMENTS" to service_role;

drop policy if exists "service_role_only" on public."APP_ANNOUNCEMENTS";
create policy "service_role_only"
  on public."APP_ANNOUNCEMENTS"
  for all
  to service_role
  using (true)
  with check (true);

insert into public."APP_SETTINGS" ("KEY", "VALUE") values
  (
    'MENU_VISIBILITY_SUPER_ADMIN',
    '["dashboard","profil","settings","transaksi","approval","pending-payment","audit-log","master-bahan","master-supplier","survei","serah-terima","menu-mbg","laporan"]'
  ),
  (
    'MENU_VISIBILITY_ADMIN',
    '["dashboard","profil","users","transaksi","approval","pending-payment","audit-log","master-bahan","master-supplier","survei","serah-terima","menu-mbg","laporan"]'
  ),
  (
    'MENU_VISIBILITY_USER',
    '["dashboard","profil","transaksi","approval","pending-payment","survei","serah-terima","master-supplier"]'
  )
on conflict ("KEY") do nothing;
