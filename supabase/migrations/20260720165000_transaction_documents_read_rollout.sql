-- Transaction document normalization rollout marker.
-- Database objects and backfill were applied directly to project dmjsgtichrfxhyywstrt.
-- This migration keeps repository history aligned and is intentionally idempotent.

create table if not exists public."TRANSAKSI_DOCUMENTS" (
  id uuid primary key default gen_random_uuid(),
  transaksi_id text not null,
  document_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  original_file_name text,
  uploaded_by text,
  source text default 'APPLICATION',
  legacy_source_column text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transaksi_documents_transaksi_id
  on public."TRANSAKSI_DOCUMENTS" (transaksi_id);

create index if not exists idx_transaksi_documents_type
  on public."TRANSAKSI_DOCUMENTS" (document_type);

create unique index if not exists transaksi_documents_one_type_per_transaction
  on public."TRANSAKSI_DOCUMENTS" (transaksi_id, document_type);
