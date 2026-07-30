import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const text = (value: unknown) => String(value ?? '').trim();

async function requireSuperAdmin(req: Request) {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const profile = await sb.from('USERS').select('ID,EMAIL,ROLE').eq('ID', auth.data.user.id).maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil user tidak ditemukan.');
  if (text(profile.data.ROLE).toUpperCase() !== 'SUPER_ADMIN') throw new Error('Hanya SUPER ADMIN yang dapat menjalankan pembersihan Storage.');
  return profile.data;
}

async function isStillReferenced(bucket: string, path: string) {
  const checks = await Promise.all([
    sb.from('TRANSAKSI_DOCUMENTS').select('id').eq('storage_bucket', bucket).eq('storage_path', path).limit(1),
    sb.from('TRANSAKSI_PAYMENT_PROOFS').select('id').eq('storage_bucket', bucket).eq('storage_path', path).limit(1),
    bucket === 'paraf-verifikator' ? sb.from('TRANSAKSI_PAYMENT_PROOFS').select('id').eq('verifier_signature_path', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'foto-profil' ? sb.from('USERS').select('ID').eq('FOTO PROFIL', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'foto-supplier' ? sb.from('MASTER_SUPPLIER').select('ID').eq('FOTO SUPPLIER', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'file-mou' ? sb.from('MASTER_SUPPLIER').select('ID').eq('FILE MOU', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'ttd-supplier-inv' ? sb.from('MASTER_SUPPLIER').select('ID').eq('TTD SUPPLIER', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'foto-bb' ? sb.from('SURVEI_BB').select('ID').eq('FOTO BAHAN BAKU', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'foto-datang' ? sb.from('SERAH_TERIMA').select('ID').or(`"FOTO BARANG DATANG".eq.${path},"FOTO SURAT JALAN".eq.${path}`).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'ttd-penerima' ? sb.from('SERAH_TERIMA').select('ID').eq('TTD PENERIMA', path).limit(1) : Promise.resolve({ data: [] }),
    bucket === 'ttd-supplier-inv' ? sb.from('SERAH_TERIMA').select('ID').eq('TTD SUPPLIER', path).limit(1) : Promise.resolve({ data: [] }),
  ] as any[]);
  for (const result of checks as any[]) {
    if (result?.error) throw result.error;
    if (result?.data?.length) return true;
  }
  return false;
}

async function summary() {
  const q = await sb.from('storage_cleanup_queue').select('status,reason,size_bytes');
  if (q.error) throw q.error;
  const rows = q.data || [];
  const out: Record<string, any> = { total: rows.length, pending: 0, deleted: 0, skipped: 0, failed: 0, pendingBytes: 0 };
  for (const row of rows) {
    const status = text(row.status).toLowerCase();
    out[status] = (out[status] || 0) + 1;
    if (status === 'pending') out.pendingBytes += Number(row.size_bytes) || 0;
  }
  return out;
}

async function processBatch(limitInput: unknown, dryRun: boolean) {
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 25));
  const q = await sb.from('storage_cleanup_queue')
    .select('id,bucket_id,object_name,reason,size_bytes')
    .eq('status', 'PENDING')
    .order('reason', { ascending: true })
    .order('discovered_at', { ascending: true })
    .limit(limit);
  if (q.error) throw q.error;
  const results: any[] = [];
  for (const item of q.data || []) {
    const referenced = await isStillReferenced(text(item.bucket_id), text(item.object_name));
    if (referenced) {
      if (!dryRun) await sb.from('storage_cleanup_queue').update({ status: 'SKIPPED', processed_at: new Date().toISOString(), error_message: 'Objek kembali direferensikan.' }).eq('id', item.id);
      results.push({ id: item.id, status: 'SKIPPED', reason: 'REFERENCED' });
      continue;
    }
    if (dryRun) {
      results.push({ id: item.id, status: 'READY', bucket: item.bucket_id, path: item.object_name, sizeBytes: item.size_bytes });
      continue;
    }
    await sb.from('storage_cleanup_queue').update({ status: 'PROCESSING', error_message: null }).eq('id', item.id);
    const removal = await sb.storage.from(text(item.bucket_id)).remove([text(item.object_name)]);
    if (removal.error) {
      await sb.from('storage_cleanup_queue').update({ status: 'FAILED', processed_at: new Date().toISOString(), error_message: removal.error.message }).eq('id', item.id);
      results.push({ id: item.id, status: 'FAILED', error: removal.error.message });
    } else {
      await sb.from('storage_cleanup_queue').update({ status: 'DELETED', processed_at: new Date().toISOString(), error_message: null }).eq('id', item.id);
      results.push({ id: item.id, status: 'DELETED', sizeBytes: item.size_bytes });
    }
  }
  return { dryRun, processed: results.length, results, summary: await summary() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'storage-cleanup-action', version: 1 });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    await requireSuperAdmin(req);
    const body = await req.json();
    const fn = text(body?.function);
    const params = Array.isArray(body?.parameters) ? body.parameters : [];
    if (fn === 'getStorageCleanupSummary') return json({ result: await summary() });
    if (fn === 'processStorageCleanup') return json({ result: await processBatch(params[0]?.limit, params[0]?.dryRun !== false) });
    return json({ error: 'Fungsi tidak diizinkan.' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const denied = /token|akses|super admin/i.test(message);
    return json({ error: message, result: { success: false, message } }, denied ? 403 : 400);
  }
});
