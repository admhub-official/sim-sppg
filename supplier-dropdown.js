(function () {
  'use strict';

  var MODULE_BASE = './assets/js/supplier/';
  var REPORT_BASE = './assets/js/reports/';
  var TRANSACTION_BASE = './assets/js/transactions/';

  function loadScriptSequential(list, index) {
    if (index >= list.length) return;

    var item = list[index];
    if (document.querySelector('script[' + item.marker + '="1"]')) {
      loadScriptSequential(list, index + 1);
      return;
    }

    var script = document.createElement('script');
    script.src = item.base + item.file + '?v=' + item.version;
    script.async = false;
    script.setAttribute(item.marker, '1');
    script.onload = function () {
      loadScriptSequential(list, index + 1);
    };
    script.onerror = function () {
      console.error('Gagal memuat modul wajib:', item.file);
      loadScriptSequential(list, index + 1);
    };
    document.head.appendChild(script);
  }

  loadScriptSequential([
    { base: MODULE_BASE, file: 'stage-d-api-router.js', marker: 'data-stage-d-api-router', version: '20260731-edit-route-v2' },
    { base: TRANSACTION_BASE, file: 'add-save-reliability.js', marker: 'data-add-save-reliability', version: '20260731-create-route-v1' },
    { base: TRANSACTION_BASE, file: 'edit-supplier-options-fix.js', marker: 'data-edit-supplier-options-fix', version: '20260731-supplier-modal-v2' },
    { base: MODULE_BASE, file: 'app-dropdowns.js', marker: 'data-app-dropdowns', version: '20260730-stability-fix-v1' },
    { base: MODULE_BASE, file: 'transaction-add-supplier-fix.js', marker: 'data-transaction-add-supplier-fix', version: '20260731-modal-return-v1' },
    { base: MODULE_BASE, file: 'edit-transaction-ui.js', marker: 'data-edit-transaction-ui', version: '20260730-edit-form-v1' },
    { base: MODULE_BASE, file: 'supplier-actions-fix.js', marker: 'data-supplier-actions-fix', version: '20260730-supplier-actions-v1' },
    { base: TRANSACTION_BASE, file: 'filter-and-edit-supplier.js', marker: 'data-transaction-filter-supplier', version: '20260731-filter-only-v3' },
    { base: TRANSACTION_BASE, file: 'edit-save-reliability.js', marker: 'data-edit-save-reliability', version: '20260731-edit-save-v2' },
    { base: MODULE_BASE, file: 'storage-egress-optimizer.js', marker: 'data-storage-egress-optimizer', version: '20260730-stage-b-v1' },
    { base: REPORT_BASE, file: 'approval-export-columns.js', marker: 'data-approval-export-columns', version: '20260731-supplier-account-v2' },
    { base: REPORT_BASE, file: 'approval-supplier-summary.js', marker: 'data-approval-supplier-summary', version: '20260731-export-only-v2' },
    { base: TRANSACTION_BASE, file: 'supplier-label-update.js', marker: 'data-supplier-label-update', version: '20260731-label-an-trx-v1' }
  ], 0);
})();
