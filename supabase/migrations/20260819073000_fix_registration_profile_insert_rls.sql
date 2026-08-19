create or replace function public.create_user_profile_by_registration(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_sppg text,
  p_yayasan text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  master_yayasan text;
begin
  select upper(regexp_replace(coalesce("ROLE", ''), '\\s+', '_', 'g'))
    into actor_role
  from public."USERS"
  where "ID" = p_actor_id;

  if actor_role <> 'SUPER_ADMIN' then
    raise exception 'Hanya SUPER_ADMIN yang dapat membuat akun USER.' using errcode = '42501';
  end if;

  select d.yayasan into master_yayasan
  from public."SPPG_DIRECTORY" d
  where upper(btrim(d.sppg)) = upper(btrim(p_sppg));

  if master_yayasan is null then
    raise exception 'SPPG tidak ditemukan di Master SPPG.' using errcode = '23514';
  end if;

  if upper(btrim(master_yayasan)) <> upper(btrim(p_yayasan)) then
    raise exception 'Yayasan tidak sesuai Master SPPG.' using errcode = '23514';
  end if;

  insert into public."USERS" (
    "ID", "NAMA LENGKAP", "EMAIL", "JABATAN", "SPPG", "ROLE",
    "FOTO PROFIL", "TIMESTAMP", "user", "USERNAME", "NAMA YAYASAN"
  ) values (
    p_user_id,
    lower(btrim(p_email)),
    lower(btrim(p_email)),
    '',
    upper(btrim(p_sppg)),
    'USER',
    '',
    now(),
    lower(btrim(p_email)),
    lower(btrim(p_email)),
    master_yayasan
  );
end;
$$;

revoke all on function public.create_user_profile_by_registration(uuid, uuid, text, text, text) from public;
grant execute on function public.create_user_profile_by_registration(uuid, uuid, text, text, text) to service_role;
