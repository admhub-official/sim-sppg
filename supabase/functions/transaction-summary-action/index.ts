import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
});
const text = (value: unknown) => String(value ?? '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const header = req.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new Error('Token tidak ditemukan.');
    const auth = await sb.auth.getUser(token);
    if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');

    const profile = await sb.from('USERS')
      .select('EMAIL,USERNAME,ROLE')
      .eq('ID', auth.data.user.id)
      .maybeSingle();
    if (profile.error || !profile.data) throw new Error('Profil user tidak ditemukan.');

    const body = await req.json();
    if (body?.function !== 'getTransactionSummary') return json({ error: 'Fungsi tidak diizinkan.' }, 404);
    const filters = Array.isArray(body.parameters) ? (body.parameters[0] || {}) : {};
    const result = await sb.rpc('get_transaction_kpi_v2', {
      p_email: text(profile.data.EMAIL || auth.data.user.email).toLowerCase(),
      p_username: text(profile.data.USERNAME).toLowerCase(),
      p_role: text(profile.data.ROLE).toUpperCase(),
      p_filters: filters,
    });
    if (result.error) throw result.error;
    return json({ result: result.data || { success: true, totalPemasukan: 0, totalPengeluaran: 0, totalTransaksi: 0 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message, result: { success: false, message } }, /token|akses/i.test(message) ? 403 : 400);
  }
});
