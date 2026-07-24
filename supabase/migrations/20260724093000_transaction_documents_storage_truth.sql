create or replace view public."TRANSAKSI_DOCUMENTS_AVAILABLE" as
select
  d.id,
  d.transaksi_id,
  d.document_type,
  d.storage_bucket,
  d.storage_path,
  d.mime_type,
  d.original_file_name,
  d.uploaded_by,
  d.source,
  d.legacy_source_column,
  d.created_at,
  d.updated_at
from public."TRANSAKSI_DOCUMENTS" d
join storage.objects o
  on o.bucket_id = d.storage_bucket
 and o.name = d.storage_path;

revoke all on public."TRANSAKSI_DOCUMENTS_AVAILABLE" from anon, authenticated;
grant select on public."TRANSAKSI_DOCUMENTS_AVAILABLE" to service_role;

comment on view public."TRANSAKSI_DOCUMENTS_AVAILABLE" is
'Canonical transaction documents whose referenced Storage object physically exists. Used to keep transaction and approval document status synchronized.';
