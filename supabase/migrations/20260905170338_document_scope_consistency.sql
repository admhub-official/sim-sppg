-- Keep document metadata aligned with its destination folder for every write path.
create or replace function public.enforce_doc_file_folder_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_row record;
begin
  if new.folder_id is null then
    return new;
  end if;

  select sppg, yayasan, is_template
    into parent_row
  from public."DOC_FOLDERS"
  where id = new.folder_id;

  if not found then
    raise exception 'Folder dokumen tidak ditemukan.' using errcode = '23503';
  end if;

  if coalesce(parent_row.sppg, '') <> coalesce(new.sppg, '')
     or coalesce(parent_row.yayasan, '') <> coalesce(new.yayasan, '') then
    raise exception 'Scope SPPG/Yayasan file harus sama dengan folder tujuan.' using errcode = '23514';
  end if;

  if parent_row.is_template is distinct from new.is_template then
    raise exception 'Jenis file template harus sama dengan folder tujuan.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_doc_file_folder_scope() from public, anon, authenticated;
grant execute on function public.enforce_doc_file_folder_scope() to service_role;

drop trigger if exists doc_files_scope_consistency_guard on public."DOC_FILES";
create trigger doc_files_scope_consistency_guard
before insert or update of folder_id, sppg, yayasan, is_template
on public."DOC_FILES"
for each row
execute function public.enforce_doc_file_folder_scope();
