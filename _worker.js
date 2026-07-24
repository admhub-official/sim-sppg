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
      const version = '20260724-approval-mobile-modal-v3';
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

/* Android WebView/PWA safeguard: the mobile modal previously depended on a
   translateY animation. Some devices rendered the blurred overlay while the
   modal box remained off-screen. Keep this override scoped to Detail Approval. */
@media (max-width: 639px) {
  #modalDetail.approval-detail-mode:not(.hidden) {
    position: fixed !important;
    inset: 0 !important;
    z-index: 120000 !important;
    display: block !important;
  }

  #modalDetail.approval-detail-mode:not(.hidden) > .modal-overlay {
    position: fixed !important;
    inset: 0 !important;
    z-index: 120000 !important;
    display: flex !important;
    align-items: stretch !important;
    justify-content: stretch !important;
    padding: 0 !important;
    opacity: 1 !important;
    background: rgba(15, 23, 42, 0.58) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    animation: none !important;
  }

  #modalDetail.approval-detail-mode:not(.hidden) .modal-box {
    position: relative !important;
    inset: auto !important;
    width: 100% !important;
    max-width: none !important;
    height: 100dvh !important;
    min-height: 100dvh !important;
    max-height: 100dvh !important;
    margin: 0 !important;
    border-radius: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
    translate: none !important;
    animation: none !important;
    will-change: auto !important;
    display: flex !important;
    flex-direction: column !important;
    background: #fff !important;
    overflow: hidden !important;
  }

  #modalDetail.approval-detail-mode:not(.hidden) .modal-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior: contain !important;
  }
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

  function ensureMobileApprovalModalVisible() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 639px)').matches) return;
    var modal = document.getElementById('modalDetail');
    if (!modal || modal.classList.contains('hidden') || !modal.classList.contains('approval-detail-mode')) return;
    var overlay = modal.querySelector('.modal-overlay');
    var box = modal.querySelector('.modal-box');
    if (overlay) {
      overlay.style.opacity = '1';
      overlay.style.animation = 'none';
      overlay.style.webkitBackdropFilter = 'none';
      overlay.style.backdropFilter = 'none';
    }
    if (box) {
      box.style.transform = 'none';
      box.style.animation = 'none';
      box.style.opacity = '1';
      box.style.visibility = 'visible';
    }
  }

  var queued = false;
  function scheduleCleanup() {
    if (queued) return;
    queued = true;
    var run = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); };
    run(function () {
      queued = false;
      removeMissingApprovalDocuments();
      ensureMobileApprovalModalVisible();
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
  window.addEventListener('orientationchange', scheduleCleanup);
  window.addEventListener('resize', scheduleCleanup);
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