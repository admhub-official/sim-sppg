import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeRole(value: unknown) {
  return clean(value).replace(/\s+/g, '_').toUpperCase();
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireSuperAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw new Error('AUTH_REQUIRED');

  const authResult = await supabase.auth.getUser(token);
  if (authResult.error || !authResult.data.user) throw new Error('AUTH_REQUIRED');

  const profile = await supabase
    .from('USERS')
    .select('ID,EMAIL,ROLE,"NAMA LENGKAP"')
    .eq('ID', authResult.data.user.id)
    .maybeSingle();

  if (profile.error || !profile.data) throw new Error('AUTH_REQUIRED');
  if (normalizeRole(profile.data.ROLE) !== 'SUPER_ADMIN') throw new Error('SUPER_ADMIN_ONLY');

  return {
    id: clean(profile.data.ID),
    email: clean(profile.data.EMAIL).toLowerCase(),
    nama: clean(profile.data['NAMA LENGKAP']) || clean(profile.data.EMAIL)
  };
}

async function createUserBySuperAdmin(request: Request, data: any) {
  const actor = await requireSuperAdmin(request);
  const email = clean(data?.email).toLowerCase();
  const password = String(data?.password ?? '');

  if (!validEmail(email)) {
    return { success: false, message: 'Alamat email tidak valid.' };
  }
  if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
    return {
      success: false,
      message: 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.'
    };
  }

  const duplicate = await supabase
    .from('USERS')
    .select('ID,EMAIL')
    .eq('EMAIL', email)
    .limit(1);
  if (duplicate.error) throw duplicate.error;
  if (duplicate.data?.length) {
    return { success: false, message: 'Email sudah terdaftar.' };
  }

  let authUserId = '';
  try {
    const invited = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        created_by: actor.email,
        created_via: 'SIM-SPPG_SUPER_ADMIN'
      }
    });
    if (invited.error || !invited.data.user) {
      throw new Error(invited.error?.message || 'Email konfirmasi tidak dapat dikirim.');
    }
    authUserId = invited.data.user.id;

    const passwordResult = await supabase.auth.admin.updateUserById(authUserId, { password });
    if (passwordResult.error) throw passwordResult.error;

    const inserted = await supabase.from('USERS').insert({
      ID: authUserId,
      'NAMA LENGKAP': email,
      EMAIL: email,
      JABATAN: '',
      SPPG: '',
      ROLE: 'USER',
      'FOTO PROFIL': '',
      TIMESTAMP: new Date().toISOString(),
      user: email,
      USERNAME: email,
      'NAMA YAYASAN': ''
    });
    if (inserted.error) throw inserted.error;

    try {
      await supabase.from('AUDIT LOG').insert({
        TIMESTAMP: new Date().toISOString(),
        USER_EMAIL: actor.email,
        USER_NAME: actor.nama,
        ROLE: 'SUPER_ADMIN',
        ACTION_TYPE: 'CREATE_USER',
        TABLE_NAME: 'USERS',
        RECORD_ID: authUserId,
        FIELD_CHANGED: 'ACCOUNT',
        OLD_VALUE: '',
        NEW_VALUE: email,
        DESCRIPTION: `SUPER_ADMIN membuat akun ${email}`,
        IP_USER: '',
        STATUS: 'SUCCESS'
      });
    } catch (auditError) {
      console.error('create user audit', auditError);
    }

    return {
      success: true,
      userId: authUserId,
      email,
      confirmationEmailSent: true,
      message: 'Akun berhasil dibuat. Email konfirmasi/undangan telah dikirim. User dapat login menggunakan email dan password yang diberikan setelah email dikonfirmasi.'
    };
  } catch (error) {
    if (authUserId) {
      await supabase.from('USERS').delete().eq('ID', authUserId).catch(() => undefined);
      await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Method tidak didukung.' }, 405);

  try {
    const body = await request.json();
    const fn = clean(body?.function);
    const data = Array.isArray(body?.parameters) ? (body.parameters[0] || {}) : (body?.data || {});

    if (fn !== 'createUserBySuperAdmin') {
      return response({ error: 'Fungsi tidak didukung.' }, 404);
    }

    const result = await createUserBySuperAdmin(request, data);
    return response({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'AUTH_REQUIRED') {
      return response({ error: 'Sesi tidak valid.', result: { success: false, message: 'Silakan login kembali.' } }, 401);
    }
    if (message === 'SUPER_ADMIN_ONLY') {
      return response({ error: 'Akses ditolak.', result: { success: false, message: 'Hanya SUPER_ADMIN yang dapat menambah user.' } }, 403);
    }
    console.error('create user failed', message);
    return response({
      error: 'Pembuatan akun gagal.',
      result: { success: false, message: 'Pembuatan akun gagal: ' + message }
    }, 400);
  }
});
