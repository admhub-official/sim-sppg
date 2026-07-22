from pathlib import Path
import re

app_path = Path('app.js')
index_path = Path('index.html')
sw_path = Path('sw.js')
approval_check_path = Path('scripts/check-approval-row-detail.mjs')
verifier_check_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
approval_check = approval_check_path.read_text(encoding='utf-8')
verifier_check = verifier_check_path.read_text(encoding='utf-8')

state_marker = "var filteredApprovalData = [];\nvar selectedApprovalIds = new Set();"
state_replacement = """var filteredApprovalData = [];
var selectedApprovalIds = new Set();
var approvalLoadState = {
  inFlight: false,
  queued: false,
  requestId: 0,
  watchdog: null,
  hasLoaded: false
};
var approvalModeLoaded = false;"""
if 'var approvalLoadState = {' not in app:
    if state_marker not in app:
        raise SystemExit('Approval state marker not found')
    app = app.replace(state_marker, state_replacement, 1)

new_loader = r'''function renderApprovalLoadingState() {
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton-screen approval-desktop-skeleton" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>'.repeat(5) +
      '</div></td></tr>';
  }
  if (mobileList) {
    mobileList.innerHTML = '<div class="approval-mobile-skeleton">' +
      '<div class="approval-card-skeleton"><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-40"></div></div>'.repeat(4) +
      '</div>';
  }
}

function setApprovalRefreshing(refreshing) {
  var page = $('page-approval');
  if (page) page.classList.toggle('approval-refreshing', !!refreshing);
}

function clearApprovalWatchdog() {
  if (approvalLoadState.watchdog) {
    clearTimeout(approvalLoadState.watchdog);
    approvalLoadState.watchdog = null;
  }
}

function runQueuedApprovalReload() {
  if (!approvalLoadState.queued) return;
  approvalLoadState.queued = false;
  setTimeout(function() { loadApprovalData(); }, 0);
}

function loadApprovalData() {
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

  var filters = { kategori: 'PENGELUARAN', approvalOnly: true };
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

  callApi('getTransactions', [filters], function(data) {
    if (requestId !== approvalLoadState.requestId) return;
    clearApprovalWatchdog();
    approvalLoadState.inFlight = false;
    setApprovalRefreshing(false);

    var normalizedResponse = normalizeApprovalApiResponse(data);
    if (!normalizedResponse.valid) {
      console.error('Kontrak respons Approval tidak dikenali:', data);
      renderApprovalLoadError('Format respons server tidak dikenali.');
      showToast('error', 'Gagal', 'Format data Approval tidak valid.');
      runQueuedApprovalReload();
      return;
    }

    allTransactions = normalizedResponse.rows
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
    var message = err && err.message ? err.message : 'Tidak dapat memuat data Approval.';
    console.error('Gagal memuat Approval:', err);
    renderApprovalLoadError(message);
    showToast('error', 'Gagal', message);
    runQueuedApprovalReload();
  });
}

'''
loader_pattern = re.compile(r'function loadApprovalData\(\) \{.*?\n\}\n\nfunction renderApprovalTable\(\)', re.S)
match = loader_pattern.search(app)
if not match:
    raise SystemExit('Approval loader block not found')
app = app[:match.start()] + new_loader + 'function renderApprovalTable()' + app[match.end():]

new_mode_loader = r'''function loadUploadBuktiMode() {
  if (approvalModeLoaded) {
    renderModeToggleUI();
    return;
  }
  callApi('getUploadBuktiMode', [], function(result) {
    approvalModeLoaded = true;
    uploadBuktiModeEnabled = !!(result && result.enabled);
    renderModeToggleUI();
    if (currentPage === 'approval' && approvalLoadState.hasLoaded && !approvalLoadState.inFlight) {
      renderApprovalTable();
    }
  }, function() {
    approvalModeLoaded = true;
    uploadBuktiModeEnabled = false;
    renderModeToggleUI();
  });
}
'''
mode_pattern = re.compile(r'function loadUploadBuktiMode\(\) \{.*?\n\}', re.S)
mode_match = mode_pattern.search(app)
if not mode_match:
    raise SystemExit('Upload mode loader block not found')
app = app[:mode_match.start()] + new_mode_loader.rstrip() + app[mode_match.end():]

style_marker = '<style id="approval-responsive-ui-v2">'
refresh_css = '''<style id="approval-loading-lifecycle-v3">
  #page-approval .approval-desktop-view,
  #page-approval .approval-mobile-view { transition: opacity .18s ease; }
  #page-approval.approval-refreshing .approval-desktop-view,
  #page-approval.approval-refreshing .approval-mobile-view { opacity: .58; pointer-events: none; }
  #page-approval .approval-load-error .btn { margin-top: 12px; }
</style>
'''
if 'id="approval-loading-lifecycle-v3"' not in index:
    if style_marker not in index:
        raise SystemExit('Approval responsive style marker not found')
    index = index.replace(style_marker, refresh_css + style_marker, 1)

index = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=20260722-approval-loader-v7', index)
sw = re.sub(r"const CACHE_VERSION = '[^']+';", "const CACHE_VERSION = 'sim-sppg-v20260722-approval-loader-v11';", sw, count=1)

approval_check = re.sub(r"sim-sppg-v20260722-[^']+", 'sim-sppg-v20260722-approval-loader-v11', approval_check)
approval_check = re.sub(r'app\\\.js\\\?v=20260722-[^<]+', r'app\\.js\\?v=20260722-approval-loader-v7', approval_check)
extra_checks = """
requireMatch(app.includes('var approvalLoadState = {'), 'Approval loader must track in-flight state');
requireMatch(app.includes('if (approvalLoadState.inFlight)'), 'Approval loader must block duplicate requests');
requireMatch(app.includes('Server terlalu lama merespons'), 'Approval loader must have a visible watchdog timeout');
requireMatch(!app.slice(app.indexOf('function loadApprovalData()'), app.indexOf('function renderApprovalTable()')).includes('showLoading(true)'), 'Approval list loading must not flash the global overlay');
requireMatch(app.includes('approvalLoadState.hasLoaded && !approvalLoadState.inFlight'), 'upload mode response must not render before Approval data is ready');
requireMatch(index.includes('id=\"approval-loading-lifecycle-v3\"'), 'Approval refresh lifecycle styles must exist');
"""
if 'Approval loader must track in-flight state' not in approval_check:
    approval_check = approval_check.replace("if (!process.exitCode) console.log('Approval responsive desktop/mobile UI check passed.');", extra_checks + "\nif (!process.exitCode) console.log('Approval responsive desktop/mobile UI check passed.');")

verifier_check = re.sub(r"sim-sppg-v20260722-[^']+", 'sim-sppg-v20260722-approval-loader-v11', verifier_check)
verifier_check = re.sub(r'app\\\.js\\\?v=20260722-[^<]+', r'app\\.js\\?v=20260722-approval-loader-v7', verifier_check)

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
approval_check_path.write_text(approval_check, encoding='utf-8')
verifier_check_path.write_text(verifier_check, encoding='utf-8')
