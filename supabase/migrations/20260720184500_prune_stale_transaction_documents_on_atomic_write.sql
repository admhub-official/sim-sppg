-- Treat the four core transaction document types as a complete snapshot during atomic writes.
create or replace function public.save_transaction_documents_atomic(
  p_transaksi_id text,
  p_documents jsonb,
  p_uploaded_by text default null,
  p_source text default 'APPLICATION'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc jsonb;
  v_type text;
  v_bucket text;
  v_path text;
  v_mime text;
  v_name text;
  v_expected_bucket text;
  v_count integer := 0;
begin
  if nullif(btrim(coalesce(p_transaksi_id, '')), '') is null then raise exception 'transaksi_id wajib diisi'; end if;
  if not exists (select 1 from public."TRANSAKSI" where "ID" = p_transaksi_id) then raise exception 'Transaksi tidak ditemukan'; end if;
  if p_documents is null or jsonb_typeof(p_documents) <> 'array' then raise exception 'documents harus berupa array JSON'; end if;

  delete from public."TRANSAKSI_DOCUMENTS" d
  where d.transaksi_id = p_transaksi_id
    and d.document_type in ('FOTO_TRANSAKSI','FILE_TRANSAKSI','TTD_USER','NOTA_PEMBELIAN')
    and not exists (
      select 1 from jsonb_array_elements(p_documents) e
      where upper(btrim(coalesce(e->>'document_type',''))) = d.document_type
    );

  for v_doc in select value from jsonb_array_elements(p_documents)
  loop
    v_type := upper(btrim(coalesce(v_doc->>'document_type', '')));
    v_bucket := btrim(coalesce(v_doc->>'storage_bucket', ''));
    v_path := btrim(coalesce(v_doc->>'storage_path', ''));
    v_mime := nullif(btrim(coalesce(v_doc->>'mime_type', '')), '');
    v_name := nullif(btrim(coalesce(v_doc->>'original_file_name', '')), '');
    v_expected_bucket := case v_type
      when 'FOTO_TRANSAKSI' then 'transaksi-images'
      when 'FILE_TRANSAKSI' then 'transaksi-files'
      when 'TTD_USER' then 'paraf-user'
      when 'NOTA_PEMBELIAN' then 'nota-pembelian'
      else null
    end;
    if v_expected_bucket is null then raise exception 'Jenis dokumen tidak diizinkan: %', v_type; end if;
    if v_bucket is distinct from v_expected_bucket then raise exception 'Bucket tidak sesuai untuk jenis dokumen %', v_type; end if;
    if nullif(v_path, '') is null or upper(v_path) in ('-', 'FOTO', 'FILE') then raise exception 'storage_path tidak valid untuk jenis dokumen %', v_type; end if;

    insert into public."TRANSAKSI_DOCUMENTS" (
      transaksi_id, document_type, storage_bucket, storage_path, mime_type,
      original_file_name, uploaded_by, source, legacy_source_column, created_at, updated_at
    ) values (
      p_transaksi_id, v_type, v_bucket, v_path, v_mime,
      coalesce(v_name, regexp_replace(v_path, '^.*/', '')),
      nullif(btrim(coalesce(p_uploaded_by, '')), ''),
      coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'APPLICATION'),
      null, now(), now()
    )
    on conflict (transaksi_id, document_type)
    do update set storage_bucket=excluded.storage_bucket, storage_path=excluded.storage_path,
      mime_type=excluded.mime_type, original_file_name=excluded.original_file_name,
      uploaded_by=excluded.uploaded_by, source=excluded.source,
      legacy_source_column=null, updated_at=now();
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('success',true,'transaksi_id',p_transaksi_id,'documents_written',v_count,'write_source','TRANSAKSI_DOCUMENTS');
end;
$$;

revoke all on function public.save_transaction_documents_atomic(text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.save_transaction_documents_atomic(text,jsonb,text,text) to service_role;
