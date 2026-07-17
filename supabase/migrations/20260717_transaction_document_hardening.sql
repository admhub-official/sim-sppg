create table if not exists public."TRANSAKSI_PAYMENT_PROOFS" (
  id uuid primary key default gen_random_uuid(),
  transaksi_id text not null references public."TRANSAKSI"("ID") on delete cascade,
  payment_sequence integer not null,
  nominal numeric(18,2) not null check (nominal > 0),
  storage_bucket text not null default 'transaksi-images',
  storage_path text not null,
  mime_type text,
  original_file_name text,
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  status text not null default 'MENUNGGU_VERIFIKASI',
  verified_by text,
  verified_at timestamptz,
  verifier_signature_path text,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaksi_id, payment_sequence)
);

create index if not exists idx_tx_payment_proofs_transaksi
  on public."TRANSAKSI_PAYMENT_PROOFS" (transaksi_id, payment_sequence);
create index if not exists idx_tx_payment_proofs_status
  on public."TRANSAKSI_PAYMENT_PROOFS" (status, submitted_at desc);

alter table public."TRANSAKSI_PAYMENT_PROOFS" enable row level security;

create or replace function public.sync_transaction_document_status()
returns trigger
language plpgsql
as $$
declare
  missing_parts text[] := array[]::text[];
  has_bukti boolean;
  has_ttd boolean;
  has_nota boolean;
begin
  has_bukti := coalesce(nullif(trim(new."UPLOUD FOTO"), ''), nullif(trim(new."UPLOUD FILE"), '')) is not null
               and upper(coalesce(nullif(trim(new."UPLOUD FOTO"), ''), nullif(trim(new."UPLOUD FILE"), ''))) not in ('FOTO','FILE','-');
  has_ttd := nullif(trim(coalesce(new."TTD USER", '')), '') is not null and trim(coalesce(new."TTD USER", '')) <> '-';
  has_nota := nullif(trim(coalesce(new."NOTA PEMBELIAN", '')), '') is not null and trim(coalesce(new."NOTA PEMBELIAN", '')) <> '-';

  if not has_bukti then missing_parts := array_append(missing_parts, 'Bukti Transaksi'); end if;
  if not has_ttd then missing_parts := array_append(missing_parts, 'TTD User'); end if;
  if not has_nota then missing_parts := array_append(missing_parts, 'Nota Pembelian'); end if;

  if cardinality(missing_parts) = 0 then
    new."STATUS DOKUMEN" := 'Dokumen Lengkap';
  else
    new."STATUS DOKUMEN" := 'Dokumen Tidak Lengkap: ' || array_to_string(missing_parts, ', ');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_transaction_document_status on public."TRANSAKSI";
create trigger trg_sync_transaction_document_status
before insert or update of "UPLOUD FOTO", "UPLOUD FILE", "TTD USER", "NOTA PEMBELIAN"
on public."TRANSAKSI"
for each row execute function public.sync_transaction_document_status();
