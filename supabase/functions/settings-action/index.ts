import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });
const text = (value: unknown) => String(value ?? '').trim();
const bool = (value: unknown) => String(value).toLowerCase() === 'true';

type Caller = {
  id: string;
  email: string;
  role: string;
};

const MENU_KEYS: Record<string, string> = {
  SUPER_ADMIN: 'MENU_VISIBILITY_SUPER_ADMIN',
  ADMIN: 'MENU_VISIBILITY_ADMIN',
  USER: 'MENU_VISIBILITY_USER'
};

const DEFAULT_MENUS: Record<string, string[]> = {
  SUPER_ADMIN: ['dashboard', 'profil', 'documents', 'settings', 'transaksi', 'approval', 'pending-payment', 'audit-log', 'master-bahan', 'master-supplier', 'survei', 'serah-terima', 'menu-mbg', 'laporan'],
  ADMIN: ['dashboard', 'profil', 'documents', 'users', 'transaksi', 'approval', 'pending-payment', 'audit-log', 'master-bahan', 'master-supplier', 'survei', 'serah-terima', 'menu-mbg', 'laporan'],
  USER: ['dashboard', 'profil', 'documents', 'transaksi', 'approval', 'pending-payment', 'survei', 'serah-terima', 'master-supplier']
};

const ALLOWED_MENU_PAGES = new Set([
  'dashboard', 'profil', 'settings', 'users', 'transaksi', 'approval',
  'pending-payment', 'audit-log', 'master-bahan', 'master-supplier',
  'survei', 'serah-terima', 'menu-mbg', 'laporan', 'documents'
]);

async function caller(request: Request): Promise<Caller> {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('Token wajib disertakan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const profile = await sb
    .from('USERS')
    .select('ID,EMAIL,ROLE')
    .eq('ID', auth.data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil pengguna tidak ditemukan.');
  return {
    id: profile.data.ID,
    email: text(auth.data.user.email || profile.data.EMAIL).toLowerCase(),
    role: text(profile.data.ROLE).toUpperCase()
  };
}

function requireSuperAdmin(current: Caller) {
  if (current.role !== 'SUPER_ADMIN') throw new Error('Hanya SUPER_ADMIN yang dapat mengubah Pengaturan.');
}

async function readSetting(key: string, fallback = '') {
  const query = await sb.from('APP_SETTINGS').select('VALUE').eq('KEY', key).maybeSingle();
  if (query.error) throw query.error;
  return query.data ? text(query.data.VALUE) : fallback;
}

async function writeSetting(key: string, value: string) {
  const query = await sb.from('APP_SETTINGS').upsert({ KEY: key, VALUE: value }, { onConflict: 'KEY' });
  if (query.error) throw query.error;
}

function parseMenuValue(raw: string, role: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map(text).filter(page => ALLOWED_MENU_PAGES.has(page)))];
    }
  } catch (_) {
    // Gunakan default aman bila nilai lama rusak.
  }
  return DEFAULT_MENUS[role].slice();
}

async function menuForRole(role: string) {
  const normalized = MENU_KEYS[role] ? role : 'USER';
  const raw = await readSetting(MENU_KEYS[normalized], JSON.stringify(DEFAULT_MENUS[normalized]));
  const menus = parseMenuValue(raw, normalized);
  const mandatory = normalized === 'SUPER_ADMIN'
    ? ['dashboard', 'profil', 'documents', 'settings']
    : ['dashboard', 'profil', 'documents'];
  mandatory.forEach(page => {
    if (!menus.includes(page)) menus.unshift(page);
  });
  return [...new Set(menus)];
}

async function getMyMenuVisibility(current: Caller) {
  return { success: true, role: current.role, menus: await menuForRole(current.role) };
}

async function getSettingsHub(current: Caller) {
  requireSuperAdmin(current);
  const [upload, edit, superMenus, adminMenus, userMenus, announcements] = await Promise.all([
    readSetting('ALLOW_USER_UPLOAD_BUKTI', 'false'),
    readSetting('ALLOW_USER_EDIT_TRANSACTION', 'false'),
    menuForRole('SUPER_ADMIN'),
    menuForRole('ADMIN'),
    menuForRole('USER'),
    sb.from('APP_ANNOUNCEMENTS')
      .select('id,title,body,target_roles,priority,is_active,starts_at,ends_at,created_at,created_by_email')
      .order('created_at', { ascending: false })
      .limit(50)
  ]);
  if (announcements.error) throw announcements.error;
  return {
    success: true,
    features: {
      allowUserUploadBukti: bool(upload),
      allowUserEditTransaction: bool(edit)
    },
    menuVisibility: {
      SUPER_ADMIN: superMenus,
      ADMIN: adminMenus,
      USER: userMenus
    },
    announcements: announcements.data || []
  };
}

async function updateFeatureSettings(current: Caller, data: Record<string, unknown>) {
  requireSuperAdmin(current);
  await Promise.all([
    writeSetting('ALLOW_USER_UPLOAD_BUKTI', String(data.allowUserUploadBukti === true)),
    writeSetting('ALLOW_USER_EDIT_TRANSACTION', String(data.allowUserEditTransaction === true))
  ]);
  return { success: true, message: 'Pengaturan transaksi berhasil disimpan.' };
}

async function updateMenuVisibility(current: Caller, data: Record<string, unknown>) {
  requireSuperAdmin(current);
  const role = text(data.role).toUpperCase();
  if (!MENU_KEYS[role]) throw new Error('Role menu tidak valid.');
  const requested = Array.isArray(data.menus) ? data.menus.map(text) : [];
  const menus = [...new Set(requested.filter(page => ALLOWED_MENU_PAGES.has(page)))];
  const mandatory = role === 'SUPER_ADMIN'
    ? ['dashboard', 'profil', 'documents', 'settings']
    : ['dashboard', 'profil', 'documents'];
  mandatory.forEach(page => {
    if (!menus.includes(page)) menus.unshift(page);
  });
  await writeSetting(MENU_KEYS[role], JSON.stringify(menus));
  return { success: true, role, menus, message: `Menu ${role} berhasil disimpan.` };
}

async function dispatchAnnouncementPush(data: Record<string, unknown>, roles: string[]) {
  const endpoint = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notification-dispatch-action`;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const results = [];
  for (const role of roles) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          function: 'dispatchSystemNotification',
          parameters: [{
            mode: 'role',
            role,
            title: text(data.title),
            body: text(data.body),
            url: '#dashboard'
          }]
        })
      });
      const payload = await response.json();
      results.push({ role, ok: response.ok, result: payload.result || null, error: payload.error || null });
    } catch (error) {
      results.push({ role, ok: false, result: null, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

async function createAnnouncement(current: Caller, data: Record<string, unknown>) {
  requireSuperAdmin(current);
  const title = text(data.title).slice(0, 120);
  const body = text(data.body).slice(0, 1000);
  const priority = text(data.priority || 'INFORMASI').toUpperCase();
  const targetRoles = [...new Set(
    (Array.isArray(data.targetRoles) ? data.targetRoles : [])
      .map(value => text(value).toUpperCase())
      .filter(role => role === 'ADMIN' || role === 'USER')
  )];
  if (!title || !body) throw new Error('Judul dan isi pengumuman wajib diisi.');
  if (!targetRoles.length) throw new Error('Pilih minimal satu role penerima.');
  if (!['INFORMASI', 'PENTING', 'MENDESAK'].includes(priority)) throw new Error('Prioritas tidak valid.');
  const startsAt = data.startsAt ? new Date(String(data.startsAt)).toISOString() : new Date().toISOString();
  const endsAt = data.endsAt ? new Date(String(data.endsAt)).toISOString() : null;
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error('Waktu berakhir harus setelah waktu mulai.');
  }
  const insert = await sb.from('APP_ANNOUNCEMENTS').insert({
    title,
    body,
    target_roles: targetRoles,
    priority,
    starts_at: startsAt,
    ends_at: endsAt,
    created_by: current.id,
    created_by_email: current.email
  }).select('id').single();
  if (insert.error) throw insert.error;
  const push = await dispatchAnnouncementPush({ title, body }, targetRoles);
  return {
    success: true,
    id: insert.data.id,
    push,
    message: 'Pengumuman berhasil diterbitkan.'
  };
}

async function setAnnouncementActive(current: Caller, data: Record<string, unknown>) {
  requireSuperAdmin(current);
  const id = text(data.id);
  if (!id) throw new Error('ID pengumuman wajib diisi.');
  const query = await sb.from('APP_ANNOUNCEMENTS')
    .update({ is_active: data.isActive === true })
    .eq('id', id);
  if (query.error) throw query.error;
  return { success: true, message: data.isActive === true ? 'Pengumuman diaktifkan.' : 'Pengumuman dinonaktifkan.' };
}

async function getMyAnnouncements(current: Caller) {
  if (current.role !== 'ADMIN' && current.role !== 'USER') {
    return { success: true, announcements: [] };
  }
  const now = new Date().toISOString();
  const query = await sb.from('APP_ANNOUNCEMENTS')
    .select('id,title,body,target_roles,priority,starts_at,ends_at,created_at')
    .eq('is_active', true)
    .contains('target_roles', [current.role])
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('starts_at', { ascending: false })
    .limit(10);
  if (query.error) throw query.error;
  return { success: true, announcements: query.data || [] };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method === 'GET') return out({ status: 'ok', service: 'settings-action', version: 1 });
  if (request.method !== 'POST') return out({ error: 'Method tidak didukung.' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 48000) return out({ error: 'Payload terlalu besar.' }, 413);
  try {
    const current = await caller(request);
    const requestBody = await request.json();
    const fn = text(requestBody?.function);
    const params = Array.isArray(requestBody?.parameters) ? requestBody.parameters : [];
    const data = params[0] && typeof params[0] === 'object' ? params[0] : {};
    if (fn === 'getMyMenuVisibility') return out({ result: await getMyMenuVisibility(current) });
    if (fn === 'getMyAnnouncements') return out({ result: await getMyAnnouncements(current) });
    if (fn === 'getSettingsHub') return out({ result: await getSettingsHub(current) });
    if (fn === 'updateFeatureSettings') return out({ result: await updateFeatureSettings(current, data) });
    if (fn === 'updateMenuVisibility') return out({ result: await updateMenuVisibility(current, data) });
    if (fn === 'createAnnouncement') return out({ result: await createAnnouncement(current, data) });
    if (fn === 'setAnnouncementActive') return out({ result: await setAnnouncementActive(current, data) });
    return out({ error: 'Fungsi tidak diizinkan.' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const denied = /token|super_admin|akses|profil pengguna/i.test(message);
    console.error(message);
    return out({ error: message, result: { success: false, message } }, denied ? 403 : 400);
  }
});
