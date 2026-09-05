-- Security and reliability hardening from 2026-09-05 review.
-- This migration is intentionally backward-compatible with the currently deployed Edge Functions.

-- 1) Transaction document metadata must never be callable from the public API.
revoke all on function public.get_transaction_documents(text) from public;
revoke all on function public.get_transaction_documents(text) from anon;
revoke all on function public.get_transaction_documents(text) from authenticated;
grant execute on function public.get_transaction_documents(text) to service_role;

-- 2) Internal report artifacts are private and anonymous upload is prohibited.
update storage.buckets
set public = false
where id = 'laporan_pdf';

drop policy if exists allow_anon_upload_laporan_pdf on storage.objects;

-- 3) Folder trash/restore must keep an entire document subtree consistent.
create or replace function public.trash_document_subtree_atomic(
  p_folder_id uuid,
  p_deleted_by uuid
)
returns table(folders_updated integer, files_updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_at timestamptz := clock_timestamp();
  v_folders integer := 0;
  v_files integer := 0;
begin
  if p_folder_id is null or p_deleted_by is null then
    raise exception 'Folder dan pelaku wajib diisi.';
  end if;

  if not exists (
    select 1 from public."DOC_FOLDERS"
    where id = p_folder_id and deleted_at is null
  ) then
    raise exception 'Folder aktif tidak ditemukan.';
  end if;

  with recursive subtree as (
    select id from public."DOC_FOLDERS" where id = p_folder_id
    union all
    select child.id
    from public."DOC_FOLDERS" child
    join subtree parent on child.parent_id = parent.id
  )
  update public."DOC_FILES" file
     set deleted_at = v_deleted_at,
         deleted_by = p_deleted_by,
         updated_at = v_deleted_at
   where file.folder_id in (select id from subtree)
     and file.deleted_at is null;
  get diagnostics v_files = row_count;

  with recursive subtree as (
    select id from public."DOC_FOLDERS" where id = p_folder_id
    union all
    select child.id
    from public."DOC_FOLDERS" child
    join subtree parent on child.parent_id = parent.id
  )
  update public."DOC_FOLDERS" folder
     set deleted_at = v_deleted_at,
         deleted_by = p_deleted_by,
         updated_at = v_deleted_at
   where folder.id in (select id from subtree)
     and folder.deleted_at is null;
  get diagnostics v_folders = row_count;

  return query select v_folders, v_files;
end;
$$;

create or replace function public.restore_document_subtree_atomic(
  p_folder_id uuid
)
returns table(folders_updated integer, files_updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch timestamptz;
  v_folders integer := 0;
  v_files integer := 0;
begin
  select deleted_at into v_batch
  from public."DOC_FOLDERS"
  where id = p_folder_id;

  if v_batch is null then
    raise exception 'Folder yang akan dipulihkan tidak ditemukan di Sampah.';
  end if;

  with recursive subtree as (
    select id from public."DOC_FOLDERS" where id = p_folder_id
    union all
    select child.id
    from public."DOC_FOLDERS" child
    join subtree parent on child.parent_id = parent.id
  )
  update public."DOC_FILES" file
     set deleted_at = null,
         deleted_by = null,
         updated_at = clock_timestamp()
   where file.folder_id in (select id from subtree)
     and file.deleted_at = v_batch;
  get diagnostics v_files = row_count;

  with recursive subtree as (
    select id from public."DOC_FOLDERS" where id = p_folder_id
    union all
    select child.id
    from public."DOC_FOLDERS" child
    join subtree parent on child.parent_id = parent.id
  )
  update public."DOC_FOLDERS" folder
     set deleted_at = null,
         deleted_by = null,
         updated_at = clock_timestamp()
   where folder.id in (select id from subtree)
     and folder.deleted_at = v_batch;
  get diagnostics v_folders = row_count;

  return query select v_folders, v_files;
end;
$$;

revoke all on function public.trash_document_subtree_atomic(uuid, uuid) from public, anon, authenticated;
revoke all on function public.restore_document_subtree_atomic(uuid) from public, anon, authenticated;
grant execute on function public.trash_document_subtree_atomic(uuid, uuid) to service_role;
grant execute on function public.restore_document_subtree_atomic(uuid) to service_role;

-- Repair descendants that could have remained active under already-trashed folders.
with recursive deleted_tree as (
  select id as root_id, id, deleted_at as root_deleted_at, deleted_by as root_deleted_by
  from public."DOC_FOLDERS"
  where deleted_at is not null
  union all
  select parent.root_id, child.id, parent.root_deleted_at, parent.root_deleted_by
  from deleted_tree parent
  join public."DOC_FOLDERS" child on child.parent_id = parent.id
), inherited as (
  select distinct on (id) id, root_deleted_at, root_deleted_by
  from deleted_tree
  where id <> root_id
  order by id, root_deleted_at desc nulls last
)
update public."DOC_FOLDERS" folder
set deleted_at = inherited.root_deleted_at,
    deleted_by = inherited.root_deleted_by,
    updated_at = greatest(folder.updated_at, inherited.root_deleted_at)
from inherited
where folder.id = inherited.id
  and folder.deleted_at is null;

with recursive deleted_tree as (
  select id as root_id, id, deleted_at as root_deleted_at, deleted_by as root_deleted_by
  from public."DOC_FOLDERS"
  where deleted_at is not null
  union all
  select parent.root_id, child.id, parent.root_deleted_at, parent.root_deleted_by
  from deleted_tree parent
  join public."DOC_FOLDERS" child on child.parent_id = parent.id
), inherited as (
  select distinct on (id) id, root_deleted_at, root_deleted_by
  from deleted_tree
  order by id, root_deleted_at desc nulls last
)
update public."DOC_FILES" file
set deleted_at = inherited.root_deleted_at,
    deleted_by = inherited.root_deleted_by,
    updated_at = greatest(file.updated_at, inherited.root_deleted_at)
from inherited
where file.folder_id = inherited.id
  and file.deleted_at is null;

-- 4) One canonical ChatTrx business-rule validator shared by confirm/edit RPCs.
create or replace function public.assert_chattrx_business_rules(
  p_row jsonb,
  p_require_ringkasan boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text := btrim(coalesce(p_row->>'kategori', ''));
  v_item text := btrim(coalesce(p_row->>'nama_item', ''));
  v_jenis text := lower(btrim(coalesce(p_row->>'jenis_transaksi', '')));
  v_status text := lower(btrim(coalesce(p_row->>'status_pembayaran', '')));
  v_penerima text := btrim(coalesce(p_row->>'penerima', ''));
  v_nominal numeric;
  v_receipt_required boolean;
begin
  begin
    v_nominal := nullif(p_row->>'nominal', '')::numeric;
  exception when others then
    raise exception 'Nominal transaksi tidak valid.';
  end;

  if v_jenis not in ('pemasukan', 'pengeluaran') then
    raise exception 'Jenis transaksi tidak valid.';
  end if;
  if v_status not in ('sudah_dibayar', 'belum_dibayar') then
    raise exception 'Status pembayaran tidak valid.';
  end if;
  if v_category = '' or v_item = '' then
    raise exception 'Kategori dan item wajib diisi.';
  end if;
  if v_nominal is null or v_nominal <= 0 then
    raise exception 'Nominal harus lebih dari 0.';
  end if;
  if nullif(p_row->>'tanggal_transaksi', '') is null then
    raise exception 'Tanggal transaksi wajib diisi.';
  end if;
  perform (p_row->>'tanggal_transaksi')::timestamptz;

  if p_require_ringkasan and coalesce(p_row->>'current_state', '') <> 'ringkasan' then
    raise exception 'Draft belum berada pada tahap ringkasan.';
  end if;

  if v_category = 'Gaji/Upah Karyawan' and v_penerima = '' then
    raise exception 'Penerima wajib diisi untuk transaksi gaji/upah.';
  end if;

  v_receipt_required := v_category = any(array[
    'Belanja Bahan Baku',
    'Material Bangunan',
    'Gas LPG',
    'Sewa & Utilitas (AC/WIFI)',
    'IPAL',
    'Inventaris Kantor',
    'Cetak & Promosi',
    'Operasional Perjalanan',
    'Konsumsi',
    'Administrasi & Lainnya'
  ]);

  if v_receipt_required and coalesce((p_row#>>'{verifikasi_nota,valid}')::boolean, false) is not true then
    raise exception 'Nota wajib tersedia dan terverifikasi untuk kategori ini.';
  end if;

  if v_status = 'sudah_dibayar' and coalesce((p_row#>>'{verifikasi_bukti_bayar,valid}')::boolean, false) is not true then
    raise exception 'Bukti pembayaran wajib tersedia dan terverifikasi untuk status Sudah Dibayar.';
  end if;
end;
$$;

create or replace function public.confirm_chattrx_atomic(p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public."CHATTRX_DRAFT"%rowtype;
  v_transaction_id uuid;
begin
  select * into v_draft
  from public."CHATTRX_DRAFT"
  where draft_id = p_draft_id
  for update;

  if not found then
    raise exception 'Draft tidak ditemukan.';
  end if;

  perform public.assert_chattrx_business_rules(to_jsonb(v_draft), true);

  insert into public."CHATTRX_TRANSAKSI" (
    draft_id, user_id, sppg, yayasan, jenis_transaksi, kategori, nama_item,
    keterangan, nominal, status_pembayaran, tanggal_transaksi, penerima,
    foto_nota_url, foto_bukti_bayar_url, ttd_konfirmasi_url,
    verifikasi_nota, verifikasi_bukti_bayar, chat_history
  ) values (
    v_draft.draft_id, v_draft.user_id, v_draft.sppg, v_draft.yayasan,
    v_draft.jenis_transaksi, v_draft.kategori, v_draft.nama_item,
    v_draft.keterangan, v_draft.nominal, v_draft.status_pembayaran,
    v_draft.tanggal_transaksi, v_draft.penerima,
    v_draft.foto_nota_url, v_draft.foto_bukti_bayar_url, null,
    v_draft.verifikasi_nota, v_draft.verifikasi_bukti_bayar, v_draft.chat_history
  )
  on conflict (draft_id) do update set
    jenis_transaksi = excluded.jenis_transaksi,
    kategori = excluded.kategori,
    nama_item = excluded.nama_item,
    keterangan = excluded.keterangan,
    nominal = excluded.nominal,
    status_pembayaran = excluded.status_pembayaran,
    tanggal_transaksi = excluded.tanggal_transaksi,
    penerima = excluded.penerima,
    foto_nota_url = excluded.foto_nota_url,
    foto_bukti_bayar_url = excluded.foto_bukti_bayar_url,
    verifikasi_nota = excluded.verifikasi_nota,
    verifikasi_bukti_bayar = excluded.verifikasi_bukti_bayar,
    chat_history = excluded.chat_history,
    updated_at = clock_timestamp()
  returning transaksi_id into v_transaction_id;

  update public."CHATTRX_DRAFT"
     set status = 'confirmed', updated_at = clock_timestamp()
   where draft_id = p_draft_id;

  return v_transaction_id;
end;
$$;

create or replace function public.update_chattrx_atomic(
  p_transaksi_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public."CHATTRX_TRANSAKSI"%rowtype;
  v_candidate jsonb;
  v_draft_id uuid;
begin
  select * into v_current
  from public."CHATTRX_TRANSAKSI"
  where transaksi_id = p_transaksi_id
  for update;

  if not found then
    raise exception 'Transaksi MyTrx tidak ditemukan.';
  end if;

  v_candidate := to_jsonb(v_current) || coalesce(p_patch, '{}'::jsonb);
  perform public.assert_chattrx_business_rules(v_candidate, false);
  v_draft_id := v_current.draft_id;

  update public."CHATTRX_TRANSAKSI"
     set jenis_transaksi = v_candidate->>'jenis_transaksi',
         kategori = v_candidate->>'kategori',
         nama_item = v_candidate->>'nama_item',
         penerima = nullif(v_candidate->>'penerima', ''),
         tanggal_transaksi = (v_candidate->>'tanggal_transaksi')::timestamptz,
         keterangan = coalesce(v_candidate->>'keterangan', ''),
         nominal = (v_candidate->>'nominal')::numeric,
         status_pembayaran = v_candidate->>'status_pembayaran',
         updated_at = clock_timestamp()
   where transaksi_id = p_transaksi_id;

  if v_draft_id is not null then
    update public."CHATTRX_DRAFT"
       set jenis_transaksi = v_candidate->>'jenis_transaksi',
           kategori = v_candidate->>'kategori',
           nama_item = v_candidate->>'nama_item',
           penerima = nullif(v_candidate->>'penerima', ''),
           tanggal_transaksi = (v_candidate->>'tanggal_transaksi')::timestamptz,
           keterangan = coalesce(v_candidate->>'keterangan', ''),
           nominal = (v_candidate->>'nominal')::numeric,
           status_pembayaran = v_candidate->>'status_pembayaran',
           updated_at = clock_timestamp()
     where draft_id = v_draft_id;
  end if;
end;
$$;

create or replace function public.get_chattrx_totals(
  p_role text,
  p_user_id uuid,
  p_email text,
  p_search text default '',
  p_jenis text default ''
)
returns table(total_count bigint, total_income numeric, total_outcome numeric)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select t.*
    from public."CHATTRX_TRANSAKSI" t
    where (
      upper(coalesce(p_role, '')) = 'SUPER_ADMIN'
      or exists (
        select 1
        from public."ADMIN_ASSIGNMENT" a
        where lower(coalesce(a.admin_email, '')) = lower(coalesce(p_email, ''))
          and a.sppg = t.sppg
          and a.yayasan = t.yayasan
      )
      or (
        not exists (
          select 1 from public."ADMIN_ASSIGNMENT" a
          where lower(coalesce(a.admin_email, '')) = lower(coalesce(p_email, ''))
            and coalesce(a.sppg, '') <> ''
        )
        and t.user_id = p_user_id
      )
    )
    and (
      coalesce(btrim(p_jenis), '') = ''
      or lower(t.jenis_transaksi) = lower(btrim(p_jenis))
    )
    and (
      coalesce(btrim(p_search), '') = ''
      or coalesce(t.kategori, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(t.nama_item, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(t.keterangan, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(t.penerima, '') ilike '%' || btrim(p_search) || '%'
    )
  )
  select
    count(*)::bigint,
    coalesce(sum(nominal) filter (where lower(jenis_transaksi) = 'pemasukan'), 0)::numeric,
    coalesce(sum(nominal) filter (where lower(jenis_transaksi) = 'pengeluaran'), 0)::numeric
  from scoped;
$$;

revoke all on function public.assert_chattrx_business_rules(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.confirm_chattrx_atomic(uuid) from public, anon, authenticated;
revoke all on function public.update_chattrx_atomic(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_chattrx_totals(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.assert_chattrx_business_rules(jsonb, boolean) to service_role;
grant execute on function public.confirm_chattrx_atomic(uuid) to service_role;
grant execute on function public.update_chattrx_atomic(uuid, jsonb) to service_role;
grant execute on function public.get_chattrx_totals(text, uuid, text, text, text) to service_role;
