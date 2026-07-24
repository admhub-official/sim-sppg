begin;

create table if not exists public."SPPG_DIRECTORY" (
  sppg text primary key,
  yayasan text not null,
  source text not null default 'AUTO_DERIVED',
  updated_at timestamptz not null default now(),
  constraint sppg_directory_sppg_not_blank check (nullif(btrim(sppg), '') is not null),
  constraint sppg_directory_yayasan_not_blank check (nullif(btrim(yayasan), '') is not null)
);

with candidates as (
  select upper(btrim("SPPG")) as sppg, btrim("YAYASAN") as yayasan, count(*)::bigint * 100 as score
  from public."TRANSAKSI"
  where nullif(btrim(coalesce("SPPG", '')), '') is not null
    and nullif(btrim(coalesce("YAYASAN", '')), '') is not null
  group by 1, 2
  union all
  select upper(btrim("SPPG")), btrim("NAMA YAYASAN"), count(*)::bigint * 10
  from public."USERS"
  where nullif(btrim(coalesce("SPPG", '')), '') is not null
    and nullif(btrim(coalesce("NAMA YAYASAN", '')), '') is not null
  group by 1, 2
  union all
  select upper(btrim(sppg)), btrim(yayasan), count(*)::bigint
  from public."ADMIN_ASSIGNMENT"
  where nullif(btrim(coalesce(sppg, '')), '') is not null
    and nullif(btrim(coalesce(yayasan, '')), '') is not null
  group by 1, 2
), aggregated as (
  select sppg, yayasan, sum(score) as score
  from candidates
  group by sppg, yayasan
), ranked as (
  select sppg, yayasan, score,
         row_number() over (partition by sppg order by score desc, length(yayasan) desc, yayasan) as rn
  from aggregated
)
insert into public."SPPG_DIRECTORY" (sppg, yayasan, source, updated_at)
select sppg, yayasan, 'AUTO_DERIVED_FROM_EXISTING_DATA', now()
from ranked
where rn = 1
on conflict (sppg) do update
set yayasan = excluded.yayasan,
    source = excluded.source,
    updated_at = now();

select set_config('app.secure_user_profile_update', '1', true);

update public."USERS" u
set "NAMA YAYASAN" = d.yayasan
from public."SPPG_DIRECTORY" d
where nullif(btrim(coalesce(u."NAMA YAYASAN", '')), '') is null
  and upper(btrim(coalesce(u."SPPG", ''))) = d.sppg;

update public."TRANSAKSI" t
set "YAYASAN" = d.yayasan
from public."SPPG_DIRECTORY" d
where nullif(btrim(coalesce(t."YAYASAN", '')), '') is null
  and upper(btrim(coalesce(t."SPPG", ''))) = d.sppg;

create or replace function public.fill_user_yayasan_from_sppg()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if nullif(btrim(coalesce(new."NAMA YAYASAN", '')), '') is null
     and nullif(btrim(coalesce(new."SPPG", '')), '') is not null then
    select d.yayasan into new."NAMA YAYASAN"
    from public."SPPG_DIRECTORY" d
    where d.sppg = upper(btrim(new."SPPG"));
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_fill_user_yayasan_from_sppg on public."USERS";
create trigger trg_fill_user_yayasan_from_sppg
before insert or update of "SPPG", "NAMA YAYASAN"
on public."USERS"
for each row execute function public.fill_user_yayasan_from_sppg();

create or replace function public.fill_transaction_yayasan_from_sppg()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if nullif(btrim(coalesce(new."YAYASAN", '')), '') is null
     and nullif(btrim(coalesce(new."SPPG", '')), '') is not null then
    select d.yayasan into new."YAYASAN"
    from public."SPPG_DIRECTORY" d
    where d.sppg = upper(btrim(new."SPPG"));
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_fill_transaction_yayasan_from_sppg on public."TRANSAKSI";
create trigger trg_fill_transaction_yayasan_from_sppg
before insert or update of "SPPG", "YAYASAN"
on public."TRANSAKSI"
for each row execute function public.fill_transaction_yayasan_from_sppg();

revoke all on public."SPPG_DIRECTORY" from anon, authenticated;
grant select on public."SPPG_DIRECTORY" to service_role;

comment on table public."SPPG_DIRECTORY" is
  'Canonical mapping used to resolve YAYASAN automatically when transaction forms only provide SPPG.';

commit;
