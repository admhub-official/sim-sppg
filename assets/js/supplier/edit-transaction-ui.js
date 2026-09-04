(function () {
  'use strict';

  function fire(element, type) {
    if (!element) return;
    element.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function refreshEditTransactionForm() {
    var category = document.getElementById('editTxKategori');
    var jenis = document.getElementById('editTxJenisKat');
    var metode = document.getElementById('editTxMetode');
    var supplier = document.getElementById('editTxSupplier');

    fire(category, 'change');
    fire(jenis, 'input');
    fire(jenis, 'change');
    fire(metode, 'change');
    fire(supplier, 'input');

    if (typeof window.handleTransactionSupplierInput === 'function') {
      window.handleTransactionSupplierInput('edit');
    }
    if (typeof window.updateEditTxSupplierVisibility === 'function') {
      window.updateEditTxSupplierVisibility();
    }

    var bankFields = document.getElementById('editTxManualBankFields');
    var holderField = document.getElementById('editTxManualAccountHolderField');
    if (bankFields) bankFields.style.display = 'none';
    if (holderField) holderField.style.display = 'none';
  }

  // Modal lifecycle is owned by edit-supplier-options-fix.js. Keep this module
  // focused on one responsibility so window.openModal is not wrapped twice.
  window.refreshEditTransactionForm = refreshEditTransactionForm;
})();