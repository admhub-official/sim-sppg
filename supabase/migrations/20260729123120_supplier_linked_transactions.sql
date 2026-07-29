-- Supplier payment identity and catalog. Arrays are appropriate here because
-- item names are small tags owned by one supplier and are always read together.
alter table public."MASTER_SUPPLIER"
  add column if not exists "NAMA BANK" text,
  add column if not exists "NO REKENING" text,
  add column if not exists "ATAS NAMA REKENING" text,
  add column if not exists "ITEM YANG DIJUAL" text[] not null default '{}'::text[];

-- Keep a supplier reference for current joins and immutable payment snapshots
-- for audit/history. Existing transactions stay nullable for compatibility.
alter table public."TRANSAKSI"
  add column if not exists "SUPPLIER ID" text,
  add column if not exists "NAMA SUPPLIER" text,
  add column if not exists "NAMA BANK SUPPLIER" text,
  add column if not exists "NO REKENING SUPPLIER" text,
  add column if not exists "ATAS NAMA REKENING SUPPLIER" text,
  add column if not exists "SUMBER SUPPLIER" text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transaksi_supplier_id_fkey'
      and conrelid = 'public."TRANSAKSI"'::regclass
  ) then
    alter table public."TRANSAKSI"
      add constraint transaksi_supplier_id_fkey
      foreign key ("SUPPLIER ID")
      references public."MASTER_SUPPLIER" ("ID")
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transaksi_sumber_supplier_check'
      and conrelid = 'public."TRANSAKSI"'::regclass
  ) then
    alter table public."TRANSAKSI"
      add constraint transaksi_sumber_supplier_check
      check (
        "SUMBER SUPPLIER" is null
        or "SUMBER SUPPLIER" in ('MASTER', 'MANUAL')
      );
  end if;
end
$$;

create index if not exists transaksi_supplier_id_idx
  on public."TRANSAKSI" ("SUPPLIER ID")
  where "SUPPLIER ID" is not null;

create index if not exists transaksi_pengeluaran_supplier_payment_idx
  on public."TRANSAKSI" ("NAMA SUPPLIER", "Tanggal" desc)
  where "Kategori" = 'PENGELUARAN'
    and "Metode Transaksi" not in ('SUDAH_DIBAYAR', 'LUNAS');

comment on column public."TRANSAKSI"."NAMA SUPPLIER" is
  'Snapshot nama supplier saat transaksi dibuat agar histori pembayaran tidak berubah saat master diedit.';
comment on column public."TRANSAKSI"."NO REKENING SUPPLIER" is
  'Snapshot nomor rekening supplier saat transaksi dibuat; jangan diganti otomatis dari master.';

-- Extend the existing atomic writers so supplier identity is committed in the
-- same database transaction as the transaction core and normalized documents.
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
    "SUPPLIER ID", "NAMA SUPPLIER", "NAMA BANK SUPPLIER", "NO REKENING SUPPLIER",
    "ATAS NAMA REKENING SUPPLIER", "SUMBER SUPPLIER",
    "APPROVED BY", "WAKTU APPROVE", "Catatan_1", "Catatan Approval", "Deskripsi"
  ) values (
    v_id, p_transaction->>'Kode Pemasukan', (p_transaction->>'Tanggal')::date,
    p_transaction->>'Kategori', p_transaction->>'Jenis Kategori', p_transaction->>'SPPG',
    p_transaction->>'YAYASAN', (p_transaction->>'Nominal')::numeric,
    coalesce(p_transaction->>'Catatan',''), coalesce((p_transaction->>'Timestamp')::timestamptz,now()),
    p_transaction->>'User', p_transaction->>'Nama Item/ Bahan Baku', p_transaction->>'Metode Transaksi',
    nullif(p_transaction->>'SUPPLIER ID',''), nullif(p_transaction->>'NAMA SUPPLIER',''),
    nullif(p_transaction->>'NAMA BANK SUPPLIER',''), nullif(p_transaction->>'NO REKENING SUPPLIER',''),
    nullif(p_transaction->>'ATAS NAMA REKENING SUPPLIER',''), nullif(p_transaction->>'SUMBER SUPPLIER',''),
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
    "SUPPLIER ID"=case when p_patch?'SUPPLIER ID' then nullif(p_patch->>'SUPPLIER ID','') else "SUPPLIER ID" end,
    "NAMA SUPPLIER"=case when p_patch?'NAMA SUPPLIER' then nullif(p_patch->>'NAMA SUPPLIER','') else "NAMA SUPPLIER" end,
    "NAMA BANK SUPPLIER"=case when p_patch?'NAMA BANK SUPPLIER' then nullif(p_patch->>'NAMA BANK SUPPLIER','') else "NAMA BANK SUPPLIER" end,
    "NO REKENING SUPPLIER"=case when p_patch?'NO REKENING SUPPLIER' then nullif(p_patch->>'NO REKENING SUPPLIER','') else "NO REKENING SUPPLIER" end,
    "ATAS NAMA REKENING SUPPLIER"=case when p_patch?'ATAS NAMA REKENING SUPPLIER' then nullif(p_patch->>'ATAS NAMA REKENING SUPPLIER','') else "ATAS NAMA REKENING SUPPLIER" end,
    "SUMBER SUPPLIER"=case when p_patch?'SUMBER SUPPLIER' then nullif(p_patch->>'SUMBER SUPPLIER','') else "SUMBER SUPPLIER" end,
    "Catatan Approval"=case when p_patch?'Catatan Approval' then p_patch->>'Catatan Approval' else "Catatan Approval" end,
    "Catatan_1"=case when p_patch?'Catatan_1' then p_patch->>'Catatan_1' else "Catatan_1" end
  where "ID"=p_transaksi_id returning * into v_row;

  if not found then raise exception 'Transaksi tidak ditemukan'; end if;
  perform public.save_transaction_documents_atomic(p_transaksi_id,p_documents,p_uploaded_by,'APPLICATION_NORMALIZED');
  select * into v_row from public."TRANSAKSI" where "ID"=p_transaksi_id;
  return to_jsonb(v_row);
end;
$$;
