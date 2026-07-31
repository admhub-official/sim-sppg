(function () {
  'use strict';

  var returnContext = null;
  var saveHookInstalled = false;

  function $(id) { return document.getElementById(id); }

  function transactionModeFromButton(button) {
    var wrapper = button && button.closest('.app-supplier-combobox');
    if (!wrapper) return 'add';
    return wrapper.querySelector('#editTxSupplier') ? 'edit' : 'add';
  }

  function closeSupplierDropdown(button) {
    var menu = button && button.closest('.app-dropdown-menu');
    if (menu) menu.classList.add('hidden');
    var wrapper = button && button.closest('.app-supplier-combobox');
    var input = wrapper && wrapper.querySelector('input');
    if (input) input.setAttribute('aria-expanded', 'false');
  }

  function openSupplierModal(mode) {
    returnContext = { mode: mode || 'add' };

    if (typeof window.openAddSupplierModal === 'function') {
      window.openAddSupplierModal();
      return;
    }

    if (typeof window.openModal === 'function' && $('modalAddSupplier')) {
      window.openModal('modalAddSupplier');
      if (typeof window.initSupTtdCanvas === 'function') {
        setTimeout(function () { window.initSupTtdCanvas(); }, 120);
      }
      return;
    }

    var modal = $('modalAddSupplier');
    if (modal) modal.classList.remove('hidden');
  }

  function waitForSupplierSaved(name, attempts) {
    attempts = attempts || 0;
    var modal = $('modalAddSupplier');
    var modalClosed = !modal || modal.classList.contains('hidden');

    if (!modalClosed && attempts < 120) {
      setTimeout(function () { waitForSupplierSaved(name, attempts + 1); }, 100);
      return;
    }
    if (!modalClosed || !name || !returnContext) return;

    var refresh = typeof window.loadDropdownOptions === 'function'
      ? window.loadDropdownOptions()
      : Promise.resolve();

    Promise.resolve(refresh).then(function () {
      var mode = returnContext.mode || 'add';
      var input = $(mode === 'edit' ? 'editTxSupplier' : 'addTxSupplier');
      if (!input) return;
      input.value = name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof window.handleTransactionSupplierInput === 'function') {
        window.handleTransactionSupplierInput(mode);
      }
      returnContext = null;
    }).catch(function () {
      returnContext = null;
    });
  }

  function installSaveHook() {
    if (saveHookInstalled || typeof window.saveAddSupplier !== 'function') return false;
    var original = window.saveAddSupplier;
    if (original.__transactionSupplierReturnFix) {
      saveHookInstalled = true;
      return true;
    }

    window.saveAddSupplier = function () {
      var nameInput = $('addSupNama');
      var supplierName = nameInput ? String(nameInput.value || '').trim() : '';
      var result = original.apply(this, arguments);
      if (returnContext && supplierName) waitForSupplierSaved(supplierName, 0);
      return result;
    };
    window.saveAddSupplier.__transactionSupplierReturnFix = true;
    saveHookInstalled = true;
    return true;
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest
      ? event.target.closest('.app-supplier-combobox [data-create="1"]')
      : null;
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    var mode = transactionModeFromButton(button);
    closeSupplierDropdown(button);
    openSupplierModal(mode);
  }, true);

  if (!installSaveHook()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (installSaveHook() || attempts >= 100) clearInterval(timer);
    }, 100);
  }
})();
