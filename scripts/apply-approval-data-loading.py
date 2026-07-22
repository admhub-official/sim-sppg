from pathlib import Path

app_path = Path('app.js')
index_path = Path('index.html')
sw_path = Path('sw.js')
read_path = Path('supabase/functions/approval-payment-action/read.ts')
approval_check_path = Path('scripts/check-approval-row-detail.mjs')
verifier_check_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
read = read_path.read_text(encoding='utf-8')
approval_check = approval_check_path.read_text(encoding='utf-8')
verifier_check = verifier_check_path.read_text(encoding='utf-8')

marker = "function loadApprovalData() {"
helpers = r'''function normalizeApprovalApiResponse(result) {
  var current = result;
  for (var depth = 0; depth < 4; depth++) {
    if (Array.isArray(current)) return { valid: true, rows: current };
    if (!current || typeof current !== 'object') break;
    if (Array.isArray(current.data)) return { valid: true, rows: current.data };
    if (Array.isArray(current.rows)) return { valid: true, rows: current.rows };
    if (Object.prototype.hasOwnProperty.call(current, 'result')) {
      current = current.result;
      continue;
    }
    break;
  }
  return { valid: false, rows: [] };
}

function normalizeApprovalTransaction(tx) {
  if (!tx || typeof tx !== 'object') return null;
  var normalized = Object.assign({}, tx);
  normalized.id = String(tx.id || tx.ID || '').trim();
  normalized.kode = tx.kode || tx['Kode Pemasukan'] || normalized.id;
  normalized.tanggal = tx.tanggal || tx.Tanggal || '';
  normalized.kategori = String(tx.kategori || tx.Kategori || '').trim().toUpperCase();
  normalized.jenisKategori = tx.jenisKategori || tx['Jenis Kategori'] || '';
  normalized.sppg = tx.sppg || tx.SPPG || '';
  normalized.yayasan = tx.yayasan || tx.YAYASAN || '';
  normalized.nominal = Number(tx.nominal if False else 0)
  return normalized;
}
'''
# Build the JavaScript helper without Python interpreting JS expressions.
helpers = helpers.replace("  normalized.nominal = Number(tx.nominal if False else 0)\n  return normalized;", r'''  normalized.nominal = Number(tx.nominal !== undefined ? tx.nominal : tx.Nominal) || 0;
  normalized.user = tx.user || tx.User || '';
  normalized.item = tx.item || tx.namaItem || tx['Nama Item/ Bahan Baku'] || '';
  normalized.uploadFoto = tx.uploadFoto || tx['UPLOUD FOTO'] || '';
  normalized.uploadFile = tx.uploadFile || tx['UPLOUD FILE'] || '';
  normalized.notaPembelian = tx.notaPembelian || tx['NOTA PEMBELIAN'] || '';
  normalized.ttdUser = tx.ttdUser || tx['TTD USER'] || '';
  normalized.metodeTransaksi = String(tx.metodeTransaksi || tx['Metode Transaksi'] || 'BELUM_BAYAR')
    .trim().toUpperCase().replace(/\s+/g, '_');
  return normalized.id ? normalized : null;
}''')
helpers += r'''

function isApprovalQueueTransaction(tx) {
  if (!tx) return false;
  var kategori = String(tx.kategori || '').trim().toUpperCase();
  var status = String(tx.metodeTransaksi || '').trim().toUpperCase().replace(/\s+/g, '_');
  return kategori === 'PENGELUARAN' && status !== 'SUDAH_DIBAYAR' && status !== 'LUNAS';
}

function renderApprovalLoadError(message) {
  var safeMessage = esc(message || 'Data Approval gagal dimuat. Silakan muat ulang halaman.');
  var html = '<div class="empty-state approval-load-error"><div class="empty-illustration"><i class="fas fa-exclamation-triangle"></i></div><h4>Data Approval Gagal Dimuat</h4><p>' + safeMessage + '</p><button type="button" class="btn btn-primary btn-sm" onclick="loadApprovalData()"><i class="fas fa-sync-alt"></i> Muat Ulang</button></div>';
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  var pagination = $('approvalPagination');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8">' + html + '</td></tr>';
  if (mobileList) mobileList.innerHTML = html;
  if (pagination) pagination.innerHTML = '';
  filteredApprovalData = [];
  selectedApprovalIds.clear();
  updateApprovalBulkBar();
}

'''

if 'function normalizeApprovalApiResponse(result)' not in app:
    if marker not in app:
        raise SystemExit('loadApprovalData marker not found')
    app = app.replace(marker, helpers + marker, 1)

old_filters = """  var filters = {};
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;
    callApi('getTransactions', [filters], function(data) {
        showLoading(false);
              if (!data || !Array.isArray(data)) {
                showToast('error', 'Gagal', 'Data approval tidak valid.');
                allTransactions = [];
                populateApprovalFilters();
                filterApproval();
                return;
              }
              allTransactions = data;
              populateApprovalFilters();
              filterApproval();
      },
      function(err) {
        showLoading(false);
              showToast('error', 'Gagal', 'Tidak dapat memuat data approval.');
              populateApprovalFilters();
              filterApproval();
      }
    );"""
new_filters = """  var filters = { kategori: 'PENGELUARAN', approvalOnly: true };
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;
  callApi('getTransactions', [filters], function(data) {
    showLoading(false);
    var normalizedResponse = normalizeApprovalApiResponse(data);
    if (!normalizedResponse.valid) {
      console.error('Kontrak respons Approval tidak dikenali:', data);
      renderApprovalLoadError('Format respons server tidak dikenali.');
      showToast('error', 'Gagal', 'Format data Approval tidak valid.');
      return;
    }
    allTransactions = normalizedResponse.rows
      .map(normalizeApprovalTransaction)
      .filter(function(tx) { return tx && isApprovalQueueTransaction(tx); });
    populateApprovalFilters();
    filterApproval();
  }, function(err) {
    showLoading(false);
    var message = err && err.message ? err.message : 'Tidak dapat memuat data Approval.';
    console.error('Gagal memuat Approval:', err);
    renderApprovalLoadError(message);
    showToast('error', 'Gagal', message);
  });"""
if old_filters not in app:
    raise SystemExit('old Approval loader block not found')
app = app.replace(old_filters, new_filters, 1)

old_base_1 = """  var base = allTransactions.filter(function(t) {
    var metode = String(t.metodeTransaksi || '').trim().toUpperCase();
    return metode !== 'SUDAH_DIBAYAR' && t.kategori === 'PENGELUARAN';
  });"""
new_base_1 = """  var base = allTransactions.filter(isApprovalQueueTransaction);"""
if old_base_1 not in app:
    raise SystemExit('populateApprovalFilters legacy filter not found')
app = app.replace(old_base_1, new_base_1, 1)

old_base_2 = """  var approvalBase = allTransactions.filter(function(t) {
    var metode = String(t.metodeTransaksi || '').trim().toUpperCase();
    return metode !== 'SUDAH_DIBAYAR' && t.kategori === 'PENGELUARAN';
  });"""
new_base_2 = """  var approvalBase = allTransactions.filter(isApprovalQueueTransaction);"""
if old_base_2 not in app:
    raise SystemExit('filterApproval legacy filter not found')
app = app.replace(old_base_2, new_base_2, 1)

old_query = """  let query = sb.from(TABLE.tx).select('*').order('Tanggal', { ascending: false });
  if (filters.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (filters.kategori && filters.kategori !== 'ALL') query = query.eq('Kategori', filters.kategori);"""
new_query = """  let query = sb.from(TABLE.tx).select('*').order('Tanggal', { ascending: false });
  const approvalOnly = filters.approvalOnly === true;
  if (filters.sppg && filters.sppg !== 'ALL') query = query.eq('SPPG', filters.sppg);
  if (filters.yayasan && filters.yayasan !== 'ALL') query = query.eq('YAYASAN', filters.yayasan);
  if (approvalOnly) {
    query = query.eq('Kategori', 'PENGELUARAN')
      .neq('Metode Transaksi', 'SUDAH_DIBAYAR')
      .neq('Metode Transaksi', 'LUNAS');
  } else if (filters.kategori && filters.kategori !== 'ALL') {
    query = query.eq('Kategori', filters.kategori);
  }"""
if old_query not in read:
    raise SystemExit('backend query block not found')
read = read.replace(old_query, new_query, 1)

old_role_end = """  } else {
    rows = (result.data || []).filter((row: any) => String(row.User || '').toLowerCase() === current.email);
  }

  const docs = await docsFor(rows.map((row: any) => text(row.ID)));"""
new_role_end = """  } else {
    rows = (result.data || []).filter((row: any) => String(row.User || '').toLowerCase() === current.email);
  }
  if (approvalOnly) {
    rows = rows.filter((row: any) => norm(row.Kategori) === 'PENGELUARAN' && normalizeStatus(row['Metode Transaksi']) !== 'SUDAH_DIBAYAR');
  }

  const docs = await docsFor(rows.map((row: any) => text(row.ID)));"""
if old_role_end not in read:
    raise SystemExit('backend role/filter boundary not found')
read = read.replace(old_role_end, new_role_end, 1)

index = index.replace('app.js?v=20260722-approval-responsive-v5', 'app.js?v=20260722-approval-data-v6')
sw = sw.replace("sim-sppg-v20260722-approval-responsive-v9", "sim-sppg-v20260722-approval-data-v10")

approval_assertion = """
requireMatch(app.includes('function normalizeApprovalApiResponse(result)'), 'Approval loader must normalize array and wrapped responses');
requireMatch(app.includes("var filters = { kategori: 'PENGELUARAN', approvalOnly: true };"), 'Approval loader must request only pending expense transactions');
requireMatch(app.includes('.map(normalizeApprovalTransaction)'), 'Approval rows must be normalized before filtering');
requireMatch(app.includes('renderApprovalLoadError(message)'), 'Approval API failures must render a visible retry state');
requireMatch(!app.includes("if (!data || !Array.isArray(data))"), 'Approval loader must not reject wrapped API responses');
requireMatch(read.includes("const approvalOnly = filters.approvalOnly === true;"), 'Approval backend must support approvalOnly');
requireMatch(read.includes(".neq('Metode Transaksi', 'SUDAH_DIBAYAR')"), 'Approval backend must exclude paid transactions before document enrichment');
"""
if "Approval loader must normalize array and wrapped responses" not in approval_check:
    approval_check = approval_check.replace("if (!process.exitCode) console.log('Approval responsive desktop/mobile UI check passed.');", approval_assertion + "\nif (!process.exitCode) console.log('Approval responsive desktop/mobile UI check passed.');")
approval_check = approval_check.replace("const sw = fs.readFileSync('sw.js', 'utf8');", "const sw = fs.readFileSync('sw.js', 'utf8');\nconst read = fs.readFileSync('supabase/functions/approval-payment-action/read.ts', 'utf8');")
approval_check = approval_check.replace('app.js\\?v=20260722-approval-responsive-v5', 'app.js\\?v=20260722-approval-data-v6')
approval_check = approval_check.replace('sim-sppg-v20260722-approval-responsive-v9', 'sim-sppg-v20260722-approval-data-v10')

verifier_check = verifier_check.replace('app.js\\?v=20260722-approval-responsive-v4', 'app.js\\?v=20260722-approval-data-v6')
verifier_check = verifier_check.replace('app.js\\?v=20260722-approval-responsive-v5', 'app.js\\?v=20260722-approval-data-v6')
verifier_check = verifier_check.replace('sim-sppg-v20260722-approval-responsive-v8', 'sim-sppg-v20260722-approval-data-v10')
verifier_check = verifier_check.replace('sim-sppg-v20260722-approval-responsive-v9', 'sim-sppg-v20260722-approval-data-v10')

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
read_path.write_text(read, encoding='utf-8')
approval_check_path.write_text(approval_check, encoding='utf-8')
verifier_check_path.write_text(verifier_check, encoding='utf-8')
