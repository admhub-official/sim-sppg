-- Follow-up hardening from Supabase security/performance advisors (2026-09-05).
-- Keep browser roles away from internal SECURITY DEFINER/trigger helpers.

revoke all on function public.cleanup_account_registration_otp() from public, anon, authenticated;
revoke all on function public.create_user_profile_by_registration(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.enforce_transaction_category_supplier_rules() from public, anon, authenticated;
revoke all on function public.fill_transaction_yayasan_from_sppg() from public, anon, authenticated;
revoke all on function public.fill_user_yayasan_from_sppg() from public, anon, authenticated;
revoke all on function public.storage_cleanup_queue_guard() from public, anon, authenticated;
revoke all on function public.sync_normalized_document_to_transaction_legacy() from public, anon, authenticated;
revoke all on function public.sync_transaction_legacy_documents_to_normalized() from public, anon, authenticated;

grant execute on function public.create_user_profile_by_registration(uuid, uuid, text, text, text) to service_role;

-- Trigger functions should have a fixed search path even when invoked indirectly.
alter function public.set_transaction_documents_updated_at() set search_path = public, pg_temp;

-- Cover foreign keys used by ChatTrx and Document Center joins/cascades.
create index if not exists chattrx_draft_user_id_idx
  on public."CHATTRX_DRAFT" (user_id);
create index if not exists doc_audit_log_user_id_idx
  on public."DOC_AUDIT_LOG" (user_id);
create index if not exists doc_favorites_file_id_idx
  on public."DOC_FAVORITES" (file_id);
create index if not exists doc_files_folder_id_idx
  on public."DOC_FILES" (folder_id);
create index if not exists doc_files_created_by_idx
  on public."DOC_FILES" (created_by);
create index if not exists doc_files_deleted_by_idx
  on public."DOC_FILES" (deleted_by);
create index if not exists doc_folders_parent_id_idx
  on public."DOC_FOLDERS" (parent_id);
create index if not exists doc_folders_created_by_idx
  on public."DOC_FOLDERS" (created_by);
create index if not exists doc_folders_deleted_by_idx
  on public."DOC_FOLDERS" (deleted_by);

-- The application searches document names using ILIKE '%term%'.
-- Trigram indexes match that query pattern; the older tsvector index can remain
-- until production query plans are observed long enough to decide whether to drop it.
create extension if not exists pg_trgm with schema extensions;
create index if not exists doc_files_name_trgm_idx
  on public."DOC_FILES" using gin (name extensions.gin_trgm_ops);
create index if not exists doc_folders_name_trgm_idx
  on public."DOC_FOLDERS" using gin (name extensions.gin_trgm_ops);

-- Supabase advisor confirmed these two indexes are identical. Keep the older
-- rollout index because it is referenced in the migration history.
drop index if exists public.transaksi_documents_unique_type;
