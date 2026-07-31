create or replace function public.enforce_transaction_category_supplier_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text := upper(btrim(coalesce(new."Kategori", '')));
  v_type text := btrim(coalesce(new."Jenis Kategori", ''));
  v_supplier_required boolean;
  v_supplier record;
  v_type_unchanged boolean := tg_op = 'UPDATE'
    and upper(btrim(coalesce(old."Kategori", ''))) = v_category
    and btrim(coalesce(old."Jenis Kategori", '')) = v_type;
begin
  if v_category = 'PEMASUKAN' then
    if not v_type_unchanged and v_type not in (
      'Anggaran Bahan Baku',
      'Anggaran Sewa Mobil',
      'Anggaran Insentif Fasilitas'
    ) then
      raise exception 'Jenis kategori pemasukan tidak diizinkan.';
    end if;
  elsif v_category = 'PENGELUARAN' then
    if not v_type_unchanged and v_type not in (
      'Belanja Bahan Baku',
      'Material Bangunan',
      'Gas LPG',
      'Sewa & Utilitas (AC/WIFI)',
      'IPAL',
      'Inventaris Kantor',
      'Cetak & Promosi',
      'Gaji/Upah Karyawan',
      'Operasional Perjalanan',
      'Konsumsi',
      'Dana Talangan',
      'Cicilan',
      'Fee Yayasan',
      'Administrasi & Lainnya'
    ) then
      raise exception 'Jenis kategori pengeluaran tidak diizinkan.';
    end if;
  else
    raise exception 'Kategori transaksi hanya boleh PEMASUKAN atau PENGELUARAN.';
  end if;

  v_supplier_required := v_category = 'PENGELUARAN' and v_type in (
    'Belanja Bahan Baku',
    'Material Bangunan',
    'Gas LPG',
    'Sewa & Utilitas (AC/WIFI)',
    'IPAL',
    'Inventaris Kantor',
    'Cetak & Promosi'
  );

  if v_category = 'PENGELUARAN' and nullif(btrim(coalesce(new."SUPPLIER ID", '')), '') is not null then
    select
      ms."ID", ms."NAMA SUPPLIER", ms."NAMA BANK", ms."NO REKENING",
      ms."ATAS NAMA REKENING", ms."STATUS"
    into v_supplier
    from public."MASTER_SUPPLIER" ms
    where ms."ID" = new."SUPPLIER ID"
    limit 1;

    if not found then
      raise exception 'Supplier yang dipilih tidak ditemukan di Data Supplier.';
    end if;
    if lower(btrim(coalesce(v_supplier."STATUS", 'Aktif'))) <> 'aktif' then
      raise exception 'Supplier yang dipilih tidak aktif.';
    end if;

    new."NAMA SUPPLIER" := v_supplier."NAMA SUPPLIER";
    new."NAMA BANK SUPPLIER" := v_supplier."NAMA BANK";
    new."NO REKENING SUPPLIER" := v_supplier."NO REKENING";
    new."ATAS NAMA REKENING SUPPLIER" := v_supplier."ATAS NAMA REKENING";
    new."SUMBER SUPPLIER" := 'MASTER';
  elsif v_supplier_required then
    raise exception 'Nama supplier/penjual wajib dipilih dari Data Supplier. Buat supplier baru terlebih dahulu bila belum tersedia.';
  elsif v_category = 'PEMASUKAN' then
    new."SUPPLIER ID" := null;
    new."NAMA SUPPLIER" := null;
    new."NAMA BANK SUPPLIER" := null;
    new."NO REKENING SUPPLIER" := null;
    new."ATAS NAMA REKENING SUPPLIER" := null;
    new."SUMBER SUPPLIER" := null;
  end if;

  return new;
end;
$$;
