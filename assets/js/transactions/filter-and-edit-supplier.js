(function () {
  'use strict';

  var SPPG_CACHE_TTL = 5 * 60 * 1000;
  var sppgCache = { values: [], loadedAt: 0, promise: null };
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

  function install() {
    if (typeof window.callApi !== 'function') return false;
    window.populateSPPGFilter = function () {
      return refreshTransactionSppgFilter(false);
    };
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
})();
