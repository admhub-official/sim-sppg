create or replace function public.submit_bulk_transaction_payment_atomic(
  p_transaksi_ids text[], p_nominals numeric[], p_storage_bucket text,
  p_storage_path text, p_mime_type text, p_original_file_name text,
  p_submitted_by text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_index integer;
  v_results jsonb := '[]'::jsonb;
begin
  if coalesce(array_length(p_transaksi_ids, 1), 0) < 2
     or array_length(p_transaksi_ids, 1) <> array_length(p_nominals, 1) then
    raise exception 'Daftar transaksi bulk tidak valid.';
  end if;
  for v_index in 1..array_length(p_transaksi_ids, 1) loop
    v_results := v_results || jsonb_build_array(public.submit_transaction_payment_atomic(
      p_transaksi_ids[v_index], p_nominals[v_index], p_storage_bucket,
      p_storage_path, p_mime_type, p_original_file_name, p_submitted_by
    ));
  end loop;
  return v_results;
end;
$$;

create or replace function public.approve_bulk_transactions_atomic(
  p_transaksi_ids text[], p_storage_bucket text, p_storage_path text,
  p_mime_type text, p_original_file_name text, p_verified_by text,
  p_verified_name text, p_verification_notes text,
  p_verifier_signature_path text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_results jsonb := '[]'::jsonb;
begin
  if coalesce(array_length(p_transaksi_ids, 1), 0) < 2 then
    raise exception 'Pilih minimal dua transaksi.';
  end if;
  foreach v_id in array p_transaksi_ids loop
    v_results := v_results || jsonb_build_array(public.approve_transaction_direct_atomic(
      v_id, p_storage_bucket, p_storage_path, p_mime_type,
      p_original_file_name, p_verified_by, p_verified_name,
      p_verification_notes, p_verifier_signature_path
    ));
  end loop;
  return v_results;
end;
$$;

revoke all on function public.submit_bulk_transaction_payment_atomic(text[], numeric[], text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.approve_bulk_transactions_atomic(text[], text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_bulk_transaction_payment_atomic(text[], numeric[], text, text, text, text, text) to service_role;
grant execute on function public.approve_bulk_transactions_atomic(text[], text, text, text, text, text, text, text, text) to service_role;
