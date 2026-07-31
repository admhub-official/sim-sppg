import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
});
const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();
const scope = (value: unknown) => text(value).toUpperCase().replace(/\s+/g, ' ');

type Caller = {
  id: string;
  email: string;
  username: string;
  role: string;
  name: string;
};

async function getCaller(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Sesi berakhir. Silakan login kembali.');
  const profile = await sb.from('USERS')
    .select('ID,EMAIL,USERNAME,ROLE,"NAMA LENGKAP"')
    .eq('ID', auth.data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil user tidak ditemukan.');
  return {
    id: auth.data.user.id,
    email: lower(auth.data.user.email || profile.data.EMAIL),
    username: lower(profile.data.USERNAME),
    role: scope(profile.data.ROLE),
    name: text(profile.data['NAMA LENGKAP']),
  };
}

async function canDelete(caller: Caller, supplier: any) {
  if (caller.role === 'SUPER_ADMIN') return true;
  if (caller.role !== 'ADMIN') return false;
  const assignments = await sb.from('ADMIN_ASSIGNMENT')
    .select('sppg,yayasan')
    .eq('admin_email', caller.email);
  if (assignments.error) throw assignments.error;
  const supplierSppg = scope(supplier.SPPG);
  const supplierYayasan = scope(supplier.YAYASAN);
  return (assignments.data || []).some((row: any) => {
    const sameSppg = scope(row.sppg) === supplierSppg;
    const assignedYayasan = scope(row.yayasan);
    return sameSppg && (!assignedYayasan || !supplierYayasan || assignedYayasan === supplierYayasan);
  });
}

async function removeFile(bucket: string, path: unknown) {
  const value = text(path);
  if (!value) return;
  const result = await sb.storage.from(bucket).remove([value]);
  if (result.error) console.error(`Gagal membersihkan ${bucket}/${value}:`, result.error.message);
}

async function deleteSupplier(id: string, caller: Caller) {
  if (!id) throw new Error('ID supplier tidak valid.');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
    throw new Error('Hanya ADMIN yang dapat menghapus supplier.');
  }

  const supplier = await sb.from('MASTER_SUPPLIER')
    .select('ID,"NAMA SUPPLIER","FOTO SUPPLIER","TTD SUPPLIER","FILE MOU",SPPG,YAYASAN')
    .eq('ID', id)
    .maybeSingle();
  if (supplier.error) throw supplier.error;
  if (!supplier.data) throw new Error('Supplier tidak ditemukan atau sudah dihapus.');
  if (!(await canDelete(caller, supplier.data))) throw new Error('Akses hapus supplier ditolak.');

  // Pertahankan snapshot nama dan rekening pada transaksi lama, tetapi lepaskan
  // relasi ID supaya supplier master dapat dihapus tanpa merusak histori transaksi.
  const detach = await sb.from('TRANSAKSI')
    .update({ 'SUPPLIER ID': null, 'SUMBER SUPPLIER': 'MANUAL' })
    .eq('SUPPLIER ID', id);
  if (detach.error) throw detach.error;

  const removed = await sb.from('MASTER_SUPPLIER').delete().eq('ID', id).select('ID').maybeSingle();
  if (removed.error) throw removed.error;
  if (!removed.data) throw new Error('Supplier gagal dihapus. Muat ulang lalu coba kembali.');

  await Promise.all([
    removeFile('foto-supplier', supplier.data['FOTO SUPPLIER']),
    removeFile('ttd-supplier-inv', supplier.data['TTD SUPPLIER']),
    removeFile('file-mou', supplier.data['FILE MOU']),
  ]);

  try {
    await sb.from('AUDIT LOG').insert({
      TIMESTAMP: new Date().toISOString(),
      USER_EMAIL: caller.email,
      USER_NAME: caller.name,
      ROLE: caller.role,
      ACTION_TYPE: 'DELETE',
      TABLE_NAME: 'MASTER_SUPPLIER',
      RECORD_ID: id,
      FIELD_CHANGED: 'SUPPLIER_DELETE',
      OLD_VALUE: text(supplier.data['NAMA SUPPLIER']),
      NEW_VALUE: '',
      DESCRIPTION: `Menghapus supplier ${text(supplier.data['NAMA SUPPLIER'])}`,
      IP_USER: '',
      STATUS: 'SUCCESS',
    });
  } catch (error) {
    console.error('Audit hapus supplier gagal:', error);
  }

  return {
    success: true,
    message: 'Supplier berhasil dihapus. Transaksi lama tetap menyimpan snapshot nama dan rekening supplier.',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'supplier-delete-action', version: 1 });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const caller = await getCaller(req);
    const body = await req.json();
    if (body?.function !== 'deleteSupplier') return json({ error: 'Fungsi tidak diizinkan.' }, 404);
    const parameters = Array.isArray(body.parameters) ? body.parameters : [];
    return json({ result: await deleteSupplier(text(parameters[0]), caller) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return json({ error: message, result: { success: false, message } }, /akses|token|sesi|hanya admin/i.test(message) ? 403 : 400);
  }
});
