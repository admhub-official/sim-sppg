(function () {
  'use strict';

  var MODULE_BASE = './assets/js/supplier/';
  var REPORT_BASE = './assets/js/reports/';
  var TRANSACTION_BASE = './assets/js/transactions/';

  function loadScript(basePath, fileName, marker, version) {
    if (document.querySelector('script[' + marker + '="1"]')) return;

    var script = document.createElement('script');
    script.src = basePath + fileName + '?v=' + version;
    script.defer = true;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  loadScript(MODULE_BASE, 'stage-d-api-router.js', 'data-stage-d-api-router', '20260731-summary-dedupe-v1');
  loadScript(MODULE_BASE, 'app-dropdowns.js', 'data-app-dropdowns', '20260730-stability-fix-v1');
  loadScript(MODULE_BASE, 'edit-transaction-ui.js', 'data-edit-transaction-ui', '20260730-edit-form-v1');
  loadScript(MODULE_BASE, 'supplier-actions-fix.js', 'data-supplier-actions-fix', '20260730-supplier-actions-v1');
  loadScript(MODULE_BASE, 'storage-egress-optimizer.js', 'data-storage-egress-optimizer', '20260730-stage-b-v1');
  loadScript(TRANSACTION_BASE, 'filter-and-edit-supplier.js', 'data-transaction-filter-supplier', '20260731-filter-options-v2');
  loadScript(TRANSACTION_BASE, 'edit-supplier-options-fix.js', 'data-edit-supplier-options-fix', '20260731-supplier-modal-v1');
  loadScript(REPORT_BASE, 'approval-export-columns.js', 'data-approval-export-columns', '20260731-supplier-account-v1');
  loadScript(REPORT_BASE, 'approval-supplier-summary.js', 'data-approval-supplier-summary', '20260731-export-only-v1');
})();
