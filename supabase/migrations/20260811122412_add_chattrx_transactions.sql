create table if not exists public."CHATTRX_TRANSAKSI" (
  transaksi_id uuid primary key default gen_random_uuid(),
  draft_id uuid not null unique references public."CHATTRX_DRAFT"(draft_id),
  user_id uuid not null references auth.users(id),
  sppg text not null default '',
  yayasan text not null default '',
  jenis_transaksi text not null check (jenis_transaksi in ('pemasukan','pengeluaran')),
  kategori text not null,
  nama_item text not null,
  keterangan text not null,
  nominal numeric not null check (nominal > 0),
  status_pembayaran text not null check (status_pembayaran in ('sudah_dibayar','belum_dibayar')),
  foto_nota_url text not null,
  foto_bukti_bayar_url text,
  ttd_konfirmasi_url text not null,
  verifikasi_nota jsonb not null,
  verifikasi_bukti_bayar jsonb,
  chat_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public."CHATTRX_TRANSAKSI" enable row level security;
grant select on public."CHATTRX_TRANSAKSI" to authenticated;
create policy "ChatTrx transaction owner read"
  on public."CHATTRX_TRANSAKSI" for select to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists chattrx_transaksi_user_created_idx
  on public."CHATTRX_TRANSAKSI" (user_id, created_at desc);
