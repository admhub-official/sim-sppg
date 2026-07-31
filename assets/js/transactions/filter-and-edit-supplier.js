(function () {
  'use strict';

  var SPPG_CACHE_TTL = 5 * 60 * 1000;
  var SUPPLIER_CACHE_TTL = 60 * 1000;
  var sppgCache = { values: [], loadedAt: 0, promise: null };
  var supplierCache = { values: [], loadedAt: 0, promise: null };
  var sessionFailureShown = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function lower(value) {
    return text(value).toLocaleLowerCase('id-ID');
  }

  function uniqueSorted(values) {
    var seen = Object.create(null);
    return values.map(text).filter(function (value) {
      var key = lower(value);
      if (!value || seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function (left, right) {
      return left.localeCompare(right, 'id-ID', { sensitivity: 'base' });
    });
  }

  function call(action, parameters) {
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') {
        reject(new Error('API aplikasi belum siap.'));
        return;
      }
      window.callApi(action, parameters || [], resolve, reject);
    });
  }

  function isSessionError(error) {
    return /sesi.*berakhir|session.*expired|unauthorized|jwt/i.test(text(error && error.message));
  }

  function localSppgFallback() {
    var rows = Array.isArray(window.allTransactions) ? window.allTransactions : [];
    return uniqueSorted(rows.map(function (row) {
      return row && (row.sppg || row.SPPG || row.namaSppg || row['NAMA SPPG']);
    }));
  }

  function unwrapFilterOptions(result) {
    var current = result;
    for (var depth = 0; depth < 5; depth += 1) {
      if (!current || typeof current !== 'object') return [];
      if (Array.isArray(current.sppg)) return uniqueSorted(current.sppg);
      if (Object.prototype.hasOwnProperty.call(current, 'result')) {
        current = current.result;
        continue;
      }
      return [];
    }
    return [];
  }

  function fetchTransactionSppg(force) {
    var now = Date.now();
    if (!force && sppgCache.values.length && now - sppgCache.loadedAt < SPPG_CACHE_TTL) {
      return Promise.resolve(sppgCache.values.slice());
    }
    if (sppgCache.promise) return sppgCache.promise;

    sppgCache.promise = call('getFilterOptions', []).then(function (result) {
      var values = unwrapFilterOptions(result);
      if (!values.length) values = localSppgFallback();
      sppgCache.values = values;
      sppgCache.loadedAt = Date.now();
      return values.slice();
    }).catch(function (error) {
      var fallback = localSppgFallback();
      if (fallback.length) {
        sppgCache.values = fallback;
        sppgCache.loadedAt = Date.now();
      }
      if (!isSessionError(error)) {
        console.warn('Gagal memuat daftar SPPG transaksi:', error);
      } else if (!sessionFailureShown) {
        sessionFailureShown = true;
        console.info('Daftar SPPG memakai data lokal karena sesi API sudah berakhir.');
      }
      return fallback;
    }).finally(function () {
      sppgCache.promise = null;
    });

    return sppgCache.promise;
  }

  function renderSppgFilter(values) {
    var select = byId('txFilterSPPG');
    if (!select) return;
    var selected = select.value || 'ALL';
    select.innerHTML = '<option value="ALL">Semua SPPG</option>' + values.map(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      return option.outerHTML;
    }).join('');
    select.value = values.indexOf(selected) !== -1 ? selected : 'ALL';
  }

  function refreshTransactionSppgFilter(force) {
    return fetchTransactionSppg(!!force).then(function (values) {
      renderSppgFilter(values);
      return values;
    });
  }

  function unwrapRows(result) {
    var current = result;
    for (var depth = 0; depth < 5; depth += 1) {
      if (Array.isArray(current)) return current;
      if (!current || typeof current !== 'object') return [];
      if (Array.isArray(current.data)) return current.data;
      if (Array.isArray(current.rows)) return current.rows;
      if (Array.isArray(current.suppliers)) return current.suppliers;
      if (Object.prototype.hasOwnProperty.call(current, 'result')) {
        current = current.result;
        continue;
      }
      return [];
    }
    return [];
  }

  function first(row, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      var value = row && row[keys[index]];
      if (value !== undefined && value !== null && text(value)) return value;
    }
    return '';
  }

  function normalizeSupplier(row) {
    var status = text(first(row, ['status', 'STATUS'])) || 'Aktif';
    return {
      id: text(first(row, ['id', 'ID', 'supplierId', 'SUPPLIER ID'])),
      nama: text(first(row, ['nama', 'namaSupplier', 'NAMA SUPPLIER', 'supplierName'])),
      sppg: text(first(row, ['sppg', 'SPPG'])),
      yayasan: text(first(row, ['yayasan', 'YAYASAN'])),
      bank: text(first(row, ['bank', 'namaBank', 'NAMA BANK', 'NAMA BANK SUPPLIER'])),
      noRekening: text(first(row, ['noRekening', 'nomorRekening', 'NO REKENING', 'NO REKENING SUPPLIER'])),
      atasNama: text(first(row, ['atasNama', 'atasNamaRekening', 'ATAS NAMA REKENING', 'ATAS NAMA REKENING SUPPLIER'])),
      status: status,
      items: Array.isArray(row && row.items) ? row.items : []
    };
  }

  function fetchMasterSuppliers(force) {
    var now = Date.now();
    if (!force && supplierCache.values.length && now - supplierCache.loadedAt < SUPPLIER_CACHE_TTL) {
      return Promise.resolve(supplierCache.values.slice());
    }
    if (supplierCache.promise) return supplierCache.promise;

    supplierCache.promise = call('getMasterSupplier', []).then(function (result) {
      var suppliers = unwrapRows(result).map(normalizeSupplier).filter(function (supplier) {
        return supplier.id && supplier.nama && lower(supplier.status) !== 'nonaktif';
      });
      supplierCache.values = suppliers;
      supplierCache.loadedAt = Date.now();
      if (!window.dropdownOptions || typeof window.dropdownOptions !== 'object') window.dropdownOptions = {};
      window.dropdownOptions.suppliers = suppliers.slice();
      return suppliers.slice();
    }).finally(function () {
      supplierCache.promise = null;
    });

    return supplierCache.promise;
  }

  function supplierScope(mode) {
    var prefix = mode === 'edit' ? 'editTx' : 'addTx';
    return {
      sppg: lower(byId(prefix + 'SPPG') && byId(prefix + 'SPPG').value),
      yayasan: lower(byId(prefix + 'Yayasan') && byId(prefix + 'Yayasan').value)
    };
  }

  function scopedSuppliers(mode) {
    var scope = supplierScope(mode);
    var suppliers = supplierCache.values.length
      ? supplierCache.values
      : ((window.dropdownOptions && window.dropdownOptions.suppliers) || []);
    return suppliers.filter(function (supplier) {
      if (scope.sppg && lower(supplier.sppg) !== scope.sppg) return false;
      if (scope.yayasan && supplier.yayasan && lower(supplier.yayasan) !== scope.yayasan) return false;
      return true;
    });
  }

  function refreshEditSupplierOptions(force) {
    return fetchMasterSuppliers(!!force).then(function () {
      if (typeof window.populateTransactionSupplierDatalist === 'function') {
        window.populateTransactionSupplierDatalist('edit');
      }
      if (typeof window.handleTransactionSupplierInput === 'function') {
        window.handleTransactionSupplierInput('edit');
      }
      var input = byId('editTxSupplier');
      if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
      return scopedSuppliers('edit');
    }).catch(function (error) {
      if (!isSessionError(error)) {
        console.warn('Gagal memuat Data Supplier untuk Edit Transaksi:', error);
        if (typeof window.showToast === 'function') {
          window.showToast('warning', 'Supplier Belum Dimuat', 'Data Supplier gagal dimuat. Silakan buka ulang form edit.');
        }
      }
      return scopedSuppliers('edit');
    });
  }

  function install() {
    if (typeof window.callApi !== 'function') return false;

    window.populateSPPGFilter = function () {
      return refreshTransactionSppgFilter(false);
    };
    window.transactionSupplierChoices = function (mode) {
      return scopedSuppliers(mode || 'add');
    };

    if (typeof window.openModal === 'function' && !window.openModal.__transactionDataSources) {
      var originalOpenModal = window.openModal;
      window.openModal = function (id) {
        var result = originalOpenModal.apply(this, arguments);
        if (id === 'modalEditTransaksi') {
          setTimeout(function () { refreshEditSupplierOptions(false); }, 0);
        }
        return result;
      };
      window.openModal.__transactionDataSources = true;
    }

    refreshTransactionSppgFilter(false);
    return true;
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 80) clearInterval(timer);
    }, 100);
  }

  window.refreshTransactionSppgFilter = refreshTransactionSppgFilter;
  window.refreshEditSupplierOptions = refreshEditSupplierOptions;
})();
