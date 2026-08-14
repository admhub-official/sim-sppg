import { BUCKET, normalizeStatus, norm, sb, TABLE, text } from './client.ts';
import { assignedSppg, canAccess, type Caller } from './auth.ts';
import { enrich, inferMime, normalizeProof, proofRows, summarize } from './proofs.ts';

const DOC: Record<string, string> = {
  foto: 'FOTO_TRANSAKSI',
  file: 'FILE_TRANSAKSI',
  ttdUser: 'TTD_USER',
  nota: 'NOTA_PEMBELIAN',
  ttdVerif: 'TTD_VERIFIKATOR_LEGACY',
  approval: 'BUKTI_APPROVAL_LEGACY',
};

// Explicit projections keep high-traffic approval lists independent from future
// wide columns added to TRANSAKSI or the document compatibility view.
const TRANSACTION_LIST_COLUMNS = 'ID,"Kode Pemasukan",Tanggal,Kategori,"Jenis Kategori",SPPG,YAYASAN,Nominal,Catatan,User,"Nama Item/ Bahan Baku","Metode Transaksi","SUPPLIER ID","NAMA SUPPLIER","NAMA BANK SUPPLIER","NO REKENING SUPPLIER","ATAS NAMA REKENING SUPPLIER","SUMBER SUPPLIER","APPROVED BY","WAKTU APPROVE",Catatan_1,"Catatan Approval"';
const APPROVAL_CANDIDATE_COLUMNS = 'ID,"Kode Pemasukan",Tanggal,Kategori,"Jenis Kategori",SPPG,Nominal,User,"Nama Item/ Bahan Baku","Metode Transaksi","SUPPLIER ID","NAMA SUPPLIER","NAMA BANK SUPPLIER","NO REKENING SUPPLIER","ATAS NAMA REKENING SUPPLIER","SUMBER SUPPLIER"';
const DOCUMENT_COLUMNS = 'transaksi_id,document_type,storage_bucket,storage_path,mime_type,original_file_name,updated_at';

function documentState(docs: Map<string, any>, method: unknown) {
  const hasFoto = !!text(docs.get(DOC.foto)?.storage_path);
  const hasFile = !!text(docs.get(DOC.file)?.storage_path);
  const hasBuktiTransaksi = hasFoto || hasFile;
  const hasNotaPembelian = !!text(docs.get(DOC.nota)?.storage_path);
  const hasTtdUser = !!text(docs.get(DOC.ttdUser)?.storage_path);
  const isBelumBayar = normalizeStatus(method) === 'BELUM_BAYAR';
  const missing: string[] = [];
  // BELUM_BAYAR belum membutuhkan bukti transaksi/pelunasan. Pada tahap ini
  // dokumen wajibnya adalah Nota Pembelian dan TTD User.
  if (!isBelumBayar && !hasBuktiTransaksi) missing.push('Bukti Transaksi');
  if (!hasNotaPembelian) missing.push('Nota Pembelian');
  if (!hasTtdUser) missing.push('TTD User');
  return {
    hasBuktiTransaksi,
    hasNotaPembelian,
    hasTtdUser,
    statusDokumen: missing.length ? `Dokumen Tidak Lengkap: ${missing.join(', ')}` : 'Dokumen Lengkap',
  };
}

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
    supplierId: row['SUPPLIER ID'] || '',
    supplierName: row['NAMA SUPPLIER'] || '',
    supplierBankName: row['NAMA BANK SUPPLIER'] || '',
    supplierAccountNumber: row['NO REKENING SUPPLIER'] || '',
    supplierAccountHolder: row['ATAS NAMA REKENING SUPPLIER'] || '',
    supplierSource: row['SUMBER SUPPLIER'] || '',
    metodeTransaksi: normalizeStatus(row['Metode Transaksi']),
    ttdVerifikator: path(DOC.ttdVerif), ttdUser: path(DOC.ttdUser),
    notaPembelian: path(DOC.nota), approvedBy: row['APPROVED BY'] || '',
    waktuApprove: row['WAKTU APPROVE'] || '',
    catatanApproval: row['Catatan Approval'] || row.Catatan_1 || '',
    ...documentState(docs, row['Metode Transaksi']),
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
  const q = await sb.from(TABLE.docsAvailable)
    .select(DOCUMENT_COLUMNS)
    .in('transaksi_id', ids)
    .order('updated_at', { ascending: true });
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
    mimeType: inferMime(doc.storage_path, doc.mime_type),
  };
}

function pageSpec(value: any) {
  if (!(Number(value?.page) > 0 || Number(value?.pageSize) > 0)) return null;
  const page = Math.max(1, Math.floor(Number(value.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(value.pageSize) || 15)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

function approvalDocumentStatus(docs: Map<string, any>, payment: ReturnType<typeof summarize>, method: unknown) {
  const hasProof = !!text(docs.get(DOC.foto)?.storage_path) ||
    !!text(docs.get(DOC.file)?.storage_path) ||
    payment.proofCount > 0;
  const hasNota = !!text(docs.get(DOC.nota)?.storage_path);
  const hasTtd = !!text(docs.get(DOC.ttdUser)?.storage_path);
  const isBelumBayar = normalizeStatus(method) === 'BELUM_BAYAR';
  const missing: string[] = [];
  if (!isBelumBayar && !hasProof) missing.push('Bukti Pembayaran');
  if (!hasNota) missing.push('Nota');
  if (!hasTtd) missing.push('TTD');
  if (!missing.length) return 'Lengkap';
  if (missing.length > 1) return 'Tidak Lengkap';
  return `Tidak ada ${missing[0]}`;
}

function matchesApprovalFilters(row: any, filters: any) {
  const search = text(filters.search).toLowerCase();
  if (search) {
    const haystack = [
      row['Kode Pemasukan'], row['Nama Item/ Bahan Baku'], row.User, row.SPPG,
      row['NAMA SUPPLIER'], row['NO REKENING SUPPLIER'],
    ].map((value) => text(value).toLowerCase()).join(' ');
    if (!haystack.includes(search)) return false;
  }
  if (filters.sppg && filters.sppg !== 'ALL' && norm(row.SPPG) !== norm(filters.sppg)) return false;
  if (filters.jenisKategori && filters.jenisKategori !== 'ALL' &&
      text(row['Jenis Kategori']) !== text(filters.jenisKategori)) return false;
  if (filters.supplier && filters.supplier !== 'ALL' &&
      norm(row['NAMA SUPPLIER']) !== norm(filters.supplier)) return false;
  return true;
}

function supplierGroups(rows: any[]) {
  const groups = new Map<string, any>();
  for (const row of rows) {
    const name = text(row['NAMA SUPPLIER']) || 'Supplier belum tercatat';
    const key = text(row['SUPPLIER ID']) || `manual:${norm(name) || 'legacy'}`;
    const group = groups.get(key) || {
      key, supplierId: text(row['SUPPLIER ID']), supplierName: name,
      supplierBankName: text(row['NAMA BANK SUPPLIER']),
      supplierAccountNumber: text(row['NO REKENING SUPPLIER']),
      supplierAccountHolder: text(row['ATAS NAMA REKENING SUPPLIER']),
      supplierSource: text(row['SUMBER SUPPLIER']) || 'LEGACY',
      transactionCount: 0, nominal: 0, transactions: [],
    };
    group.transactionCount++;
    group.nominal += Number(row.Nominal) || 0;
    // Keep payment summaries compact. The group button applies a server-side
    // supplier filter for the full paginated list, so only a short preview is
    // returned here instead of duplicating every candidate row in the payload.
    if (group.transactions.length < 10) {
      group.transactions.push({
        id: text(row.ID), kode: text(row['Kode Pemasukan']),
        tanggal: text(row.Tanggal), item: text(row['Nama Item/ Bahan Baku']),
        nominal: Number(row.Nominal) || 0,
      });
    }
    group.hasMoreTransactions = group.transactionCount > group.transactions.length;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.nominal - a.nominal);
}

async function approvalCandidates(filters: any, current: Caller, scope: string[]) {
  // Candidate rows intentionally use a narrow projection. This lets the Edge
  // Function calculate filters/KPI before paging without transferring document
  // metadata and payment proof payloads for every Approval row.
  const rows: any[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    let query = sb.from(TABLE.tx)
      .select(APPROVAL_CANDIDATE_COLUMNS)
      .eq('Kategori', 'PENGELUARAN')
      .neq('Metode Transaksi', 'SUDAH_DIBAYAR')
      .neq('Metode Transaksi', 'LUNAS')
      .order('Tanggal', { ascending: false })
      .order('ID', { ascending: false })
      .range(from, from + chunkSize - 1);
    if (current.role === 'USER') query = query.ilike('User', current.email);
    if (current.role === 'ADMIN') query = query.in('SPPG', scope);
    if (filters.dateStart) query = query.gte('Tanggal', text(filters.dateStart).slice(0, 10));
    if (filters.dateEnd) query = query.lte('Tanggal', text(filters.dateEnd).slice(0, 10));
    const result = await query;
    if (result.error) throw result.error;
    const batch = result.data || [];
    rows.push(...batch);
    if (batch.length < chunkSize) break;
  }

  const queueRows = rows.filter((row: any) => {
    const status = normalizeStatus(row['Metode Transaksi']);
    return norm(row.Kategori) === 'PENGELUARAN' &&
      status !== 'SUDAH_DIBAYAR' && status !== 'LUNAS';
  });
  const filterOptions = {
    sppg: [...new Set(queueRows.map((row: any) => text(row.SPPG)).filter(Boolean))].sort(),
    jenisKategori: [...new Set(queueRows.map((row: any) => text(row['Jenis Kategori'])).filter(Boolean))].sort(),
    supplier: [...new Set(queueRows.map((row: any) => text(row['NAMA SUPPLIER'])).filter(Boolean))].sort(),
  };
  let filtered = queueRows.filter((row: any) => matchesApprovalFilters(row, filters));

  const completeness = text(filters.kelengkapan);
  if (completeness && completeness !== 'ALL' && filtered.length) {
    const ids = filtered.map((row: any) => text(row.ID));
    const docs = await docsFor(ids);
    const proofs = await proofRows(ids);
    const grouped = new Map<string, any[]>();
    for (const proof of proofs) {
      const id = text(proof.transaksi_id);
      const list = grouped.get(id) || [];
      list.push(proof);
      grouped.set(id, list);
    }
    filtered = filtered.filter((row: any) => {
      const id = text(row.ID);
      return approvalDocumentStatus(
        docs.get(id) || new Map(),
        summarize(grouped.get(id) || []),
        row['Metode Transaksi'],
      ) === completeness;
    });
  }
  return { rows: filtered, filterOptions, supplierGroups: supplierGroups(filtered) };
}

export async function getTransactions(parameters: any[], current: Caller) {
  const filters = parameters[0] || {};
  const page = pageSpec(filters);
  const approvalOnly = filters.approvalOnly === true;
  const scope = current.role === 'ADMIN' ? [...await assignedSppg(current)] : [];
  if (current.role === 'ADMIN' && !scope.length) return page
    ? {
      data: [], page: page.page, pageSize: page.pageSize, total: 0, hasMore: false,
      summary: { total: 0, nominal: 0 },
      filterOptions: { sppg: [], jenisKategori: [], supplier: [] }, supplierGroups: [],
    }
    : [];

  if (approvalOnly) {
    const candidates = await approvalCandidates(filters, current, scope);
    const total = candidates.rows.length;
    const nominal = candidates.rows.reduce((sum: number, row: any) => sum + (Number(row.Nominal) || 0), 0);
    const selected = page && filters.exportAll !== true
      ? candidates.rows.slice(page.from, page.to + 1)
      : candidates.rows;
    const selectedIds = selected.map((row: any) => text(row.ID));
    if (!selectedIds.length) return page
      ? {
        data: [], page: page.page, pageSize: page.pageSize, total, hasMore: false,
        summary: { total, nominal }, filterOptions: candidates.filterOptions,
        supplierGroups: candidates.supplierGroups,
      }
      : [];

    const result = await sb.from(TABLE.tx)
      .select(TRANSACTION_LIST_COLUMNS)
      .in('ID', selectedIds)
      .order('Tanggal', { ascending: false })
      .order('ID', { ascending: false });
    if (result.error) throw result.error;
    const rows: any[] = result.data || [];
    const docs = await docsFor(selectedIds);
    const users = await usersFor(rows);
    const proofs = await proofRows(selectedIds);
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
    if (!page || filters.exportAll === true) return data;
    return {
      data, page: page.page, pageSize: page.pageSize,
      total, hasMore: page.to + 1 < total,
      summary: { total, nominal }, filterOptions: candidates.filterOptions,
      supplierGroups: candidates.supplierGroups,
    };
  }

  let query = page
    ? sb.from(TABLE.tx).select(TRANSACTION_LIST_COLUMNS, { count: 'exact' })
    : sb.from(TABLE.tx).select(TRANSACTION_LIST_COLUMNS);
  if (current.role === 'USER') query = query.ilike('User', current.email);
  if (current.role === 'ADMIN') {
    query = query.in('SPPG', scope);
  }
  if (filters.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (filters.kategori && filters.kategori !== 'ALL') {
    query = query.eq('Kategori', filters.kategori);
  }
  if (filters.dateStart) query = query.gte('Tanggal', text(filters.dateStart).slice(0, 10));
  if (filters.dateEnd) query = query.lte('Tanggal', text(filters.dateEnd).slice(0, 10));
  query = query.order('Tanggal', { ascending: false }).order('ID', { ascending: false });
  // Pagination happens in Postgres so only the displayed transactions consume
  // Data API egress and trigger related document/proof queries.
  if (page) query = query.range(page.from, page.to);

  const result = await query;
  if (result.error) throw result.error;
  const rows: any[] = result.data || [];

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
  if (!page) return data;
  const total = result.count ?? data.length;
  return {
    data, page: page.page, pageSize: page.pageSize,
    total, hasMore: page.to + 1 < total,
  };
}

export async function getTransactionDetail(parameters: any[], current: Caller) {
  const id = text(parameters[0]);
  const q = await sb.from(TABLE.tx).select(TRANSACTION_LIST_COLUMNS).eq('ID', id).maybeSingle();
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
