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
const normalizeDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
};
const normalizeMethod = (value: unknown) => {
  const method = text(value).toUpperCase().replace(/\s+/g, '_');
  return method === 'LUNAS' ? 'SUDAH_DIBAYAR' : (method || 'BELUM_BAYAR');
};
const validPath = (value: unknown) => {
  const path = text(value);
  return Boolean(path && path !== '-' && !/^https?:\/\//i.test(path));
};
const inferMime = (path: unknown) => {
  const value = text(path).toLowerCase().split('?')[0];
  if (value.endsWith('.pdf')) return 'application/pdf';
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
};

type Caller = {
  id: string;
  email: string;
  username: string;
  role: string;
  sppg: string;
  yayasan: string;
};

type DocumentRow = {
  document_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  original_file_name: string;
};

const BUCKETS: Record<string, string> = {
  FOTO_TRANSAKSI: 'transaksi-images',
  FILE_TRANSAKSI: 'transaksi-files',
  TTD_USER: 'paraf-user',
  NOTA_PEMBELIAN: 'nota-pembelian',
};

async function getCaller(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');

  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Sesi berakhir. Silakan login kembali.');

  const profile = await sb.from('USERS')
    .select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN"')
    .eq('ID', auth.data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil user tidak ditemukan.');

  return {
    id: auth.data.user.id,
    email: lower(auth.data.user.email || profile.data.EMAIL),
    username: lower(profile.data.USERNAME),
    role: text(profile.data.ROLE).toUpperCase(),
    sppg: text(profile.data.SPPG),
    yayasan: text(profile.data['NAMA YAYASAN']),
  };
}

async function getAssignments(caller: Caller) {
  if (caller.role !== 'ADMIN') return [] as Array<{ sppg: string; yayasan: string }>;
  const result = await sb.from('ADMIN_ASSIGNMENT')
    .select('sppg,yayasan')
    .eq('admin_email', caller.email);
  if (result.error) throw result.error;
  return (result.data || []).map((row: any) => ({
    sppg: text(row.sppg),
    yayasan: text(row.yayasan),
  }));
}

async function resolveYayasan(caller: Caller, sppg: string, requested: unknown) {
  const explicit = text(requested);
  if (explicit) return explicit;
  if (sppg === caller.sppg && caller.yayasan) return caller.yayasan;

  if (caller.role === 'ADMIN') {
    const matches = (await getAssignments(caller)).filter((row) => row.sppg === sppg && row.yayasan);
    if (matches.length === 1) return matches[0].yayasan;
  }

  const directory = await sb.from('SPPG_DIRECTORY')
    .select('yayasan')
    .eq('sppg', sppg.toUpperCase())
    .maybeSingle();
  if (directory.error) throw directory.error;
  return text(directory.data?.yayasan);
}

function inputDocuments(data: any): DocumentRow[] {
  const rows: DocumentRow[] = [];
  const fields: Array<[string, string]> = [
    ['uploadFoto', 'FOTO_TRANSAKSI'],
    ['uploadFile', 'FILE_TRANSAKSI'],
    ['ttdUser', 'TTD_USER'],
    ['notaPembelian', 'NOTA_PEMBELIAN'],
  ];

  for (const [field, type] of fields) {
    const path = text(data?.[field]);
    if (!validPath(path)) continue;
    rows.push({
      document_type: type,
      storage_bucket: BUCKETS[type],
      storage_path: path,
      mime_type: inferMime(path),
      original_file_name: path.split('/').pop() || path,
    });
  }
  return rows;
}

async function resolveSupplier(data: any) {
  const supplierId = text(data?.supplierId || data?.['SUPPLIER ID']);
  const manualName = text(data?.supplierName || data?.['Nama Supplier']);

  if (!supplierId) {
    return {
      'SUPPLIER ID': null,
      'NAMA SUPPLIER': manualName || null,
      'NAMA BANK SUPPLIER': text(data?.supplierBankName || data?.['Nama Bank Supplier']) || null,
      'NO REKENING SUPPLIER': text(data?.supplierAccountNumber || data?.['No Rekening Supplier']) || null,
      'ATAS NAMA REKENING SUPPLIER': text(data?.supplierAccountHolder || data?.['Atas Nama Rekening Supplier']) || null,
      'SUMBER SUPPLIER': manualName ? 'MANUAL' : null,
    };
  }

  const supplier = await sb.from('MASTER_SUPPLIER')
    .select('ID,"NAMA SUPPLIER","NAMA BANK","NO REKENING","ATAS NAMA REKENING",STATUS')
    .eq('ID', supplierId)
    .maybeSingle();
  if (supplier.error) throw supplier.error;
  if (!supplier.data) throw new Error('Supplier yang dipilih tidak ditemukan atau sudah dihapus.');
  if (lower(supplier.data.STATUS || 'Aktif') !== 'aktif') throw new Error('Supplier yang dipilih tidak aktif.');

  return {
    'SUPPLIER ID': text(supplier.data.ID),
    'NAMA SUPPLIER': text(supplier.data['NAMA SUPPLIER']),
    'NAMA BANK SUPPLIER': text(supplier.data['NAMA BANK']),
    'NO REKENING SUPPLIER': text(supplier.data['NO REKENING']),
    'ATAS NAMA REKENING SUPPLIER': text(supplier.data['ATAS NAMA REKENING']),
    'SUMBER SUPPLIER': 'MASTER',
  };
}

async function addTransaction(data: any, caller: Caller) {
  const sppg = ['ADMIN', 'SUPER_ADMIN'].includes(caller.role)
    ? text(data?.sppg || caller.sppg)
    : caller.sppg;
  const yayasan = await resolveYayasan(caller, sppg, data?.yayasan);
  if (!sppg || !yayasan) throw new Error('SPPG dan Yayasan wajib tersedia.');
  if (!(Number(data?.nominal) > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');

  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const method = normalizeMethod(data?.metodeTransaksi);
  const documents = inputDocuments(data);
  const documentTypes = new Set(documents.map((row) => row.document_type));

  if (!documentTypes.has('TTD_USER')) throw new Error('Tanda tangan digital pengguna wajib tersedia.');
  if (!documentTypes.has('NOTA_PEMBELIAN')) throw new Error('Nota pembelian wajib tersedia.');
  if (method !== 'BELUM_BAYAR' && !documentTypes.has('FOTO_TRANSAKSI') && !documentTypes.has('FILE_TRANSAKSI')) {
    throw new Error('Bukti transaksi wajib tersedia untuk metode Sudah Dibayar.');
  }

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    ID: id,
    'Kode Pemasukan': `TRX - ${crypto.randomUUID().slice(0, 8)}`,
    Tanggal: normalizeDate(data?.tanggal),
    Kategori: text(data?.kategori),
    'Jenis Kategori': text(data?.jenisKategori),
    SPPG: sppg,
    YAYASAN: yayasan,
    Nominal: Number(data?.nominal),
    Catatan: text(data?.catatan),
    Timestamp: now,
    User: caller.email,
    'Nama Item/ Bahan Baku': text(data?.namaItem || data?.item),
    'Metode Transaksi': method,
    'APPROVED BY': method === 'SUDAH_DIBAYAR' ? caller.email : '',
    'WAKTU APPROVE': method === 'SUDAH_DIBAYAR' ? now : null,
    Catatan_1: '',
    'Catatan Approval': method === 'SUDAH_DIBAYAR'
      ? 'Pembayaran langsung telah dilengkapi saat transaksi dibuat.'
      : '',
    Deskripsi: '',
  };
  Object.assign(row, await resolveSupplier(data));

  const result = await sb.rpc('create_transaction_with_documents_atomic', {
    p_transaction: row,
    p_documents: documents,
    p_uploaded_by: caller.email,
  });
  if (result.error) throw new Error(result.error.message || 'Database menolak penyimpanan transaksi.');

  return {
    success: true,
    message: 'Transaksi berhasil ditambahkan.',
    id,
    data: result.data || row,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'transaction-create-action', version: 1 });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);

  try {
    const caller = await getCaller(req);
    const body = await req.json();
    if (body?.function !== 'addTransaction') return json({ error: 'Fungsi tidak diizinkan.' }, 404);
    const parameters = Array.isArray(body.parameters) ? body.parameters : [];
    return json({ result: await addTransaction(parameters[0] || {}, caller) });
  } catch (error) {
    const message = error instanceof Error ? error.message : text(error) || 'Terjadi kesalahan pada server.';
    console.error(message);
    const denied = /akses|token|sesi/i.test(message);
    return json({ error: message, result: { success: false, message } }, denied ? 403 : 400);
  }
});
