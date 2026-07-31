(function () {
  'use strict';

  var suppliers = [];
  var loading = null;
  var lastLoadedAt = 0;
  var CACHE_TTL = 60 * 1000;

  function byId(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function lower(value) { return text(value).toLocaleLowerCase('id-ID'); }
  function first(row, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = row && row[keys[i]];
      if (value !== undefined && value !== null && text(value)) return value;
    }
    return '';
  }
  function unwrapRows(result) {
    var current = result;
    for (var depth = 0; depth < 6; depth += 1) {
      if (Array.isArray(current)) return current;
      if (!current || typeof current !== 'object') return [];
      if (Array.isArray(current.data)) return current.data;
      if (Array.isArray(current.rows)) return current.rows;
      if (Array.isArray(current.suppliers)) return current.suppliers;
      if (Array.isArray(current.items)) return current.items;
      if (Object.prototype.hasOwnProperty.call(current, 'result')) {
        current = current.result;
        continue;
      }
      return [];
    }
    return [];
  }
  function normalize(row, index) {
    var name = text(first(row, [
      'nama', 'Nama', 'namaSupplier', 'supplierName', 'NAMA SUPPLIER',
      'Nama Supplier', 'Supplier', 'SUPPLIER', 'Supplier/Penjual', 'NAMA SUPPLIER/PENJUAL'
    ]));
    return {
      id: text(first(row, ['id', 'ID', 'supplierId', 'supplier_id', 'SUPPLIER ID'])) || ('supplier-' + index + '-' + lower(name).replace(/\s+/g, '-')),
      nama: name,
      sppg: text(first(row, ['sppg', 'SPPG', 'namaSppg', 'Nama SPPG', 'NAMA SPPG'])),
      yayasan: text(first(row, ['yayasan', 'YAYASAN', 'namaYayasan', 'Nama Yayasan'])),
      bank: text(first(row, ['bank', 'namaBank', 'NAMA BANK', 'Nama Bank', 'NAMA BANK SUPPLIER'])),
      noRekening: text(first(row, ['noRekening', 'nomorRekening', 'no_rekening', 'NO REKENING', 'Nomor Rekening', 'NAMA REKENING SUPPLIER'])),
      atasNama: text(first(row, ['atasNama', 'atasNamaRekening', 'atas_nama', 'ATAS NAMA REKENING', 'Atas Nama', 'ATAS NAMA REKENING SUPPLIER'])),
      status: text(first(row, ['status', 'STATUS', 'Status', 'statusSupplier', 'STATUS SUPPLIER'])) || 'Aktif',
      items: Array.isArray(row && row.items) ? row.items : []
    };
  }
  function dedupe(list) {
    var seen = Object.create(null);
    return list.filter(function (supplier) {
      var key = lower(supplier.id || supplier.nama + '|' + supplier.sppg);
      if (!supplier.nama || seen[key]) return false;
      seen[key] = true;
      return lower(supplier.status) !== 'nonaktif' && lower(supplier.status) !== 'tidak aktif';
    });
  }
  function api(action, parameters) {
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') return reject(new Error('API belum siap'));
      window.callApi(action, parameters || [], resolve, reject);
    });
  }
  function publish(list) {
    suppliers = dedupe(list);
    if (!window.dropdownOptions || typeof window.dropdownOptions !== 'object') window.dropdownOptions = {};
    window.dropdownOptions.suppliers = suppliers.slice();
    lastLoadedAt = Date.now();
    return suppliers.slice();
  }
  function load(force) {
    if (!force && suppliers.length && Date.now() - lastLoadedAt < CACHE_TTL) return Promise.resolve(suppliers.slice());
    if (loading) return loading;
    loading = api('getMasterSupplier', [{ page: 1, pageSize: 1000, exportAll: true }])
      .then(function (result) {
        return publish(unwrapRows(result).map(normalize));
      })
      .catch(function (error) {
        var fallback = (window.dropdownOptions && window.dropdownOptions.suppliers) || [];
        if (fallback.length) return publish(fallback.map(normalize));
        console.warn('Data Supplier gagal dimuat:', error);
        return [];
      })
      .finally(function () { loading = null; });
    return loading;
  }
  function scope(mode) {
    var prefix = mode === 'edit' ? 'editTx' : 'addTx';
    return {
      sppg: lower(byId(prefix + 'SPPG') && byId(prefix + 'SPPG').value),
      yayasan: lower(byId(prefix + 'Yayasan') && byId(prefix + 'Yayasan').value)
    };
  }
  function choices(mode) {
    var current = suppliers.length ? suppliers : ((window.dropdownOptions && window.dropdownOptions.suppliers) || []);
    var target = scope(mode);
    var exact = current.filter(function (supplier) {
      if (target.sppg && lower(supplier.sppg) !== target.sppg) return false;
      if (target.yayasan && supplier.yayasan && lower(supplier.yayasan) !== target.yayasan) return false;
      return true;
    });
    if (exact.length) return exact;
    var bySppg = target.sppg ? current.filter(function (supplier) {
      return lower(supplier.sppg) === target.sppg;
    }) : current;
    return bySppg.length ? bySppg : current;
  }
  function refreshEdit(force) {
    return load(!!force).then(function () {
      if (typeof window.populateTransactionSupplierDatalist === 'function') window.populateTransactionSupplierDatalist('edit');
      var input = byId('editTxSupplier');
      if (input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return choices('edit');
    });
  }
  function findSupplierModal() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('[id^="modal"],.modal'));
    return candidates.find(function (node) {
      var content = lower(node.textContent);
      return content.indexOf('tambah supplier') !== -1 || content.indexOf('data supplier') !== -1 && content.indexOf('mou') !== -1;
    }) || null;
  }
  function openSupplierForm() {
    if (typeof window.closeModal === 'function') window.closeModal('modalEditTransaksi');
    var modal = findSupplierModal();
    if (modal && modal.id && typeof window.openModal === 'function') {
      window.openModal(modal.id);
      return;
    }
    if (typeof window.showPage === 'function') window.showPage('supplier');
    setTimeout(function () {
      var button = byId('btnAddSupplier');
      if (button) button.click();
      else if (typeof window.showToast === 'function') window.showToast('warning', 'Form Supplier', 'Buka menu Data Supplier lalu pilih Tambah Supplier.');
    }, 120);
  }
  function installCreateHandler() {
    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('.app-create-supplier,[data-create="1"]') : null;
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSupplierForm();
    }, true);
  }
  function injectStyles() {
    if (byId('editSupplierOptionsFixStyles')) return;
    var style = document.createElement('style');
    style.id = 'editSupplierOptionsFixStyles';
    style.textContent = [
      '.app-supplier-combobox .app-dropdown-menu{z-index:15050;max-height:min(360px,45vh)}',
      '.app-create-supplier{min-height:56px}',
      '@media(max-width:640px){.app-supplier-combobox .app-dropdown-menu{position:fixed;left:12px;right:12px;top:auto;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-height:52vh;border-radius:16px}.app-supplier-combobox .app-dropdown-option{min-height:50px;padding:12px}.app-create-supplier{min-height:64px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function install() {
    window.transactionSupplierChoices = function (mode) { return choices(mode || 'add'); };
    window.refreshEditSupplierOptions = refreshEdit;
    window.openTransactionSupplierCreateForm = openSupplierForm;
    if (typeof window.openModal === 'function' && !window.openModal.__supplierOptionsFix) {
      var original = window.openModal;
      window.openModal = function (id) {
        var result = original.apply(this, arguments);
        if (id === 'modalEditTransaksi') setTimeout(function () { refreshEdit(true); }, 0);
        return result;
      };
      window.openModal.__supplierOptionsFix = true;
    }
    injectStyles();
    installCreateHandler();
    load(false);
  }
  install();
})();
