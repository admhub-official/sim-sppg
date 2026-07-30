(function () {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .replace(/[＋+]/g, '+')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function removeLegacySupplierCreateControls(root) {
    root = root || document;

    Array.prototype.forEach.call(
      root.querySelectorAll ? root.querySelectorAll('[data-inline-create-supplier="1"]') : [],
      function (node) { node.remove(); }
    );

    Array.prototype.forEach.call(
      root.querySelectorAll ? root.querySelectorAll('option[value="__CREATE_NEW_SUPPLIER__"]') : [],
      function (node) { node.remove(); }
    );

    ['addTxSupplierSection', 'editTxSupplierSection'].forEach(function (sectionId) {
      var section = document.getElementById(sectionId);
      if (!section) return;

      Array.prototype.forEach.call(
        section.querySelectorAll('button,a,[role="option"],.dropdown-item,.autocomplete-item'),
        function (node) {
          if (node.classList.contains('app-create-supplier') || node.closest('.app-create-supplier')) return;
          var text = normalizeText(node.textContent);
          if (text === '+ tambah supplier baru' || text === 'tambah supplier baru') node.remove();
        }
      );
    });
  }

  if (!document.querySelector('script[data-app-dropdowns="1"]')) {
    var script = document.createElement('script');
    script.src = './app-dropdowns.js?v=20260730-form-controls-v4';
    script.defer = true;
    script.dataset.appDropdowns = '1';
    script.addEventListener('load', function () { removeLegacySupplierCreateControls(document); });
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { removeLegacySupplierCreateControls(document); });
  } else {
    removeLegacySupplierCreateControls(document);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes, function (node) {
        if (node.nodeType !== 1) return;
        removeLegacySupplierCreateControls(node);
      });
    });
    removeLegacySupplierCreateControls(document);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();