alter table public."CHATTRX_DRAFT"
  add column if not exists tanggal_transaksi timestamptz,
  add column if not exists penerima text;

alter table public."CHATTRX_TRANSAKSI"
  add column if not exists tanggal_transaksi timestamptz,
  add column if not exists penerima text,
  alter column foto_nota_url drop not null,
  alter column verifikasi_nota drop not null,
  alter column ttd_konfirmasi_url drop not null;

comment on column public."CHATTRX_TRANSAKSI".foto_nota_url is
  'Nota bersifat kontekstual; tidak wajib untuk kategori non-pembelian seperti gaji.';
