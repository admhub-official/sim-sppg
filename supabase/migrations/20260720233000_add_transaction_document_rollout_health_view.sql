create or replace view public.transaction_document_rollout_health as
with core_types as (
  select unnest(array['FOTO_TRANSAKSI','FILE_TRANSAKSI','TTD_USER','NOTA_PEMBELIAN'])::text as document_type
), normalized as (
  select
    count(*)::bigint as normalized_rows,
    count(distinct transaksi_id)::bigint as normalized_transactions
  from public."TRANSAKSI_DOCUMENTS"
  where document_type in (select document_type from core_types)
), orphaned as (
  select count(*)::bigint as orphan_document_rows
  from public."TRANSAKSI_DOCUMENTS" d
  left join public."TRANSAKSI" t on t."ID" = d.transaksi_id
  where t."ID" is null
), mismatches as (
  select count(*)::bigint as mismatch_count
  from public."TRANSAKSI_DOCUMENTS" d
  join public."TRANSAKSI" t on t."ID" = d.transaksi_id
  where
    (d.document_type='FOTO_TRANSAKSI' and coalesce(t."UPLOUD FOTO",'') is distinct from coalesce(d.storage_path,'')) or
    (d.document_type='FILE_TRANSAKSI' and coalesce(t."UPLOUD FILE",'') is distinct from coalesce(d.storage_path,'')) or
    (d.document_type='TTD_USER' and coalesce(t."TTD USER",'') is distinct from coalesce(d.storage_path,'')) or
    (d.document_type='NOTA_PEMBELIAN' and coalesce(t."NOTA PEMBELIAN",'') is distinct from coalesce(d.storage_path,''))
), legacy_only as (
  select count(*)::bigint as legacy_only_values
  from public."TRANSAKSI" t
  cross join lateral (values
    ('FOTO_TRANSAKSI', t."UPLOUD FOTO"),
    ('FILE_TRANSAKSI', t."UPLOUD FILE"),
    ('TTD_USER', t."TTD USER"),
    ('NOTA_PEMBELIAN', t."NOTA PEMBELIAN")
  ) as x(document_type, storage_path)
  where nullif(btrim(coalesce(x.storage_path,'')),'') is not null
    and upper(btrim(x.storage_path)) not in ('-','FOTO','FILE')
    and not exists (
      select 1 from public."TRANSAKSI_DOCUMENTS" d
      where d.transaksi_id=t."ID" and d.document_type=x.document_type
    )
)
select
  now() as checked_at,
  n.normalized_rows,
  n.normalized_transactions,
  o.orphan_document_rows,
  m.mismatch_count,
  l.legacy_only_values,
  (o.orphan_document_rows=0 and m.mismatch_count=0 and l.legacy_only_values=0) as healthy
from normalized n, orphaned o, mismatches m, legacy_only l;

revoke all on public.transaction_document_rollout_health from anon, authenticated;
grant select on public.transaction_document_rollout_health to service_role;
