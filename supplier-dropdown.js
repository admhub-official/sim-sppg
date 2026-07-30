(function () {
  'use strict';

  function removeDuplicateSupplierCreateRow() {
    ['addTxSupplierSection', 'editTxSupplierSection'].forEach(function (sectionId) {
      var section = document.getElementById(sectionId);
      if (!section) return;
      Array.prototype.forEach.call(
        section.querySelectorAll('button,a,[role="option"],.dropdown-item,.autocomplete-item'),
        function (node) {
          if (node.classList.contains('app-create-supplier') || node.closest('.app-create-supplier')) return;
          var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
          if (text === '+ Tambah Supplier Baru') node.remove();
        }
      );
    });
  }

  if (!document.querySelector('script[data-app-dropdowns="1"]')) {
    var script = document.createElement('script');
    script.src = './app-dropdowns.js?v=20260730-form-controls-v3';
    script.defer = true;
    script.dataset.appDropdowns = '1';
    script.addEventListener('load', removeDuplicateSupplierCreateRow);
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeDuplicateSupplierCreateRow);
  } else {
    removeDuplicateSupplierCreateRow();
  }

  new MutationObserver(removeDuplicateSupplierCreateRow).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();