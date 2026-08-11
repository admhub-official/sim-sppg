alter table public."CHATTRX_TRANSAKSI"
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_chattrx_transaksi_created_at
  on public."CHATTRX_TRANSAKSI" (created_at desc);
