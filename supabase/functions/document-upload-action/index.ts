import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BUCKET = 'sppg-documents';
const MAX_BYTES = 15 * 1024 * 1024;
const INTENT_TTL_MS = 2 * 60 * 60 * 1000;
const INTENT_SECRET = Deno.env.get('DOCUMENT_UPLOAD_INTENT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
const forbiddenMime = /application\/(x-msdownload|x-msdos-program|x-sh|x-executable)/i;

type Caller = { id: string; email: string; username: string; role: string; sppg: string; yayasan: string };
type Scope = { sppg: string; yayasan: string };
type UploadIntent = {
  v: number;
  callerId: string;
  fileId: string;
  folderId: string;
  name: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sppg: string;
  yayasan: string;
  isTemplate: boolean;
  requestedClassification: string;
  issuedAt: number;
  expiresAt: number;
};

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
    return (result.data || [])
      .map((row: any) => ({ sppg: text(row.SPPG), yayasan: text(row['NAMA YAYASAN']) }))
      .filter((scope: Scope) => scope.sppg && !seen.has(scope.sppg + '|' + scope.yayasan) && !!seen.add(scope.sppg + '|' + scope.yayasan));
  }
  if (caller.role === 'ADMIN') {
    const result = await sb.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email', caller.email).order('sppg');
    if (result.error) throw result.error;
    return (result.data || []).map((row: any) => ({ sppg: text(row.sppg), yayasan: text(row.yayasan) }));
  }
  return caller.sppg ? [{ sppg: caller.sppg, yayasan: caller.yayasan }] : [];
}

async function resolveScope(caller: Caller, input: any): Promise<Scope> {
  const requested = { sppg: text(input?.sppg), yayasan: text(input?.yayasan) };
  const scopes = await availableScopes(caller);
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

async function assertFolder(caller: Caller, folderId: unknown, scope: Scope) {
  const id = text(folderId);
  if (!id) return null;
  const result = await sb.from('DOC_FOLDERS').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (result.error || !result.data) throw new Error('Folder tidak ditemukan.');
  const folder = result.data;
  const isGlobalTemplate = folder.is_template && !text(folder.sppg) && !text(folder.yayasan);
  const sameScope = text(folder.sppg) === scope.sppg && text(folder.yayasan) === scope.yayasan;
  if (isGlobalTemplate) {
    if (caller.role !== 'SUPER_ADMIN') throw new Error('Template pusat hanya dapat diubah oleh Super Admin.');
    return folder;
  }
  if (!sameScope && caller.role !== 'SUPER_ADMIN') throw new Error('Akses folder ditolak.');
  return folder;
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

async function audit(caller: Caller, action: string, entity: any, detail: any = {}) {
  const result = await sb.from('DOC_AUDIT_LOG').insert({
    user_id: caller.id,
    user_email: caller.email,
    user_role: caller.role,
    action,
    entity_type: 'FILE',
    entity_id: entity.id,
    entity_name: entity.name,
    sppg: text(entity.sppg),
    yayasan: text(entity.yayasan),
    detail
  });
  if (result.error) console.error('document upload audit', result.error.message);
}

function validateFileRequest(input: any) {
  const name = safeName(input?.name, 'File');
  if (forbiddenName.test(name)) throw new Error('Jenis file ini tidak diizinkan demi keamanan.');
  const mimeType = text(input?.mimeType || 'application/octet-stream').slice(0, 150);
  if (forbiddenMime.test(mimeType)) throw new Error('Jenis file ini tidak diizinkan demi keamanan.');
  const sizeBytes = Number(input?.sizeBytes || 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new Error('File kosong tidak dapat disimpan.');
  if (sizeBytes > MAX_BYTES) throw new Error('Ukuran file maksimal 15 MB.');
  const requestedClassification = ['INTERNAL', 'SPPG_RESTRICTED', 'CONFIDENTIAL', 'PERSONAL_DATA'].includes(text(input?.classification))
    ? text(input.classification)
    : 'INTERNAL';
  return { name, mimeType, sizeBytes, requestedClassification };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(INTENT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signIntent(intent: UploadIntent) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(intent)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(payload));
  return payload + '.' + bytesToBase64Url(new Uint8Array(signature));
}

async function verifyIntent(token: unknown): Promise<UploadIntent> {
  const parts = text(token).split('.');
  if (parts.length !== 2) throw new Error('Intent upload tidak valid.');
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(),
    base64UrlToBytes(parts[1]),
    new TextEncoder().encode(parts[0])
  );
  if (!valid) throw new Error('Intent upload tidak valid.');
  let intent: UploadIntent;
  try {
    intent = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
  } catch (_) {
    throw new Error('Intent upload tidak valid.');
  }
  if (!intent || intent.v !== 1 || !intent.fileId || !intent.storagePath) throw new Error('Intent upload tidak valid.');
  if (Date.now() > Number(intent.expiresAt || 0)) throw new Error('Intent upload sudah kedaluwarsa.');
  return intent;
}

async function prepareUpload(caller: Caller, input: any) {
  const scope = await resolveScope(caller, input);
  const isTemplate = input?.isTemplate === true;
  if (isTemplate && !canManageTemplates(caller)) throw new Error('Hanya Admin yang dapat membuat template.');
  const globalTemplate = isTemplate && caller.role === 'SUPER_ADMIN' && input?.global === true;
  const targetScope: Scope = globalTemplate ? { sppg: '', yayasan: '' } : scope;
  const folder = await assertFolder(caller, input?.folderId, scope);
  if (folder) {
    if (Boolean(folder.is_template) !== isTemplate) throw new Error('File biasa dan template harus disimpan pada lokasi yang sesuai.');
    if (text(folder.sppg) !== targetScope.sppg || text(folder.yayasan) !== targetScope.yayasan) {
      throw new Error('Folder tujuan harus berada pada scope SPPG/Yayasan yang sama.');
    }
  }

  const file = validateFileRequest(input);
  const fileId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const scopeKey = (targetScope.sppg || 'global').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'global';
  const extension = (file.name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] || '').toLowerCase();
  const storagePath = `${scopeKey}/${fileId}/${versionId}${extension}`;
  const signed = await sb.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (signed.error || !signed.data?.signedUrl) throw new Error(`Upload tidak dapat disiapkan: ${signed.error?.message || 'signed URL tidak tersedia'}`);

  const now = Date.now();
  const intent: UploadIntent = {
    v: 1,
    callerId: caller.id,
    fileId,
    folderId: folder?.id || '',
    name: file.name,
    storagePath,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sppg: targetScope.sppg,
    yayasan: targetScope.yayasan,
    isTemplate,
    requestedClassification: file.requestedClassification,
    issuedAt: now,
    expiresAt: now + INTENT_TTL_MS
  };

  return {
    success: true,
    direct: true,
    upload: {
      signedUrl: signed.data.signedUrl,
      intent: await signIntent(intent),
      expiresIn: Math.floor(INTENT_TTL_MS / 1000)
    },
    message: 'Upload langsung siap.'
  };
}

async function inspectUploadedObject(storagePath: string) {
  const slash = storagePath.lastIndexOf('/');
  const folder = slash >= 0 ? storagePath.slice(0, slash) : '';
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const result = await sb.storage.from(BUCKET).list(folder, { limit: 10, search: name });
  if (result.error) throw new Error(`Upload belum dapat diverifikasi: ${result.error.message}`);
  const object = (result.data || []).find((row: any) => text(row.name) === name);
  if (!object) throw new Error('Upload belum tersedia untuk difinalisasi.');
  return object;
}

async function finalizeUpload(caller: Caller, input: any) {
  const intent = await verifyIntent(input?.intent);
  if (intent.callerId !== caller.id) throw new Error('Intent upload bukan milik pengguna ini.');

  const existing = await sb.from('DOC_FILES').select('*').eq('id', intent.fileId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if (text(existing.data.created_by) !== caller.id || text(existing.data.storage_path) !== intent.storagePath) {
      throw new Error('Metadata upload sudah digunakan oleh dokumen lain.');
    }
    return { success: true, direct: true, alreadyFinalized: true, file: existing.data, message: 'File sudah berhasil difinalisasi.' };
  }

  if (!intent.sppg && !intent.yayasan) {
    if (!intent.isTemplate || caller.role !== 'SUPER_ADMIN') throw new Error('Scope upload global tidak diizinkan.');
  } else {
    const scope = await resolveScope(caller, { sppg: intent.sppg, yayasan: intent.yayasan });
    if (scope.sppg !== intent.sppg || scope.yayasan !== intent.yayasan) throw new Error('Akses cakupan upload berubah.');
  }

  const folderScope = intent.sppg || intent.yayasan ? { sppg: intent.sppg, yayasan: intent.yayasan } : await resolveScope(caller, {});
  const folder = await assertFolder(caller, intent.folderId, folderScope);
  if (folder) {
    if (Boolean(folder.is_template) !== intent.isTemplate) throw new Error('Jenis folder tujuan berubah.');
    if (text(folder.sppg) !== intent.sppg || text(folder.yayasan) !== intent.yayasan) throw new Error('Scope folder tujuan berubah.');
  }

  const object = await inspectUploadedObject(intent.storagePath);
  const actualSize = Number(object?.metadata?.size || object?.metadata?.contentLength || 0);
  const actualMime = text(object?.metadata?.mimetype || intent.mimeType).split(';')[0].toLowerCase();
  const expectedMime = text(intent.mimeType).split(';')[0].toLowerCase();
  if (actualSize && actualSize !== Number(intent.sizeBytes)) {
    await sb.storage.from(BUCKET).remove([intent.storagePath]);
    throw new Error('Ukuran file hasil upload tidak sesuai dengan file yang disiapkan.');
  }
  if ((actualSize || intent.sizeBytes) > MAX_BYTES) {
    await sb.storage.from(BUCKET).remove([intent.storagePath]);
    throw new Error('Ukuran file melebihi batas 15 MB.');
  }
  if (forbiddenName.test(intent.name) || forbiddenMime.test(actualMime)) {
    await sb.storage.from(BUCKET).remove([intent.storagePath]);
    throw new Error('Jenis file hasil upload tidak diizinkan.');
  }
  if (expectedMime && expectedMime !== 'application/octet-stream' && actualMime && actualMime !== expectedMime) {
    await sb.storage.from(BUCKET).remove([intent.storagePath]);
    throw new Error('Tipe file hasil upload tidak sesuai dengan file yang disiapkan.');
  }

  const classification = await folderStoresPersonalData(folder) ? 'PERSONAL_DATA' : intent.requestedClassification;
  const inserted = await sb.from('DOC_FILES').insert({
    id: intent.fileId,
    folder_id: intent.folderId || null,
    name: intent.name,
    storage_path: intent.storagePath,
    mime_type: actualMime || intent.mimeType || 'application/octet-stream',
    size_bytes: actualSize || intent.sizeBytes,
    sppg: intent.sppg,
    yayasan: intent.yayasan,
    is_template: intent.isTemplate,
    classification,
    source_type: 'UPLOAD',
    created_by: caller.id,
    created_by_email: caller.email
  }).select('*').single();
  if (inserted.error) throw new Error(inserted.error.message);

  await audit(caller, 'UPLOAD', inserted.data, {
    direct: true,
    mime: inserted.data.mime_type,
    size: inserted.data.size_bytes,
    signedUpload: true
  });
  return {
    success: true,
    direct: true,
    file: inserted.data,
    message: intent.isTemplate ? 'Template berhasil diunggah langsung.' : 'File berhasil diunggah langsung.'
  };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const caller = await getCaller(request);
    const body = await request.json();
    const input = Array.isArray(body?.parameters) ? (body.parameters[0] || {}) : (body || {});
    const mode = text(input?.mode || body?.mode).toLowerCase();
    if (mode === 'prepare') return json({ result: await prepareUpload(caller, input) });
    if (mode === 'finalize') return json({ result: await finalizeUpload(caller, input) });
    return json({ error: 'Mode upload tidak didukung.', result: { success: false, message: 'Mode upload tidak didukung.' } }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /token|akses|ditolak|bukan milik|scope/i.test(message) ? 403 : /tidak ditemukan/i.test(message) ? 404 : 400;
    return json({ error: message, result: { success: false, message } }, status);
  }
});
