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

      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/javascript; charset=UTF-8');
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(runtimeState + source, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
      let html = await response.text();
      const version = '20260724-approval-runtime-prune-v2';
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

      const approvalCleanup = `
<style data-approval-missing-doc-cleanup>
#modalDetail.approval-detail-mode #detailBody > div:has(.detail-doc-item.doc-missing .fa-times),
#modalDetail.approval-detail-mode #detailBody > div:has(.detail-doc-item.doc-missing svg[data-icon="xmark"]),
#modalDetail.approval-detail-mode #detailBody > div:has(.detail-doc-item.doc-missing svg[data-icon="times"]) {
  display: none !important;
}
</style>
<script data-approval-missing-doc-cleanup>
(function () {
  function isMissingDocumentCard(card) {
    if (!card || !card.classList || !card.classList.contains('doc-missing')) return false;
    var text = String(card.textContent || '').toLowerCase();
    return text.indexOf('belum diupload') !== -1 ||
      !!card.querySelector('.fa-times, svg[data-icon="xmark"], svg[data-icon="times"]');
  }

  function removeMissingApprovalDocuments() {
    var modal = document.getElementById('modalDetail');
    if (!modal || !modal.classList.contains('approval-detail-mode')) return;
    var body = document.getElementById('detailBody');
    if (!body) return;

    Array.prototype.slice.call(body.querySelectorAll('.detail-doc-item.doc-missing')).forEach(function (card) {
      if (!isMissingDocumentCard(card)) return;
      var wrapper = card.parentElement;
      if (wrapper && wrapper.parentElement === body) wrapper.remove();
      else card.remove();
    });
  }

  var queued = false;
  function scheduleCleanup() {
    if (queued) return;
    queued = true;
    var run = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); };
    run(function () {
      queued = false;
      removeMissingApprovalDocuments();
    });
  }

  function startObserver() {
    if (!document.body) return;
    new MutationObserver(scheduleCleanup).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
    scheduleCleanup();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
  document.addEventListener('click', scheduleCleanup, true);
})();
</script>`;

      if (!html.includes('data-approval-missing-doc-cleanup')) {
        html = html.replace('</body>', approvalCleanup + '\n</body>');
      }

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