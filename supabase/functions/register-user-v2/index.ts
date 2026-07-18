import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
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

async function systemNotify(payload: Record<string, unknown>) {
  try {
    if (!supabaseUrl || !serviceRoleKey) return;
    const result = await fetch(`${supabaseUrl}/functions/v1/notification-dispatch-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ function: 'dispatchSystemNotification', parameters: [payload] }),
      signal: AbortSignal.timeout(8000)
    });
    if (!result.ok) console.error('registration notification failed', result.status, await result.text());
  } catch (error) {
    console.error('registration notification error', error);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Method tidak didukung.' }, 405);

  let authUserId = '';
  try {
    const body = await request.json();
    const data = Array.isArray(body?.parameters) ? body.parameters[0] : body?.data;
    if (body?.function && body.function !== 'registerUser') {
      return response({ error: 'Fungsi tidak didukung.' }, 404);
    }

    const nama = clean(data?.namaLengkap);
    const email = clean(data?.email).toLowerCase();
    const jabatan = clean(data?.jabatan);
    const sppg = clean(data?.sppg).toUpperCase();
    const yayasan = clean(data?.namaYayasan);
    const usernameOriginal = clean(data?.username);
    const username = usernameOriginal.toLowerCase();
    const password = String(data?.password ?? '');

    if (!nama || !email || !jabatan || !sppg || !yayasan || !username || !password) {
      return response({ result: { success: false, message: 'Nama, email, jabatan, SPPG, Nama Yayasan, username, dan password wajib diisi.' } });
    }
    if (!email.endsWith('@gmail.com')) {
      return response({ result: { success: false, message: 'Email harus menggunakan @gmail.com.' } });
    }
    if (username.length < 6 || username !== usernameOriginal || !/^[a-z0-9._-]+$/.test(username)) {
      return response({ result: { success: false, message: 'Username minimal 6 karakter, huruf kecil, dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.' } });
    }
    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      return response({ result: { success: false, message: 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.' } });
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from('USERS')
      .select('ID,EMAIL,USERNAME')
      .or(`EMAIL.eq.${email},USERNAME.eq.${username}`)
      .limit(1);
    if (duplicateError) throw duplicateError;
    if (duplicate?.length) {
      return response({ result: { success: false, message: duplicate[0].EMAIL === email ? 'Email sudah terdaftar.' : 'Username sudah digunakan.' } });
    }

    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { username, namaLengkap: nama }
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message || 'Tidak dapat membuat akun.');
    authUserId = created.data.user.id;

    const inserted = await supabase.from('USERS').insert({
      ID: authUserId,
      'NAMA LENGKAP': nama,
      EMAIL: email,
      JABATAN: jabatan,
      SPPG: sppg,
      ROLE: 'USER',
      'FOTO PROFIL': '',
      TIMESTAMP: new Date().toISOString(),
      user: username,
      USERNAME: username,
      'NAMA YAYASAN': yayasan
    });
    if (inserted.error) throw inserted.error;

    const otp = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }
    });

    await systemNotify({
      mode: 'role',
      role: 'SUPER_ADMIN',
      title: 'Pendaftaran user baru',
      body: `${nama} mendaftar untuk ${sppg} — ${yayasan}.`,
      url: '/?page=users'
    });

    return response({ result: {
      success: true,
      message: otp.error
        ? 'Registrasi berhasil sebagai USER, tetapi OTP gagal dikirim. Hubungi administrator.'
        : 'Registrasi berhasil sebagai USER. Kode OTP 6 digit telah dikirim ke email Anda.'
    } });
  } catch (error) {
    if (authUserId) {
      await supabase.from('USERS').delete().eq('ID', authUserId).catch(() => undefined);
      await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
    return response({ result: { success: false, message: 'Registrasi gagal: ' + (error instanceof Error ? error.message : String(error)) } }, 400);
  }
});
