from pathlib import Path

app_path = Path('app.js')
worker_path = Path('_worker.js')
sw_path = Path('sw.js')
row_test_path = Path('scripts/check-approval-row-detail.mjs')
verifier_test_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
start = app.index('function setApprovalRefreshing(refreshing) {')
end = app.index('function renderApprovalTable()', start)
canonical = r'''function setApprovalRefreshing(refreshing) {
  var page = $('page-approval');
  if (page) page.classList.toggle('approval-refreshing', !!refreshing);
}

function clearApprovalWatchdog() {
  if (approvalLoadState.watchdog) {
    clearTimeout(approvalLoadState.watchdog);
    approvalLoadState.watchdog = null;
  }
}

function loadApprovalData() {
  if (!currentUser || approvalLoadState.inFlight) return;

  approvalLoadState.inFlight = true;
  approvalLoadState.queued = false;
  var requestId = ++approvalLoadState.requestId;

  selectedApprovalIds.clear();
  if (!approvalLoadState.hasLoaded) renderApprovalLoadingState();
  else setApprovalRefreshing(true);

  var filters = { kategori: 'PENGELUARAN' };
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;

  clearApprovalWatchdog();
  approvalLoadState.watchdog = setTimeout(function() {
    if (!approvalLoadState.inFlight || requestId !== approvalLoadState.requestId) return;
    approvalLoadState.requestId++;
    approvalLoadState.inFlight = false;
    approvalLoadState.queued = false;
    setApprovalRefreshing(false);
    renderApprovalLoadError('Server terlalu lama merespons. Tekan Muat Ulang untuk mencoba kembali.');
  }, 20000);

  callApi('getTransactions', [filters], function(result) {
    if (requestId !== approvalLoadState.requestId) return;
    clearApprovalWatchdog();
    approvalLoadState.inFlight = false;
    approvalLoadState.queued = false;
    setApprovalRefreshing(false);

    try {
      var normalizedResponse = normalizeApprovalApiResponse(result);
      if (!normalizedResponse.valid) throw new Error('Format respons transaksi tidak dikenali.');

      allTransactions = normalizedResponse.rows
        .map(normalizeApprovalTransaction)
        .filter(function(tx) { return tx && isApprovalQueueTransaction(tx); });

      approvalLoadState.hasLoaded = true;
      approvalPage = 1;
      populateApprovalFilters();
      filterApproval();
    } catch (renderError) {
      console.error('Approval render failure:', renderError, result);
      renderApprovalLoadError(renderError && renderError.message ? renderError.message : 'Data Approval gagal ditampilkan.');
      showToast('error', 'Gagal', 'Data diterima tetapi gagal ditampilkan.');
    }
  }, function(err) {
    if (requestId !== approvalLoadState.requestId) return;
    clearApprovalWatchdog();
    approvalLoadState.inFlight = false;
    approvalLoadState.queued = false;
    setApprovalRefreshing(false);
    var message = err && err.message ? err.message : 'Tidak dapat memuat data Approval.';
    console.error('Gagal memuat Approval:', err);
    renderApprovalLoadError(message);
    showToast('error', 'Gagal', message);
  });
}

'''
app = app[:start] + canonical + app[end:]
app_path.write_text(app, encoding='utf-8')

worker = worker_path.read_text(encoding='utf-8')
start_rt = worker.find('      const approvalRuntime = String.raw`')
if start_rt >= 0:
    end_rt = worker.find('`;\n', start_rt)
    if end_rt < 0:
        raise SystemExit('approvalRuntime end not found')
    worker = worker[:start_rt] + worker[end_rt + 3:]
worker = worker.replace('return new Response(runtimeState + source + approvalRuntime, {', 'return new Response(runtimeState + source, {')
worker = worker.replace('20260722-approval-direct-render-v16', '20260722-approval-canonical-source-v17')
worker_path.write_text(worker, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8').replace('sim-sppg-v20260722-approval-direct-render-v15', 'sim-sppg-v20260722-approval-canonical-source-v16')
sw_path.write_text(sw, encoding='utf-8')

row_test = row_test_path.read_text(encoding='utf-8')
old_start = row_test.index("requireMatch(worker.includes('Cloudflare canonical Approval loader v16')")
old_end = row_test.index("if (!process.exitCode)", old_start)
new_checks = r'''requireMatch(app.includes("var filters = { kategori: 'PENGELUARAN' };"), 'canonical Approval loader must use Transactions query contract');
requireMatch(!app.includes("var filters = { kategori: 'PENGELUARAN', approvalOnly: true };"), 'legacy approvalOnly loader must be removed');
requireMatch(!app.includes('function runQueuedApprovalReload()'), 'queued Approval reload helper must be removed');
requireMatch(app.includes('if (!currentUser || approvalLoadState.inFlight) return;'), 'duplicate Approval loads must be ignored');
requireMatch(app.includes('var normalizedResponse = normalizeApprovalApiResponse(result);'), 'canonical loader must normalize backend response');
requireMatch(app.includes("console.error('Approval render failure:'"), 'canonical loader must expose render errors');
requireMatch((app.match(/function loadApprovalData\(\)/g) || []).length === 1, 'Approval loader must exist exactly once in source');
requireMatch(!worker.includes('approvalRuntime'), 'Cloudflare worker must not inject a second Approval loader');
requireMatch(worker.includes('20260722-approval-canonical-source-v17'), 'Cloudflare runtime cache key must be current');
requireMatch(sw.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-canonical-source-v16';"), 'service worker must invalidate previous Approval bundles');

'''
row_test = row_test[:old_start] + new_checks + row_test[old_end:]
row_test_path.write_text(row_test, encoding='utf-8')

verifier = verifier_test_path.read_text(encoding='utf-8')
verifier = verifier.replace("sim-sppg-v20260722-approval-direct-render-v15", "sim-sppg-v20260722-approval-canonical-source-v16")
verifier = verifier.replace("requireMatch(!worker.includes('approvalRuntime'), 'Cloudflare worker must not inject a second Approval loader');\n", "")
verifier_test_path.write_text(verifier, encoding='utf-8')

print('Canonical Approval loader applied to app.js; Cloudflare duplicate removed.')
# trigger
