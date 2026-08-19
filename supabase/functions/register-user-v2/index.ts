import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const C = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const out = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...C, 'Content-Type': 'application/json' } });
const clean = (v: any) => String(v ?? '').trim();
const role = (v: any) => clean(v).replace(/\s+/g, '_').toUpperCase();

function msg(e: any) {
  if (!e) return 'Kesalahan database.';
  if (typeof e === 'string') return e;
  return [clean(e.message), clean(e.code) ? `kode ${e.code}` : '', clean(e.details), clean(e.hint) ? `petunjuk: ${clean(e.hint)}` : ''].filter(Boolean).join(' — ') || String(e);
}

async function actor(req: Request) {
  const h = req.headers.get('Authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) throw new Error('AUTH_REQUIRED');
  const a = await sb.auth.getUser(t);
  if (a.error || !a.data.user) throw new Error('AUTH_REQUIRED');
  const p = await sb.from('USERS').select('ID,EMAIL,ROLE,"NAMA LENGKAP","NAMA YAYASAN"').eq('ID', a.data.user.id).maybeSingle();
  if (p.error || !p.data || role(p.data.ROLE) !== 'SUPER_ADMIN') throw new Error('SUPER_ADMIN_ONLY');
  return p.data;
}

async function master() {
  const q = await sb.from('SPPG_DIRECTORY').select('sppg,yayasan,source,updated_at').order('sppg', { ascending: true });
  if (q.error) throw q.error;
  return (q.data || []).map(x => ({ ...x, status: true }));
}

async function requestOtp(req: Request, d: any) {
  const c = await actor(req);
  const email = clean(d.email).toLowerCase();
  const sppg = clean(d.sppg).toUpperCase();
  const yayasan = clean(d.yayasan);
  const password = String(d.password ?? '');

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email tidak valid.');
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password minimal 8 karakter dan mengandung huruf besar, huruf kecil, dan angka.');
  }

  const existingUser = await sb.from('USERS').select('ID').eq('EMAIL', email).limit(1);
  if (existingUser.error) throw existingUser.error;
  if (existingUser.data?.length) throw new Error('Email sudah terdaftar.');

  const m = (await master()).find(x => clean(x.sppg).toUpperCase() === sppg);
  if (!m) throw new Error('SPPG tidak ditemukan di Master SPPG.');
  if (clean(m.yayasan) !== yayasan) throw new Error('Yayasan tidak sesuai Master SPPG.');

  const old = await sb.from('ACCOUNT_REGISTRATION_OTP')
    .select('id,auth_user_id,expires_at')
    .eq('email', email)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (old.error) throw old.error;
  if (old.data && new Date(old.data.expires_at).getTime() > Date.now()) {
    throw new Error('OTP masih aktif. Periksa email atau tunggu sampai OTP kedaluwarsa.');
  }
  if (old.data?.auth_user_id) {
    try { await sb.auth.admin.deleteUser(old.data.auth_user_id); } catch (_) {}
  }

  // Penting: JANGAN menggunakan inviteUserByEmail(). Fungsi tersebut selalu
  // mengirim email "Accept invitation". Kita membuat user tanpa email invite,
  // lalu meminta Supabase Auth mengirim OTP melalui template Magic Link / OTP.
  const created = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      sppg: m.sppg,
      yayasan: m.yayasan,
      created_by: clean(c.EMAIL),
      created_via: 'SIM-SPPG_SUPER_ADMIN_REGISTRATION',
      registration_pending: true
    }
  });
  if (created.error || !created.data.user) {
    throw new Error(`Gagal membuat akun Auth: ${msg(created.error || 'User tidak terbentuk.')}`);
  }
  const uid = created.data.user.id;

  const otpRequest = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      data: {
        sppg: m.sppg,
        yayasan: m.yayasan,
        registration_pending: true
      }
    }
  });
  if (otpRequest.error) {
    try { await sb.auth.admin.deleteUser(uid); } catch (_) {}
    throw new Error(`OTP email gagal dikirim: ${msg(otpRequest.error)}`);
  }

  if (old.data?.id) {
    await sb.from('ACCOUNT_REGISTRATION_OTP').update({
      consumed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', old.data.id);
  }

  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const ins = await sb.from('ACCOUNT_REGISTRATION_OTP').insert({
    email,
    sppg: m.sppg,
    yayasan: m.yayasan,
    // OTP aktual dibuat dan diverifikasi oleh Supabase Auth. Kolom legacy ini
    // dipertahankan untuk kompatibilitas skema lama dan tidak dipakai sebagai
    // sumber kebenaran OTP.
    otp_hash: '',
    expires_at: expires,
    attempts: 0,
    max_attempts: 5,
    auth_user_id: uid,
    created_by: clean(c.EMAIL)
  });
  if (ins.error) {
    try { await sb.auth.admin.deleteUser(uid); } catch (_) {}
    throw ins.error;
  }

  return {
    success: true,
    expiresAt: expires,
    message: `Kode OTP telah dikirim ke ${email}. Periksa email dan folder Spam.`
  };
}

async function create(req: Request, d: any) {
  await actor(req);
  const email = clean(d.email).toLowerCase();
  const sppg = clean(d.sppg).toUpperCase();
  const otp = clean(d.otp);
  const password = String(d.password ?? '');

  if (!/^\d{8}$/.test(otp)) throw new Error('OTP harus terdiri dari 8 digit angka.');
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password minimal 8 karakter dan mengandung huruf besar, huruf kecil, dan angka.');
  }

  const m = (await master()).find(x => clean(x.sppg).toUpperCase() === sppg);
  if (!m) throw new Error('SPPG tidak ditemukan di Master SPPG.');

  const q = await sb.from('ACCOUNT_REGISTRATION_OTP')
    .select('id,expires_at,attempts,auth_user_id,yayasan')
    .eq('email', email)
    .eq('sppg', m.sppg)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('OTP belum diminta atau sudah digunakan.');
  if (new Date(q.data.expires_at).getTime() < Date.now()) throw new Error('OTP sudah kedaluwarsa. Kirim OTP baru.');
  if (Number(q.data.attempts) >= 5) throw new Error('Percobaan OTP sudah melebihi batas. Kirim OTP baru.');

  // Verifikasi OTP dilakukan oleh Supabase Auth sehingga token email yang
  // diterima di sini adalah token yang sama dengan yang dikirim melalui email.
  const verified = await sb.auth.verifyOtp({ email, token: otp, type: 'email' });
  if (verified.error || !verified.data.user) {
    await sb.from('ACCOUNT_REGISTRATION_OTP').update({
      attempts: Number(q.data.attempts) + 1,
      updated_at: new Date().toISOString()
    }).eq('id', q.data.id);
    throw new Error('OTP tidak sesuai atau sudah kedaluwarsa.');
  }

  const uid = clean(q.data.auth_user_id || verified.data.user.id);
  if (!uid) throw new Error('Sesi pendaftaran tidak ditemukan. Kirim OTP baru.');

  const duplicate = await sb.from('USERS').select('ID').eq('EMAIL', email).limit(1);
  if (duplicate.error) throw duplicate.error;
  if (duplicate.data?.length) throw new Error('Email sudah terdaftar.');

  const au = await sb.auth.admin.updateUserById(uid, {
    password,
    email_confirm: true,
    user_metadata: {
      sppg: m.sppg,
      yayasan: m.yayasan,
      registration_verified: true,
      registration_pending: false
    }
  });
  if (au.error) throw new Error(`Gagal mengaktifkan akun: ${msg(au.error)}`);

  const ins = await sb.from('USERS').insert({
    ID: uid,
    'NAMA LENGKAP': email,
    EMAIL: email,
    JABATAN: '',
    SPPG: m.sppg,
    ROLE: 'USER',
    'FOTO PROFIL': '',
    TIMESTAMP: new Date().toISOString(),
    user: email,
    USERNAME: email,
    'NAMA YAYASAN': m.yayasan
  });
  if (ins.error) {
    try { await sb.auth.admin.deleteUser(uid); } catch (_) {}
    throw new Error(`Gagal menyimpan profil USER: ${msg(ins.error)}`);
  }

  await sb.from('ACCOUNT_REGISTRATION_OTP').update({
    verified_at: new Date().toISOString(),
    consumed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', q.data.id);

  // Buang session yang mungkin dihasilkan verifyOtp agar session admin/browser
  // tidak pernah digantikan oleh session user baru.
  return {
    success: true,
    message: 'Akun USER berhasil dibuat dan email telah diverifikasi.',
    userId: uid
  };
}

async function saveMaster(req: Request, d: any, update = false) {
  await actor(req);
  const sppg = clean(d.sppg).toUpperCase();
  const yayasan = clean(d.yayasan).toUpperCase();
  if (!sppg || !yayasan) throw new Error('SPPG dan Yayasan wajib diisi.');
  if (update) {
    const old = clean(d.oldSppg).toUpperCase();
    if (!old) throw new Error('SPPG lama wajib diisi.');
    const q = await sb.from('SPPG_DIRECTORY').update({ sppg, yayasan, source: 'MANUAL_MASTER', updated_at: new Date().toISOString() }).eq('sppg', old);
    if (q.error) throw q.error;
    return { success: true, message: 'Master SPPG diperbarui.' };
  }
  const q = await sb.from('SPPG_DIRECTORY').upsert({ sppg, yayasan, source: 'MANUAL_MASTER', updated_at: new Date().toISOString() }, { onConflict: 'sppg' });
  if (q.error) throw q.error;
  return { success: true, message: 'Master SPPG disimpan.' };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: C });
  if (req.method !== 'POST') return out({ error: 'Method tidak didukung.' }, 405);
  try {
    const b = await req.json();
    const fn = clean(b.function);
    const d = Array.isArray(b.parameters) ? b.parameters[0] || {} : b.data || {};
    if (fn === 'getMasterSPPG') return out({ result: { success: true, data: await master() } });
    if (fn === 'requestRegistrationOtp') return out({ result: await requestOtp(req, d) });
    if (fn === 'createUserBySuperAdmin') return out({ result: await create(req, d) });
    if (fn === 'addMasterSPPG') return out({ result: await saveMaster(req, d, false) });
    if (fn === 'updateMasterSPPG') return out({ result: await saveMaster(req, d, true) });
    return out({ error: 'Fungsi tidak didukung.' }, 404);
  } catch (e) {
    const m = e instanceof Error ? e.message : msg(e);
    if (m === 'AUTH_REQUIRED') return out({ error: 'Sesi tidak valid.', result: { success: false, message: 'Silakan login kembali.' } }, 401);
    if (m === 'SUPER_ADMIN_ONLY') return out({ error: 'Akses ditolak.', result: { success: false, message: 'Hanya SUPER_ADMIN yang dapat mengelola pendaftaran user.' } }, 403);
    console.error('registration failed', e);
    return out({ error: 'Pendaftaran gagal.', result: { success: false, message: m } }, 400);
  }
});
