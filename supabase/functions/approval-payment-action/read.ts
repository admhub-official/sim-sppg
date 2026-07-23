import { BUCKET, normalizeStatus, norm, sb, TABLE, text } from './client.ts';
import { assignedSppg, canAccess, type Caller } from './auth.ts';
import { enrich, normalizeProof, proofRows, summarize } from './proofs.ts';

const DOC: Record<string, string> = {
  foto: 'FOTO_TRANSAKSI',
  file: 'FILE_TRANSAKSI',
  ttdUser: 'TTD_USER',
  nota: 'NOTA_PEMBELIAN',
  ttdVerif: 'TTD_VERIFIKATOR_LEGACY',
  approval: 'BUKTI_APPROVAL_LEGACY',
};

function mapped(row: any, docs: Map<string, any>, user: any = null) {
  const path = (type: string) => text(docs.get(type)?.storage_path);
  const email = text(user?.EMAIL || row.User);
  return {
    id: row.ID || '', kode: row['Kode Pemasukan'] || '', tanggal: row.Tanggal || '',
    kategori: row.Kategori || '', jenisKategori: row['Jenis Kategori'] || '',
    sppg: row.SPPG || '', yayasan: row.YAYASAN || '', nominal: Number(row.Nominal) || 0,
    uploadFoto: path(DOC.foto), uploadFile: path(DOC.file), catatan: row.Catatan || '',
    user: email, userEmail: email,
    userName: text(user?.['NAMA LENGKAP']) || email || '-',
    item: row['Nama Item/ Bahan Baku'] || '',
    namaItem: row['Nama Item/ Bahan Baku'] || '',
    metodeTransaksi: normalizeStatus(row['Metode Transaksi']),
    ttdVerifikator: path(DOC.ttdVerif), ttdUser: path(DOC.ttdUser),
    notaPembelian: path(DOC.nota), approvedBy: row['APPROVED BY'] || '',
    waktuApprove: row['WAKTU APPROVE'] || '',
    catatanApproval: row['Catatan Approval'] || row.Catatan_1 || '',
  };
}

async function usersFor(rows: any[]) {
  const emails = Array.from(new Set(rows.map((row: any) => text(row.User).toLowerCase()).filter(Boolean)));
  const out = new Map<string, any>();
  if (!emails.length) return out;
  const q = await sb.from('USERS').select('EMAIL,"NAMA LENGKAP"').in('EMAIL', emails);
  if (q.error) throw q.error;
  for (const user of q.data || []) out.set(text(user.EMAIL).toLowerCase(), user);
  return out;
}

async function docsFor(ids: string[]) {
  const out = new Map<string, Map<string, any>>();
  if (!ids.length) return out;
  const q = await sb.from(TABLE.docs).select('*').in('transaksi_id', ids);
  if (q.error) throw q.error;
  for (const doc of q.data || []) {
    const id = text(doc.transaksi_id);
    if (!out.has(id)) out.set(id, new Map());
    out.get(id)!.set(text(doc.document_type), doc);
  }
  return out;
}

async function signed(doc: any) {
  if (!doc?.storage_path) return null;
  const q = await sb.storage.from(text(doc.storage_bucket)).createSignedUrl(text(doc.storage_path), 3600);
  if (q.error || !q.data?.signedUrl) return null;
  return {
    path: text(doc.storage_path), bucket: text(doc.storage_bucket),
    name: text(doc.original_file_name) || text(doc.storage_path).split('/').pop(),
    signedUrl: q.data.signedUrl, signedThumbnailUrl: q.data.signedUrl,
    mimeType: doc.mime_type || null,
  };
}

function pageSpec(value: any) {
  if (!(Number(value?.page) > 0 || Number(value?.pageSize) > 0)) return null;
  const page = Math.max(1, Math.floor(Number(value.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(value.pageSize) || 15)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export async function getTransactions(parameters: any[], current: Caller) {
  const filters = parameters[0] || {};
  let query = sb.from(TABLE.tx).select('*').order('Tanggal', { ascending: false });
  const approvalOnly = filters.approvalOnly === true;
  if (filters.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (approvalOnly) {
    query = query.eq('Kategori', 'PENGELUARAN')
      .neq('Metode Transaksi', 'SUDAH_DIBAYAR')
      .neq('Metode Transaksi', 'LUNAS');
  } else if (filters.kategori && filters.kategori !== 'ALL') {
    query = query.eq('Kategori', filters.kategori);
  }
  if (filters.dateStart) query = query.gte('Tanggal', text(filters.dateStart).slice(0, 10));
  if (filters.dateEnd) query = query.lte('Tanggal', text(filters.dateEnd).slice(0, 10));

  const result = await query;
  if (result.error) throw result.error;
  let rows: any[] = [];
  if (current.role === 'SUPER_ADMIN') rows = result.data || [];
  else if (current.role === 'ADMIN') {
    const scope = await assignedSppg(current);
    rows = (result.data || []).filter((row: any) => scope.has(norm(row.SPPG)));
  } else {
    rows = (result.data || []).filter((row: any) => String(row.User || '').toLowerCase() === current.email);
  }
  if (approvalOnly) {
    rows = rows.filter((row: any) => norm(row.Kategori) === 'PENGELUARAN' && normalizeStatus(row['Metode Transaksi']) !== 'SUDAH_DIBAYAR');
  }

  const docs = await docsFor(rows.map((row: any) => text(row.ID)));
  const users = await usersFor(rows);
  const proofs = await proofRows(rows.map((row: any) => text(row.ID)));
  const grouped = new Map<string, any[]>();
  for (const proof of proofs) {
    const list = grouped.get(text(proof.transaksi_id)) || [];
    list.push(proof);
    grouped.set(text(proof.transaksi_id), list);
  }
  const data = rows.map((row: any) => enrich(
    mapped(row, docs.get(text(row.ID)) || new Map(), users.get(text(row.User).toLowerCase())),
    summarize(grouped.get(text(row.ID)) || []),
  ));
  const page = pageSpec(filters);
  if (!page) return data;
  return {
    data: data.slice(page.from, page.to + 1), page: page.page, pageSize: page.pageSize,
    total: data.length, hasMore: page.to + 1 < data.length,
  };
}

export async function getTransactionDetail(parameters: any[], current: Caller) {
  const id = text(parameters[0]);
  const q = await sb.from(TABLE.tx).select('*').eq('ID', id).maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Transaksi tidak ditemukan.');
  if (!(await canAccess(current, q.data))) throw new Error('Akses transaksi ditolak.');

  const docMap = (await docsFor([id])).get(id) || new Map();
  const users = await usersFor([q.data]);
  const proofs = await proofRows([id]);
  const normalized = [];
  for (const proof of proofs) normalized.push(await normalizeProof(proof));
  const pending = normalized.filter((proof: any) => proof.status === 'MENUNGGU_VERIFIKASI');
  const latest = pending[pending.length - 1] || normalized[normalized.length - 1] || null;

  return {
    ...enrich(mapped(q.data, docMap, users.get(text(q.data.User).toLowerCase())), summarize(proofs)),
    fileBuktiFoto: await signed(docMap.get(DOC.foto)),
    fileBuktiFile: await signed(docMap.get(DOC.file)),
    fileBuktiApproval: await signed(docMap.get(DOC.approval)),
    fileNota: await signed(docMap.get(DOC.nota)),
    fileTtdUser: await signed(docMap.get(DOC.ttdUser)),
    fileTtdVerif: await signed(docMap.get(DOC.ttdVerif)),
    paymentProofs: normalized,
    fileBuktiUser: latest?.file || null,
    submittedByUser: latest?.submittedBy || '', submittedAt: latest?.submittedAt || '',
    pendingPaymentProofCount: pending.length,
    hasPendingPaymentProof: pending.some((proof: any) => !!proof.file?.path),
  };
}
