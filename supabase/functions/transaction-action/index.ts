import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const T = {
  users: 'USERS',
  transactions: 'TRANSAKSI',
  assignments: 'ADMIN_ASSIGNMENT',
  documents: 'TRANSAKSI_DOCUMENTS',
  payments: 'TRANSAKSI_PAYMENT_PROOFS',
  audit: 'AUDIT LOG',
};

const B = {
  foto: 'transaksi-images',
  file: 'transaksi-files',
  ttdUser: 'paraf-user',
  nota: 'nota-pembelian',
  ttdVerif: 'paraf-verifikator',
  payment: 'bukti-payment',
};

const DOC = {
  foto: 'FOTO_TRANSAKSI',
  file: 'FILE_TRANSAKSI',
  ttdUser: 'TTD_USER',
  nota: 'NOTA_PEMBELIAN',
  ttdVerif: 'TTD_VERIFIKATOR_LEGACY',
  approval: 'BUKTI_APPROVAL_LEGACY',
} as const;

type Caller = { id: string; email: string; role: string; sppg: string; yayasan: string; nama: string };
type DocKind = 'foto' | 'file' | 'ttdUser' | 'nota';
type TxDocument = {
  id?: string;
  transaksi_id: string;
  document_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type?: string | null;
  original_file_name?: string | null;
  uploaded_by?: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();
const validPath = (value: unknown) => {
  const valueText = text(value);
  return Boolean(valueText && valueText !== '-' && !/^(FOTO|FILE)$/i.test(valueText));
};
const paymentStatus = (value: unknown) => {
  const normalized = text(value).toUpperCase().replace(/\s+/g, '_');
  return normalized === 'LUNAS' ? 'SUDAH_DIBAYAR' : normalized || 'BELUM_BAYAR';
};
const isoDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
};
const bytes = (value: string) => {
  const raw = value.includes(',') ? value.split(',').pop()! : value;
  const binary = atob(raw);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
  return result;
};

function indexDocuments(rows: TxDocument[]) {
  const indexed: Record<string, TxDocument> = {};
  for (const row of rows) indexed[row.document_type] = row;
  return indexed;
}

function documentState(documents: Record<string, TxDocument>) {
  const missing: string[] = [];
  if (!documents[DOC.foto] && !documents[DOC.file]) missing.push('Bukti Transaksi');
  if (!documents[DOC.ttdUser]) missing.push('TTD User');
  if (!documents[DOC.nota]) missing.push('Nota Pembelian');
  return {
    missing,
    label: missing.length ? `Dokumen Tidak Lengkap: ${missing.join(', ')}` : 'Dokumen Lengkap',
  };
}

function mapTransaction(row: any, documents: Record<string, TxDocument> = {}) {
  const state = documentState(documents);
  return {
    id: row.ID || '',
    kode: row['Kode Pemasukan'] || '',
    tanggal: row.Tanggal || '',
    kategori: row.Kategori || '',
    jenisKategori: row['Jenis Kategori'] || '',
    sppg: row.SPPG || '',
    yayasan: row.YAYASAN || '',
    nominal: Number(row.Nominal) || 0,
    uploadFoto: documents[DOC.foto]?.storage_path || '',
    uploadFile: documents[DOC.file]?.storage_path || '',
    catatan: row.Catatan || '',
    user: row.User || '',
    item: row['Nama Item/ Bahan Baku'] || '',
    namaItem: row['Nama Item/ Bahan Baku'] || '',
    metodeTransaksi: paymentStatus(row['Metode Transaksi']),
    ttdVerifikator: documents[DOC.ttdVerif]?.storage_path || '',
    ttdUser: documents[DOC.ttdUser]?.storage_path || '',
    notaPembelian: documents[DOC.nota]?.storage_path || '',
    approvedBy: row['APPROVED BY'] || '',
    waktuApprove: row['WAKTU APPROVE'] || '',
    statusDokumen: state.label,
    catatanApproval: row['Catatan Approval'] || '',
  };
}

async function getCaller(req: Request): Promise<Caller> {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const profile = await sb
    .from(T.users)
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

async function assignedPairs(caller: Caller) {
  if (caller.role !== 'ADMIN') return [] as [string, string][];
  const query = await sb.from(T.assignments).select('sppg,yayasan').eq('admin_email', caller.email);
  if (query.error) throw query.error;
  return (query.data || []).map((row: any) => [text(row.sppg), text(row.yayasan)] as [string, string]);
}

async function pairAllowed(caller: Caller, sppg: unknown, yayasan: unknown) {
  if (caller.role === 'SUPER_ADMIN') return true;
  if (caller.role !== 'ADMIN') return false;
  const targetSppg = text(sppg);
  const targetYayasan = text(yayasan);
  return (await assignedPairs(caller)).some(([assignedSppg, assignedYayasan]) =>
    assignedSppg === targetSppg && assignedYayasan === targetYayasan
  );
}

async function canAccess(caller: Caller, transaction: any) {
  if (caller.role === 'SUPER_ADMIN') return true;
  if (caller.role === 'ADMIN') return pairAllowed(caller, transaction.SPPG, transaction.YAYASAN);
  return lower(transaction.User) === caller.email;
}

async function getTransaction(caller: Caller, id: string) {
  const query = await sb.from(T.transactions).select('*').eq('ID', id).maybeSingle();
  if (query.error) throw query.error;
  if (!query.data) throw new Error('Transaksi tidak ditemukan.');
  if (!(await canAccess(caller, query.data))) throw new Error('Akses transaksi ditolak.');
  return query.data;
}

async function getDocuments(transactionIds: string[]) {
  if (!transactionIds.length) return new Map<string, Record<string, TxDocument>>();
  const query = await sb.from(T.documents).select('*').in('transaksi_id', transactionIds);
  if (query.error) throw query.error;
  const result = new Map<string, Record<string, TxDocument>>();
  for (const row of query.data || []) {
    const transactionId = text(row.transaksi_id);
    if (!result.has(transactionId)) result.set(transactionId, {});
    result.get(transactionId)![row.document_type] = row as TxDocument;
  }
  return result;
}

async function signedDocument(document?: TxDocument | null) {
  if (!document || !validPath(document.storage_path)) return null;
  const signed = await sb.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 3600);
  if (signed.error || !signed.data?.signedUrl) return null;
  return {
    path: document.storage_path,
    bucket: document.storage_bucket,
    name: document.original_file_name || document.storage_path.split('/').pop(),
    signedUrl: signed.data.signedUrl,
    signedThumbnailUrl: signed.data.signedUrl,
    mimeType: document.mime_type || null,
  };
}

async function upload(kind: DocKind, base64: string, mimeType: string, fileName: string, prefix: string) {
  const rules: Record<DocKind, RegExp> = {
    foto: /^image\/(jpeg|jpg|png|webp|heic|heif)$/i,
    file: /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,
    ttdUser: /^image\/(png|jpeg|jpg|webp)$/i,
    nota: /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i,
  };
  if (!rules[kind].test(text(mimeType))) throw new Error('Tipe MIME file tidak diizinkan.');
  if (!base64 || !fileName) throw new Error('Data file tidak lengkap.');
  const safeName = text(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${prefix}_${Date.now()}_${crypto.randomUUID()}_${safeName}`;
  const uploaded = await sb.storage.from(B[kind]).upload(path, bytes(base64), {
    contentType: mimeType,
    upsert: false,
  });
  if (uploaded.error) throw new Error(`Upload gagal: ${uploaded.error.message}`);
  return path;
}

function requestedDocuments(data: any, transactionId: string, caller: Caller): TxDocument[] {
  const specifications = [
    { type: DOC.foto, bucket: B.foto, path: data.uploadFoto },
    { type: DOC.file, bucket: B.file, path: data.uploadFile },
    { type: DOC.ttdUser, bucket: B.ttdUser, path: data.ttdUser },
    { type: DOC.nota, bucket: B.nota, path: data.notaPembelian },
  ];
  return specifications.filter((item) => validPath(item.path)).map((item) => ({
    transaksi_id: transactionId,
    document_type: item.type,
    storage_bucket: item.bucket,
    storage_path: text(item.path),
    original_file_name: text(item.path).split('/').pop() || text(item.path),
    uploaded_by: caller.email,
  }));
}

async function replaceDocument(transactionId: string, documentType: string, bucket: string, path: unknown, caller: Caller) {
  const existing = await sb
    .from(T.documents)
    .select('*')
    .eq('transaksi_id', transactionId)
    .eq('document_type', documentType)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const newPath = text(path);
  if (!validPath(newPath)) {
    if (existing.data) {
      const removed = await sb.from(T.documents).delete().eq('id', existing.data.id);
      if (removed.error) throw removed.error;
    }
    return existing.data ? [{ bucket: existing.data.storage_bucket, path: existing.data.storage_path }] : [];
  }
  if (existing.data?.storage_path === newPath && existing.data?.storage_bucket === bucket) return [];
  const saved = await sb.from(T.documents).upsert({
    transaksi_id: transactionId,
    document_type: documentType,
    storage_bucket: bucket,
    storage_path: newPath,
    original_file_name: newPath.split('/').pop() || newPath,
    uploaded_by: caller.email,
    source: 'APPLICATION',
    legacy_source_column: null,
  }, { onConflict: 'transaksi_id,document_type' });
  if (saved.error) throw saved.error;
  return existing.data ? [{ bucket: existing.data.storage_bucket, path: existing.data.storage_path }] : [];
}

async function removeStorageFiles(files: { bucket: string; path: string }[]) {
  const grouped = new Map<string, string[]>();
  for (const file of files) {
    if (!file.bucket || !validPath(file.path)) continue;
    const paths = grouped.get(file.bucket) || [];
    if (!paths.includes(file.path)) paths.push(file.path);
    grouped.set(file.bucket, paths);
  }
  for (const [bucket, paths] of grouped) {
    const removed = await sb.storage.from(bucket).remove(paths);
    if (removed.error) throw new Error(`Gagal membersihkan Storage ${bucket}: ${removed.error.message}`);
  }
}

async function audit(id: string, action: string, caller: Caller, detail: unknown) {
  try {
    await sb.from(T.audit).insert({
      TIMESTAMP: new Date().toISOString(),
      USER_EMAIL: caller.email,
      USER_NAME: caller.nama,
      ROLE: caller.role,
      SPPG: caller.sppg,
      ACTION_TYPE: action,
      TABLE_NAME: T.transactions,
      RECORD_ID: id,
      FIELD_CHANGED: 'TRANSACTION_DOCUMENTS',
      OLD_VALUE: '',
      NEW_VALUE: JSON.stringify(detail).slice(0, 500),
      DESCRIPTION: `${action} ${T.transactions}`,
      IP_USER: '',
      STATUS: 'SUCCESS',
    });
  } catch (error) {
    console.error('audit', error);
  }
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

async function listTransactions(filters: any, caller: Caller) {
  let query = sb.from(T.transactions).select('*').order('Tanggal', { ascending: false });
  if (filters?.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters?.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (filters?.kategori && filters.kategori !== 'ALL') query = query.eq('Kategori', filters.kategori);
  if (filters?.dateStart) query = query.gte('Tanggal', isoDate(filters.dateStart));
  if (filters?.dateEnd) query = query.lte('Tanggal', isoDate(filters.dateEnd));
  const transactions = await query;
  if (transactions.error) throw transactions.error;
  const accessible = [];
  for (const row of transactions.data || []) if (await canAccess(caller, row)) accessible.push(row);
  const documents = await getDocuments(accessible.map((row: any) => text(row.ID)));
  const mapped = accessible.map((row: any) => mapTransaction(row, documents.get(text(row.ID)) || {}));
  const requestedPaging = Number(filters?.page) > 0 || Number(filters?.pageSize) > 0;
  if (!requestedPaging) return mapped;
  const page = Math.max(1, Math.floor(Number(filters?.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(filters?.pageSize) || 25)));
  const from = (page - 1) * pageSize;
  return {
    data: mapped.slice(from, from + pageSize),
    page,
    pageSize,
    total: mapped.length,
    hasMore: from + pageSize < mapped.length,
  };
}

async function transactionDetail(id: string, caller: Caller) {
  const transaction = await getTransaction(caller, id);
  const documentRows = await sb.from(T.documents).select('*').eq('transaksi_id', id);
  if (documentRows.error) throw documentRows.error;
  const documents = indexDocuments((documentRows.data || []) as TxDocument[]);
  const payments = await sb.from(T.payments).select('*').eq('transaksi_id', id).order('payment_sequence');
  if (payments.error) throw payments.error;
  const paymentProofs = [];
  for (const proof of payments.data || []) {
    const paymentDocument: TxDocument = {
      transaksi_id: id,
      document_type: 'PAYMENT',
      storage_bucket: text(proof.storage_bucket) || B.payment,
      storage_path: text(proof.storage_path),
      mime_type: proof.mime_type,
      original_file_name: proof.original_file_name,
    };
    const signatureDocument: TxDocument = {
      transaksi_id: id,
      document_type: 'VERIFIER_SIGNATURE',
      storage_bucket: B.ttdVerif,
      storage_path: text(proof.verifier_signature_path),
      mime_type: 'image/png',
    };
    paymentProofs.push({
      ...proof,
      nominal: Number(proof.nominal) || 0,
      file: await signedDocument(paymentDocument),
      verifierSignature: await signedDocument(signatureDocument),
    });
  }
  return {
    ...mapTransaction(transaction, documents),
    fileBuktiFoto: await signedDocument(documents[DOC.foto]),
    fileBuktiFile: await signedDocument(documents[DOC.file]),
    fileBuktiApproval: await signedDocument(documents[DOC.approval]),
    fileNota: await signedDocument(documents[DOC.nota]),
    fileTtdUser: await signedDocument(documents[DOC.ttdUser]),
    fileTtdVerif: await signedDocument(documents[DOC.ttdVerif]),
    paymentProofs,
  };
}

async function addTransaction(data: any, caller: Caller) {
  const sppg = ['ADMIN', 'SUPER_ADMIN'].includes(caller.role) ? text(data.sppg || caller.sppg) : caller.sppg;
  const yayasan = ['ADMIN', 'SUPER_ADMIN'].includes(caller.role) ? text(data.yayasan || caller.yayasan) : caller.yayasan;
  if (!sppg || !yayasan) throw new Error('SPPG dan YAYASAN wajib tersedia.');
  if (caller.role === 'ADMIN' && !(await pairAllowed(caller, sppg, yayasan)))
    throw new Error('Pasangan SPPG + YAYASAN tidak di-assign.');
  if (!(Number(data.nominal) > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const documents = requestedDocuments(data, id, caller);
  const state = documentState(indexDocuments(documents));
  if (state.missing.length) throw new Error(`Upload wajib belum lengkap atau gagal: ${state.missing.join(', ')}.`);
  const row = {
    ID: id,
    'Kode Pemasukan': `TRX - ${crypto.randomUUID().slice(0, 8)}`,
    Tanggal: isoDate(data.tanggal),
    Kategori: text(data.kategori),
    'Jenis Kategori': text(data.jenisKategori),
    SPPG: sppg,
    YAYASAN: yayasan,
    Nominal: Number(data.nominal),
    Catatan: text(data.catatan),
    Timestamp: new Date().toISOString(),
    User: caller.email,
    'Nama Item/ Bahan Baku': text(data.namaItem || data.item),
    'Metode Transaksi': paymentStatus(data.metodeTransaksi),
    'APPROVED BY': '',
    'WAKTU APPROVE': null,
    'Catatan Approval': '',
    Deskripsi: '',
  };
  const inserted = await sb.from(T.transactions).insert(row).select().single();
  if (inserted.error) throw inserted.error;
  try {
    const saved = await sb.from(T.documents).insert(documents.map((document) => ({
      ...document,
      source: 'APPLICATION',
      legacy_source_column: null,
    })));
    if (saved.error) throw saved.error;
  } catch (error) {
    await sb.from(T.transactions).delete().eq('ID', id);
    throw error;
  }
  await audit(id, 'ADD', caller, { sppg, yayasan, documents: documents.length });
  await notify({
    mode: 'pair', sppg, yayasan, title: 'Transaksi baru',
    body: `Transaksi ${id} sebesar Rp ${Number(data.nominal).toLocaleString('id-ID')} telah dibuat.`,
    url: '/?page=transaksi',
  });
  return { success: true, message: 'Transaksi berhasil ditambahkan.', id, data: mapTransaction(inserted.data, indexDocuments(documents)) };
}

async function editTransaction(id: string, fields: any, caller: Caller) {
  const old = await getTransaction(caller, id);
  const scalarMap: Record<string, string> = {
    Tanggal: 'Tanggal', Kategori: 'Kategori', 'Jenis Kategori': 'Jenis Kategori',
    SPPG: 'SPPG', YAYASAN: 'YAYASAN', 'Nama Item/Bahan Baku': 'Nama Item/ Bahan Baku',
    Nominal: 'Nominal', Catatan: 'Catatan', 'Metode Transaksi': 'Metode Transaksi',
  };
  const patch: any = {};
  for (const [key, value] of Object.entries(fields || {})) {
    const target = scalarMap[key];
    if (target) patch[target] = target === 'Tanggal' ? isoDate(value) : value;
  }
  const sppg = text(patch.SPPG ?? old.SPPG);
  const yayasan = text(patch.YAYASAN ?? old.YAYASAN);
  if (caller.role === 'ADMIN' && !(await pairAllowed(caller, sppg, yayasan)))
    throw new Error('Pasangan SPPG + YAYASAN tujuan tidak di-assign.');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
    delete patch.SPPG;
    delete patch.YAYASAN;
    delete patch['Metode Transaksi'];
  }
  const proofState = await sb.from(T.payments).select('nominal,status').eq('transaksi_id', id);
  if (proofState.error) throw proofState.error;
  let submitted = 0;
  let verified = 0;
  let pending = 0;
  for (const proof of proofState.data || []) {
    const amount = Number(proof.nominal) || 0;
    const status = paymentStatus(proof.status);
    if (status !== 'DITOLAK') submitted += amount;
    if (status === 'TERVERIFIKASI') verified += amount;
    if (status === 'MENUNGGU_VERIFIKASI') pending++;
  }
  const targetNominal = Object.prototype.hasOwnProperty.call(patch, 'Nominal') ? Number(patch.Nominal) : Number(old.Nominal);
  if (!(targetNominal > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
  if (targetNominal < submitted) throw new Error('Nominal transaksi tidak boleh lebih kecil dari pembayaran yang sudah diajukan.');
  if ((proofState.data || []).length) {
    if (verified >= targetNominal) patch['Metode Transaksi'] = 'SUDAH_DIBAYAR';
    else if (submitted >= targetNominal && pending > 0) patch['Metode Transaksi'] = 'MENUNGGU_VERIFIKASI';
    else patch['Metode Transaksi'] = 'BELUM_LUNAS';
  }
  const obsolete: { bucket: string; path: string }[] = [];
  const documentChanges = [
    ['Upload Foto', DOC.foto, B.foto],
    ['Upload File', DOC.file, B.file],
    ['TTD User', DOC.ttdUser, B.ttdUser],
    ['Nota Pembelian', DOC.nota, B.nota],
  ] as const;
  for (const [fieldName, documentType, bucket] of documentChanges) {
    if (Object.prototype.hasOwnProperty.call(fields || {}, fieldName))
      obsolete.push(...await replaceDocument(id, documentType, bucket, fields[fieldName], caller));
  }
  const currentDocumentsQuery = await sb.from(T.documents).select('*').eq('transaksi_id', id);
  if (currentDocumentsQuery.error) throw currentDocumentsQuery.error;
  const currentDocuments = indexDocuments((currentDocumentsQuery.data || []) as TxDocument[]);
  const state = documentState(currentDocuments);
  if (state.missing.length) throw new Error(`Upload wajib belum lengkap atau gagal: ${state.missing.join(', ')}.`);
  const updated = await sb.from(T.transactions).update(patch).eq('ID', id).select().single();
  if (updated.error) throw updated.error;
  await removeStorageFiles(obsolete).catch((error) => console.error('cleanup replaced files', error));
  await audit(id, 'EDIT', caller, { fields: Object.keys(patch), documentChanges: obsolete.length });
  return { success: true, message: 'Transaksi berhasil diubah.', data: mapTransaction(updated.data, currentDocuments) };
}

async function saveApprovalNote(parameters: any[], caller: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) throw new Error('Akses ditolak.');
  const first = parameters[0];
  const id = typeof first === 'object' ? text(first.txId || first.id) : text(first);
  const note = typeof first === 'object' ? text(first.note || first.catatanApproval || first.catatan) : text(parameters[1]);
  await getTransaction(caller, id);
  const updated = await sb.from(T.transactions).update({ 'Catatan Approval': note }).eq('ID', id);
  if (updated.error) throw updated.error;
  return { success: true, message: 'Catatan berhasil disimpan.' };
}

async function uploadTransactionFile(parameters: any[], caller: Caller) {
  const kind = text(parameters[3]) as DocKind;
  if (!['foto', 'file', 'ttdUser', 'nota'].includes(kind)) throw new Error('Tipe file transaksi tidak diizinkan.');
  const path = await upload(kind, parameters[0], parameters[1], parameters[2], `${kind}_${caller.id}`);
  const document: TxDocument = {
    transaksi_id: '', document_type: DOC[kind], storage_bucket: B[kind], storage_path: path,
    mime_type: parameters[1], original_file_name: parameters[2], uploaded_by: caller.email,
  };
  return { success: true, fileName: path, bucket: B[kind], viewUrl: (await signedDocument(document))?.signedUrl || '' };
}

async function deleteTransaction(id: string, caller: Caller) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) throw new Error('Hanya ADMIN yang dapat menghapus transaksi.');
  await getTransaction(caller, id);
  const documents = await sb.from(T.documents).select('storage_bucket,storage_path').eq('transaksi_id', id);
  if (documents.error) throw documents.error;
  const payments = await sb.from(T.payments).select('storage_bucket,storage_path,verifier_signature_path').eq('transaksi_id', id);
  if (payments.error) throw payments.error;
  const files: { bucket: string; path: string }[] = (documents.data || []).map((document: any) => ({
    bucket: text(document.storage_bucket), path: text(document.storage_path),
  }));
  for (const payment of payments.data || []) {
    files.push({ bucket: text(payment.storage_bucket) || B.payment, path: text(payment.storage_path) });
    files.push({ bucket: B.ttdVerif, path: text(payment.verifier_signature_path) });
  }
  await removeStorageFiles(files);
  const deleted = await sb.from(T.transactions).delete().eq('ID', id);
  if (deleted.error) throw deleted.error;
  await audit(id, 'DELETE', caller, { storageFilesDeleted: files.filter((file) => validPath(file.path)).length });
  return { success: true, message: 'Transaksi dan file Storage terkait berhasil dihapus.' };
}

const handlers: Record<string, (parameters: any[], caller: Caller) => Promise<unknown>> = {
  getTransactions: (parameters, caller) => listTransactions(parameters[0] || {}, caller),
  getTransactionDetail: (parameters, caller) => transactionDetail(text(parameters[0]), caller),
  addTransaction: (parameters, caller) => addTransaction(parameters[0] || {}, caller),
  editTransaction: (parameters, caller) => editTransaction(text(parameters[0]), parameters[1] || {}, caller),
  sendCatatanApproval: saveApprovalNote,
  uploadTxFile: uploadTransactionFile,
  deleteTransaction: (parameters, caller) => deleteTransaction(text(parameters[0]), caller),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status: 'ok', service: 'transaction-action', version: 4 });
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405);
  try {
    const caller = await getCaller(req);
    const body = await req.json();
    const handler = handlers[body?.function];
    if (!handler) return json({ error: `Fungsi tidak diizinkan: ${body?.function || ''}` }, 404);
    const result = await handler(Array.isArray(body.parameters) ? body.parameters : [], caller);
    return json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const denied = /akses|token|hanya admin|di-assign/i.test(message);
    console.error(message);
    return json({ error: message, result: { success: false, message } }, denied ? 403 : 400);
  }
});
