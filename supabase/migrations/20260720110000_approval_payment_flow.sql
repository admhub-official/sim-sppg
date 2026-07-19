-- Approval and partial-payment workflow for SIM-SPPG.
-- Payment proofs are the ledger; TRANSAKSI."Metode Transaksi" is the derived payment status.

begin;

create or replace function public.submit_transaction_payment_atomic(
  p_transaksi_id text,
  p_nominal numeric,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_original_file_name text,
  p_submitted_by text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tx public."TRANSAKSI"%rowtype;
  v_used numeric := 0;
  v_seq integer := 0;
  v_total numeric := 0;
  v_status text;
  v_proof_id uuid;
begin
  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari 0.';
  end if;
  if coalesce(trim(p_storage_bucket), '') = '' or coalesce(trim(p_storage_path), '') = '' then
    raise exception 'File bukti pembayaran wajib tersedia.';
  end if;

  select * into v_tx
  from public."TRANSAKSI"
  where "ID" = p_transaksi_id
  for update;

  if not found then raise exception 'Transaksi tidak ditemukan.'; end if;
  if upper(coalesce(v_tx."Metode Transaksi", '')) = 'SUDAH_DIBAYAR' then
    raise exception 'Transaksi sudah dibayar.';
  end if;

  select coalesce(sum(nominal) filter (where status <> 'DITOLAK'), 0),
         coalesce(max(payment_sequence), 0)
  into v_used, v_seq
  from public."TRANSAKSI_PAYMENT_PROOFS"
  where transaksi_id = p_transaksi_id;

  if v_used >= coalesce(v_tx."Nominal", 0) then
    raise exception 'Pelunasan sudah lengkap dan sedang menunggu verifikasi.';
  end if;
  if v_used + p_nominal > coalesce(v_tx."Nominal", 0) then
    raise exception 'Nominal pembayaran melebihi sisa tagihan.';
  end if;

  v_seq := v_seq + 1;
  v_total := v_used + p_nominal;
  v_status := case when v_total >= coalesce(v_tx."Nominal", 0)
                   then 'MENUNGGU_VERIFIKASI'
                   else 'BELUM_LUNAS' end;

  insert into public."TRANSAKSI_PAYMENT_PROOFS"(
    transaksi_id, payment_sequence, nominal, storage_bucket, storage_path,
    mime_type, original_file_name, submitted_by, submitted_at, status
  ) values (
    p_transaksi_id, v_seq, p_nominal, trim(p_storage_bucket), trim(p_storage_path),
    nullif(trim(coalesce(p_mime_type, '')), ''), nullif(trim(coalesce(p_original_file_name, '')), ''),
    lower(trim(p_submitted_by)), now(), 'MENUNGGU_VERIFIKASI'
  ) returning id into v_proof_id;

  update public."TRANSAKSI"
  set "Metode Transaksi" = v_status,
      "Deskripsi" = jsonb_build_object(
        'nominalDibayar', v_total,
        'sisaPembayaran', greatest(coalesce("Nominal", 0) - v_total, 0),
        'submittedBy', lower(trim(p_submitted_by)),
        'updatedAt', now()
      )::text
  where "ID" = p_transaksi_id;

  return jsonb_build_object(
    'proofId', v_proof_id,
    'paymentSequence', v_seq,
    'totalDibayar', v_total,
    'sisaPembayaran', greatest(coalesce(v_tx."Nominal", 0) - v_total, 0),
    'status', v_status
  );
end;
$function$;

create or replace function public.verify_transaction_payment_batch_atomic(
  p_transaksi_id text,
  p_accepted boolean,
  p_verified_by text,
  p_verified_name text,
  p_verification_notes text default '',
  p_verifier_signature_path text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tx public."TRANSAKSI"%rowtype;
  v_submitted numeric := 0;
  v_verified numeric := 0;
  v_pending_count integer := 0;
  v_status text;
  v_now timestamptz := now();
begin
  if coalesce(trim(p_verifier_signature_path), '') = '' then
    raise exception 'TTD verifikator wajib tersedia.';
  end if;

  select * into v_tx
  from public."TRANSAKSI"
  where "ID" = p_transaksi_id
  for update;
  if not found then raise exception 'Transaksi tidak ditemukan.'; end if;

  select coalesce(sum(nominal) filter (where status <> 'DITOLAK'), 0),
         count(*) filter (where status = 'MENUNGGU_VERIFIKASI')
  into v_submitted, v_pending_count
  from public."TRANSAKSI_PAYMENT_PROOFS"
  where transaksi_id = p_transaksi_id;

  if v_pending_count = 0 then raise exception 'Tidak ada bukti pembayaran yang menunggu verifikasi.'; end if;

  if p_accepted then
    if v_submitted < coalesce(v_tx."Nominal", 0) then
      raise exception 'Pembayaran belum lunas. TTD verifikator belum dapat diberikan.';
    end if;

    update public."TRANSAKSI_PAYMENT_PROOFS"
    set status = 'TERVERIFIKASI',
        verified_by = lower(trim(p_verified_by)),
        verified_at = v_now,
        verifier_signature_path = trim(p_verifier_signature_path),
        verification_notes = trim(coalesce(p_verification_notes, '')),
        updated_at = v_now
    where transaksi_id = p_transaksi_id
      and status = 'MENUNGGU_VERIFIKASI';

    select coalesce(sum(nominal), 0)
    into v_verified
    from public."TRANSAKSI_PAYMENT_PROOFS"
    where transaksi_id = p_transaksi_id and status = 'TERVERIFIKASI';

    if v_verified < coalesce(v_tx."Nominal", 0) then
      raise exception 'Total pembayaran terverifikasi belum menutup nominal transaksi.';
    end if;
    v_status := 'SUDAH_DIBAYAR';
  else
    update public."TRANSAKSI_PAYMENT_PROOFS"
    set status = 'DITOLAK',
        verified_by = lower(trim(p_verified_by)),
        verified_at = v_now,
        verifier_signature_path = trim(p_verifier_signature_path),
        verification_notes = trim(coalesce(p_verification_notes, '')),
        updated_at = v_now
    where transaksi_id = p_transaksi_id
      and status = 'MENUNGGU_VERIFIKASI';
    v_verified := 0;
    v_status := 'BELUM_LUNAS';
  end if;

  update public."TRANSAKSI"
  set "Metode Transaksi" = v_status,
      "APPROVED BY" = coalesce(nullif(trim(p_verified_name), ''), lower(trim(p_verified_by))),
      "WAKTU APPROVE" = case when p_accepted then v_now else "WAKTU APPROVE" end,
      "Catatan_1" = trim(coalesce(p_verification_notes, '')),
      "TTD VERIFIKATOR" = trim(p_verifier_signature_path),
      "Deskripsi" = jsonb_build_object(
        'nominalDibayar', case when p_accepted then v_verified else 0 end,
        'sisaPembayaran', case when p_accepted then 0 else coalesce("Nominal", 0) end,
        'verifiedBy', lower(trim(p_verified_by)),
        'verifiedAt', v_now
      )::text
  where "ID" = p_transaksi_id;

  return jsonb_build_object(
    'accepted', p_accepted,
    'processedProofs', v_pending_count,
    'totalVerified', v_verified,
    'status', v_status
  );
end;
$function$;

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
) returns jsonb
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

  select * into v_tx
  from public."TRANSAKSI"
  where "ID" = p_transaksi_id
  for update;
  if not found then raise exception 'Transaksi tidak ditemukan.'; end if;
  if upper(coalesce(v_tx."Metode Transaksi", '')) = 'SUDAH_DIBAYAR' then raise exception 'Transaksi sudah dibayar.'; end if;

  select coalesce(sum(nominal) filter (where status <> 'DITOLAK'), 0),
         coalesce(max(payment_sequence), 0)
  into v_submitted, v_seq
  from public."TRANSAKSI_PAYMENT_PROOFS"
  where transaksi_id = p_transaksi_id;

  v_remaining := greatest(coalesce(v_tx."Nominal", 0) - v_submitted, 0);

  update public."TRANSAKSI_PAYMENT_PROOFS"
  set status = 'TERVERIFIKASI',
      verified_by = lower(trim(p_verified_by)),
      verified_at = v_now,
      verifier_signature_path = trim(p_verifier_signature_path),
      verification_notes = trim(coalesce(p_verification_notes, '')),
      updated_at = v_now
  where transaksi_id = p_transaksi_id
    and status = 'MENUNGGU_VERIFIKASI';

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
      "LINK FOTO/ FILE  BUKTI TRANSAKSI" = trim(p_storage_path),
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

revoke all on function public.submit_transaction_payment_atomic(text,numeric,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.verify_transaction_payment_batch_atomic(text,boolean,text,text,text,text) from public, anon, authenticated;
revoke all on function public.approve_transaction_direct_atomic(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_transaction_payment_atomic(text,numeric,text,text,text,text,text) to service_role;
grant execute on function public.verify_transaction_payment_batch_atomic(text,boolean,text,text,text,text) to service_role;
grant execute on function public.approve_transaction_direct_atomic(text,text,text,text,text,text,text,text,text) to service_role;

with payment_totals as (
  select transaksi_id,
         coalesce(sum(nominal) filter (where status <> 'DITOLAK'), 0) submitted,
         coalesce(sum(nominal) filter (where status = 'TERVERIFIKASI'), 0) verified,
         count(*) filter (where status = 'MENUNGGU_VERIFIKASI') pending_count
  from public."TRANSAKSI_PAYMENT_PROOFS"
  group by transaksi_id
)
update public."TRANSAKSI" t
set "Metode Transaksi" = case
  when p.verified >= coalesce(t."Nominal", 0) then 'SUDAH_DIBAYAR'
  when p.submitted >= coalesce(t."Nominal", 0) and p.pending_count > 0 then 'MENUNGGU_VERIFIKASI'
  else 'BELUM_LUNAS'
end
from payment_totals p
where p.transaksi_id = t."ID";

commit;

-- Rollback: restore the previous submit_transaction_payment_atomic and
-- verify_transaction_payment_atomic definitions from migrations
-- 20260717173018 and 20260718054326, then drop the two new batch/direct RPCs.
