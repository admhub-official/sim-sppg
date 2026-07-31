(function () {
  'use strict';

  var BASE = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';
  var REQUEST_TIMEOUT_MS = 30000;
  var UPLOAD_TIMEOUT_MS = 60000;
  var MAX_RETRY = 2;
  var SUMMARY_CACHE_TTL_MS = 15000;
  var summaryCache = Object.create(null);
  var summaryPending = Object.create(null);

  function token() {
    try {
      return localStorage.getItem('sppg_jwt') || window._supabaseToken || '';
    } catch (_) {
      return window._supabaseToken || '';
    }
  }

  function safeCallback(callback, value) {
    if (typeof callback !== 'function') return;
    try {
      callback(value);
    } catch (error) {
      setTimeout(function () { throw error; }, 0);
    }
  }

  function requestKey(params) {
    try {
      return JSON.stringify(Array.isArray(params) ? params : []);
    } catch (_) {
      return String(params || '');
    }
  }

  function clearSummaryCache() {
    summaryCache = Object.create(null);
  }

  function request(slug, fnName, params, ok, fail, attempt) {
    attempt = attempt || 0;
    var timeoutMs = fnName === 'uploadTxFile' ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    var headers = { 'Content-Type': 'application/json' };
    var jwt = token();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);

    if (jwt) headers.Authorization = 'Bearer ' + jwt;

    fetch(BASE + slug, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        function: fnName,
        parameters: Array.isArray(params) ? params : []
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        return response.text().then(function (raw) {
          var body = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch (_) {
            throw new Error('Respons server tidak valid.');
          }
          if (!response.ok || body.error) {
            throw new Error(body.error || ('Server error ' + response.status));
          }
          return Object.prototype.hasOwnProperty.call(body, 'result') ? body.result : body;
        });
      })
      .then(function (result) {
        clearTimeout(timeout);
        safeCallback(ok, result);
      })
      .catch(function (error) {
        clearTimeout(timeout);
        var isNet = error && (error.name === 'AbortError' || error.name === 'TypeError');
        if (isNet && attempt < MAX_RETRY) {
          setTimeout(function () {
            request(slug, fnName, params, ok, fail, attempt + 1);
          }, 800 * (attempt + 1));
          return;
        }
        var message = error && error.name === 'AbortError'
          ? new Error('Permintaan melewati batas waktu. Silakan coba kembali.')
          : error;
        if (typeof fail === 'function') safeCallback(fail, message);
        else console.error('Stage D API route failed:', message);
      });
  }

  function requestTransactionSummary(params, ok, fail) {
    var key = requestKey(params);
    var cached = summaryCache[key];
    var now = Date.now();

    if (cached && now - cached.createdAt < SUMMARY_CACHE_TTL_MS) {
      setTimeout(function () { safeCallback(ok, cached.value); }, 0);
      return;
    }

    if (summaryPending[key]) {
      summaryPending[key].push({ ok: ok, fail: fail });
      return;
    }

    summaryPending[key] = [{ ok: ok, fail: fail }];
    request('transaction-summary-action', 'getTransactionSummary', params, function (result) {
      var listeners = summaryPending[key] || [];
      delete summaryPending[key];
      summaryCache[key] = { value: result, createdAt: Date.now() };
      listeners.forEach(function (listener) {
        safeCallback(listener.ok, result);
      });
    }, function (error) {
      var listeners = summaryPending[key] || [];
      delete summaryPending[key];
      listeners.forEach(function (listener) {
        safeCallback(listener.fail, error);
      });
    });
  }

  function install() {
    if (typeof window.callApi !== 'function' || window.callApi.__stageD) return false;

    var original = window.callApi;
    function routed(fnName, params, onSuccess, onFailure) {
      if (fnName === 'getTransactionDetail') {
        return request('approval-payment-action', fnName, params, onSuccess, onFailure);
      }
      if (fnName === 'editTransaction') {
        clearSummaryCache();
        return request('transaction-edit-action', fnName, params, onSuccess, onFailure);
      }
      if (fnName === 'deleteSupplier') {
        clearSummaryCache();
        return request('supplier-delete-action', fnName, params, onSuccess, onFailure);
      }
      if (fnName === 'uploadTxFile') {
        clearSummaryCache();
        return request('transaction-file-upload-action', fnName, params, onSuccess, onFailure);
      }
      if (fnName === 'getTransactionSummary') {
        return requestTransactionSummary(params, onSuccess, onFailure);
      }
      if (fnName === 'getTransactions' && params && params[0] && params[0].approvalOnly === true) {
        return request('approval-query-action', fnName, params, onSuccess, onFailure);
      }

      if (!/^get|^check|^load/.test(String(fnName || ''))) clearSummaryCache();
      return original(fnName, params, onSuccess, onFailure);
    }

    routed.__stageD = true;
    routed.__original = original;
    routed.clearTransactionSummaryCache = clearSummaryCache;
    window.callApi = routed;
    return true;
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts > 40) clearInterval(timer);
    }, 100);
  }
})();
