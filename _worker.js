/* SIM-SPPG Cloudflare Pages runtime compatibility layer. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    if (!response || !response.ok || request.method !== 'GET') return response;

    if (url.pathname.endsWith('/app.js')) {
      let source = await response.text();
      source = source
        .replace('function installReportCenter() {', 'function installLegacyReportCenterDisabled() {')
        .replace('    installReportCenter();', '    /* Legacy raw-table report center disabled. professional-report-v1.js owns menu Laporan. */');

      const runtimeState = [
        "if (typeof currentTrxId === 'undefined') var currentTrxId = null;",
        "if (typeof pendingConfirmNominal === 'undefined') var pendingConfirmNominal = 0;",
        ''
      ].join('\n');

      const approvalRuntime = String.raw`

/* Cloudflare canonical Approval loader v16.
 * Uses the same getTransactions contract as the Transaksi page and renders once.
 */
var approvalDirectLoading = false;
loadApprovalData = function () {
  if (!currentUser || approvalDirectLoading) return;
  approvalDirectLoading = true;

  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  var pagination = $('approvalPagination');
  var loadingHtml = '<div class="empty-state approval-direct-loading"><div class="empty-illustration"><i class="fas fa-spinner fa-spin"></i></div><h4>Memuat Transaksi</h4><p>Mengambil data transaksi pengeluaran...</p></div>';
  if (tbody) tbody.innerHTML = '<tr><td colspan="8">' + loadingHtml + '</td></tr>';
  if (mobileList) mobileList.innerHTML = loadingHtml;
  if (pagination) pagination.innerHTML = '';

  var filters = { kategori: 'PENGELUARAN' };
  if (globalDateFilter && globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter && globalDateFilter.end) filters.dateEnd = globalDateFilter.end;

  var settled = false;
  var timeoutId = setTimeout(function () {
    if (settled) return;
    settled = true;
    approvalDirectLoading = false;
    renderApprovalLoadError('Server terlalu lama merespons. Tekan Muat Ulang untuk mencoba kembali.');
  }, 20000);

  callApi('getTransactions', [filters], function (result) {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    approvalDirectLoading = false;

    try {
      var rows;
      if (Array.isArray(result)) rows = result;
      else if (result && Array.isArray(result.data)) rows = result.data;
      else throw new Error('Format respons transaksi tidak dikenali.');

      allTransactions = rows.map(function (row) {
        try {
          return typeof normalizeApprovalTransaction === 'function'
            ? normalizeApprovalTransaction(row)
            : row;
        } catch (normalizeError) {
          console.warn('Normalisasi transaksi Approval dilewati:', normalizeError, row);
          return row;
        }
      }).filter(function (tx) {
        if (!tx) return false;
        var kategori = String(tx.kategori || tx.Kategori || '').trim().toUpperCase();
        var status = String(tx.metodeTransaksi || tx['Metode Transaksi'] || '').trim().toUpperCase().replace(/\s+/g, '_');
        return kategori === 'PENGELUARAN' && status !== 'SUDAH_DIBAYAR' && status !== 'LUNAS';
      });

      filteredApprovalData = allTransactions.slice();
      selectedApprovalIds.clear();
      approvalPage = 1;

      if (typeof populateApprovalFilters === 'function') populateApprovalFilters();
      if (typeof filterApproval === 'function') filterApproval();
      else if (typeof renderApprovalTable === 'function') renderApprovalTable();

      if (tbody && tbody.querySelector('.approval-direct-loading')) {
        throw new Error('Renderer Approval tidak mengganti tampilan loading.');
      }
    } catch (renderError) {
      console.error('Approval render failure:', renderError, result);
      renderApprovalLoadError(renderError && renderError.message ? renderError.message : 'Data Approval gagal ditampilkan.');
      showToast('error', 'Gagal', 'Data diterima tetapi gagal ditampilkan: ' + (renderError.message || 'error tidak diketahui'));
    }
  }, function (error) {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    approvalDirectLoading = false;
    var message = error && error.message ? error.message : 'Tidak dapat memuat transaksi.';
    console.error('Approval request failure:', error);
    renderApprovalLoadError(message);
    showToast('error', 'Gagal', message);
  });
};
`;

      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/javascript; charset=UTF-8');
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(runtimeState + source + approvalRuntime, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
      let html = await response.text();
      const version = '20260722-approval-direct-render-v16';
      const scripts = [
        `<script src="./app.js?v=${version}"></script>`,
        `<script src="./yayasan-dropdown-hotfix.js?v=${version}"></script>`,
        `<script src="./sidebar-menu-structure.js?v=${version}"></script>`,
        `<script src="./professional-report-v1.js?v=${version}"></script>`
      ].join('\n');

      html = html.replace(
        /(?:<script\s+src=["']\.\/uiux-fixes\.js[^>]*><\/script>\s*)?<script\s+src=["']\.\/app\.js[^>]*><\/script>(?:\s*<script\s+src=["']\.\/approval-transaction-loader\.js[^>]*><\/script>)?(?:\s*<script\s+src=["']\.\/approval-flow-hotfix\.js[^>]*><\/script>)?(?:\s*<script\s+src=["']\.\/yayasan-dropdown-hotfix\.js[^>]*><\/script>)?(?:\s*<script\s+src=["']\.\/sidebar-menu-structure\.js[^>]*><\/script>)?(?:\s*<script\s+src=["']\.\/professional-report-v1\.js[^>]*><\/script>)?(?:\s*<script\s+src=["']\.\/report-export-bridge\.js[^>]*><\/script>)?/i,
        scripts
      );

      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    if (
      url.pathname.endsWith('/yayasan-dropdown-hotfix.js') ||
      url.pathname.endsWith('/sidebar-menu-structure.js') ||
      url.pathname.endsWith('/professional-report-v1.js')
    ) {
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return response;
  }
};
