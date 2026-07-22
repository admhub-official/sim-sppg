from pathlib import Path

app_path = Path('app.js')
index_path = Path('index.html')
sw_path = Path('sw.js')
worker_path = Path('_worker.js')
row_test_path = Path('scripts/check-approval-row-detail.mjs')
verifier_test_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
start = app.find('function loadApprovalData() {')
end = app.find('function renderApprovalTable()', start)
if start < 0 or end <= start:
    raise SystemExit('Approval loader block not found')

loader = r'''function loadApprovalData() {
  if (!currentUser) return;
  if (approvalLoadState.inFlight) {
    approvalLoadState.queued = true;
    return;
  }

  approvalLoadState.inFlight = true;
  approvalLoadState.queued = false;
  var requestId = ++approvalLoadState.requestId;

  if (!approvalLoadState.hasLoaded) renderApprovalLoadingState();
  else setApprovalRefreshing(true);

  selectedApprovalIds.clear();
  if (!approvalModeLoaded) loadUploadBuktiMode();

  // Gunakan jalur data yang sama dengan menu Transaksi. Jangan memakai
  // approvalOnly karena daftar Approval cukup diturunkan dari transaksi
  // pengeluaran yang berhasil diterima oleh getTransactions.
  var filters = { kategori: 'PENGELUARAN' };
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;

  clearApprovalWatchdog();
  approvalLoadState.watchdog = setTimeout(function() {
    if (!approvalLoadState.inFlight || requestId !== approvalLoadState.requestId) return;
    approvalLoadState.requestId++;
    approvalLoadState.inFlight = false;
    setApprovalRefreshing(false);
    renderApprovalLoadError('Server terlalu lama merespons. Tekan Muat Ulang untuk mencoba kembali.');
    runQueuedApprovalReload();
  }, 15000);

  callApi('getTransactions', [filters], function(result) {
    if (requestId !== approvalLoadState.requestId) return;
    clearApprovalWatchdog();
    approvalLoadState.inFlight = false;
    setApprovalRefreshing(false);

    // Samakan kontrak pembacaan dengan loadTransactions(): endpoint dapat
    // mengembalikan array langsung atau objek pagination dengan properti data.
    var rows;
    if (Array.isArray(result)) rows = result;
    else if (result && Array.isArray(result.data)) rows = result.data;
    else {
      console.error('Data transaksi untuk Approval tidak valid:', result);
      renderApprovalLoadError('Format data transaksi tidak valid. Silakan muat ulang.');
      showToast('error', 'Gagal', 'Data Approval tidak dapat dibaca.');
      runQueuedApprovalReload();
      return;
    }

    allTransactions = rows
      .map(normalizeApprovalTransaction)
      .filter(function(tx) { return tx && isApprovalQueueTransaction(tx); });

    approvalLoadState.hasLoaded = true;
    populateApprovalFilters();
    filterApproval();
    runQueuedApprovalReload();
  }, function(err) {
    if (requestId !== approvalLoadState.requestId) return;
    clearApprovalWatchdog();
    approvalLoadState.inFlight = false;
    setApprovalRefreshing(false);
    var message = err && err.message ? err.message : 'Tidak dapat memuat data transaksi untuk Approval.';
    console.error('Gagal memuat transaksi untuk Approval:', err);
    renderApprovalLoadError(message);
    showToast('error', 'Gagal', message);
    runQueuedApprovalReload();
  });
}

'''

app = app[:start] + loader + app[end:]
app_path.write_text(app, encoding='utf-8')

index = index_path.read_text(encoding='utf-8')
index = index.replace('20260722-approval-loader-v7', '20260722-approval-transaction-loader-v8')
index_path.write_text(index, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace('sim-sppg-v20260722-approval-loader-v11', 'sim-sppg-v20260722-approval-transaction-v12')
sw_path.write_text(sw, encoding='utf-8')

worker = worker_path.read_text(encoding='utf-8')
worker = worker.replace('20260722-approval-loader-v12', '20260722-approval-transaction-v13')
worker_path.write_text(worker, encoding='utf-8')

row_test = row_test_path.read_text(encoding='utf-8')
row_test = row_test.replace('20260722-approval-loader-v7', '20260722-approval-transaction-loader-v8')
row_test = row_test.replace("sim-sppg-v20260722-approval-loader-v11", "sim-sppg-v20260722-approval-transaction-v12")
row_test = row_test.replace("worker.includes('20260722-approval-loader-v12')", "worker.includes('20260722-approval-transaction-v13')")
row_test = row_test.replace("requireMatch(app.includes(\"var filters = { kategori: 'PENGELUARAN', approvalOnly: true };\"), 'Approval loader must request only pending expense transactions');", "requireMatch(loaderBlock.includes(\"var filters = { kategori: 'PENGELUARAN' };\"), 'Approval loader must reuse the transaction request contract');")
row_test = row_test.replace("requireMatch(read.includes(\"const approvalOnly = filters.approvalOnly === true;\"), 'Approval backend must support approvalOnly');\nrequireMatch(read.includes(\".neq('Metode Transaksi', 'SUDAH_DIBAYAR')\"), 'Approval backend must exclude paid transactions before document enrichment');\n", "")
insert_after = "requireMatch(loaderBlock.includes('approvalLoadState.queued = true'), 'duplicate loads must be queued rather than started concurrently');\n"
extra = "requireMatch(!loaderBlock.includes('approvalOnly'), 'Approval loader must not depend on the special approvalOnly backend filter');\nrequireMatch(loaderBlock.includes('if (Array.isArray(result)) rows = result;'), 'Approval loader must accept the same direct-array response as Transactions');\nrequireMatch(loaderBlock.includes('result && Array.isArray(result.data)'), 'Approval loader must accept the same paged data response as Transactions');\nrequireMatch(loaderBlock.includes('isApprovalQueueTransaction(tx)'), 'Approval pending status must be filtered locally');\n"
if extra not in row_test:
    row_test = row_test.replace(insert_after, insert_after + extra)
row_test_path.write_text(row_test, encoding='utf-8')

verifier_test = verifier_test_path.read_text(encoding='utf-8')
verifier_test = verifier_test.replace('20260722-approval-loader-v7', '20260722-approval-transaction-loader-v8')
verifier_test = verifier_test.replace('sim-sppg-v20260722-approval-loader-v11', 'sim-sppg-v20260722-approval-transaction-v12')
verifier_test_path.write_text(verifier_test, encoding='utf-8')

# Trigger marker: 2026-07-22 transaction-loader adaptation
print('Approval now reuses the proven Transactions data-loading contract.')
