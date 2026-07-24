begin;

-- Move path-like values from legacy link columns into canonical columns.
update public."TRANSAKSI"
set "NOTA PEMBELIAN" = btrim("LINK FOTO NOTA")
where nullif(btrim(coalesce("NOTA PEMBELIAN", '')), '') is null
  and nullif(btrim(coalesce("LINK FOTO NOTA", '')), '') is not null
  and btrim("LINK FOTO NOTA") !~* '^https?://';

update public."TRANSAKSI"
set "TTD USER" = btrim("LINK  TTD USER")
where nullif(btrim(coalesce("TTD USER", '')), '') is null
  and nullif(btrim(coalesce("LINK  TTD USER", '')), '') is not null
  and btrim("LINK  TTD USER") !~* '^https?://';

update public."TRANSAKSI" t
set "UPLOUD FOTO" = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
where nullif(btrim(coalesce(t."UPLOUD FOTO", '')), '') is null
  and nullif(btrim(coalesce(t."LINK FOTO/ FILE  BUKTI TRANSAKSI", '')), '') is not null
  and btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI") !~* '^https?://'
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'bukti-payment'
      and o.name = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
  )
  and (
    btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI") ~* '\.(png|jpe?g|webp|heic|heif)$'
    or exists (
      select 1 from storage.objects o
      where o.bucket_id = 'transaksi-images'
        and o.name = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
    )
  );

update public."TRANSAKSI" t
set "UPLOUD FILE" = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
where nullif(btrim(coalesce(t."UPLOUD FILE", '')), '') is null
  and nullif(btrim(coalesce(t."LINK FOTO/ FILE  BUKTI TRANSAKSI", '')), '') is not null
  and btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI") !~* '^https?://'
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'bukti-payment'
      and o.name = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
  )
  and (
    btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI") ~* '\.pdf$'
    or exists (
      select 1 from storage.objects o
      where o.bucket_id = 'transaksi-files'
        and o.name = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
    )
  );

-- Preserve path-based approval evidence in the normalized payment-proof table.
insert into public."TRANSAKSI_PAYMENT_PROOFS" (
  transaksi_id, payment_sequence, nominal, storage_bucket, storage_path,
  mime_type, original_file_name, submitted_by, submitted_at, status,
  verified_by, verified_at, verifier_signature_path, verification_notes,
  created_at, updated_at
)
select
  t."ID",
  coalesce((select max(p.payment_sequence) from public."TRANSAKSI_PAYMENT_PROOFS" p where p.transaksi_id = t."ID"), 0) + 1,
  coalesce(t."Nominal", 0),
  'bukti-payment',
  btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI"),
  case
    when lower(btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")) like '%.pdf' then 'application/pdf'
    when lower(btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")) like '%.png' then 'image/png'
    when lower(btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")) like '%.webp' then 'image/webp'
    when lower(btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")) like '%.heic' then 'image/heic'
    when lower(btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")) like '%.heif' then 'image/heif'
    else 'image/jpeg'
  end,
  regexp_replace(btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI"), '^.*/', ''),
  coalesce(nullif(lower(btrim(t."User")), ''), nullif(lower(btrim(t."APPROVED BY")), ''), 'legacy-migration'),
  coalesce(t."WAKTU APPROVE", t."Timestamp", now()),
  case when upper(coalesce(t."Metode Transaksi", '')) in ('SUDAH_DIBAYAR', 'LUNAS') then 'TERVERIFIKASI' else 'MENUNGGU_VERIFIKASI' end,
  case when upper(coalesce(t."Metode Transaksi", '')) in ('SUDAH_DIBAYAR', 'LUNAS') then coalesce(nullif(lower(btrim(t."APPROVED BY")), ''), nullif(lower(btrim(t."User")), '')) else null end,
  case when upper(coalesce(t."Metode Transaksi", '')) in ('SUDAH_DIBAYAR', 'LUNAS') then coalesce(t."WAKTU APPROVE", t."Timestamp", now()) else null end,
  nullif(btrim(coalesce(t."TTD VERIFIKATOR", '')), ''),
  nullif(btrim(coalesce(t."Catatan Approval", t."Catatan_1", '')), ''),
  coalesce(t."WAKTU APPROVE", t."Timestamp", now()),
  now()
from public."TRANSAKSI" t
where nullif(btrim(coalesce(t."LINK FOTO/ FILE  BUKTI TRANSAKSI", '')), '') is not null
  and btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI") !~* '^https?://'
  and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'bukti-payment'
      and o.name = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
  )
  and not exists (
    select 1 from public."TRANSAKSI_PAYMENT_PROOFS" p
    where p.transaksi_id = t."ID"
      and p.storage_bucket = 'bukti-payment'
      and p.storage_path = btrim(t."LINK FOTO/ FILE  BUKTI TRANSAKSI")
  );

-- Rebuild normalized document metadata from canonical path columns.
insert into public."TRANSAKSI_DOCUMENTS" (
  transaksi_id, document_type, storage_bucket, storage_path, mime_type,
  original_file_name, uploaded_by, source, legacy_source_column, created_at, updated_at
)
select * from (
  select t."ID", 'FOTO_TRANSAKSI', 'transaksi-images', btrim(t."UPLOUD FOTO"),
    case
      when lower(btrim(t."UPLOUD FOTO")) like '%.png' then 'image/png'
      when lower(btrim(t."UPLOUD FOTO")) like '%.webp' then 'image/webp'
      when lower(btrim(t."UPLOUD FOTO")) like '%.heic' then 'image/heic'
      when lower(btrim(t."UPLOUD FOTO")) like '%.heif' then 'image/heif'
      else 'image/jpeg'
    end,
    regexp_replace(btrim(t."UPLOUD FOTO"), '^.*/', ''), t."User", 'CANONICAL_COLUMN', 'UPLOUD FOTO', coalesce(t."Timestamp", now()), now()
  from public."TRANSAKSI" t
  where nullif(btrim(coalesce(t."UPLOUD FOTO", '')), '') is not null
    and btrim(t."UPLOUD FOTO") !~* '^https?://'
    and upper(btrim(t."UPLOUD FOTO")) not in ('-', 'FOTO', 'FILE')

  union all
  select t."ID", 'FILE_TRANSAKSI', 'transaksi-files', btrim(t."UPLOUD FILE"),
    case when lower(btrim(t."UPLOUD FILE")) like '%.pdf' then 'application/pdf' else 'application/octet-stream' end,
    regexp_replace(btrim(t."UPLOUD FILE"), '^.*/', ''), t."User", 'CANONICAL_COLUMN', 'UPLOUD FILE', coalesce(t."Timestamp", now()), now()
  from public."TRANSAKSI" t
  where nullif(btrim(coalesce(t."UPLOUD FILE", '')), '') is not null
    and btrim(t."UPLOUD FILE") !~* '^https?://'
    and upper(btrim(t."UPLOUD FILE")) not in ('-', 'FOTO', 'FILE')

  union all
  select t."ID", 'NOTA_PEMBELIAN', 'nota-pembelian', btrim(t."NOTA PEMBELIAN"),
    case
      when lower(btrim(t."NOTA PEMBELIAN")) like '%.pdf' then 'application/pdf'
      when lower(btrim(t."NOTA PEMBELIAN")) like '%.png' then 'image/png'
      when lower(btrim(t."NOTA PEMBELIAN")) like '%.webp' then 'image/webp'
      when lower(btrim(t."NOTA PEMBELIAN")) like '%.heic' then 'image/heic'
      when lower(btrim(t."NOTA PEMBELIAN")) like '%.heif' then 'image/heif'
      else 'image/jpeg'
    end,
    regexp_replace(btrim(t."NOTA PEMBELIAN"), '^.*/', ''), t."User", 'CANONICAL_COLUMN', 'NOTA PEMBELIAN', coalesce(t."Timestamp", now()), now()
  from public."TRANSAKSI" t
  where nullif(btrim(coalesce(t."NOTA PEMBELIAN", '')), '') is not null
    and btrim(t."NOTA PEMBELIAN") !~* '^https?://'
    and upper(btrim(t."NOTA PEMBELIAN")) not in ('-', 'FOTO', 'FILE')

  union all
  select t."ID", 'TTD_USER', 'paraf-user', btrim(t."TTD USER"),
    case when lower(btrim(t."TTD USER")) like '%.webp' then 'image/webp' when lower(btrim(t."TTD USER")) like '%.jpg' or lower(btrim(t."TTD USER")) like '%.jpeg' then 'image/jpeg' else 'image/png' end,
    regexp_replace(btrim(t."TTD USER"), '^.*/', ''), t."User", 'CANONICAL_COLUMN', 'TTD USER', coalesce(t."Timestamp", now()), now()
  from public."TRANSAKSI" t
  where nullif(btrim(coalesce(t."TTD USER", '')), '') is not null
    and btrim(t."TTD USER") !~* '^https?://'
    and upper(btrim(t."TTD USER")) not in ('-', 'FOTO', 'FILE')

  union all
  select t."ID", 'TTD_VERIFIKATOR_LEGACY', 'paraf-verifikator', btrim(t."TTD VERIFIKATOR"),
    case when lower(btrim(t."TTD VERIFIKATOR")) like '%.webp' then 'image/webp' when lower(btrim(t."TTD VERIFIKATOR")) like '%.jpg' or lower(btrim(t."TTD VERIFIKATOR")) like '%.jpeg' then 'image/jpeg' else 'image/png' end,
    regexp_replace(btrim(t."TTD VERIFIKATOR"), '^.*/', ''), coalesce(t."APPROVED BY", t."User"), 'CANONICAL_COLUMN', 'TTD VERIFIKATOR', coalesce(t."WAKTU APPROVE", t."Timestamp", now()), now()
  from public."TRANSAKSI" t
  where nullif(btrim(coalesce(t."TTD VERIFIKATOR", '')), '') is not null
    and btrim(t."TTD VERIFIKATOR") !~* '^https?://'
    and upper(btrim(t."TTD VERIFIKATOR")) not in ('-', 'FOTO', 'FILE')
) as canonical_docs(
  transaksi_id, document_type, storage_bucket, storage_path, mime_type,
  original_file_name, uploaded_by, source, legacy_source_column, created_at, updated_at
)
on conflict (transaksi_id, document_type)
do update set
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  mime_type = excluded.mime_type,
  original_file_name = excluded.original_file_name,
  uploaded_by = excluded.uploaded_by,
  source = excluded.source,
  legacy_source_column = excluded.legacy_source_column,
  updated_at = now();

-- Remove Google Drive metadata and the obsolete approval-document mirror.
delete from public."TRANSAKSI_DOCUMENTS"
where storage_path ~* '(drive\.google\.com|docs\.google\.com)';

delete from public."TRANSAKSI_DOCUMENTS"
where document_type = 'BUKTI_APPROVAL_LEGACY';

create or replace function public.sync_transaction_legacy_documents_to_normalized()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item record;
begin
  for v_item in
    select * from (values
      ('FOTO_TRANSAKSI','transaksi-images',new."UPLOUD FOTO",'UPLOUD FOTO'),
      ('FILE_TRANSAKSI','transaksi-files',new."UPLOUD FILE",'UPLOUD FILE'),
      ('TTD_USER','paraf-user',new."TTD USER",'TTD USER'),
      ('NOTA_PEMBELIAN','nota-pembelian',new."NOTA PEMBELIAN",'NOTA PEMBELIAN'),
      ('TTD_VERIFIKATOR_LEGACY','paraf-verifikator',new."TTD VERIFIKATOR",'TTD VERIFIKATOR')
    ) as x(document_type, storage_bucket, storage_path, source_column)
  loop
    delete from public."TRANSAKSI_DOCUMENTS"
    where transaksi_id = new."ID"
      and document_type = v_item.document_type
      and storage_path is distinct from nullif(btrim(coalesce(v_item.storage_path,'')), '');

    if nullif(btrim(coalesce(v_item.storage_path,'')), '') is not null
       and upper(btrim(v_item.storage_path)) not in ('-','FOTO','FILE')
       and btrim(v_item.storage_path) !~* '^https?://' then
      insert into public."TRANSAKSI_DOCUMENTS" (
        transaksi_id, document_type, storage_bucket, storage_path, original_file_name,
        uploaded_by, source, legacy_source_column, created_at, updated_at
      ) values (
        new."ID", v_item.document_type, v_item.storage_bucket, btrim(v_item.storage_path),
        regexp_replace(btrim(v_item.storage_path), '^.*/', ''),
        coalesce(new."User", new."APPROVED BY"), 'CANONICAL_COLUMN', v_item.source_column,
        coalesce(new."Timestamp", now()), now()
      )
      on conflict (transaksi_id, document_type)
      do update set
        storage_bucket = excluded.storage_bucket,
        storage_path = excluded.storage_path,
        original_file_name = excluded.original_file_name,
        uploaded_by = excluded.uploaded_by,
        source = excluded.source,
        legacy_source_column = excluded.legacy_source_column,
        updated_at = now();
    end if;
  end loop;

  if nullif(btrim(coalesce(new."Catatan_1",'')), '') is not null
     and nullif(btrim(coalesce(new."Catatan Approval",'')), '') is null then
    new."Catatan Approval" := new."Catatan_1";
  elsif tg_op = 'UPDATE' and new."Catatan Approval" is distinct from old."Catatan Approval" then
    new."Catatan_1" := new."Catatan Approval";
  end if;

  return new;
end;
$function$;

create or replace function public.sync_normalized_document_to_transaction_legacy()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    case old.document_type
      when 'FOTO_TRANSAKSI' then update public."TRANSAKSI" set "UPLOUD FOTO" = null where "ID" = old.transaksi_id and "UPLOUD FOTO" = old.storage_path;
      when 'FILE_TRANSAKSI' then update public."TRANSAKSI" set "UPLOUD FILE" = null where "ID" = old.transaksi_id and "UPLOUD FILE" = old.storage_path;
      when 'TTD_USER' then update public."TRANSAKSI" set "TTD USER" = null where "ID" = old.transaksi_id and "TTD USER" = old.storage_path;
      when 'NOTA_PEMBELIAN' then update public."TRANSAKSI" set "NOTA PEMBELIAN" = null where "ID" = old.transaksi_id and "NOTA PEMBELIAN" = old.storage_path;
      when 'TTD_VERIFIKATOR_LEGACY' then update public."TRANSAKSI" set "TTD VERIFIKATOR" = null where "ID" = old.transaksi_id and "TTD VERIFIKATOR" = old.storage_path;
      else null;
    end case;
    return old;
  end if;

  case new.document_type
    when 'FOTO_TRANSAKSI' then update public."TRANSAKSI" set "UPLOUD FOTO" = new.storage_path where "ID" = new.transaksi_id;
    when 'FILE_TRANSAKSI' then update public."TRANSAKSI" set "UPLOUD FILE" = new.storage_path where "ID" = new.transaksi_id;
    when 'TTD_USER' then update public."TRANSAKSI" set "TTD USER" = new.storage_path where "ID" = new.transaksi_id;
    when 'NOTA_PEMBELIAN' then update public."TRANSAKSI" set "NOTA PEMBELIAN" = new.storage_path where "ID" = new.transaksi_id;
    when 'TTD_VERIFIKATOR_LEGACY' then update public."TRANSAKSI" set "TTD VERIFIKATOR" = new.storage_path where "ID" = new.transaksi_id;
    else null;
  end case;
  return new;
end;
$function$;

create or replace function public.sync_transaction_document_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  missing_parts text[] := array[]::text[];
  has_foto boolean;
  has_file boolean;
  has_bukti boolean;
  has_ttd boolean;
  has_nota boolean;
begin
  has_foto := nullif(trim(coalesce(new."UPLOUD FOTO", '')), '') is not null
    and exists (select 1 from storage.objects o where o.bucket_id = 'transaksi-images' and o.name = trim(new."UPLOUD FOTO"));
  has_file := nullif(trim(coalesce(new."UPLOUD FILE", '')), '') is not null
    and exists (select 1 from storage.objects o where o.bucket_id = 'transaksi-files' and o.name = trim(new."UPLOUD FILE"));
  has_bukti := has_foto or has_file;
  has_ttd := nullif(trim(coalesce(new."TTD USER", '')), '') is not null
    and exists (select 1 from storage.objects o where o.bucket_id = 'paraf-user' and o.name = trim(new."TTD USER"));
  has_nota := nullif(trim(coalesce(new."NOTA PEMBELIAN", '')), '') is not null
    and exists (select 1 from storage.objects o where o.bucket_id = 'nota-pembelian' and o.name = trim(new."NOTA PEMBELIAN"));

  if not has_bukti then missing_parts := array_append(missing_parts, 'Bukti Transaksi'); end if;
  if not has_ttd then missing_parts := array_append(missing_parts, 'TTD User'); end if;
  if not has_nota then missing_parts := array_append(missing_parts, 'Nota Pembelian'); end if;

  if cardinality(missing_parts) = 0 then
    new."STATUS DOKUMEN" := 'Dokumen Lengkap';
  else
    new."STATUS DOKUMEN" := 'Dokumen Tidak Lengkap: ' || array_to_string(missing_parts, ', ');
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sync_transaction_documents on public."TRANSAKSI";
create trigger trg_sync_transaction_documents
before insert or update of "UPLOUD FOTO", "UPLOUD FILE", "TTD USER", "NOTA PEMBELIAN", "TTD VERIFIKATOR", "Catatan_1", "Catatan Approval"
on public."TRANSAKSI"
for each row execute function public.sync_transaction_legacy_documents_to_normalized();

create or replace function public.approve_transaction_direct_atomic(
  p_transaksi_id text,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_original_file_name text,
  p_verified_by text,
  p_verified_name text,
  p_verification_notes text default '',
  p_verifier_signature_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tx public."TRANSAKSI"%rowtype;
  v_submitted numeric := 0;
  v_remaining numeric := 0;
  v_seq integer := 0;
  v_proof_id uuid;
  v_now timestamptz := now();
begin
  if coalesce(trim(p_storage_path), '') = '' then raise exception 'Bukti pelunasan wajib tersedia.'; end if;
  if coalesce(trim(p_verifier_signature_path), '') = '' then raise exception 'TTD verifikator wajib tersedia.'; end if;

  select * into v_tx from public."TRANSAKSI" where "ID" = p_transaksi_id for update;
  if not found then raise exception 'Transaksi tidak ditemukan.'; end if;
  if upper(coalesce(v_tx."Metode Transaksi", '')) = 'SUDAH_DIBAYAR' then raise exception 'Transaksi sudah dibayar.'; end if;

  select coalesce(sum(nominal) filter (where status <> 'DITOLAK'), 0), coalesce(max(payment_sequence), 0)
  into v_submitted, v_seq
  from public."TRANSAKSI_PAYMENT_PROOFS"
  where transaksi_id = p_transaksi_id;

  v_remaining := greatest(coalesce(v_tx."Nominal", 0) - v_submitted, 0);

  update public."TRANSAKSI_PAYMENT_PROOFS"
  set status = 'TERVERIFIKASI', verified_by = lower(trim(p_verified_by)), verified_at = v_now,
      verifier_signature_path = trim(p_verifier_signature_path), verification_notes = trim(coalesce(p_verification_notes, '')), updated_at = v_now
  where transaksi_id = p_transaksi_id and status = 'MENUNGGU_VERIFIKASI';

  if v_remaining > 0 then
    insert into public."TRANSAKSI_PAYMENT_PROOFS"(
      transaksi_id, payment_sequence, nominal, storage_bucket, storage_path,
      mime_type, original_file_name, submitted_by, submitted_at, status,
      verified_by, verified_at, verifier_signature_path, verification_notes
    ) values (
      p_transaksi_id, v_seq + 1, v_remaining, trim(p_storage_bucket), trim(p_storage_path),
      nullif(trim(coalesce(p_mime_type, '')), ''), nullif(trim(coalesce(p_original_file_name, '')), ''),
      lower(trim(p_verified_by)), v_now, 'TERVERIFIKASI', lower(trim(p_verified_by)), v_now,
      trim(p_verifier_signature_path), trim(coalesce(p_verification_notes, ''))
    ) returning id into v_proof_id;
  end if;

  update public."TRANSAKSI"
  set "Metode Transaksi" = 'SUDAH_DIBAYAR',
      "APPROVED BY" = coalesce(nullif(trim(p_verified_name), ''), lower(trim(p_verified_by))),
      "WAKTU APPROVE" = v_now,
      "Catatan_1" = trim(coalesce(p_verification_notes, '')),
      "TTD VERIFIKATOR" = trim(p_verifier_signature_path),
      "Deskripsi" = jsonb_build_object(
        'nominalDibayar', coalesce("Nominal", 0),
        'sisaPembayaran', 0,
        'verifiedBy', lower(trim(p_verified_by)),
        'verifiedAt', v_now
      )::text
  where "ID" = p_transaksi_id;

  return jsonb_build_object(
    'proofId', v_proof_id,
    'directPaymentAmount', v_remaining,
    'totalVerified', coalesce(v_tx."Nominal", 0),
    'status', 'SUDAH_DIBAYAR'
  );
end;
$function$;

alter table public."TRANSAKSI"
  drop column if exists "LINK FOTO/ FILE  BUKTI TRANSAKSI",
  drop column if exists "LINK FOTO NOTA",
  drop column if exists "LINK  TTD USER";

-- Recalculate stored status through the storage-aware trigger.
update public."TRANSAKSI" set "UPLOUD FOTO" = "UPLOUD FOTO";

commit;
