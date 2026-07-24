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
    .select('*')
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

async function canAccess(current: Caller, row: any) {
  if (current.role === 'SUPER_ADMIN') return true;
  if (current.role === 'ADMIN') return pairAllowed(current, row.SPPG, row.YAYASAN);
  return lower(row.User) === current.email;
}

async function getTransaction(current: Caller, id: string) {
  const query = await sb.from(T.X).select('*').eq('ID', id).maybeSingle();
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
  const query = await sb.storage.from(B[kind]).upload(path, decodeBase64(base64), { contentType: mime, upsert: false });
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
  let query = sb.from(T.X).select('*').order('Tanggal', { ascending: false });
  if (filters?.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters?.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (filters?.kategori && filters.kategori !== 'ALL') query = query.eq('Kategori', filters.kategori);
  if (filters?.dateStart) query = query.gte('Tanggal', normalizeDate(filters.dateStart));
  if (filters?.dateEnd) query = query.lte('Tanggal', normalizeDate(filters.dateEnd));
  const result = await query;
  if (result.error) throw result.error;
  const rows = [];
  for (const row of result.data || []) if (await canAccess(current, row)) rows.push(row);
  const documents = await docsFor(rows.map((row: any) => text(row.ID)));
  const data = rows.map((row: any) => mapTransaction(row, documents.get(text(row.ID)) || new Map()));
  const page = pageSpec(filters);
  if (!page) return data;
  return {
    data: data.slice(page.from, page.to + 1),
    page: page.page,
    pageSize: page.pageSize,
    total: data.length,
    hasMore: page.to + 1 < data.length,
  };
}

async function transactionDetail(id: string, current: Caller) {
  const row = await getTransaction(current, id);
  const documents = (await docsFor([id])).get(id) || new Map<string, Doc>();
  const proofQuery = await sb.from(T.P).select('*').eq('transaksi_id', id).order('payment_sequence', { ascending: true });
  if (proofQuery.error) throw proofQuery.error;
  const paymentProofs: any[] = [];
  for (const proof of proofQuery.data || []) {
    paymentProofs.push({
      ...proof,
      nominal: Number(proof.nominal) || 0,
      file: await sign('payment', proof.storage_path, proof.mime_type),
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
  const yayasan = ['ADMIN', 'SUPER_ADMIN'].includes(current.role) ? text(data.yayasan || current.yayasan) : current.yayasan;
  if (!sppg || !yayasan) throw new Error('SPPG dan YAYASAN wajib tersedia.');
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
  if (!(Number(data.nominal) > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
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
    Timestamp: new Date().toISOString(),
    User: current.email,
    'Nama Item/ Bahan Baku': text(data.namaItem || data.item),
    'Metode Transaksi': normalizeStatus(data.metodeTransaksi),
    'APPROVED BY': '',
    'WAKTU APPROVE': '',
    Catatan_1: '',
    'Catatan Approval': '',
    Deskripsi: '',
  };
  const documents = inputDocs(data, id);
  const missing = missingDocs(documents);
  if (missing.length) throw new Error(`Upload wajib belum lengkap atau gagal: ${missing.join(', ')}.`);
  const uploaded = [...documents.values()]
    .filter((document) => ownedUpload(current, docKind(document.document_type), document.storage_path))
    .map((document) => ({ bucket: document.storage_bucket, path: document.storage_path }));
  try {
    const result = await sb.rpc('create_transaction_with_documents_atomic', {
      p_transaction: core,
      p_documents: docPayload(documents),
      p_uploaded_by: current.email,
    });
    if (result.error) throw result.error;
    const normalized = (await docsFor([id])).get(id) || documents;
    await audit(id, 'ADD', current, { sppg, yayasan, documentWrite: 'normalized-atomic' });
    await notify({
      mode: 'pair',
      sppg,
      yayasan,
      title: 'Transaksi baru',
      body: `Transaksi ${id} sebesar Rp ${Number(data.nominal).toLocaleString('id-ID')} telah dibuat.`,
      url: '/?page=transaksi',
    });
    return { success: true, message: 'Transaksi berhasil ditambahkan.', id, data: mapTransaction(result.data, normalized) };
  } catch (error) {
    await removeFiles(uploaded).catch((cleanupError) => console.error('cleanup add orphan', cleanupError));
    throw error;
  }
}

async function editTransaction(id: string, fields: any, current: Caller) {
  const old = await getTransaction(current, id);
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
  const yayasan = text(patch.YAYASAN ?? old.YAYASAN);
  if (current.role === 'ADMIN' && !(await pairAllowed(current, sppg, yayasan))) throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(current.role)) {
    delete patch.SPPG;
    delete patch.YAYASAN;
    delete patch['Metode Transaksi'];
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
    version: 6,
    documentReadSource: T.DA,
    writeMode: 'normalized-atomic',
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
