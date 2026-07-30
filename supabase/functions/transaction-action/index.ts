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
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const text = (v: unknown) => String(v ?? '').trim();
const lower = (v: unknown) => text(v).toLowerCase();
const normalizeDate = (v: unknown) => {
  const raw = text(v);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
};
const normalizeMethod = (v: unknown) => {
  const x = text(v).toUpperCase().replace(/\s+/g, '_');
  return x === 'LUNAS' ? 'SUDAH_DIBAYAR' : (x || 'BELUM_BAYAR');
};
const validPath = (v: unknown) => {
  const x = text(v);
  return !!x && x !== '-' && !/^https?:\/\//i.test(x);
};
const inferMime = (path: unknown) => {
  const x = text(path).toLowerCase().split('?')[0];
  if (x.endsWith('.pdf')) return 'application/pdf';
  if (x.endsWith('.png')) return 'image/png';
  if (x.endsWith('.webp')) return 'image/webp';
  if (x.endsWith('.jpg') || x.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
};

type Caller = { id: string; email: string; username: string; role: string; sppg: string; yayasan: string; nama: string };
type Doc = { transaksi_id: string; document_type: string; storage_bucket: string; storage_path: string; mime_type?: string | null; original_file_name?: string | null; updated_at?: string; created_at?: string };

const LIST_COLUMNS = 'ID,"Kode Pemasukan",Tanggal,Kategori,"Jenis Kategori",SPPG,YAYASAN,Nominal,Catatan,User,"Nama Item/ Bahan Baku","Metode Transaksi","SUPPLIER ID","NAMA SUPPLIER","NAMA BANK SUPPLIER","NO REKENING SUPPLIER","ATAS NAMA REKENING SUPPLIER","SUMBER SUPPLIER","APPROVED BY","WAKTU APPROVE",Catatan_1,"Catatan Approval"';
const DOC_COLUMNS = 'transaksi_id,document_type,storage_bucket,storage_path,mime_type,original_file_name,created_at,updated_at';
const BUCKETS: Record<string, string> = {
  FOTO_TRANSAKSI: 'transaksi-images',
  FILE_TRANSAKSI: 'transaksi-files',
  TTD_USER: 'paraf-user',
  NOTA_PEMBELIAN: 'nota-pembelian',
};

async function caller(req: Request): Promise<Caller> {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new Error('Token tidak ditemukan.');
  const auth = await sb.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('Token tidak valid atau kedaluwarsa.');
  const q = await sb.from('USERS').select('ID,EMAIL,USERNAME,ROLE,SPPG,"NAMA YAYASAN","NAMA LENGKAP"').eq('ID', auth.data.user.id).maybeSingle();
  if (q.error || !q.data) throw new Error('Profil user tidak ditemukan.');
  return {
    id: auth.data.user.id,
    email: lower(auth.data.user.email || q.data.EMAIL),
    username: lower(q.data.USERNAME),
    role: text(q.data.ROLE).toUpperCase(),
    sppg: text(q.data.SPPG),
    yayasan: text(q.data['NAMA YAYASAN']),
    nama: text(q.data['NAMA LENGKAP']),
  };
}

async function assignments(c: Caller) {
  if (c.role !== 'ADMIN') return [] as { sppg: string; yayasan: string }[];
  const q = await sb.from('ADMIN_ASSIGNMENT').select('sppg,yayasan').eq('admin_email', c.email);
  if (q.error) throw q.error;
  return (q.data || []).map((r: any) => ({ sppg: text(r.sppg), yayasan: text(r.yayasan) }));
}
async function canAccess(c: Caller, row: any) {
  if (c.role === 'SUPER_ADMIN') return true;
  if (c.role === 'USER') return [c.email, c.username].includes(lower(row.User));
  const pairs = await assignments(c);
  return pairs.some((p) => p.sppg === text(row.SPPG) && (!p.yayasan || p.yayasan === text(row.YAYASAN)));
}
async function resolveYayasan(c: Caller, sppg: string, requested: unknown) {
  const explicit = text(requested);
  if (explicit) return explicit;
  if (sppg === c.sppg && c.yayasan) return c.yayasan;
  if (c.role === 'ADMIN') {
    const matches = (await assignments(c)).filter((p) => p.sppg === sppg && p.yayasan);
    if (matches.length === 1) return matches[0].yayasan;
  }
  const q = await sb.from('SPPG_DIRECTORY').select('yayasan').eq('sppg', sppg.toUpperCase()).maybeSingle();
  if (q.error) throw q.error;
  return text(q.data?.yayasan);
}

function indexDocs(rows: Doc[]) {
  const result = new Map<string, Map<string, Doc>>();
  for (const row of rows || []) {
    if (!result.has(row.transaksi_id)) result.set(row.transaksi_id, new Map());
    const map = result.get(row.transaksi_id)!;
    const prev = map.get(row.document_type);
    if (!prev || text(row.updated_at || row.created_at) >= text(prev.updated_at || prev.created_at)) map.set(row.document_type, row);
  }
  return result;
}
async function docsFor(ids: string[]) {
  const unique = [...new Set(ids.map(text).filter(Boolean))];
  if (!unique.length) return new Map<string, Map<string, Doc>>();
  const q = await sb.from('TRANSAKSI_DOCUMENTS_AVAILABLE').select(DOC_COLUMNS).in('transaksi_id', unique);
  if (q.error) throw q.error;
  return indexDocs((q.data || []) as Doc[]);
}
const docPath = (docs: Map<string, Doc>, type: string) => text(docs.get(type)?.storage_path);
function mapTransaction(row: any, docs: Map<string, Doc>) {
  const uploadFoto = docPath(docs, 'FOTO_TRANSAKSI');
  const uploadFile = docPath(docs, 'FILE_TRANSAKSI');
  const ttdUser = docPath(docs, 'TTD_USER');
  const nota = docPath(docs, 'NOTA_PEMBELIAN');
  const missing: string[] = [];
  if (!validPath(uploadFoto) && !validPath(uploadFile)) missing.push('Bukti Transaksi');
  if (!validPath(ttdUser)) missing.push('TTD User');
  if (!validPath(nota)) missing.push('Nota Pembelian');
  return {
    id: row.ID || '', kode: row['Kode Pemasukan'] || '', tanggal: row.Tanggal || '', kategori: row.Kategori || '',
    jenisKategori: row['Jenis Kategori'] || '', sppg: row.SPPG || '', yayasan: row.YAYASAN || '', nominal: Number(row.Nominal) || 0,
    uploadFoto, uploadFile, catatan: row.Catatan || '', user: row.User || '', item: row['Nama Item/ Bahan Baku'] || '', namaItem: row['Nama Item/ Bahan Baku'] || '',
    supplierId: row['SUPPLIER ID'] || '', supplierName: row['NAMA SUPPLIER'] || '', supplierBankName: row['NAMA BANK SUPPLIER'] || '',
    supplierAccountNumber: row['NO REKENING SUPPLIER'] || '', supplierAccountHolder: row['ATAS NAMA REKENING SUPPLIER'] || '', supplierSource: row['SUMBER SUPPLIER'] || '',
    metodeTransaksi: normalizeMethod(row['Metode Transaksi']), ttdUser, notaPembelian: nota, approvedBy: row['APPROVED BY'] || '', waktuApprove: row['WAKTU APPROVE'] || '',
    statusDokumen: missing.length ? `Dokumen Tidak Lengkap: ${missing.join(', ')}` : 'Dokumen Lengkap', catatanApproval: row['Catatan Approval'] || row.Catatan_1 || '',
    hasBuktiTransaksi: validPath(uploadFoto) || validPath(uploadFile), hasNotaPembelian: validPath(nota), hasTtdUser: validPath(ttdUser),
  };
}

async function listTransactions(filters: any, c: Caller) {
  const page = Math.max(1, Number(filters?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters?.pageSize) || 25));
  let q: any = sb.from('TRANSAKSI').select(LIST_COLUMNS, { count: 'exact' });
  if (c.role === 'USER') q = q.ilike('User', c.email);
  if (filters?.sppg && filters.sppg !== 'ALL') q = q.eq('SPPG', filters.sppg);
  if (filters?.yayasan && filters.yayasan !== 'ALL') q = q.eq('YAYASAN', filters.yayasan);
  if (filters?.kategori && filters.kategori !== 'ALL') q = q.eq('Kategori', filters.kategori);
  if (filters?.dateStart) q = q.gte('Tanggal', normalizeDate(filters.dateStart));
  if (filters?.dateEnd) q = q.lte('Tanggal', normalizeDate(filters.dateEnd));
  q = q.order('Tanggal', { ascending: false }).order('ID', { ascending: false });
  if (c.role !== 'ADMIN') q = q.range((page - 1) * pageSize, page * pageSize - 1);
  const r = await q;
  if (r.error) throw r.error;
  let rows = r.data || [];
  let total = r.count ?? rows.length;
  if (c.role === 'ADMIN') {
    const pairs = await assignments(c);
    rows = rows.filter((x: any) => pairs.some((p) => p.sppg === text(x.SPPG) && (!p.yayasan || p.yayasan === text(x.YAYASAN))));
    total = rows.length;
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
  }
  const docs = await docsFor(rows.map((x: any) => text(x.ID)));
  const data = rows.map((x: any) => mapTransaction(x, docs.get(text(x.ID)) || new Map()));
  return { data, page, pageSize, total, hasMore: page * pageSize < total };
}

async function getTransactionRow(id: string, c: Caller) {
  const q = await sb.from('TRANSAKSI').select(LIST_COLUMNS).eq('ID', id).maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Transaksi tidak ditemukan.');
  if (!(await canAccess(c, q.data))) throw new Error('Akses transaksi ditolak.');
  return q.data;
}
function metadata(doc?: Doc) {
  if (!doc || !validPath(doc.storage_path)) return null;
  return { path: doc.storage_path, bucket: doc.storage_bucket, name: doc.original_file_name || doc.storage_path.split('/').pop(), mimeType: doc.mime_type || inferMime(doc.storage_path), accessMode: 'on-demand' };
}
async function detail(id: string, c: Caller) {
  const row = await getTransactionRow(id, c);
  const docs = (await docsFor([id])).get(id) || new Map<string, Doc>();
  const p = await sb.from('TRANSAKSI_PAYMENT_PROOFS').select('id,transaksi_id,payment_sequence,nominal,storage_bucket,storage_path,mime_type,original_file_name,submitted_by,submitted_at,status,verified_by,verified_at,verifier_signature_path,verification_notes').eq('transaksi_id', id).order('payment_sequence');
  if (p.error) throw p.error;
  const proofs = (p.data || []).map((x: any) => ({ ...x, nominal: Number(x.nominal) || 0, file: metadata({ transaksi_id: id, document_type: 'PAYMENT_PROOF', storage_bucket: text(x.storage_bucket) || 'bukti-payment', storage_path: text(x.storage_path), mime_type: x.mime_type, original_file_name: x.original_file_name }), verifierSignature: validPath(x.verifier_signature_path) ? { path: x.verifier_signature_path, bucket: 'paraf-verifikator', name: text(x.verifier_signature_path).split('/').pop(), mimeType: 'image/png', accessMode: 'on-demand' } : null }));
  return { ...mapTransaction(row, docs), fileBuktiFoto: metadata(docs.get('FOTO_TRANSAKSI')), fileBuktiFile: metadata(docs.get('FILE_TRANSAKSI')), fileNota: metadata(docs.get('NOTA_PEMBELIAN')), fileTtdUser: metadata(docs.get('TTD_USER')), paymentProofs: proofs };
}

function inputDocs(data: any, id: string) {
  const rows: Doc[] = [];
  for (const [key, type] of [['uploadFoto','FOTO_TRANSAKSI'],['uploadFile','FILE_TRANSAKSI'],['ttdUser','TTD_USER'],['notaPembelian','NOTA_PEMBELIAN']] as const) {
    const path = text(data[key]);
    if (validPath(path)) rows.push({ transaksi_id: id, document_type: type, storage_bucket: BUCKETS[type], storage_path: path, mime_type: inferMime(path), original_file_name: path.split('/').pop() });
  }
  return rows;
}
async function resolveSupplier(data: any, sppg: string, yayasan: string) {
  const id = text(data.supplierId || data['SUPPLIER ID']);
  if (!id) return { 'SUPPLIER ID': null, 'NAMA SUPPLIER': null, 'NAMA BANK SUPPLIER': null, 'NO REKENING SUPPLIER': null, 'ATAS NAMA REKENING SUPPLIER': null, 'SUMBER SUPPLIER': null };
  const q = await sb.from('MASTER_SUPPLIER').select('ID,"NAMA SUPPLIER","NAMA BANK","NO REKENING","ATAS NAMA REKENING",STATUS,SPPG,YAYASAN').eq('ID', id).maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Supplier tidak ditemukan.');
  if (text(q.data.STATUS || 'Aktif').toLowerCase() !== 'aktif') throw new Error('Supplier tidak aktif.');
  if (text(q.data.SPPG) && text(q.data.SPPG) !== sppg) throw new Error('Supplier tidak sesuai SPPG transaksi.');
  if (text(q.data.YAYASAN) && text(q.data.YAYASAN) !== yayasan) throw new Error('Supplier tidak sesuai Yayasan transaksi.');
  return { 'SUPPLIER ID': text(q.data.ID), 'NAMA SUPPLIER': text(q.data['NAMA SUPPLIER']), 'NAMA BANK SUPPLIER': text(q.data['NAMA BANK']), 'NO REKENING SUPPLIER': text(q.data['NO REKENING']), 'ATAS NAMA REKENING SUPPLIER': text(q.data['ATAS NAMA REKENING']), 'SUMBER SUPPLIER': 'MASTER' };
}
async function addTransaction(data: any, c: Caller) {
  const sppg = ['ADMIN','SUPER_ADMIN'].includes(c.role) ? text(data.sppg || c.sppg) : c.sppg;
  const yayasan = await resolveYayasan(c, sppg, data.yayasan);
  if (!sppg || !yayasan) throw new Error('SPPG dan Yayasan wajib tersedia.');
  if (!(Number(data.nominal) > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const method = normalizeMethod(data.metodeTransaksi);
  const docs = inputDocs(data, id);
  const types = new Set(docs.map((d) => d.document_type));
  if (!types.has('TTD_USER')) throw new Error('TTD User wajib tersedia.');
  if (!types.has('NOTA_PEMBELIAN')) throw new Error('Nota Pembelian wajib tersedia.');
  if (method !== 'BELUM_BAYAR' && !types.has('FOTO_TRANSAKSI') && !types.has('FILE_TRANSAKSI')) throw new Error('Bukti Transaksi wajib tersedia.');
  const now = new Date().toISOString();
  const row: any = {
    ID: id, 'Kode Pemasukan': `TRX - ${crypto.randomUUID().slice(0, 8)}`, Tanggal: normalizeDate(data.tanggal),
    Kategori: text(data.kategori), 'Jenis Kategori': text(data.jenisKategori), SPPG: sppg, YAYASAN: yayasan,
    Nominal: Number(data.nominal), Catatan: text(data.catatan), Timestamp: now, User: c.email,
    'Nama Item/ Bahan Baku': text(data.namaItem || data.item), 'Metode Transaksi': method,
    'APPROVED BY': method === 'SUDAH_DIBAYAR' ? c.email : '', 'WAKTU APPROVE': method === 'SUDAH_DIBAYAR' ? now : null,
    Catatan_1: '', 'Catatan Approval': method === 'SUDAH_DIBAYAR' ? 'Pembayaran langsung telah dilengkapi saat transaksi dibuat.' : '', Deskripsi: '',
  };
  Object.assign(row, await resolveSupplier(data, sppg, yayasan));
  const rpc = await sb.rpc('create_transaction_with_documents_atomic', { p_transaction: row, p_documents: docs.map((d) => ({ document_type: d.document_type, storage_bucket: d.storage_bucket, storage_path: d.storage_path, mime_type: d.mime_type, original_file_name: d.original_file_name })), p_uploaded_by: c.email });
  if (rpc.error) throw rpc.error;
  const normalized = (await docsFor([id])).get(id) || new Map(docs.map((d) => [d.document_type, d]));
  return { success: true, message: 'Transaksi berhasil ditambahkan.', id, data: mapTransaction(rpc.data || row, normalized) };
}

async function editTransaction(id: string, fields: any, c: Caller) {
  const old = await getTransactionRow(id, c);
  const patch: any = {};
  const mapping: Record<string,string> = { Tanggal:'Tanggal', Kategori:'Kategori', 'Jenis Kategori':'Jenis Kategori', SPPG:'SPPG', YAYASAN:'YAYASAN', 'Nama Item/Bahan Baku':'Nama Item/ Bahan Baku', Nominal:'Nominal', Catatan:'Catatan', 'Metode Transaksi':'Metode Transaksi' };
  for (const [k,v] of Object.entries(fields || {})) if (mapping[k]) patch[mapping[k]] = mapping[k] === 'Tanggal' ? normalizeDate(v) : v;
  if (Object.prototype.hasOwnProperty.call(patch,'Nominal') && !(Number(patch.Nominal) > 0)) throw new Error('Nominal transaksi harus lebih dari 0.');
  const docsExisting = (await docsFor([id])).get(id) || new Map<string, Doc>();
  const docFields: Record<string,[string,string]> = { 'Upload Foto':['FOTO_TRANSAKSI','transaksi-images'], 'Upload File':['FILE_TRANSAKSI','transaksi-files'], 'TTD User':['TTD_USER','paraf-user'], 'Nota Pembelian':['NOTA_PEMBELIAN','nota-pembelian'] };
  for (const [field,[type,bucket]] of Object.entries(docFields)) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, field)) continue;
    const path = text(fields[field]);
    if (validPath(path)) docsExisting.set(type,{ transaksi_id:id, document_type:type, storage_bucket:bucket, storage_path:path, mime_type:inferMime(path), original_file_name:path.split('/').pop() }); else docsExisting.delete(type);
  }
  if (!docsExisting.has('TTD_USER') || !docsExisting.has('NOTA_PEMBELIAN')) throw new Error('TTD User dan Nota Pembelian wajib tersedia.');
  const rpc = await sb.rpc('update_transaction_with_documents_atomic', { p_transaksi_id:id, p_patch:patch, p_documents:[...docsExisting.values()].filter((d) => BUCKETS[d.document_type]).map((d) => ({ document_type:d.document_type, storage_bucket:d.storage_bucket, storage_path:d.storage_path, mime_type:d.mime_type || inferMime(d.storage_path), original_file_name:d.original_file_name || d.storage_path.split('/').pop() })), p_uploaded_by:c.email });
  if (rpc.error) throw rpc.error;
  return { success:true, message:'Transaksi berhasil diubah.', data:mapTransaction(rpc.data || { ...old, ...patch }, docsExisting) };
}

async function removeStorage(items: { bucket:string; path:string }[]) {
  const grouped = new Map<string,string[]>();
  for (const x of items) if (validPath(x.path)) grouped.set(x.bucket,[...(grouped.get(x.bucket)||[]),x.path]);
  for (const [bucket,paths] of grouped) { const q = await sb.storage.from(bucket).remove([...new Set(paths)]); if (q.error) throw q.error; }
}
async function deleteTransaction(id: string, c: Caller) {
  if (!['ADMIN','SUPER_ADMIN'].includes(c.role)) throw new Error('Hanya ADMIN yang dapat menghapus transaksi.');
  await getTransactionRow(id,c);
  const d = await sb.from('TRANSAKSI_DOCUMENTS').select('storage_bucket,storage_path').eq('transaksi_id',id);
  if (d.error) throw d.error;
  const p = await sb.from('TRANSAKSI_PAYMENT_PROOFS').select('storage_bucket,storage_path,verifier_signature_path').eq('transaksi_id',id);
  if (p.error) throw p.error;
  const files = (d.data || []).map((x:any) => ({ bucket:text(x.storage_bucket), path:text(x.storage_path) }));
  for (const x of p.data || []) { files.push({ bucket:text(x.storage_bucket)||'bukti-payment', path:text(x.storage_path) }); if (validPath(x.verifier_signature_path)) files.push({ bucket:'paraf-verifikator', path:text(x.verifier_signature_path) }); }
  await removeStorage(files);
  const q = await sb.from('TRANSAKSI').delete().eq('ID',id);
  if (q.error) throw q.error;
  return { success:true, message:'Transaksi dan file terkait berhasil dihapus.' };
}
async function summary(filters:any,c:Caller) {
  const r = await listTransactions({ ...filters, page:1, pageSize:100 },c);
  let totalPemasukan=0,totalPengeluaran=0;
  for (const x of r.data) { if (text(x.kategori).toUpperCase()==='PEMASUKAN') totalPemasukan+=Number(x.nominal)||0; if (text(x.kategori).toUpperCase()==='PENGELUARAN') totalPengeluaran+=Number(x.nominal)||0; }
  return { success:true,totalPemasukan,totalPengeluaran,totalTransaksi:r.total };
}
async function saveNote(params:any[],c:Caller) {
  if (!['ADMIN','SUPER_ADMIN'].includes(c.role)) throw new Error('Akses ditolak.');
  const first=params[0]; const id=typeof first==='object'?text(first.id||first.txId):text(first); const note=typeof first==='object'?text(first.note||first.catatanApproval):text(params[1]);
  await getTransactionRow(id,c); const q=await sb.from('TRANSAKSI').update({ 'Catatan Approval':note, Catatan_1:note }).eq('ID',id); if(q.error)throw q.error; return { success:true,message:'Catatan berhasil disimpan.' };
}

const handlers: Record<string,(p:any[],c:Caller)=>Promise<any>> = {
  getTransactions:(p,c)=>listTransactions(p[0]||{},c),
  getTransactionSummary:(p,c)=>summary(p[0]||{},c),
  getTransactionSuggestions:async()=>({ success:true,jenisKategori:[],items:[],catatan:[] }),
  getTransactionDetail:(p,c)=>detail(text(p[0]),c),
  addTransaction:(p,c)=>addTransaction(p[0]||{},c),
  editTransaction:(p,c)=>editTransaction(text(p[0]),p[1]||{},c),
  sendCatatanApproval:saveNote,
  deleteTransaction:(p,c)=>deleteTransaction(text(p[0]),c),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ status:'ok',service:'transaction-action',version:51,writeMode:'normalized-atomic',detailMode:'metadata-only' });
  if (req.method !== 'POST') return json({ error:'Method tidak didukung.' },405);
  try {
    const c=await caller(req); const body=await req.json(); const fn=handlers[body?.function];
    if (!fn) return json({ error:`Fungsi tidak diizinkan: ${body?.function||''}` },404);
    return json({ result:await fn(Array.isArray(body.parameters)?body.parameters:[],c) });
  } catch (error) {
    const message=error instanceof Error?error.message:String(error); console.error(message);
    return json({ error:message,result:{ success:false,message } },/akses|token|hanya admin/i.test(message)?403:400);
  }
});
