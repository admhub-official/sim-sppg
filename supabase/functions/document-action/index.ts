import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const BUCKET = 'sppg-documents';
const MAX_BYTES = 15 * 1024 * 1024;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });
const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();
const safeName = (value: unknown, fallback = 'File') => text(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240) || fallback;
const forbiddenName = /\.(exe|msi|apk|bat|cmd|com|scr|ps1|vbs|js|mjs|cjs|jar|sh|php|py|rb|pl|cgi|dll)$/i;

type Caller = { id: string; email: string; username: string; role: string; sppg: string; yayasan: string };
type Scope = { sppg: string; yayasan: string };
type PageResult = { rows: any[]; total: number };

async function getCaller(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const profile = await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN"').eq('ID', auth.data.user.id).maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil pengguna tidak ditemukan.');
  return {
    id: text(profile.data.ID),
    email: lower(auth.data.user.email || profile.data.EMAIL),
    username: lower(profile.data.USERNAME),
    role: text(profile.data.ROLE).toUpperCase(),
    sppg: text(profile.data.SPPG),
    yayasan: text(profile.data['NAMA YAYASAN'])
  };
}

async function availableScopes(caller: Caller): Promise<Scope[]> {
  if (caller.role === 'SUPER_ADMIN') {
    const result = await sb.from('USERS').select('SPPG,"NAMA YAYASAN"').neq('SPPG', '').order('SPPG');
    if (result.error) throw result.error;
    const seen = new Set<string>();
    return (result.data || []).map((row: any) => ({ sppg: text(row.SPPG), yayasan: text(row['NAMA YAYASAN']) }))
      .filter((scope: Scope) => scope.sppg && !seen.has(scope.sppg + '|' + scope.yayasan) && !!seen.add(scope.sppg + '|' + scope.yayasan));
  }
  if (caller.role === 'ADMIN') {
    const result = await sb.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email', caller.email).order('sppg');
    if (result.error) throw result.error;
    return (result.data || []).map((row: any) => ({ sppg: text(row.sppg), yayasan: text(row.yayasan) }));
  }
  return caller.sppg ? [{ sppg: caller.sppg, yayasan: caller.yayasan }] : [];
}

async function resolveScope(caller: Caller, input: any, allowAll = false, knownScopes?: Scope[]): Promise<Scope | null> {
  const requested = { sppg: text(input?.sppg), yayasan: text(input?.yayasan) };
  const scopes = knownScopes || await availableScopes(caller);
  if (caller.role === 'SUPER_ADMIN' && allowAll && !requested.sppg) return null;
  if (requested.sppg) {
    if (caller.role === 'SUPER_ADMIN' || scopes.some(scope => scope.sppg === requested.sppg && (!requested.yayasan || scope.yayasan === requested.yayasan))) {
      return requested;
    }
    throw new Error('Akses cakupan SPPG ditolak.');
  }
  if (scopes[0]) return scopes[0];
  throw new Error('Akun belum memiliki cakupan SPPG.');
}

function canManageTemplates(caller: Caller) {
  return caller.role === 'ADMIN' || caller.role === 'SUPER_ADMIN';
}

async function audit(caller: Caller, action: string, entityType: 'FILE' | 'FOLDER', entity: any, detail: any = {}) {
  const result = await sb.from('DOC_AUDIT_LOG').insert({
    user_id: caller.id, user_email: caller.email, user_role: caller.role,
    action, entity_type: entityType, entity_id: entity.id, entity_name: entity.name,
    sppg: text(entity.sppg), yayasan: text(entity.yayasan), detail
  });
  if (result.error) console.error('document audit', result.error.message);
}

async function assertFolder(caller: Caller, folderId: unknown, scope: Scope | null) {
  const id = text(folderId);
  if (!id) return null;
  const result = await sb.from('DOC_FOLDERS').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (result.error || !result.data) throw new Error('Folder tidak ditemukan.');
  const folder = result.data;
  if (folder.is_template) {
    const isGlobal = !text(folder.sppg) && !text(folder.yayasan);
    const isOwnScope = !!scope && text(folder.sppg) === scope.sppg && text(folder.yayasan) === scope.yayasan;
    if (!isGlobal && caller.role !== 'SUPER_ADMIN' && !isOwnScope) throw new Error('Akses folder ditolak.');
    return folder;
  }
  if (caller.role !== 'SUPER_ADMIN' && (!scope || text(folder.sppg) !== scope.sppg || text(folder.yayasan) !== scope.yayasan)) {
    throw new Error('Akses folder ditolak.');
  }
  return folder;
}

async function ensureDefaultFolders(caller: Caller, scope: Scope) {
  const names = ['Penerima Manfaat', 'Dokumentasi Dapur', 'Legalitas dan Perizinan', 'Supplier', 'Keuangan', 'SDM', 'Pemeriksaan dan Audit', 'Surat Menyurat'];
  const check = await sb.from('DOC_FOLDERS').select('name').eq('sppg', scope.sppg).eq('yayasan', scope.yayasan).is('parent_id', null).eq('is_template', false).is('deleted_at', null);
  if (check.error) throw check.error;
  const existing = new Set((check.data || []).map((row: any) => lower(row.name)));
  const missing = names.filter(name => !existing.has(lower(name)));
  if (!missing.length) return;
  const result = await sb.from('DOC_FOLDERS').insert(missing.map(name => ({
    name, sppg: scope.sppg, yayasan: scope.yayasan, created_by: caller.id, created_by_email: caller.email
  })));
  if (result.error && !/duplicate/i.test(result.error.message)) console.error('default folders', result.error.message);
}

async function breadcrumbs(folder: any) {
  const items: any[] = [];
  let current = folder;
  for (let depth = 0; current && depth < 20; depth += 1) {
    items.unshift({ id: current.id, name: current.name });
    if (!current.parent_id) break;
    const result = await sb.from('DOC_FOLDERS').select('id,parent_id,name').eq('id', current.parent_id).maybeSingle();
    current = result.data;
  }
  return items;
}

function stableSort(rows: any[], recent: boolean) {
  return rows.sort((a, b) => {
    if (recent) {
      const delta = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      if (delta) return delta;
    } else {
      const delta = text(a.name).localeCompare(text(b.name), 'id-ID', { sensitivity: 'base' });
      if (delta) return delta;
    }
    return text(a.id).localeCompare(text(b.id));
  });
}

function configureBaseQuery(query: any, options: {
  trash: boolean; search: string; folder: any; view: string; isFile: boolean; favoriteIds: string[];
}) {
  const { trash, search, folder, view, isFile, favoriteIds } = options;
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (!trash && !search && view !== 'recent' && view !== 'favorites') {
    const column = isFile ? 'folder_id' : 'parent_id';
    query = folder ? query.eq(column, folder.id) : query.is(column, null);
  }
  if (search) query = query.ilike('name', `%${search}%`);
  if (isFile && view === 'favorites') {
    query = favoriteIds.length ? query.in('id', favoriteIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  return query;
}

async function fetchPage(table: 'DOC_FOLDERS' | 'DOC_FILES', columns: string, options: {
  caller: Caller; scope: Scope | null; templates: boolean; trash: boolean; search: string; folder: any;
  view: string; isFile: boolean; favoriteIds: string[]; from: number; to: number;
}): Promise<PageResult> {
  const { caller, scope, templates, from, to, isFile } = options;
  const recent = isFile && options.view === 'recent';

  const build = (scopeKind: 'normal' | 'global' | 'assigned') => {
    let query: any = sb.from(table).select(columns, { count: 'exact' }).eq('is_template', templates);
    query = configureBaseQuery(query, options);
    if (scopeKind === 'global') query = query.eq('sppg', '').eq('yayasan', '');
    else if (scopeKind === 'assigned' && scope) query = query.eq('sppg', scope.sppg).eq('yayasan', scope.yayasan);
    else if (scope && !templates) query = query.eq('sppg', scope.sppg).eq('yayasan', scope.yayasan);
    query = recent
      ? query.order('updated_at', { ascending: false }).order('id', { ascending: true })
      : query.order('name', { ascending: true }).order('id', { ascending: true });
    return query;
  };

  if (templates && scope && caller.role !== 'SUPER_ADMIN') {
    const fetchThrough = to;
    const [globalResult, assignedResult] = await Promise.all([
      build('global').range(0, fetchThrough),
      build('assigned').range(0, fetchThrough)
    ]);
    if (globalResult.error) throw globalResult.error;
    if (assignedResult.error) throw assignedResult.error;
    const rows = stableSort([...(globalResult.data || []), ...(assignedResult.data || [])], recent).slice(from, to + 1);
    return { rows, total: Number(globalResult.count || 0) + Number(assignedResult.count || 0) };
  }

  const result = await build('normal').range(from, to);
  if (result.error) throw result.error;
  return { rows: result.data || [], total: Number(result.count || 0) };
}

async function listDocuments(caller: Caller, input: any) {
  const view = text(input?.view || 'files').toLowerCase();
  const allowedViews = ['files', 'templates', 'recent', 'favorites', 'trash'];
  if (!allowedViews.includes(view)) throw new Error('Tampilan dokumen tidak valid.');

  const scopes = await availableScopes(caller);
  const scope = await resolveScope(caller, input, caller.role === 'SUPER_ADMIN', scopes);
  if (scope && view !== 'templates' && view !== 'trash') await ensureDefaultFolders(caller, scope);
  const folder = await assertFolder(caller, input?.folderId, scope);
  const search = text(input?.search).slice(0, 100);
  const trash = view === 'trash';
  const templates = view === 'templates';
  const page = Math.max(1, Number(input?.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(input?.pageSize) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const favoritesResult = await sb.from('DOC_FAVORITES').select('file_id').eq('user_id', caller.id);
  if (favoritesResult.error) throw favoritesResult.error;
  const favoriteIds = (favoritesResult.data || []).map((row: any) => text(row.file_id)).filter(Boolean);
  const favoriteSet = new Set(favoriteIds);

  const folderColumns = 'id,parent_id,name,sppg,yayasan,is_template,created_by_email,created_at,updated_at,deleted_at';
  const fileColumns = 'id,folder_id,name,mime_type,size_bytes,sppg,yayasan,is_template,classification,source_type,created_by,created_by_email,created_at,updated_at,deleted_at';

  // Recent/Favorites are file-centric views. Avoid querying unrelated folders.
  const foldersPage = ['recent', 'favorites'].includes(view)
    ? { rows: [], total: 0 }
    : await fetchPage('DOC_FOLDERS', folderColumns, {
        caller, scope, templates, trash, search, folder, view, isFile: false,
        favoriteIds, from, to
      });

  const filesPage = await fetchPage('DOC_FILES', fileColumns, {
    caller, scope, templates, trash, search, folder, view, isFile: true,
    favoriteIds, from, to
  });

  const files = filesPage.rows.map((file: any) => ({ ...file, favorite: favoriteSet.has(text(file.id)) }));
  const total = Math.max(foldersPage.total, filesPage.total);

  return {
    success: true,
    folders: foldersPage.rows,
    files,
    breadcrumbs: await breadcrumbs(folder),
    scopes,
    currentScope: scope,
    canManageTemplates: canManageTemplates(caller),
    role: caller.role,
    pagination: {
      page,
      pageSize,
      folderTotal: foldersPage.total,
      fileTotal: filesPage.total,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

async function createFolder(caller: Caller, input: any) {
  const scope = await resolveScope(caller, input);
  const isTemplate = input?.isTemplate === true;
  if (isTemplate && !canManageTemplates(caller)) throw new Error('Hanya Admin yang dapat membuat folder template.');
  const parent = await assertFolder(caller, input?.parentId, scope);
  if (parent && Boolean(parent.is_template) !== isTemplate) throw new Error('Folder biasa dan folder template tidak dapat dicampur.');
  if (parent?.is_template && !text(parent.sppg) && caller.role !== 'SUPER_ADMIN') throw new Error('Template pusat hanya dapat diubah oleh Super Admin.');
  const name = safeName(input?.name, 'Folder Baru').slice(0, 120);
  const result = await sb.from('DOC_FOLDERS').insert({
    parent_id: parent?.id || null, name, sppg: isTemplate && caller.role === 'SUPER_ADMIN' && input?.global === true ? '' : scope!.sppg,
    yayasan: isTemplate && caller.role === 'SUPER_ADMIN' && input?.global === true ? '' : scope!.yayasan,
    is_template: isTemplate, created_by: caller.id, created_by_email: caller.email
  }).select('*').single();
  if (result.error) throw new Error(result.error.code === '23505' ? 'Nama folder sudah digunakan.' : result.error.message);
  await audit(caller, 'CREATE', 'FOLDER', result.data);
  return { success: true, folder: result.data, message: 'Folder berhasil dibuat.' };
}

function decodeBase64(value: unknown) {
  const normalized = text(value).replace(/^data:[^,]+,/, '');
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function folderStoresPersonalData(folder: any) {
  let current = folder;
  for (let depth = 0; current && depth < 20; depth += 1) {
    if (/penerima\s+manfaat/i.test(text(current.name))) return true;
    if (!current.parent_id) break;
    const result = await sb.from('DOC_FOLDERS').select('id,parent_id,name').eq('id', current.parent_id).maybeSingle();
    current = result.data;
  }
  return false;
}

async function saveFile(caller: Caller, input: any, sourceType: 'UPLOAD' | 'IN_APP') {
  const scope = await resolveScope(caller, input);
  const isTemplate = input?.isTemplate === true;
  if (isTemplate && !canManageTemplates(caller)) throw new Error('Hanya Admin yang dapat membuat template.');
  const folder = await assertFolder(caller, input?.folderId, scope);
  if (folder && Boolean(folder.is_template) !== isTemplate) throw new Error('File biasa dan template harus disimpan pada lokasi yang sesuai.');
  if (folder?.is_template && !text(folder.sppg) && caller.role !== 'SUPER_ADMIN') throw new Error('Template pusat hanya dapat diubah oleh Super Admin.');
  const name = safeName(input?.name, sourceType === 'IN_APP' ? 'Dokumen Baru.txt' : 'File');
  if (forbiddenName.test(name)) throw new Error('Jenis file ini tidak diizinkan demi keamanan.');
  const mime = text(input?.mimeType || (sourceType === 'IN_APP' ? 'text/plain' : 'application/octet-stream')).slice(0, 150);
  if (/application\/(x-msdownload|x-msdos-program|x-sh|x-executable)/i.test(mime)) throw new Error('Jenis file ini tidak diizinkan demi keamanan.');
  const bytes = sourceType === 'IN_APP' ? new TextEncoder().encode(text(input?.content).slice(0, 1_000_000)) : decodeBase64(input?.base64);
  if (!bytes.byteLength) throw new Error('File kosong tidak dapat disimpan.');
  if (bytes.byteLength > MAX_BYTES) throw new Error('Ukuran file maksimal 15 MB pada versi ini.');
  const fileId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const scopeKey = (scope!.sppg || 'global').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const extension = (name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] || (sourceType === 'IN_APP' ? '.txt' : '')).toLowerCase();
  const storagePath = `${scopeKey}/${fileId}/${versionId}${extension}`;
  const upload = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mime, cacheControl: '3600', upsert: false });
  if (upload.error) throw new Error(`Upload gagal: ${upload.error.message}`);
  const requestedClassification = ['INTERNAL','SPPG_RESTRICTED','CONFIDENTIAL','PERSONAL_DATA'].includes(text(input?.classification)) ? text(input.classification) : 'INTERNAL';
  const classification = await folderStoresPersonalData(folder) ? 'PERSONAL_DATA' : requestedClassification;
  const inserted = await sb.from('DOC_FILES').insert({
    id: fileId, folder_id: folder?.id || null, name, storage_path: storagePath, mime_type: mime,
    size_bytes: bytes.byteLength, sppg: isTemplate && caller.role === 'SUPER_ADMIN' && input?.global === true ? '' : scope!.sppg,
    yayasan: isTemplate && caller.role === 'SUPER_ADMIN' && input?.global === true ? '' : scope!.yayasan,
    is_template: isTemplate, classification, source_type: sourceType,
    created_by: caller.id, created_by_email: caller.email
  }).select('*').single();
  if (inserted.error) {
    await sb.storage.from(BUCKET).remove([storagePath]);
    throw new Error(inserted.error.message);
  }
  await audit(caller, 'UPLOAD', 'FILE', inserted.data, { mime, size: bytes.byteLength, sourceType });
  return { success: true, file: inserted.data, message: isTemplate ? 'Template berhasil disimpan.' : 'File berhasil diunggah.' };
}

async function getFile(caller: Caller, input: any) {
  const scope = await resolveScope(caller, input, caller.role === 'SUPER_ADMIN');
  const result = await sb.from('DOC_FILES').select('*').eq('id', text(input?.fileId)).maybeSingle();
  if (result.error || !result.data) throw new Error('File tidak ditemukan.');
  const file = result.data;
  const permittedTemplate = file.is_template && (file.sppg === '' || caller.role === 'SUPER_ADMIN' || (scope && file.sppg === scope.sppg && file.yayasan === scope.yayasan));
  const permittedScope = caller.role === 'SUPER_ADMIN' || (scope && file.sppg === scope.sppg && file.yayasan === scope.yayasan);
  if (!permittedTemplate && !permittedScope) throw new Error('Akses file ditolak.');
  const signed = await sb.storage.from(BUCKET).createSignedUrl(file.storage_path, 600, { download: input?.download === true ? file.name : false });
  if (signed.error || !signed.data?.signedUrl) throw new Error('File tidak dapat dibuka.');
  await audit(caller, input?.download === true ? 'DOWNLOAD' : 'PREVIEW', 'FILE', file);
  return { success: true, file: { ...file, url: signed.data.signedUrl, expiresIn: 600 } };
}

function sameScope(a: any, b: any) {
  return text(a?.sppg) === text(b?.sppg) && text(a?.yayasan) === text(b?.yayasan);
}

async function mutate(caller: Caller, action: string, input: any) {
  const entityType = text(input?.entityType).toUpperCase() === 'FOLDER' ? 'FOLDER' : 'FILE';
  const table = entityType === 'FOLDER' ? 'DOC_FOLDERS' : 'DOC_FILES';
  const result = await sb.from(table).select('*').eq('id', text(input?.id)).maybeSingle();
  if (result.error || !result.data) throw new Error(`${entityType === 'FOLDER' ? 'Folder' : 'File'} tidak ditemukan.`);
  const entity = result.data;
  const scope = await resolveScope(caller, entity);
  if (caller.role !== 'SUPER_ADMIN' && (text(entity.sppg) !== scope!.sppg || text(entity.yayasan) !== scope!.yayasan)) throw new Error('Akses perubahan ditolak.');
  if (entity.is_template && !canManageTemplates(caller)) throw new Error('Template hanya dapat diubah oleh Admin.');
  if (entity.is_template && !text(entity.sppg) && caller.role !== 'SUPER_ADMIN') throw new Error('Template pusat hanya dapat diubah oleh Super Admin.');

  if (entityType === 'FOLDER' && (action === 'TRASH' || action === 'RESTORE')) {
    const rpcName = action === 'TRASH' ? 'trash_document_subtree_atomic' : 'restore_document_subtree_atomic';
    const args = action === 'TRASH'
      ? { p_folder_id: entity.id, p_deleted_by: caller.id }
      : { p_folder_id: entity.id };
    const changed = await sb.rpc(rpcName, args);
    if (changed.error) throw new Error(changed.error.message);
    const updated = await sb.from('DOC_FOLDERS').select('*').eq('id', entity.id).single();
    if (updated.error) throw new Error(updated.error.message);
    await audit(caller, action, 'FOLDER', updated.data, { subtree: true, changed: changed.data || [] });
    return {
      success: true,
      item: updated.data,
      message: action === 'TRASH' ? 'Folder beserta seluruh isinya dipindahkan ke Sampah.' : 'Folder beserta isinya berhasil dipulihkan.'
    };
  }

  let values: any = { updated_at: new Date().toISOString() };
  if (action === 'RENAME') values.name = safeName(input?.name, entity.name);
  if (action === 'TRASH') values = { ...values, deleted_at: new Date().toISOString(), deleted_by: caller.id };
  if (action === 'RESTORE') values = { ...values, deleted_at: null, deleted_by: null };
  if (action === 'MOVE') {
    if (entityType !== 'FILE') throw new Error('Pemindahan folder belum tersedia pada versi ini.');
    const target = await assertFolder(caller, input?.folderId, scope);
    if (target) {
      if (Boolean(target.is_template) !== Boolean(entity.is_template)) {
        throw new Error('File biasa dan template tidak dapat dipindahkan ke jenis folder yang berbeda.');
      }
      if (!sameScope(target, entity)) {
        throw new Error('File tidak dapat dipindahkan ke folder dengan cakupan SPPG/Yayasan yang berbeda.');
      }
      if (target.is_template && !text(target.sppg) && caller.role !== 'SUPER_ADMIN') {
        throw new Error('Template pusat hanya dapat diubah oleh Super Admin.');
      }
    }
    values.folder_id = target?.id || null;
  }

  const updated = await sb.from(table).update(values).eq('id', entity.id).select('*').single();
  if (updated.error) throw new Error(updated.error.message);
  await audit(caller, action, entityType as 'FILE' | 'FOLDER', updated.data);
  return {
    success: true,
    item: updated.data,
    message: action === 'TRASH' ? 'Dipindahkan ke Sampah.' : action === 'RESTORE' ? 'Berhasil dipulihkan.' : 'Perubahan berhasil disimpan.'
  };
}

async function toggleFavorite(caller: Caller, input: any) {
  const file = await sb.from('DOC_FILES').select('*').eq('id', text(input?.fileId)).is('deleted_at', null).maybeSingle();
  if (file.error || !file.data) throw new Error('File tidak ditemukan.');
  const scope = await resolveScope(caller, file.data, caller.role === 'SUPER_ADMIN');
  const globalTemplate = file.data.is_template && !text(file.data.sppg) && !text(file.data.yayasan);
  if (!globalTemplate && caller.role !== 'SUPER_ADMIN' && (!scope || file.data.sppg !== scope.sppg || file.data.yayasan !== scope.yayasan)) throw new Error('Akses file ditolak.');
  const existing = await sb.from('DOC_FAVORITES').select('file_id').eq('user_id', caller.id).eq('file_id', file.data.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const removed = await sb.from('DOC_FAVORITES').delete().eq('user_id', caller.id).eq('file_id', file.data.id);
    if (removed.error) throw removed.error;
  } else {
    const added = await sb.from('DOC_FAVORITES').insert({ user_id: caller.id, file_id: file.data.id });
    if (added.error) throw added.error;
  }
  return { success: true, favorite: !existing.data };
}

async function useTemplate(caller: Caller, input: any) {
  const destinationScope = await resolveScope(caller, input);
  const source = await sb.from('DOC_FILES').select('*').eq('id', text(input?.fileId)).eq('is_template', true).is('deleted_at', null).maybeSingle();
  if (source.error || !source.data) throw new Error('Template tidak ditemukan.');
  const template = source.data;
  const isGlobal = !text(template.sppg) && !text(template.yayasan);
  const isOwnScope = text(template.sppg) === destinationScope!.sppg && text(template.yayasan) === destinationScope!.yayasan;
  if (!isGlobal && caller.role !== 'SUPER_ADMIN' && !isOwnScope) throw new Error('Akses template ditolak.');
  const targetFolder = await assertFolder(caller, input?.targetFolderId, destinationScope);
  if (targetFolder?.is_template) throw new Error('Salinan kerja harus disimpan di folder dokumen SPPG.');
  const fileId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const scopeKey = destinationScope!.sppg.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'sppg';
  const extension = (text(template.name).match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] || '').toLowerCase();
  const storagePath = `${scopeKey}/${fileId}/${versionId}${extension}`;
  const copied = await sb.storage.from(BUCKET).copy(template.storage_path, storagePath);
  if (copied.error) throw new Error(`Template gagal disalin: ${copied.error.message}`);
  const inserted = await sb.from('DOC_FILES').insert({
    id: fileId, folder_id: targetFolder?.id || null, name: safeName(input?.name, template.name), storage_path: storagePath,
    mime_type: template.mime_type, size_bytes: template.size_bytes, sppg: destinationScope!.sppg, yayasan: destinationScope!.yayasan,
    is_template: false, classification: await folderStoresPersonalData(targetFolder) ? 'PERSONAL_DATA' : template.classification,
    source_type: template.source_type, created_by: caller.id, created_by_email: caller.email
  }).select('*').single();
  if (inserted.error) {
    await sb.storage.from(BUCKET).remove([storagePath]);
    throw new Error(inserted.error.message);
  }
  await audit(caller, 'COPY_TEMPLATE', 'FILE', inserted.data, { templateId: template.id });
  return { success: true, file: inserted.data, message: 'Template disalin ke Dokumen SPPG dan siap digunakan.' };
}

const handlers: Record<string, (caller: Caller, input: any) => Promise<any>> = {
  listDocuments,
  createDocumentFolder: createFolder,
  uploadDocument: (caller, input) => saveFile(caller, input, 'UPLOAD'),
  createTextDocument: (caller, input) => saveFile(caller, input, 'IN_APP'),
  getDocumentUrl: getFile,
  renameDocumentItem: (caller, input) => mutate(caller, 'RENAME', input),
  trashDocumentItem: (caller, input) => mutate(caller, 'TRASH', input),
  restoreDocumentItem: (caller, input) => mutate(caller, 'RESTORE', input),
  moveDocumentFile: (caller, input) => mutate(caller, 'MOVE', input),
  toggleDocumentFavorite: toggleFavorite,
  useDocumentTemplate: useTemplate
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method === 'GET') return json({ status: 'ok', service: 'document-action', version: 3 });
  if (request.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const caller = await getCaller(request);
    const body = await request.json();
    const handler = handlers[text(body?.function)];
    if (!handler) return json({ error: 'Fungsi tidak diizinkan.' }, 404);
    const parameters = Array.isArray(body.parameters) ? body.parameters : [];
    return json({ result: await handler(caller, parameters[0] || {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /token|akses|ditolak|cakupan/i.test(message) ? 403 : /tidak ditemukan/i.test(message) ? 404 : 400;
    return json({ error: message, result: { success: false, message } }, status);
  }
});
