-- Reproduce the production KPI architecture in fresh Supabase preview branches.

create or replace view public.approval_queue_enriched_v
with (security_invoker = true)
as
with payment as (
  select
    transaksi_id,
    count(*) as proof_count,
    coalesce(sum(nominal) filter (where upper(status) <> 'DITOLAK'), 0::numeric) as submitted,
    coalesce(sum(nominal) filter (where upper(status) = 'TERVERIFIKASI'), 0::numeric) as verified,
    count(*) filter (where upper(status) = 'MENUNGGU_VERIFIKASI') as pending_count
  from public."TRANSAKSI_PAYMENT_PROOFS"
  group by transaksi_id
), docs as (
  select
    transaksi_id,
    bool_or(document_type in ('FOTO_TRANSAKSI','FILE_TRANSAKSI') and coalesce(storage_path,'') <> '') as has_bukti,
    bool_or(document_type = 'NOTA_PEMBELIAN' and coalesce(storage_path,'') <> '') as has_nota,
    bool_or(document_type = 'TTD_USER' and coalesce(storage_path,'') <> '') as has_ttd
  from public."TRANSAKSI_DOCUMENTS_AVAILABLE"
  group by transaksi_id
)
select
  t.*,
  coalesce(p.proof_count, 0::bigint) as proof_count,
  coalesce(p.submitted, 0::numeric) as submitted,
  coalesce(p.verified, 0::numeric) as verified,
  coalesce(p.pending_count, 0::bigint) as pending_count,
  coalesce(d.has_bukti, false) as has_bukti,
  coalesce(d.has_nota, false) as has_nota,
  coalesce(d.has_ttd, false) as has_ttd,
  case
    when coalesce(d.has_bukti, false) and coalesce(d.has_nota, false) and coalesce(d.has_ttd, false)
      then 'LENGKAP'
    else 'TIDAK_LENGKAP'
  end as document_status
from public."TRANSAKSI" t
left join payment p on p.transaksi_id = t."ID"
left join docs d on d.transaksi_id = t."ID"
where upper(coalesce(t."Kategori",'')) = 'PENGELUARAN'
  and upper(replace(coalesce(t."Metode Transaksi",''),' ','_')) not in ('SUDAH_DIBAYAR','LUNAS');

create or replace function public.get_transaction_kpi_v2(
  p_email text,
  p_username text,
  p_role text,
  p_filters jsonb default '{}'::jsonb
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with scoped as (
  select t.*
  from public."TRANSAKSI" t
  where
    upper(coalesce(p_role,'')) = 'SUPER_ADMIN'
    or (
      upper(coalesce(p_role,'')) = 'USER'
      and lower(coalesce(t."User",'')) in (lower(coalesce(p_email,'')), lower(coalesce(p_username,'')))
    )
    or (
      upper(coalesce(p_role,'')) = 'ADMIN'
      and exists (
        select 1 from public."ADMIN_ASSIGNMENT" a
        where lower(coalesce(a.admin_email,'')) = lower(coalesce(p_email,''))
          and upper(coalesce(a.sppg,'')) = upper(coalesce(t."SPPG",''))
          and (coalesce(a.yayasan,'') = '' or upper(coalesce(a.yayasan,'')) = upper(coalesce(t."YAYASAN",'')))
      )
    )
), filtered as (
  select * from scoped t
  where
    (coalesce(p_filters->>'sppg','') in ('','ALL') or upper(coalesce(t."SPPG",'')) = upper(p_filters->>'sppg'))
    and (coalesce(p_filters->>'yayasan','') in ('','ALL') or upper(coalesce(t."YAYASAN",'')) = upper(p_filters->>'yayasan'))
    and (coalesce(p_filters->>'kategori','') in ('','ALL') or upper(coalesce(t."Kategori",'')) = upper(p_filters->>'kategori'))
    and (coalesce(p_filters->>'jenisKategori','') in ('','ALL') or upper(coalesce(t."Jenis Kategori",'')) = upper(p_filters->>'jenisKategori'))
    and (coalesce(p_filters->>'supplier','') in ('','ALL') or upper(coalesce(t."NAMA SUPPLIER",'')) = upper(p_filters->>'supplier'))
    and (coalesce(p_filters->>'dateStart','') = '' or t."Tanggal" >= (p_filters->>'dateStart')::date)
    and (coalesce(p_filters->>'dateEnd','') = '' or t."Tanggal" <= (p_filters->>'dateEnd')::date)
    and (
      coalesce(p_filters->>'search','') = ''
      or concat_ws(' ',t."Kode Pemasukan",t."Nama Item/ Bahan Baku",t."User",t."SPPG",t."YAYASAN",t."Catatan",t."NAMA SUPPLIER") ilike '%' || (p_filters->>'search') || '%'
    )
    and (
      coalesce(p_filters->>'status','') in ('','ALL')
      or (upper(p_filters->>'status') = 'PENDING' and upper(replace(coalesce(t."Metode Transaksi",''),' ','_')) not in ('SUDAH_DIBAYAR','LUNAS'))
      or (upper(p_filters->>'status') in ('SUDAH_DIBAYAR','LUNAS') and upper(replace(coalesce(t."Metode Transaksi",''),' ','_')) in ('SUDAH_DIBAYAR','LUNAS'))
      or upper(replace(coalesce(t."Metode Transaksi",''),' ','_')) = upper(replace(p_filters->>'status',' ','_'))
    )
)
select jsonb_build_object(
  'success', true,
  'totalPemasukan', coalesce(sum("Nominal") filter (where upper(coalesce("Kategori",''))='PEMASUKAN'),0),
  'totalPengeluaran', coalesce(sum("Nominal") filter (where upper(coalesce("Kategori",''))='PENGELUARAN'),0),
  'totalTransaksi', count(*),
  'saldo', coalesce(sum("Nominal") filter (where upper(coalesce("Kategori",''))='PEMASUKAN'),0) - coalesce(sum("Nominal") filter (where upper(coalesce("Kategori",''))='PENGELUARAN'),0),
  'jumlahPemasukan', count(*) filter (where upper(coalesce("Kategori",''))='PEMASUKAN'),
  'jumlahPengeluaran', count(*) filter (where upper(coalesce("Kategori",''))='PENGELUARAN'),
  'scope', upper(coalesce(p_role,'')),
  'source', 'database_full_scope'
) from filtered;
$$;

create or replace function public.get_approval_queue_stage_d_v2(
  p_email text,
  p_role text,
  p_page integer default 1,
  p_page_size integer default 15,
  p_filters jsonb default '{}'::jsonb
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with role_scoped as (
  select q.*
  from public.approval_queue_enriched_v q
  where
    upper(coalesce(p_role,''))='SUPER_ADMIN'
    or (upper(coalesce(p_role,''))='USER' and lower(coalesce(q."User",''))=lower(coalesce(p_email,'')))
    or (
      upper(coalesce(p_role,''))='ADMIN'
      and exists (
        select 1 from public."ADMIN_ASSIGNMENT" a
        where lower(coalesce(a.admin_email,''))=lower(coalesce(p_email,''))
          and upper(coalesce(a.sppg,''))=upper(coalesce(q."SPPG",''))
          and (coalesce(a.yayasan,'')='' or upper(coalesce(a.yayasan,''))=upper(coalesce(q."YAYASAN",'')))
      )
    )
), date_scoped as (
  select * from role_scoped q
  where (coalesce(p_filters->>'dateStart','')='' or q."Tanggal">=(p_filters->>'dateStart')::date)
    and (coalesce(p_filters->>'dateEnd','')='' or q."Tanggal"<=(p_filters->>'dateEnd')::date)
), filtered as (
  select * from date_scoped q
  where
    (coalesce(p_filters->>'sppg','') in ('','ALL') or upper(coalesce(q."SPPG",''))=upper(p_filters->>'sppg'))
    and (coalesce(p_filters->>'yayasan','') in ('','ALL') or upper(coalesce(q."YAYASAN",''))=upper(p_filters->>'yayasan'))
    and (coalesce(p_filters->>'jenisKategori','') in ('','ALL') or upper(coalesce(q."Jenis Kategori",''))=upper(p_filters->>'jenisKategori'))
    and (coalesce(p_filters->>'supplier','') in ('','ALL') or upper(coalesce(q."NAMA SUPPLIER",''))=upper(p_filters->>'supplier'))
    and (
      coalesce(p_filters->>'search','')=''
      or concat_ws(' ',q."Kode Pemasukan",q."Nama Item/ Bahan Baku",q."User",q."SPPG",q."YAYASAN",q."NAMA SUPPLIER",q."NO REKENING SUPPLIER") ilike '%'||(p_filters->>'search')||'%'
    )
    and (
      coalesce(p_filters->>'kelengkapan','') in ('','ALL')
      or (upper(p_filters->>'kelengkapan')='LENGKAP' and (q.has_bukti or q.proof_count>0) and q.has_nota)
      or (upper(p_filters->>'kelengkapan') in ('TIDAK ADA NOTA','TIDAK_ADA_NOTA') and (q.has_bukti or q.proof_count>0) and not q.has_nota)
      or (upper(p_filters->>'kelengkapan') in ('TIDAK ADA BUKTI PEMBAYARAN','TIDAK_ADA_BUKTI_PEMBAYARAN') and not (q.has_bukti or q.proof_count>0) and q.has_nota)
      or (upper(p_filters->>'kelengkapan') in ('TIDAK LENGKAP','TIDAK_LENGKAP') and not ((q.has_bukti or q.proof_count>0) and q.has_nota))
    )
), paged as (
  select * from filtered
  order by "Tanggal" desc,"ID" desc
  limit least(greatest(coalesce(p_page_size,15),1),100)
  offset (greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,15),1),100)
), filter_options as (
  select jsonb_build_object(
    'sppg',coalesce((select jsonb_agg(x order by x) from (select distinct "SPPG" x from date_scoped where coalesce("SPPG",'')<>'') s),'[]'::jsonb),
    'jenisKategori',coalesce((select jsonb_agg(x order by x) from (select distinct "Jenis Kategori" x from date_scoped where coalesce("Jenis Kategori",'')<>'') s),'[]'::jsonb),
    'supplier',coalesce((select jsonb_agg(x order by x) from (select distinct "NAMA SUPPLIER" x from date_scoped where coalesce("NAMA SUPPLIER",'')<>'') s),'[]'::jsonb)
  ) value
), supplier_groups as (
  select coalesce(jsonb_agg(to_jsonb(g) order by g.nominal desc),'[]'::jsonb) value
  from (
    select coalesce(nullif("SUPPLIER ID",''),'manual:'||lower(coalesce(nullif("NAMA SUPPLIER",''),'legacy'))) key,
      "SUPPLIER ID" "supplierId",coalesce(nullif("NAMA SUPPLIER",''),'Supplier belum tercatat') "supplierName",
      max("NAMA BANK SUPPLIER") "supplierBankName",max("NO REKENING SUPPLIER") "supplierAccountNumber",
      max("ATAS NAMA REKENING SUPPLIER") "supplierAccountHolder",max(coalesce(nullif("SUMBER SUPPLIER",''),'LEGACY')) "supplierSource",
      count(*) "transactionCount",coalesce(sum("Nominal"),0) nominal
    from filtered group by 1,2,3
  ) g
)
select jsonb_build_object(
  'data',coalesce((select jsonb_agg(to_jsonb(paged) order by "Tanggal" desc,"ID" desc) from paged),'[]'::jsonb),
  'page',greatest(coalesce(p_page,1),1),
  'pageSize',least(greatest(coalesce(p_page_size,15),1),100),
  'total',(select count(*) from filtered),
  'hasMore',greatest(coalesce(p_page,1),1)*least(greatest(coalesce(p_page_size,15),1),100)<(select count(*) from filtered),
  'summary',jsonb_build_object(
    'total',(select count(*) from filtered),
    'nominal',coalesce((select sum("Nominal") from filtered),0),
    'submitted',coalesce((select sum(submitted) from filtered),0),
    'verified',coalesce((select sum(verified) from filtered),0),
    'pendingNominal',coalesce((select sum(greatest(submitted-verified,0)) from filtered),0),
    'outstanding',coalesce((select sum(greatest("Nominal"-submitted,0)) from filtered),0),
    'proofCount',coalesce((select sum(proof_count) from filtered),0),
    'pendingProofCount',coalesce((select sum(pending_count) from filtered),0),
    'completeCount',(select count(*) from filtered where (has_bukti or proof_count>0) and has_nota),
    'incompleteCount',(select count(*) from filtered where not ((has_bukti or proof_count>0) and has_nota)),
    'source','database_full_scope'
  ),
  'filterOptions',(select value from filter_options),
  'supplierGroups',(select value from supplier_groups)
);
$$;

revoke all on function public.get_transaction_kpi_v2(text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.get_approval_queue_stage_d_v2(text,text,integer,integer,jsonb) from public, anon, authenticated;
grant execute on function public.get_transaction_kpi_v2(text,text,text,jsonb) to service_role;
grant execute on function public.get_approval_queue_stage_d_v2(text,text,integer,integer,jsonb) to service_role;
