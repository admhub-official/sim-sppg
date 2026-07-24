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
      const version = '20260724-approval-responsive-compact-v4';
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

/* Compact responsive layout for Detail Approval on tablets and phones. */
@media (max-width: 1024px) {
  #modalDetail.approval-detail-mode:not(.hidden) {
    z-index: 120000 !important;
  }

  #modalDetail.approval-detail-mode:not(.hidden) > .modal-overlay {
    z-index: 120000 !important;
    padding: 12px !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(15, 23, 42, 0.56) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  #modalDetail.approval-detail-mode:not(.hidden) .modal-box {
    width: min(94vw, 900px) !important;
    max-width: 900px !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: calc(100dvh - 24px) !important;
    margin: 0 !important;
    border-radius: 18px !important;
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
    translate: none !important;
    animation: none !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  #modalDetail.approval-detail-mode .modal-header.detail-modal-header {
    position: sticky !important;
    top: 0 !important;
    z-index: 8 !important;
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: flex-start !important;
    gap: 12px !important;
    min-height: 0 !important;
    padding: 14px 16px !important;
    overflow: visible !important;
    background: rgba(255, 255, 255, 0.99) !important;
    border-bottom: 1px solid #e2e8f0 !important;
    border-radius: 18px 18px 0 0 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-title-wrap {
    display: block !important;
    flex: 1 1 auto !important;
    flex-basis: auto !important;
    min-width: 0 !important;
    padding-right: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-title-wrap h3 {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    margin: 0 !important;
    color: #1e293b !important;
    font-size: 17px !important;
    line-height: 1.25 !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-title-wrap p {
    display: block !important;
    margin: 4px 0 0 !important;
    color: #64748b !important;
    font-size: 11px !important;
    line-height: 1.35 !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-header-actions {
    width: auto !important;
    order: initial !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    flex: 0 0 auto !important;
  }

  #modalDetail.approval-detail-mode .detail-context-actions {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 8px !important;
  }

  #modalDetail.approval-detail-mode .detail-context-actions .btn {
    width: auto !important;
    min-width: 112px !important;
    max-width: 160px !important;
    min-height: 38px !important;
    height: 38px !important;
    padding: 0 14px !important;
    justify-content: center !important;
    border-radius: 9px !important;
    font-size: 12px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-header-actions .modal-close {
    position: static !important;
    inset: auto !important;
    width: 38px !important;
    min-width: 38px !important;
    height: 38px !important;
    min-height: 38px !important;
    border-radius: 10px !important;
    background: #f1f5f9 !important;
    color: #475569 !important;
    z-index: 10 !important;
  }

  #modalDetail.approval-detail-mode .modal-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    padding: 14px 16px calc(16px + var(--safe-bottom)) !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior: contain !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-hero {
    margin-bottom: 14px !important;
    padding: 14px 16px !important;
    gap: 12px !important;
    border-radius: 14px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-icon {
    width: 46px !important;
    height: 46px !important;
    border-radius: 12px !important;
    font-size: 18px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-summary h4 {
    font-size: 16px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-nominal {
    min-width: 130px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-nominal strong {
    font-size: 17px !important;
  }

  #modalDetail.approval-detail-mode .info-card {
    padding: 12px 14px !important;
    margin-bottom: 14px !important;
    border-radius: 12px !important;
  }

  #modalDetail.approval-detail-mode .info-card .info-row {
    padding: 7px 0 !important;
  }
}

/* Phone layout: full-height modal with a compact two-row header. */
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
    display: flex !important;
    align-items: stretch !important;
    justify-content: stretch !important;
    padding: 0 !important;
    opacity: 1 !important;
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
    border-radius: 0 !important;
    padding-top: var(--safe-top) !important;
    background: #fff !important;
  }

  #modalDetail.approval-detail-mode .modal-header.detail-modal-header {
    position: sticky !important;
    top: 0 !important;
    display: block !important;
    padding: 12px calc(12px + var(--safe-right)) 11px calc(14px + var(--safe-left)) !important;
    border-radius: 0 !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-title-wrap {
    min-height: 38px !important;
    padding-right: 46px !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-title-wrap h3 {
    font-size: 16px !important;
    line-height: 1.2 !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-title-wrap p {
    margin-top: 3px !important;
    font-size: 10.5px !important;
    line-height: 1.3 !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-header-actions {
    width: 100% !important;
    margin-top: 9px !important;
    display: flex !important;
    justify-content: flex-end !important;
  }

  #modalDetail.approval-detail-mode .detail-context-actions {
    flex: 0 1 auto !important;
    width: auto !important;
    margin-right: 0 !important;
  }

  #modalDetail.approval-detail-mode .detail-context-actions .btn {
    min-width: 108px !important;
    max-width: 138px !important;
    width: auto !important;
    height: 36px !important;
    min-height: 36px !important;
    padding: 0 13px !important;
    border-radius: 9px !important;
    font-size: 11.5px !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-header-actions .modal-close {
    position: absolute !important;
    top: 11px !important;
    right: calc(11px + var(--safe-right)) !important;
    width: 36px !important;
    min-width: 36px !important;
    height: 36px !important;
    min-height: 36px !important;
    border-radius: 9px !important;
  }

  #modalDetail.approval-detail-mode .modal-body {
    padding: 11px 12px calc(14px + var(--safe-bottom)) !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-hero {
    grid-template-columns: 42px minmax(0, 1fr) !important;
    margin-bottom: 12px !important;
    padding: 12px !important;
    gap: 10px !important;
    border-radius: 13px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-icon {
    width: 42px !important;
    height: 42px !important;
    border-radius: 11px !important;
    font-size: 16px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-eyebrow {
    font-size: 9px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-summary h4 {
    font-size: 15px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-summary p {
    margin: 3px 0 7px !important;
    font-size: 10px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-badges {
    gap: 5px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-badges .badge {
    padding: 4px 8px !important;
    font-size: 10px !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-nominal {
    grid-column: 1 / -1 !important;
    min-width: 0 !important;
    padding-top: 10px !important;
    text-align: left !important;
  }

  #modalDetail.approval-detail-mode .approval-detail-nominal strong {
    font-size: 17px !important;
  }

  #modalDetail.approval-detail-mode .detail-section-title {
    margin-bottom: 8px !important;
    padding-bottom: 6px !important;
    font-size: 10px !important;
  }

  #modalDetail.approval-detail-mode .info-card {
    padding: 10px 12px !important;
    margin-bottom: 12px !important;
  }

  #modalDetail.approval-detail-mode .info-card .info-row {
    gap: 10px !important;
    padding: 7px 0 !important;
  }

  #modalDetail.approval-detail-mode .info-card .info-label {
    font-size: 11px !important;
  }

  #modalDetail.approval-detail-mode .info-card .info-value {
    font-size: 12px !important;
  }
}

@media (max-width: 380px) {
  #modalDetail.approval-detail-mode .detail-modal-title-wrap p {
    display: none !important;
  }

  #modalDetail.approval-detail-mode .detail-context-actions .btn {
    min-width: 102px !important;
    height: 34px !important;
    min-height: 34px !important;
    font-size: 11px !important;
  }

  #modalDetail.approval-detail-mode .detail-modal-header-actions .modal-close {
    top: 9px !important;
    right: calc(9px + var(--safe-right)) !important;
    width: 34px !important;
    min-width: 34px !important;
    height: 34px !important;
    min-height: 34px !important;
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
    if (!window.matchMedia || !window.matchMedia('(max-width: 1024px)').matches) return;
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