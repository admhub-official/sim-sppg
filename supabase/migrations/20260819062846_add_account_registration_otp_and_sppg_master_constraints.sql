create unique index if not exists ux_sppg_directory_sppg on public."SPPG_DIRECTORY" (lower(trim(sppg)));

create table if not exists public."ACCOUNT_REGISTRATION_OTP" (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  sppg text not null,
  yayasan text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  verified_at timestamptz,
  consumed_at timestamptz,
  auth_user_id text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_account_registration_otp_email_created on public."ACCOUNT_REGISTRATION_OTP" (lower(email), created_at desc);
create index if not exists idx_account_registration_otp_expires on public."ACCOUNT_REGISTRATION_OTP" (expires_at);

alter table public."ACCOUNT_REGISTRATION_OTP" enable row level security;

drop policy if exists account_registration_otp_no_direct_access on public."ACCOUNT_REGISTRATION_OTP";
create policy account_registration_otp_no_direct_access on public."ACCOUNT_REGISTRATION_OTP" for all to anon, authenticated using (false) with check (false);

create or replace function public.cleanup_account_registration_otp() returns trigger language plpgsql security definer set search_path=public as $$
begin
  delete from public."ACCOUNT_REGISTRATION_OTP" where expires_at < now() - interval '1 day';
  return new;
end;
$$;

drop trigger if exists trg_cleanup_account_registration_otp on public."ACCOUNT_REGISTRATION_OTP";
create trigger trg_cleanup_account_registration_otp after insert on public."ACCOUNT_REGISTRATION_OTP" for each statement execute function public.cleanup_account_registration_otp();
