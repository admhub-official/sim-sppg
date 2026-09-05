(function () {
  'use strict';

  function localDateValue(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function fixReportDefaults(root) {
    var scope = root && root.querySelector ? root : document;
    var start = scope.querySelector('#reportUnifiedStart') || document.getElementById('reportUnifiedStart');
    var end = scope.querySelector('#reportUnifiedEnd') || document.getElementById('reportUnifiedEnd');
    if (!start || !end || start.dataset.localDateFixed === '1') return;

    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    start.value = localDateValue(first);
    end.value = localDateValue(now);
    start.dataset.localDateFixed = '1';
    end.dataset.localDateFixed = '1';
  }

  function scan(node) {
    fixReportDefaults(node || document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(document); });
  else scan(document);

  new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      var nodes = mutations[i].addedNodes || [];
      for (var j = 0; j < nodes.length; j += 1) {
        if (nodes[j].nodeType === 1) scan(nodes[j]);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
