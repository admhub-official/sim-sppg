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
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
};
const validPath = (value: unknown) => {
  const path = text(value);
  return !!path && path !== '-' && !/^https?:\/\//i.test(path);
};
const inferMime = (path: string) => {
  const value = path.toLowerCase().split('?')[0];
  if (value.endsWith('.pdf')) return 'application/pdf';
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
};

type Caller = { id: string; email: string; username: string; role: string };
type DocumentRow = {
  transaksi_id: string;
  document_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type?: string | null;
  original_file_name?: string | null;
};

async function getCaller(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Sesi berakhir. Silakan login kembali.');
  const profile = await sb.from('USERS')
    .select('ID,EMAIL,USERNAME,ROLE')
    .eq('ID', auth.data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil user tidak ditemukan.');
  return {
    id: auth.data.user.id,
    email: lower(auth.data.user.email || profile.data.EMAIL),
    username: lower(profile.data.USERNAME),
    role: text(profile.data.ROLE).toUpperCase(),
  };
}

async function canAccess(caller: Caller, transaction: any) {
  if (caller.role === 'SUPER_ADMIN') return true;
  if (caller.role === 'USER') {
    return [caller.email, caller.username].includes(lower(transaction.User));
  }
  if (caller.role !== 'ADMIN') return false;
  const assignments = await sb.from('ADMIN_ASSIGNMENT')
    .select('sppg,yayasan')
    .eq('admin_email', caller.email);
  if (assignments.error) throw assignments.error;
  return (assignments.data || []).some((row: any) =>
    text(row.sppg).toUpperCase() === text(transaction.SPPG).toUpperCase() &&
    (!text(row.yayasan) || !text(transaction.YAYASAN) || text(row.yayasan).toUpperCase() === text(transaction.YAYASAN).toUpperCase())
  );
}

async function resolveSupplier(fields: any) {
  const supplierId = text(fields['Supplier ID'] || fields.supplierId);
  const manualName = text(fields['Nama Supplier'] || fields.supplierName);
  if (!supplierId) {
    return {
      'SUPPLIER ID': null,
      'NAMA SUPPLIER': manualName || null,
      'NAMA BANK SUPPLIER': text(fields['Nama Bank Supplier'] || fields.supplierBankName) || null,
      'NO REKENING SUPPLIER': text(fields['No Rekening Supplier'] || fields.supplierAccountNumber) || null,
      'ATAS NAMA REKENING SUPPLIER': text(fields['Atas Nama Rekening Supplier'] || fields.supplierAccountHolder) || null,
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

async function editTransaction(id: string, fields: any, caller: Caller) {
  if (!id) throw new Error('ID transaksi tidak valid.');
  const current = await sb.from('TRANSAKSI').select('*').eq('ID', id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw new Error('Transaksi tidak ditemukan.');
  if (!(await canAccess(caller, current.data))) throw new Error('Akses edit transaksi ditolak.');

  const mapping: Record<string, string> = {
    Tanggal: 'Tanggal',
    Kategori: 'Kategori',
    'Jenis Kategori': 'Jenis Kategori',
    SPPG: 'SPPG',
    YAYASAN: 'YAYASAN',
    'Nama Item/Bahan Baku': 'Nama Item/ Bahan Baku',
    Nominal: 'Nominal',
    Catatan: 'Catatan',
    'Metode Transaksi': 'Metode Transaksi',
  };
  const patch: Record<string, unknown> = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, source)) continue;
    patch[target] = target === 'Tanggal' ? normalizeDate(fields[source]) : fields[source];
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'Nominal') && !(Number(patch.Nominal) > 0)) {
    throw new Error('Nominal transaksi harus lebih dari 0.');
  }

  if (text(patch.Kategori || current.data.Kategori).toUpperCase() === 'PENGELUARAN') {
    Object.assign(patch, await resolveSupplier(fields));
  } else {
    Object.assign(patch, {
      'SUPPLIER ID': null,
      'NAMA SUPPLIER': null,
      'NAMA BANK SUPPLIER': null,
      'NO REKENING SUPPLIER': null,
      'ATAS NAMA REKENING SUPPLIER': null,
      'SUMBER SUPPLIER': null,
    });
  }

  const documents = await sb.from('TRANSAKSI_DOCUMENTS_AVAILABLE')
    .select('transaksi_id,document_type,storage_bucket,storage_path,mime_type,original_file_name')
    .eq('transaksi_id', id);
  if (documents.error) throw documents.error;
  const docs = new Map<string, DocumentRow>();
  for (const row of documents.data || []) docs.set(row.document_type, row as DocumentRow);

  const inputDocuments: Record<string, [string, string]> = {
    'Upload Foto': ['FOTO_TRANSAKSI', 'transaksi-images'],
    'Upload File': ['FILE_TRANSAKSI', 'transaksi-files'],
    'TTD User': ['TTD_USER', 'paraf-user'],
    'Nota Pembelian': ['NOTA_PEMBELIAN', 'nota-pembelian'],
  };
  for (const [field, [type, bucket]] of Object.entries(inputDocuments)) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, field)) continue;
    const path = text(fields[field]);
    if (!validPath(path)) continue;
    docs.set(type, {
      transaksi_id: id,
      document_type: type,
      storage_bucket: bucket,
      storage_path: path,
      mime_type: inferMime(path),
      original_file_name: path.split('/').pop(),
    });
  }

  const rpc = await sb.rpc('update_transaction_with_documents_atomic', {
    p_transaksi_id: id,
    p_patch: patch,
    p_documents: [...docs.values()].map((row) => ({
      document_type: row.document_type,
      storage_bucket: row.storage_bucket,
      storage_path: row.storage_path,
      mime_type: row.mime_type || inferMime(row.storage_path),
      original_file_name: row.original_file_name || row.storage_path.split('/').pop(),
    })),
    p_uploaded_by: caller.email,
  });
  if (rpc.error) throw rpc.error;
  return {
    success: true,
    message: 'Perubahan transaksi berhasil disimpan.',
    data: rpc.data || { ...current.data, ...patch },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'transaction-edit-action', version: 2 });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const caller = await getCaller(req);
    const body = await req.json();
    if (body?.function !== 'editTransaction') return json({ error: 'Fungsi tidak diizinkan.' }, 404);
    const parameters = Array.isArray(body.parameters) ? body.parameters : [];
    return json({ result: await editTransaction(text(parameters[0]), parameters[1] || {}, caller) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return json({ error: message, result: { success: false, message } }, /akses|token|sesi/i.test(message) ? 403 : 400);
  }
});
