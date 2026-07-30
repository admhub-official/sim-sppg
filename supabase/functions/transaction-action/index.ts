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

const T = {
  U: 'USERS',
  X: 'TRANSAKSI',
  A: 'ADMIN_ASSIGNMENT',
  P: 'TRANSAKSI_PAYMENT_PROOFS',
  D: 'TRANSAKSI_DOCUMENTS',
  DA: 'TRANSAKSI_DOCUMENTS_AVAILABLE',
  S: 'SPPG_DIRECTORY',
  MS: 'MASTER_SUPPLIER',
  L: 'AUDIT LOG',
};

const B = {
  foto: 'transaksi-images',
  file: 'transaksi-files',
  ttdUser: 'paraf-user',
  nota: 'nota-pembelian',
  ttdVerif: 'paraf-verifikator',
  payment: 'bukti-payment',
};

const DT = {
  foto: 'FOTO_TRANSAKSI',
  file: 'FILE_TRANSAKSI',
  ttdUser: 'TTD_USER',
  nota: 'NOTA_PEMBELIAN',
  ttdVerif: 'TTD_VERIFIKATOR_LEGACY',
};

// List endpoints deliberately exclude legacy/base64-adjacent columns. Keeping the
// projection here prevents new table columns from silently increasing API egress.
const TRANSACTION_LIST_COLUMNS = 'ID,"Kode Pemasukan",Tanggal,Kategori,"Jenis Kategori",SPPG,YAYASAN,Nominal,Catatan,User,"Nama Item/ Bahan Baku","Metode Transaksi","SUPPLIER ID","NAMA SUPPLIER","NAMA BANK SUPPLIER","NO REKENING SUPPLIER","ATAS NAMA REKENING SUPPLIER","SUMBER SUPPLIER","APPROVED BY","WAKTU APPROVE",Catatan_1,"Catatan Approval"';
const DOCUMENT_COLUMNS = 'transaksi_id,document_type,storage_bucket,storage_path,mime_type,original_file_name,created_at,updated_at';
const PAYMENT_PROOF_COLUMNS = 'id,transaksi_id,payment_sequence,nominal,storage_bucket,storage_path,mime_type,original_file_name,submitted_by,submitted_at,status,verified_by,verified_at,verifier_signature_path,verification_notes';

type Caller = { id: string; email: string; role: string; sppg: string; yayasan: string; nama: string };
type Doc = {
  transaksi_id: string;
  document_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type?: string | null;
  original_file_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
});
const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();

const TRANSACTION_CATEGORY_TYPES = {
  PEMASUKAN: [
    'Anggaran Bahan Baku',
    'Anggaran Sewa Mobil',
    'Anggaran Insentif Fasilitas',
  ],
  SUPPLIER_REQUIRED: [
    'Belanja Bahan Baku',
    'Material Bangunan',
    'Gas LPG',
    'Sewa & Utilitas (AC/WIFI)',
    'IPAL',
    'Inventaris Kantor',
    'Cetak & Promosi',
  ],
  SUPPLIER_OPTIONAL: [
    'Gaji/Upah Karyawan',
    'Operasional Perjalanan',
    'Konsumsi',
    'Dana Talangan',
    'Cicilan',
    'Fee Yayasan',
    'Administrasi & Lainnya',
  ],
} as const;
const normalizeCategoryValue = (value: unknown) => text(value).replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
const categoryIncludes = (values: readonly string[], value: unknown) => values.some((item) => normalizeCategoryValue(item) === normalizeCategoryValue(value));
const supplierRequiredFor = (category: unknown, type: unknown) => text(category).toUpperCase() === 'PENGELUARAN' && categoryIncludes(TRANSACTION_CATEGORY_TYPES.SUPPLIER_REQUIRED, type);
function validateTransactionCategory(category: unknown, type: unknown) {
  const normalizedCategory = text(category).toUpperCase();
  const normalizedType = text(type);
  const allowed = normalizedCategory === 'PEMASUKAN'
    ? TRANSACTION_CATEGORY_TYPES.PEMASUKAN
    : normalizedCategory === 'PENGELUARAN'
      ? [...TRANSACTION_CATEGORY_TYPES.SUPPLIER_REQUIRED, ...TRANSACTION_CATEGORY_TYPES.SUPPLIER_OPTIONAL]
      : [];
  if (!allowed.length) throw new Error('Kategori transaksi hanya boleh PEMASUKAN atau PENGELUARAN.');
  if (!categoryIncludes(allowed, normalizedType)) throw new Error('Jenis kategori wajib dipilih dari daftar kategori resmi.');
  return allowed.find((item) => categoryIncludes([item], normalizedType)) || normalizedType;
}

const normalizeStatus = (value: unknown) => {
  const normalized = text(value).toUpperCase().replace(/\s+/g, '_');
  return normalized === 'LUNAS' ? 'SUDAH_DIBAYAR' : (normalized || 'BELUM_BAYAR');
};
const validPath = (value: unknown) => {
  const path = text(value);
  return !!path && path !== '-' && !/^(FOTO|FILE)$/i.test(path) && !/^https?:\/\//i.test(path);
};
const normalizeDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
};
const inferMime = (path: unknown, supplied?: string | null) => {
  if (supplied) return supplied;
  const value = text(path).toLowerCase().split('?')[0];
  if (value.endsWith('.pdf')) return 'application/pdf';
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.heic')) return 'image/heic';
  if (value.endsWith('.heif')) return 'image/heif';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
};

function decodeBase64(value: string) {
  const raw = value.includes(',') ? value.split(',').pop()! : value;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function docIndex(rows: Doc[]) {
  const result = new Map<string, Doc>();
  for (const row of rows || []) {
    const previous = result.get(row.document_type);
    if (!previous || text(row.updated_at || row.created_at) >= text(previous.updated_at || previous.created_at)) {
      result.set(row.document_type, row);
    }
  }
  return result;
}

const docPath = (docs: Map<string, Doc>, type: string) => text(docs.get(type)?.storage_path);
const missingDocs = (docs: Map<string, Doc>) => {
  const missing: string[] = [];
  if (!validPath(docPath(docs, DT.foto)) && !validPath(docPath(docs, DT.file))) missing.push('Bukti Transaksi');
  if (!validPath(docPath(docs, DT.ttdUser))) missing.push('TTD User');
  if (!validPath(docPath(docs, DT.nota))) missing.push('Nota Pembelian');
  return missing;
};
const missingCreateDocs = (docs: Map<string, Doc>, method: string) => {
  const missing: string[] = [];
  if (normalizeStatus(method) !== 'BELUM_BAYAR' &&
      !validPath(docPath(docs, DT.foto)) &&
      !validPath(docPath(docs, DT.file))) {
    missing.push('Bukti Transaksi');
  }
  if (!validPath(docPath(docs, DT.ttdUser))) missing.push('TTD User');
  if (!validPath(docPath(docs, DT.nota))) missing.push('Nota Pembelian');
  return missing;
};
const documentStatus = (docs: Map<string, Doc>) => {
  const missing = missingDocs(docs);
  return missing.length ? `Dokumen Tidak Lengkap: ${missing.join(', ')}` : 'Dokumen Lengkap';
};

function mapTransaction(row: any, docs: Map<string, Doc>) {
  const hasBuktiTransaksi = validPath(docPath(docs, DT.foto)) || validPath(docPath(docs, DT.file));
  const hasNotaPembelian = validPath(docPath(docs, DT.nota));
  const hasTtdUser = validPath(docPath(docs, DT.ttdUser));
  return {
    id: row.ID || '',
    kode: row['Kode Pemasukan'] || '',
    tanggal: row.Tanggal || '',
    kategori: row.Kategori || '',
    jenisKategori: row['Jenis Kategori'] || '',
    sppg: row.SPPG || '',
    yayasan: row.YAYASAN || '',
    nominal: Number(row.Nominal) || 0,
    uploadFoto: docPath(docs, DT.foto),
    uploadFile: docPath(docs, DT.file),
    catatan: row.Catatan || '',
    user: row.User || '',
    item: row['Nama Item/ Bahan Baku'] || '',
    namaItem: row['Nama Item/ Bahan Baku'] || '',
    supplierId: row['SUPPLIER ID'] || '',
    supplierName: row['NAMA SUPPLIER'] || '',
    supplierBankName: row['NAMA BANK SUPPLIER'] || '',
    supplierAccountNumber: row['NO REKENING SUPPLIER'] || '',
    supplierAccountHolder: row['ATAS NAMA REKENING SUPPLIER'] || '',
    supplierSource: row['SUMBER SUPPLIER'] || '',
    metodeTransaksi: normalizeStatus(row['Metode Transaksi']),
    ttdVerifikator: docPath(docs, DT.ttdVerif),
    ttdUser: docPath(docs, DT.ttdUser),
    notaPembelian: docPath(docs, DT.nota),
    approvedBy: row['APPROVED BY'] || '',
    waktuApprove: row['WAKTU APPROVE'] || '',
    statusDokumen: documentStatus(docs),
    catatanApproval: row['Catatan Approval'] || row.Catatan_1 || '',
    hasBuktiTransaksi,
    hasNotaPembelian,
    hasTtdUser,
  };
}

async function docsFor(ids: string[]) {
  const output = new Map<string, Map<string, Doc>>();
  const uniqueIds = [...new Set(ids.map(text).filter(Boolean))];
  if (!uniqueIds.length) return output;
  const query = await sb.from(T.DA)
    .select(DOCUMENT_COLUMNS)
    .in('transaksi_id', uniqueIds)
    .order('updated_at', { ascending: true });
  if (query.error) throw query.error;
  for (const row of query.data || []) {
    const id = text(row.transaksi_id);
    if (!output.has(id)) output.set(id, new Map());
    output.get(id)!.set(text(row.document_type), row as Doc);
  }
  return output;
}

async function caller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const profile = await sb.from(T.U)
    .select('ID,EMAIL,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"')
    .eq('ID', auth.data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data) throw new Error('Profil user tidak ditemukan.');
  return {
    id: auth.data.user.id,
    email: lower(auth.data.user.email || profile.data.EMAIL),
    role: text(profile.data.ROLE).toUpperCase(),
    sppg: text(profile.data.SPPG),
    yayasan: text(profile.data['NAMA YAYASAN']),
    nama: text(profile.data['NAMA LENGKAP']),
  };
}

async function assignedPairs(current: Caller) {
  if (current.role !== 'ADMIN') return [] as string[][];
  const query = await sb.from(T.A).select('sppg,yayasan').eq('admin_email', current.email);
  if (query.error) throw query.error;
  return (query.data || []).map((row: any) => [text(row.sppg), text(row.yayasan)]);
}

async function pairAllowed(current: Caller, sppg: unknown, yayasan: unknown) {
  if (current.role === 'SUPER_ADMIN') return true;
  if (current.role !== 'ADMIN') return false;
  const targetSppg = text(sppg);
  const targetYayasan = text(yayasan);
  return (await assignedPairs(current)).some(([assignedSppg, assignedYayasan]) => assignedSppg === targetSppg && assignedYayasan === targetYayasan);
}

const sameText = (left: unknown, right: unknown) => text(left).toUpperCase() === text(right).toUpperCase();

async function resolveYayasan(sppg: unknown, requested: unknown, current: Caller) {
  const targetSppg = text(sppg);
  const explicitYayasan = text(requested);
  if (!targetSppg) return '';
  if (explicitYayasan) return explicitYayasan;

  if (current.role === 'ADMIN') {
    const matches = (await assignedPairs(current)).filter(
      ([assignedSppg, assignedYayasan]) => sameText(assignedSppg, targetSppg) && !!text(assignedYayasan),
    );
    if (matches.length === 1) return text(matches[0][1]);
    if (current.yayasan && matches.some(([, assignedYayasan]) => sameText(assignedYayasan, current.yayasan))) {
      return current.yayasan;
    }
  }

  if (sameText(current.sppg, targetSppg) && current.yayasan) return current.yayasan;

  const directory = await sb.from(T.S)
    .select('yayasan')
    .eq('sppg', targetSppg.toUpperCase())
    .maybeSingle();
  if (directory.error) throw directory.error;
  return text(directory.data?.yayasan);
}

async function resolveSupplier(data: any, sppg: string, yayasan: string, category: unknown, type: unknown) {
  const required = supplierRequiredFor(category, type);
  if (!required) {
    return {
      'SUPPLIER ID': null, 'NAMA SUPPLIER': null, 'NAMA BANK SUPPLIER': null,
      'NO REKENING SUPPLIER': null, 'ATAS NAMA REKENING SUPPLIER': null,
      'SUMBER SUPPLIER': null,
    };
  }

  const supplierId = text(data.supplierId ?? data['SUPPLIER ID']);
  if (!supplierId) {
    throw new Error('Supplier wajib dipilih dari Data Supplier. Jika belum tersedia, buat data supplier baru terlebih dahulu.');
  }

  const query = await sb.from(T.MS)
    .select('ID,"NAMA SUPPLIER","NAMA BANK","NO REKENING","ATAS NAMA REKENING",STATUS,SPPG,YAYASAN')
    .eq('ID', supplierId)
    .maybeSingle();
  if (query.error) throw query.error;
  if (!query.data) throw new Error('Supplier yang dipilih tidak ditemukan di Data Supplier.');
  if (text(query.data.STATUS || 'Aktif') !== 'Aktif') throw new Error('Supplier yang dipilih tidak aktif.');
  if (!sameText(query.data.SPPG, sppg) || !sameText(query.data.YAYASAN, yayasan)) {
    throw new Error('Supplier tidak terdaftar untuk SPPG dan Yayasan transaksi ini.');
  }
  return {
    'SUPPLIER ID': text(query.data.ID),
    'NAMA SUPPLIER': text(query.data['NAMA SUPPLIER']),
    'NAMA BANK SUPPLIER': text(query.data['NAMA BANK']),
    'NO REKENING SUPPLIER': text(query.data['NO REKENING']),
    'ATAS NAMA REKENING SUPPLIER': text(query.data['ATAS NAMA REKENING']),
    'SUMBER SUPPLIER': 'MASTER',
  };
}

async function canAccess(current: Caller, row: any) {
  if (current.role === 'SUPER_ADMIN') return true;
  if (current.role === 'ADMIN') return pairAllowed(current, row.SPPG, row.YAYASAN);
  return lower(row.User) === current.email;
}

async function getTransaction(current: Caller, id: string) {
  const query = await sb.from(T.X).select(TRANSACTION_LIST_COLUMNS).eq('ID', id).maybeSingle();
  if (query.error) throw query.error;
  if (!query.data) throw new Error('Transaksi tidak ditemukan.');
  if (!(await canAccess(current, query.data))) throw new Error('Akses transaksi ditolak.');
  return query.data;
}

async function upload(kind: keyof typeof B, base64: string, mime: string, name: string, prefix: string) {
  const rules: Record<string, RegExp> = {
    foto: /^image\/(jpeg|jpg|png|webp|heic|heif)$/i,
    file: /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,
    ttdUser: /^image\/(png|jpeg|jpg|webp)$/i,
    nota: /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,
    ttdVerif: /^image\/(png|jpeg|jpg|webp)$/i,
    payment: /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,
  };
  if (!rules[kind].test(text(mime))) throw new Error('Tipe MIME file tidak diizinkan.');
  if (!base64 || !name) throw new Error('Data file tidak lengkap.');
  const path = `${prefix}_${Date.now()}_${crypto.randomUUID()}_${text(name).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  // Paths are immutable and unique, so a browser/CDN TTL avoids repeated origin
  // downloads without risking a stale replacement.
  const query = await sb.storage.from(B[kind]).upload(path, decodeBase64(base64), {
    contentType: mime,
    cacheControl: '3600',
    upsert: false,
  });
  if (query.error) throw new Error(`Upload gagal: ${query.error.message}`);
  return path;
}

async function signDoc(doc?: Doc) {
  if (!doc || !validPath(doc.storage_path)) return null;
  const query = await sb.storage.from(doc.storage_bucket).createSignedUrl(text(doc.storage_path), 3600);
  if (query.error || !query.data?.signedUrl) return null;
  return {
    path: text(doc.storage_path),
    bucket: doc.storage_bucket,
    name: text(doc.original_file_name) || text(doc.storage_path).split('/').pop(),
    signedUrl: query.data.signedUrl,
    signedThumbnailUrl: query.data.signedUrl,
    mimeType: inferMime(doc.storage_path, doc.mime_type),
  };
}

async function sign(kind: keyof typeof B, path: unknown, mime?: string) {
  return signDoc(validPath(path) ? {
    transaksi_id: '',
    document_type: '',
    storage_bucket: B[kind],
    storage_path: text(path),
    mime_type: mime,
  } : undefined);
}

async function audit(id: string, action: string, current: Caller, detail: any) {
  try {
    await sb.from(T.L).insert({
      TIMESTAMP: new Date().toISOString(),
      USER_EMAIL: current.email,
      USER_NAME: current.nama,
      ROLE: current.role,
      SPPG: current.sppg,
      ACTION_TYPE: action,
      TABLE_NAME: T.X,
      RECORD_ID: id,
      FIELD_CHANGED: 'TRANSACTION_SECURITY',
      OLD_VALUE: '',
      NEW_VALUE: JSON.stringify(detail).slice(0, 500),
      DESCRIPTION: `${action} ${T.X}`,
      IP_USER: '',
      STATUS: 'SUCCESS',
    });
  } catch (error) {
    console.error('audit', error);
  }
}

function pageSpec(value: any) {
  const requested = Number(value?.page) > 0 || Number(value?.pageSize) > 0;
  if (!requested) return null;
  const page = Math.max(1, Math.floor(Number(value?.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(value?.pageSize) || 25)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

async function listTransactions(filters: any, current: Caller) {
  const page = pageSpec(filters);
  const pairs = current.role === 'ADMIN' ? await assignedPairs(current) : [];
  let query = page && current.role !== 'ADMIN'
    ? sb.from(T.X).select(TRANSACTION_LIST_COLUMNS, { count: 'exact' })
    : sb.from(T.X).select(TRANSACTION_LIST_COLUMNS);

  // Push authorization and pagination into PostgREST whenever the access model can
  // be expressed safely. Unauthorized/off-page rows then never leave the database.
  if (current.role === 'USER') query = query.ilike('User', current.email);
  if (current.role === 'ADMIN') {
    const sppg = [...new Set(pairs.map(([value]) => value).filter(Boolean))];
    if (!sppg.length) return page
      ? { data: [], page: page.page, pageSize: page.pageSize, total: 0, hasMore: false }
      : [];
    query = query.in('SPPG', sppg);
  }
  if (filters?.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters?.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (filters?.kategori && filters.kategori !== 'ALL') query = query.eq('Kategori', filters.kategori);
  if (filters?.dateStart) query = query.gte('Tanggal', normalizeDate(filters.dateStart));
  if (filters?.dateEnd) query = query.lte('Tanggal', normalizeDate(filters.dateEnd));
  query = query.order('Tanggal', { ascending: false }).order('ID', { ascending: false });
  if (page && current.role !== 'ADMIN') query = query.range(page.from, page.to);

  const result = await query;
  if (result.error) throw result.error;
  let rows = result.data || [];
  let total = result.count ?? rows.length;
  if (current.role === 'ADMIN') {
    rows = rows.filter((row: any) => pairs.some(
      ([sppg, yayasan]) => sppg === text(row.SPPG) && yayasan === text(row.YAYASAN),
    ));
    total = rows.length;
    if (page) rows = rows.slice(page.from, page.to + 1);
  }

  // Related documents are loaded only for the visible page, not for every
  // transaction matching the filter.
  const documents = await docsFor(rows.map((row: any) => text(row.ID)));
  const data = rows.map((row: any) => mapTransaction(row, documents.get(text(row.ID)) || new Map()));
  if (!page) return data;
  return {
    data,
    page: page.page,
    pageSize: page.pageSize,
    total,
    hasMore: page.to + 1 < total,
  };
}

function rowMatchesTransactionFilters(row: any, filters: any) {
  const search = lower(filters?.search);
  if (search) {
    const haystack = [
      row['Kode Pemasukan'],
      row['Nama Item/ Bahan Baku'],
      row.User,
      row.SPPG,
      row.YAYASAN,
      row.Catatan,
      row['NAMA SUPPLIER'],
    ].map(lower).join(' ');
    if (!haystack.includes(search)) return false;
  }

  const status = text(filters?.status).toUpperCase();
  const method = normalizeStatus(row['Metode Transaksi']);
  if (status === 'PENDING' && method === 'SUDAH_DIBAYAR') return false;
  if (status === 'SUDAH_DIBAYAR' && method !== 'SUDAH_DIBAYAR') return false;
  return true;
}

async function getTransactionSummary(filters: any, current: Caller) {
  let query = sb.from(T.X)
    .select('ID,"Kode Pemasukan",Tanggal,Kategori,SPPG,YAYASAN,Nominal,Catatan,User,"Nama Item/ Bahan Baku","Metode Transaksi","NAMA SUPPLIER"');
  if (filters?.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters?.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (filters?.kategori && filters.kategori !== 'ALL') query = query.eq('Kategori', filters.kategori);
  if (filters?.dateStart) query = query.gte('Tanggal', normalizeDate(filters.dateStart));
  if (filters?.dateEnd) query = query.lte('Tanggal', normalizeDate(filters.dateEnd));
  const result = await query;
  if (result.error) throw result.error;

  let accessibleRows = result.data || [];
  if (current.role === 'USER') {
    accessibleRows = accessibleRows.filter((row: any) => lower(row.User) === current.email);
  } else if (current.role === 'ADMIN') {
    const allowed = new Set(
      (await assignedPairs(current)).map(([sppg, yayasan]) =>
        `${text(sppg).toUpperCase()}\u0000${text(yayasan).toUpperCase()}`),
    );
    accessibleRows = accessibleRows.filter((row: any) =>
      allowed.has(`${text(row.SPPG).toUpperCase()}\u0000${text(row.YAYASAN).toUpperCase()}`));
  }

  let totalPemasukan = 0;
  let totalPengeluaran = 0;
  let totalTransaksi = 0;
  for (const row of accessibleRows) {
    if (!rowMatchesTransactionFilters(row, filters)) continue;
    const nominal = Number(row.Nominal) || 0;
    const kategori = text(row.Kategori).toUpperCase();
    if (kategori === 'PEMASUKAN') totalPemasukan += nominal;
    if (kategori === 'PENGELUARAN') totalPengeluaran += nominal;
    totalTransaksi++;
  }

  return { success: true, totalPemasukan, totalPengeluaran, totalTransaksi };
}

function uniqueSuggestionValues(rows: any[], key: string, limit: number) {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of rows) {
    const value = text(row?.[key]);
    if (!value || value === '-') continue;
    const normalized = value.replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

async function getTransactionSuggestions(current: Caller) {
  let query = sb.from(T.X)
    .select('User,SPPG,YAYASAN,"Jenis Kategori","Nama Item/ Bahan Baku",Catatan,Tanggal')
    .order('Tanggal', { ascending: false })
    .limit(1000);
  if (current.role === 'USER') query = query.eq('User', current.email);
  const result = await query;
  if (result.error) throw result.error;

  let rows = result.data || [];
  if (current.role === 'ADMIN') {
    const allowed = new Set(
      (await assignedPairs(current)).map(([sppg, yayasan]) =>
        `${text(sppg).toUpperCase()}\u0000${text(yayasan).toUpperCase()}`),
    );
    rows = rows.filter((row: any) =>
      allowed.has(`${text(row.SPPG).toUpperCase()}\u0000${text(row.YAYASAN).toUpperCase()}`));
  }

  return {
    success: true,
    jenisKategori: [...TRANSACTION_CATEGORY_TYPES.PEMASUKAN, ...TRANSACTION_CATEGORY_TYPES.SUPPLIER_REQUIRED, ...TRANSACTION_CATEGORY_TYPES.SUPPLIER_OPTIONAL],
    items: uniqueSuggestionValues(rows, 'Nama Item/ Bahan Baku', 300),
    catatan: uniqueSuggestionValues(rows, 'Catatan', 300),
  };
}

async function transactionDetail(id: string, current: Caller) {
  const row = await getTransaction(current, id);
  const documents = (await docsFor([id])).get(id) || new Map<string, Doc>();
  const proofQuery = await sb.from(T.P).select(PAYMENT_PROOF_COLUMNS).eq('transaksi_id', id).order('payment_sequence', { ascending: true });
  if (proofQuery.error) throw proofQuery.error;
  const paymentProofs: any[] = [];
  for (const proof of proofQuery.data || []) {
    const proofDocument: Doc = {
      transaksi_id: id,
      document_type: 'PAYMENT_PROOF',
      storage_bucket: text(proof.storage_bucket) || B.payment,
      storage_path: text(proof.storage_path),
      mime_type: proof.mime_type,
      original_file_name: proof.original_file_name,
    };
    paymentProofs.push({
      ...proof,
      nominal: Number(proof.nominal) || 0,
      file: await signDoc(proofDocument),
      verifierSignature: await sign('ttdVerif', proof.verifier_signature_path, 'image/png'),
    });
  }
  const latest = paymentProofs[paymentProofs.length - 1] || null;
  return {
    ...mapTransaction(row, documents),
    fileBuktiFoto: await signDoc(documents.get(DT.foto)),
    fileBuktiFile: await signDoc(documents.get(DT.file)),
    fileBuktiApproval: latest?.file || null,
    fileNota: await signDoc(documents.get(DT.nota)),
    fileTtdUser: await signDoc(documents.get(DT.ttdUser)),
    fileTtdVerif: latest?.verifierSignature || await signDoc(documents.get(DT.ttdVerif)),
    paymentProofs,
  };
}

const ownedUpload = (current: Caller, kind: string, path: unknown) => validPath(path) && text(path).startsWith(`${kind}_${current.id}_`);

function inputDocs(data: any, id: string) {
  return docIndex([
    validPath(data.uploadFoto) ? { transaksi_id: id, document_type: DT.foto, storage_bucket: B.foto, storage_path: text(data.uploadFoto) } : null,
    validPath(data.uploadFile) ? { transaksi_id: id, document_type: DT.file, storage_bucket: B.file, storage_path: text(data.uploadFile) } : null,
    validPath(data.ttdUser) ? { transaksi_id: id, document_type: DT.ttdUser, storage_bucket: B.ttdUser, storage_path: text(data.ttdUser) } : null,
    validPath(data.notaPembelian) ? { transaksi_id: id, document_type: DT.nota, storage_bucket: B.nota, storage_path: text(data.notaPembelian) } : null,
  ].filter(Boolean) as Doc[]);
}

function docPayload(documents: Map<string, Doc>) {
  return [...documents.values()]
    .filter((document) => [DT.foto, DT.file, DT.ttdUser, DT.nota].includes(document.document_type))
    .map((document) => ({
      document_type: document.document_type,
      storage_bucket: document.storage_bucket,
      storage_path: document.storage_path,
      mime_type: document.mime_type || null,
      original_file_name: document.original_file_name || text(document.storage_path).split('/').pop() || null,
    }));
}

function docKind(type: string) {
  return type === DT.foto ? 'foto' : type === DT.file ? 'file' : type === DT.ttdUser ? 'ttdUser' : 'nota';
}

async function notify(payload: any) {
  try {
    const base = Deno.env.get('SUPABASE_URL') || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!base || !service) return;
    const response = await fetch(`${base}/functions/v1/notification-dispatch-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${service}` },
      body: JSON.stringify({ function: 'dispatchSystemNotification', parameters: [payload] }),
    });
    if (!response.ok) console.error('notification dispatch failed', response.status, await response.text());
  } catch (error) {
    console.error('notification dispatch error', error);
  }
}

async function addTransaction(data: any, current: Caller) {
  const sppg = ['ADMIN', 'SUPER_ADMIN'].includes(current.role) ? text(data.sppg || current.sppg) : current.sppg;
  if (!sppg) throw new Error('SPPG wajib tersedia.');
  const yayasan = await resolveYayasan(sppg, data.yayasan, current);
  if (!yayasan) throw new Error(`Yayasan untuk SPPG ${sppg} belum terdaftar di database.`);
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
  if (!(Number(data.nominal) > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
  data.jenisKategori = validateTransactionCategory(data.kategori, data.jenisKategori);
  const method = normalizeStatus(data.metodeTransaksi);
  const paidDirectly = method === 'SUDAH_DIBAYAR';
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const core: any = {
    ID: id,
    'Kode Pemasukan': `TRX - ${crypto.randomUUID().slice(0, 8)}`,
    Tanggal: normalizeDate(data.tanggal),
    Kategori: text(data.kategori),
    'Jenis Kategori': text(data.jenisKategori),
    SPPG: sppg,
    YAYASAN: yayasan,
    Nominal: Number(data.nominal),
    Catatan: text(data.catatan),
    Timestamp: createdAt,
    User: current.email,
    'Nama Item/ Bahan Baku': text(data.namaItem || data.item),
    'Metode Transaksi': method,
    'APPROVED BY': paidDirectly ? current.email : '',
    'WAKTU APPROVE': paidDirectly ? createdAt : '',
    Catatan_1: '',
    'Catatan Approval': paidDirectly ? 'Pembayaran langsung telah dilengkapi saat transaksi dibuat.' : '',
    Deskripsi: '',
  };
  Object.assign(core, await resolveSupplier(data, sppg, yayasan, core.Kategori, core['Jenis Kategori']));
  const documents = inputDocs(data, id);
  const missing = missingCreateDocs(documents, method);
  if (missing.length) throw new Error(`Upload wajib belum lengkap atau gagal: ${missing.join(', ')}.`);
  const uploaded = [...documents.values()]
    .filter((document) => ownedUpload(current, docKind(document.document_type), document.storage_path))
    .map((document) => ({ bucket: document.storage_bucket, path: document.storage_path }));
  let transactionCreated = false;
  try {
    const result = await sb.rpc('create_transaction_with_documents_atomic', {
      p_transaction: core,
      p_documents: docPayload(documents),
      p_uploaded_by: current.email,
    });
    if (result.error) throw result.error;
    transactionCreated = true;
    if (paidDirectly) {
      const proofDocument = documents.get(DT.foto) || documents.get(DT.file);
      if (!proofDocument || !validPath(proofDocument.storage_path)) {
        throw new Error('Bukti transaksi wajib tersedia untuk pembayaran langsung.');
      }
      const proofInsert = await sb.from(T.P).insert({
        transaksi_id: id,
        payment_sequence: 1,
        nominal: Number(data.nominal),
        storage_bucket: proofDocument.storage_bucket,
        storage_path: proofDocument.storage_path,
        mime_type: inferMime(proofDocument.storage_path, proofDocument.mime_type),
        original_file_name: proofDocument.original_file_name || text(proofDocument.storage_path).split('/').pop(),
        submitted_by: current.email,
        submitted_at: createdAt,
        status: 'TERVERIFIKASI',
        verified_by: current.email,
        verified_at: createdAt,
        verification_notes: 'Bukti transaksi digunakan otomatis sebagai bukti pelunasan pembayaran langsung.',
      });
      if (proofInsert.error) throw proofInsert.error;
    }
    const normalized = (await docsFor([id])).get(id) || documents;
    await audit(id, 'ADD', current, {
      sppg, yayasan, method, paidDirectly,
      supplierId: core['SUPPLIER ID'], supplierName: core['NAMA SUPPLIER'],
      documentWrite: 'normalized-atomic',
    });
    await notify({
      mode: 'pair',
      sppg,
      yayasan,
      title: 'Transaksi baru',
      body: `Transaksi ${id} sebesar Rp ${Number(data.nominal).toLocaleString('id-ID')} telah dibuat.`,
      url: '/?page=transaksi',
    });
    return {
      success: true,
      message: paidDirectly
        ? 'Transaksi sudah dibayar dan bukti pelunasan otomatis terverifikasi.'
        : 'Transaksi berhasil ditambahkan.',
      id,
      data: mapTransaction(result.data, normalized),
    };
  } catch (error) {
    if (transactionCreated) {
      const rollback = await sb.from(T.X).delete().eq('ID', id);
      if (rollback.error) console.error('rollback add transaction failed', rollback.error);
    }
    await removeFiles(uploaded).catch((cleanupError) => console.error('cleanup add orphan', cleanupError));
    throw error;
  }
}

async function userTransactionEditEnabled() {
  const q = await sb.from('APP_SETTINGS').select('VALUE').eq('KEY', 'ALLOW_USER_EDIT_TRANSACTION').maybeSingle();
  if (q.error) throw q.error;
  return !q.data || String(q.data.VALUE || '').toLowerCase() === 'true';
}

async function editTransaction(id: string, fields: any, current: Caller) {
  const old = await getTransaction(current, id);
  if (current.role === 'USER' && !(await userTransactionEditEnabled())) {
    throw new Error('Edit transaksi untuk USER sedang dinonaktifkan oleh ADMIN.');
  }
  const existing = (await docsFor([id])).get(id) || new Map<string, Doc>();
  const fieldMap: Record<string, string> = {
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
  const documentMap: Record<string, [string, string, string]> = {
    'Upload Foto': [DT.foto, B.foto, 'foto'],
    'Upload File': [DT.file, B.file, 'file'],
    'Nota Pembelian': [DT.nota, B.nota, 'nota'],
    'TTD User': [DT.ttdUser, B.ttdUser, 'ttdUser'],
  };
  const patch: any = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (fieldMap[key]) patch[fieldMap[key]] = fieldMap[key] === 'Tanggal' ? normalizeDate(value) : value;
  }
  const sppg = text(patch.SPPG ?? old.SPPG);
  const requestedYayasan = Object.prototype.hasOwnProperty.call(patch, 'YAYASAN')
    ? patch.YAYASAN
    : (sameText(sppg, old.SPPG) ? old.YAYASAN : '');
  const yayasan = await resolveYayasan(sppg, requestedYayasan, current);
  if (!yayasan) throw new Error(`Yayasan untuk SPPG ${sppg} belum terdaftar di database.`);
  if (['ADMIN', 'SUPER_ADMIN'].includes(current.role)) patch.YAYASAN = yayasan;
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) {
    delete patch.SPPG;
    delete patch.YAYASAN;
    delete patch['Metode Transaksi'];
  }
  const supplierInputKeys = [
    'Supplier ID', 'Nama Supplier', 'Nama Bank Supplier',
    'No Rekening Supplier', 'Atas Nama Rekening Supplier',
  ];
  const supplierChanged = supplierInputKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(fields || {}, key)
  );
  const targetCategory = text(patch.Kategori ?? old.Kategori);
  const targetType = validateTransactionCategory(targetCategory, patch['Jenis Kategori'] ?? old['Jenis Kategori']);
  patch['Jenis Kategori'] = targetType;
  if (supplierChanged || targetCategory.toUpperCase() !== text(old.Kategori).toUpperCase()) {
    Object.assign(patch, await resolveSupplier({
      supplierId: fields?.['Supplier ID'],
      supplierName: fields?.['Nama Supplier'],
      supplierBankName: fields?.['Nama Bank Supplier'],
      supplierAccountNumber: fields?.['No Rekening Supplier'],
      supplierAccountHolder: fields?.['Atas Nama Rekening Supplier'],
    }, sppg, yayasan, targetCategory, targetType));
  } else if (supplierRequiredFor(targetCategory, targetType) && !text(old['SUPPLIER ID'])) {
    throw new Error('Supplier wajib dipilih dari Data Supplier. Jika belum tersedia, buat data supplier baru terlebih dahulu.');
  } else if (!supplierRequiredFor(targetCategory, targetType)) {
    Object.assign(patch, await resolveSupplier({}, sppg, yayasan, targetCategory, targetType));
  }
  const proofState = await sb.from(T.P).select('nominal,status').eq('transaksi_id', id);
  if (proofState.error) throw proofState.error;
  let submitted = 0;
  let verified = 0;
  let pendingCount = 0;
  for (const proof of proofState.data || []) {
    const amount = Number(proof.nominal) || 0;
    const proofStatus = normalizeStatus(proof.status);
    if (proofStatus !== 'DITOLAK') submitted += amount;
    if (proofStatus === 'TERVERIFIKASI') verified += amount;
    if (proofStatus === 'MENUNGGU_VERIFIKASI') pendingCount++;
  }
  const targetNominal = Object.prototype.hasOwnProperty.call(patch, 'Nominal') ? Number(patch.Nominal) : Number(old.Nominal);
  if (!(targetNominal > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
  if (targetNominal < submitted) throw new Error('Nominal transaksi tidak boleh lebih kecil dari pembayaran yang sudah diajukan.');
  if ((proofState.data || []).length) {
    if (verified >= targetNominal) patch['Metode Transaksi'] = 'SUDAH_DIBAYAR';
    else if (submitted >= targetNominal && pendingCount > 0) patch['Metode Transaksi'] = 'MENUNGGU_VERIFIKASI';
    else patch['Metode Transaksi'] = 'BELUM_LUNAS';
  }
  const next = new Map(existing);
  const fresh: { bucket: string; path: unknown }[] = [];
  const obsolete: { bucket: string; path: unknown }[] = [];
  for (const [field, [type, bucket, kind]] of Object.entries(documentMap)) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, field)) continue;
    const path = text(fields[field]);
    const previous = next.get(type);
    if (previous && previous.storage_path !== path) obsolete.push({ bucket: previous.storage_bucket, path: previous.storage_path });
    if (validPath(path)) {
      next.set(type, { transaksi_id: id, document_type: type, storage_bucket: bucket, storage_path: path });
      if (ownedUpload(current, kind, path)) fresh.push({ bucket, path });
    } else {
      next.delete(type);
    }
  }
  const missing = missingDocs(next);
  if (missing.length) throw new Error(`Upload wajib belum lengkap atau gagal: ${missing.join(', ')}.`);
  try {
    const result = await sb.rpc('update_transaction_with_documents_atomic', {
      p_transaksi_id: id,
      p_patch: patch,
      p_documents: docPayload(next),
      p_uploaded_by: current.email,
    });
    if (result.error) throw result.error;
    await removeFiles(obsolete).catch((cleanupError) => console.error('cleanup replaced files', cleanupError));
    await audit(id, 'EDIT', current, { fields: Object.keys(patch), documentWrite: 'normalized-atomic' });
    const normalized = (await docsFor([id])).get(id) || next;
    return { success: true, message: 'Transaksi berhasil diubah.', data: mapTransaction(result.data, normalized) };
  } catch (error) {
    await removeFiles(fresh).catch((cleanupError) => console.error('cleanup edit orphan', cleanupError));
    throw error;
  }
}

async function saveApprovalNote(parameters: any[], current: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) throw new Error('Akses ditolak.');
  const first = parameters[0];
  const id = typeof first === 'object' ? text(first.txId || first.id) : text(first);
  const note = typeof first === 'object' ? text(first.note || first.catatanApproval || first.catatan) : text(parameters[1]);
  await getTransaction(current, id);
  const query = await sb.from(T.X).update({ 'Catatan Approval': note, Catatan_1: note }).eq('ID', id);
  if (query.error) throw query.error;
  return { success: true, message: 'Catatan berhasil disimpan.' };
}

async function uploadTransactionFile(parameters: any[], current: Caller) {
  const kind = text(parameters[3]) as keyof typeof B;
  if (!['foto', 'file', 'ttdUser', 'nota'].includes(kind)) throw new Error('Tipe file transaksi tidak diizinkan.');
  const path = await upload(kind, parameters[0], parameters[1], parameters[2], `${kind}_${current.id}`);
  return { success: true, fileName: path, bucket: B[kind], viewUrl: (await sign(kind, path, parameters[1]))?.signedUrl || '' };
}

async function removeFiles(items: { bucket: string; path: unknown }[]) {
  const grouped = new Map<string, string[]>();
  for (const item of items) {
    if (!validPath(item.path) || !item.bucket) continue;
    const paths = grouped.get(item.bucket) || [];
    if (!paths.includes(text(item.path))) paths.push(text(item.path));
    grouped.set(item.bucket, paths);
  }
  for (const [bucket, paths] of grouped) {
    if (!paths.length) continue;
    const result = await sb.storage.from(bucket).remove(paths);
    if (result.error) throw new Error(`Gagal membersihkan Storage ${bucket}: ${result.error.message}`);
  }
}

async function deleteTransaction(id: string, current: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) throw new Error('Hanya ADMIN yang dapat menghapus transaksi.');
  await getTransaction(current, id);
  const documentQuery = await sb.from(T.D).select('storage_bucket,storage_path').eq('transaksi_id', id);
  if (documentQuery.error) throw documentQuery.error;
  const proofQuery = await sb.from(T.P).select('storage_bucket,storage_path,verifier_signature_path').eq('transaksi_id', id);
  if (proofQuery.error) throw proofQuery.error;
  const files: { bucket: string; path: unknown }[] = (documentQuery.data || []).map((row: any) => ({ bucket: text(row.storage_bucket), path: row.storage_path }));
  for (const proof of proofQuery.data || []) {
    files.push(
      { bucket: text(proof.storage_bucket) || B.payment, path: proof.storage_path },
      { bucket: B.ttdVerif, path: proof.verifier_signature_path },
    );
  }
  await removeFiles(files);
  const query = await sb.from(T.X).delete().eq('ID', id);
  if (query.error) throw query.error;
  await audit(id, 'DELETE', current, { storageFilesDeleted: files.filter((item) => validPath(item.path)).length, documentSource: T.D });
  return { success: true, message: 'Transaksi dan file Storage terkait berhasil dihapus.' };
}

const HANDLERS: Record<string, (parameters: any[], current: Caller) => Promise<any>> = {
  getTransactions: (parameters, current) => listTransactions(parameters[0] || {}, current),
  getTransactionSummary: (parameters, current) => getTransactionSummary(parameters[0] || {}, current),
  getTransactionSuggestions: (_parameters, current) => getTransactionSuggestions(current),
  getTransactionDetail: (parameters, current) => transactionDetail(text(parameters[0]), current),
  addTransaction: (parameters, current) => addTransaction(parameters[0] || {}, current),
  editTransaction: (parameters, current) => editTransaction(text(parameters[0]), parameters[1] || {}, current),
  sendCatatanApproval: saveApprovalNote,
  uploadTxFile: uploadTransactionFile,
  deleteTransaction: (parameters, current) => deleteTransaction(text(parameters[0]), current),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({
    status: 'ok',
    service: 'transaction-action',
    version: 12,
    documentReadSource: T.DA,
    yayasanResolutionSource: T.S,
    writeMode: 'normalized-atomic',
    suggestionMode: 'authenticated-role-scoped',
    summaryMode: 'authenticated-role-scoped-filtered',
  });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const current = await caller(req);
    const body = await req.json();
    const handler = HANDLERS[body?.function];
    if (!handler) return json({ error: `Fungsi tidak diizinkan: ${body?.function || ''}` }, 404);
    const result = await handler(Array.isArray(body.parameters) ? body.parameters : [], current);
    return json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const denied = /akses|token|hanya admin|di-assign/i.test(message);
    console.error(message);
    return json({ error: message, result: { success: false, message } }, denied ? 403 : 400);
  }
});
