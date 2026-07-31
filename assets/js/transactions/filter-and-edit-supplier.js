(function () {
  'use strict';

  var SPPG_CACHE_TTL = 5 * 60 * 1000;
  var SUPPLIER_CACHE_TTL = 60 * 1000;
  var sppgCache = { values: [], loadedAt: 0, promise: null };
  var supplierCache = { values: [], loadedAt: 0, promise: null };

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
      if (!value) return false;
      var key = lower(value);
      if (seen[key]) return false;
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

  function unwrapPage(result) {
    var current = result;
    for (var depth = 0; depth < 5; depth += 1) {
      if (Array.isArray(current)) {
        return { rows: current, total: current.length, hasMore: false };
      }
      if (!current || typeof current !== 'object') break;
      if (Array.isArray(current.data) || Array.isArray(current.rows)) {
        var rows = current.data || current.rows || [];
        return {
          rows: rows,
          total: Number(current.total) || rows.length,
          hasMore: current.hasMore === true
        };
      }
      if (Object.prototype.hasOwnProperty.call(current, 'result')) {
        current = current.result;
        continue;
      }
      break;
    }
    return { rows: [], total: 0, hasMore: false };
  }

  function readSppg(row) {
    return text(row && (row.sppg || row.SPPG || row.namaSppg || row['NAMA SPPG']));
  }

  function fetchAllTransactionSppg(force) {
    var now = Date.now();
    if (!force && sppgCache.values.length && now - sppgCache.loadedAt < SPPG_CACHE_TTL) {
      return Promise.resolve(sppgCache.values.slice());
    }
    if (sppgCache.promise) return sppgCache.promise;

    sppgCache.promise = new Promise(function (resolve, reject) {
      var page = 1;
      var pageSize = 100;
      var values = [];

      function next() {
        call('getTransactions', [{ page: page, pageSize: pageSize }]).then(function (result) {
          var parsed = unwrapPage(result);
          parsed.rows.forEach(function (row) {
            var sppg = readSppg(row);
            if (sppg) values.push(sppg);
          });

          var loaded = page * pageSize;
          var hasMore = parsed.hasMore || (parsed.total > loaded && parsed.rows.length > 0);
          if (hasMore && page < 100) {
            page += 1;
            next();
            return;
          }

          sppgCache.values = uniqueSorted(values);
          sppgCache.loadedAt = Date.now();
          resolve(sppgCache.values.slice());
        }).catch(reject);
      }

      next();
    }).finally(function () {
      sppgCache.promise = null;
    });

    return sppgCache.promise;
  }

  function renderSppgFilter(values) {
    var select = byId('txFilterSPPG');
    if (!select) return;
    var selected = select.value || 'ALL';
    var options = ['<option value="ALL">Semua SPPG</option>'];
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      options.push(option.outerHTML);
    });
    select.innerHTML = options.join('');
    select.value = values.some(function (value) { return value === selected; }) ? selected : 'ALL';
    select.dispatchEvent(new Event('change', { bubbles: false }));
  }

  function refreshTransactionSppgFilter(force) {
    return fetchAllTransactionSppg(!!force).then(function (values) {
      renderSppgFilter(values);
      return values;
    }).catch(function (error) {
      console.warn('Gagal memuat daftar lengkap SPPG transaksi:', error);
      return [];
    });
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
      if (input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return scopedSuppliers('edit');
    }).catch(function (error) {
      console.warn('Gagal memuat Data Supplier untuk Edit Transaksi:', error);
      if (typeof window.showToast === 'function') {
        window.showToast('warning', 'Supplier Belum Dimuat', 'Data Supplier gagal dimuat. Silakan buka ulang form edit.');
      }
      return [];
    });
  }

  function install() {
    if (typeof window.callApi !== 'function') return false;

    window.populateSPPGFilter = function () {
      refreshTransactionSppgFilter(false);
    };

    window.transactionSupplierChoices = function (mode) {
      return scopedSuppliers(mode || 'add');
    };

    if (typeof window.openModal === 'function' && !window.openModal.__transactionDataSources) {
      var originalOpenModal = window.openModal;
      window.openModal = function (id) {
        var result = originalOpenModal.apply(this, arguments);
        if (id === 'modalEditTransaksi') {
          setTimeout(function () { refreshEditSupplierOptions(true); }, 0);
        }
        return result;
      };
      window.openModal.__transactionDataSources = true;
    }

    if (typeof window.loadTransactions === 'function' && !window.loadTransactions.__transactionDataSources) {
      var originalLoadTransactions = window.loadTransactions;
      window.loadTransactions = function () {
        var result = originalLoadTransactions.apply(this, arguments);
        setTimeout(function () { refreshTransactionSppgFilter(false); }, 0);
        return result;
      };
      window.loadTransactions.__transactionDataSources = true;
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
