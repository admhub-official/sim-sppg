begin;

update public."USERS"
set "ROLE" = 'USER'
where "ROLE" is null or btrim("ROLE") = '';

alter table public."USERS"
  alter column "ROLE" set default 'USER',
  alter column "ROLE" set not null;

alter table public."USERS"
  drop constraint if exists users_role_normalized_check;

alter table public."USERS"
  add constraint users_role_normalized_check
  check ("ROLE" = any (array['USER'::text, 'ADMIN'::text, 'SUPER_ADMIN'::text]));

commit;
