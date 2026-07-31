(function () {
  'use strict';

  var MODULE_BASE = './assets/js/supplier/';

  function loadScript(fileName, marker, version) {
    if (document.querySelector('script[' + marker + '="1"]')) return;

    var script = document.createElement('script');
    script.src = MODULE_BASE + fileName + '?v=' + version;
    script.defer = true;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  loadScript('stage-d-api-router.js', 'data-stage-d-api-router', '20260731-full-scope-kpi-v2');
  loadScript('app-dropdowns.js', 'data-app-dropdowns', '20260730-stability-fix-v1');
  loadScript('edit-transaction-ui.js', 'data-edit-transaction-ui', '20260730-edit-form-v1');
  loadScript('supplier-actions-fix.js', 'data-supplier-actions-fix', '20260730-supplier-actions-v1');
  loadScript('storage-egress-optimizer.js', 'data-storage-egress-optimizer', '20260730-stage-b-v1');
})();
