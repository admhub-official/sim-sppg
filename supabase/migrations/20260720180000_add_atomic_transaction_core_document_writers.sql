create or replace function public.create_transaction_with_documents_atomic(
  p_transaction jsonb,
  p_documents jsonb,
  p_uploaded_by text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(btrim(p_transaction->>'ID'), '');
  v_row public."TRANSAKSI"%rowtype;
begin
  if v_id is null then raise exception 'ID transaksi wajib tersedia'; end if;
  if jsonb_typeof(p_documents) <> 'array' then raise exception 'Dokumen harus berupa array'; end if;

  insert into public."TRANSAKSI" (
    "ID", "Kode Pemasukan", "Tanggal", "Kategori", "Jenis Kategori", "SPPG", "YAYASAN",
    "Nominal", "Catatan", "Timestamp", "User", "Nama Item/ Bahan Baku", "Metode Transaksi",
    "APPROVED BY", "WAKTU APPROVE", "Catatan_1", "Catatan Approval", "Deskripsi"
  ) values (
    v_id, p_transaction->>'Kode Pemasukan', (p_transaction->>'Tanggal')::date,
    p_transaction->>'Kategori', p_transaction->>'Jenis Kategori', p_transaction->>'SPPG',
    p_transaction->>'YAYASAN', (p_transaction->>'Nominal')::numeric,
    coalesce(p_transaction->>'Catatan',''), coalesce((p_transaction->>'Timestamp')::timestamptz,now()),
    p_transaction->>'User', p_transaction->>'Nama Item/ Bahan Baku', p_transaction->>'Metode Transaksi',
    coalesce(p_transaction->>'APPROVED BY',''), nullif(p_transaction->>'WAKTU APPROVE','')::timestamptz,
    coalesce(p_transaction->>'Catatan_1',''), coalesce(p_transaction->>'Catatan Approval',''),
    coalesce(p_transaction->>'Deskripsi','')
  ) returning * into v_row;

  perform public.save_transaction_documents_atomic(v_id,p_documents,p_uploaded_by,'APPLICATION_NORMALIZED');
  select * into v_row from public."TRANSAKSI" where "ID"=v_id;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.update_transaction_with_documents_atomic(
  p_transaksi_id text,
  p_patch jsonb,
  p_documents jsonb,
  p_uploaded_by text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public."TRANSAKSI"%rowtype;
begin
  if nullif(btrim(p_transaksi_id),'') is null then raise exception 'ID transaksi wajib tersedia'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'Patch transaksi harus berupa object'; end if;
  if jsonb_typeof(p_documents) <> 'array' then raise exception 'Dokumen harus berupa array'; end if;

  update public."TRANSAKSI" set
    "Tanggal"=case when p_patch?'Tanggal' then (p_patch->>'Tanggal')::date else "Tanggal" end,
    "Kategori"=case when p_patch?'Kategori' then p_patch->>'Kategori' else "Kategori" end,
    "Jenis Kategori"=case when p_patch?'Jenis Kategori' then p_patch->>'Jenis Kategori' else "Jenis Kategori" end,
    "SPPG"=case when p_patch?'SPPG' then p_patch->>'SPPG' else "SPPG" end,
    "YAYASAN"=case when p_patch?'YAYASAN' then p_patch->>'YAYASAN' else "YAYASAN" end,
    "Nominal"=case when p_patch?'Nominal' then (p_patch->>'Nominal')::numeric else "Nominal" end,
    "Catatan"=case when p_patch?'Catatan' then p_patch->>'Catatan' else "Catatan" end,
    "Nama Item/ Bahan Baku"=case when p_patch?'Nama Item/ Bahan Baku' then p_patch->>'Nama Item/ Bahan Baku' else "Nama Item/ Bahan Baku" end,
    "Metode Transaksi"=case when p_patch?'Metode Transaksi' then p_patch->>'Metode Transaksi' else "Metode Transaksi" end,
    "Catatan Approval"=case when p_patch?'Catatan Approval' then p_patch->>'Catatan Approval' else "Catatan Approval" end,
    "Catatan_1"=case when p_patch?'Catatan_1' then p_patch->>'Catatan_1' else "Catatan_1" end
  where "ID"=p_transaksi_id returning * into v_row;

  if not found then raise exception 'Transaksi tidak ditemukan'; end if;
  perform public.save_transaction_documents_atomic(p_transaksi_id,p_documents,p_uploaded_by,'APPLICATION_NORMALIZED');
  select * into v_row from public."TRANSAKSI" where "ID"=p_transaksi_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_transaction_with_documents_atomic(jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.update_transaction_with_documents_atomic(text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_transaction_with_documents_atomic(jsonb,jsonb,text) to service_role;
grant execute on function public.update_transaction_with_documents_atomic(text,jsonb,jsonb,text) to service_role;