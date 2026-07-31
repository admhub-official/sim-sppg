(function () {
  'use strict';

  var installed = false;

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

  function install() {
    if (installed || typeof window.openModal !== 'function') return false;
    installed = true;
    var originalOpenModal = window.openModal;
    window.openModal = function (id) {
      var result = originalOpenModal.apply(this, arguments);
      if (id === 'modalEditTransaksi') {
        setTimeout(refreshEditTransactionForm, 0);
        setTimeout(refreshEditTransactionForm, 80);
      }
      return result;
    };
    return true;
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 40) clearInterval(timer);
    }, 100);
  }

  window.refreshEditTransactionForm = refreshEditTransactionForm;
})();