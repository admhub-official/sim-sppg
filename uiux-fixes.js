/* SIM-SPPG UI/UX compatibility and transport hardening hooks.
 * API routing remains native in app.js. This file normalizes request
 * headers and restores required approval UI components defensively.
 */
(function(){
  'use strict';

  // app.js uses this identifier from the Approval V2 module but older bundles
  // did not declare it in the centralized state section.
  if (typeof window.currentTrxId === 'undefined') window.currentTrxId = null;

  function ensureVerificationModal() {
    if (document.getElementById('modalVerifikasiPembayaran')) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'modalVerifikasiPembayaran';
    wrapper.className = 'hidden';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');
    wrapper.setAttribute('aria-labelledby', 'verifikasiPembayaranTitle');
    wrapper.innerHTML =
      '<div class="modal-overlay" onclick="if(event.target===this)closeModal(\'modalVerifikasiPembayaran\')">' +
        '<div class="modal-box modal-wide">' +
          '<div class="modal-header">' +
            '<h3 id="verifikasiPembayaranTitle"><i class="fas fa-stamp" style="color:var(--emerald);margin-right:8px"></i>Verifikasi Pelunasan &amp; TTD</h3>' +
            '<button type="button" onclick="closeModal(\'modalVerifikasiPembayaran\')" class="modal-close" aria-label="Tutup"><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div class="modal-body" id="verifikasiBody"></div>' +
          '<div class="modal-footer">' +
            '<button type="button" onclick="closeModal(\'modalVerifikasiPembayaran\')" class="btn btn-outline">Batal</button>' +
            '<button type="button" onclick="submitVerifikasiPembayaran()" class="btn btn-primary" id="btnSubmitVerifikasiPembayaran"><i class="fas fa-signature"></i> Simpan TTD &amp; Verifikasi</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrapper);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureVerificationModal, { once: true });
  } else {
    ensureVerificationModal();
  }

  if (window.__simSppgFetchHardened || typeof window.fetch !== 'function') return;

  var nativeFetch = window.fetch.bind(window);
  var configuredBase = typeof window.API_BASE_URL === 'string' ? window.API_BASE_URL : '';
  var projectBase = configuredBase || 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';

  window.fetch = function(input, init) {
    var requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (!requestUrl || requestUrl.indexOf(projectBase) !== 0) {
      return nativeFetch(input, init);
    }

    var options = Object.assign({}, init || {});
    var inheritedHeaders = input && typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
    var headers = new Headers(options.headers || inheritedHeaders || {});
    var publishableKey = window._supabaseKey || '';
    var sessionToken = '';
    try { sessionToken = localStorage.getItem('sppg_jwt') || ''; } catch (_) {}
    var authorizationToken = sessionToken || publishableKey;

    if (authorizationToken && !headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer ' + authorizationToken);
    }
    if (publishableKey && !headers.has('apikey')) {
      headers.set('apikey', publishableKey);
    }

    options.headers = headers;
    return nativeFetch(input, options);
  };

  window.__simSppgFetchHardened = true;
})();