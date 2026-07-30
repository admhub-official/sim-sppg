(function () {
  'use strict';

  function loadScript(src, marker) {
    if (document.querySelector('script[' + marker + '="1"]')) return;
    var script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  loadScript('./stage-d-api-router.js?v=20260730-stage-d-v1', 'data-stage-d-api-router');
  loadScript('./app-dropdowns.js?v=20260730-stability-fix-v1', 'data-app-dropdowns');
  loadScript('./edit-transaction-ui.js?v=20260730-edit-form-v1', 'data-edit-transaction-ui');
  loadScript('./supplier-actions-fix.js?v=20260730-supplier-actions-v1', 'data-supplier-actions-fix');
  loadScript('./storage-egress-optimizer.js?v=20260730-stage-b-v1', 'data-storage-egress-optimizer');
})();