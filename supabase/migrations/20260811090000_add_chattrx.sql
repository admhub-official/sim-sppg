create table if not exists public."CHATTRX_DRAFT" (
  draft_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sppg text not null default '', yayasan text not null default '',
  jenis_transaksi text check (jenis_transaksi in ('pemasukan','pengeluaran')),
  kategori text, nama_item text, keterangan text, nominal numeric check (nominal is null or nominal > 0),
  status_pembayaran text check (status_pembayaran in ('sudah_dibayar','belum_dibayar')),
  foto_nota_url text, foto_bukti_bayar_url text,
  verifikasi_nota jsonb, verifikasi_bukti_bayar jsonb,
  status text not null default 'in_progress' check (status in ('in_progress','pending_review','confirmed','rejected')),
  current_state text not null default 'jenis_transaksi', detail_confirmed boolean not null default false, chat_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public."CHATTRX_KATEGORI" (
  kategori_id uuid primary key default gen_random_uuid(), nama_kategori text not null,
  jenis_transaksi text check (jenis_transaksi in ('pemasukan','pengeluaran','keduanya')),
  sppg text not null default '', yayasan text not null default '', jumlah_pemakaian integer not null default 1,
  created_at timestamptz not null default now(), unique(nama_kategori,jenis_transaksi,sppg,yayasan)
);
alter table public."CHATTRX_DRAFT" enable row level security;
alter table public."CHATTRX_KATEGORI" enable row level security;
grant select,insert,update on public."CHATTRX_DRAFT" to authenticated;
grant select,insert,update on public."CHATTRX_KATEGORI" to authenticated;
create policy "ChatTrx draft owner read" on public."CHATTRX_DRAFT" for select to authenticated using ((select auth.uid())=user_id);
create policy "ChatTrx draft owner insert" on public."CHATTRX_DRAFT" for insert to authenticated with check ((select auth.uid())=user_id);
create policy "ChatTrx draft owner update" on public."CHATTRX_DRAFT" for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "ChatTrx category authenticated read" on public."CHATTRX_KATEGORI" for select to authenticated using (true);
-- Writes are performed only by role-checked Edge Functions using service_role.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('chattrx-evidence','chattrx-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy "ChatTrx evidence owner read" on storage.objects for select to authenticated using (bucket_id='chattrx-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
