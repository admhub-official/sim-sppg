(function () {
  'use strict';
  var BASE = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';
  function token() { try { return localStorage.getItem('sppg_jwt') || window._supabaseToken || ''; } catch (_) { return window._supabaseToken || ''; } }
  function request(slug, fnName, params, ok, fail) {
    var headers = { 'Content-Type': 'application/json' }, jwt = token();
    if (jwt) headers.Authorization = 'Bearer ' + jwt;
    fetch(BASE + slug, { method: 'POST', headers: headers, body: JSON.stringify({ function: fnName, parameters: Array.isArray(params) ? params : [] }) })
      .then(function (res) { return res.text().then(function (raw) { var body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error('Respons server tidak valid.'); } if (!res.ok || body.error) throw new Error(body.error || ('Server error ' + res.status)); return Object.prototype.hasOwnProperty.call(body, 'result') ? body.result : body; }); })
      .then(function (result) { if (ok) ok(result); })
      .catch(function (error) { if (fail) fail(error); else console.error('Stage D API route failed:', error); });
  }
  function install() {
    if (typeof window.callApi !== 'function' || window.callApi.__stageD) return false;
    var original = window.callApi;
    function routed(fnName, params, onSuccess, onFailure) {
      if (fnName === 'getTransactionDetail') return request('approval-payment-action', fnName, params, onSuccess, onFailure);
      if (fnName === 'uploadTxFile') return request('transaction-file-upload-action', fnName, params, onSuccess, onFailure);
      if (fnName === 'getTransactionSummary') return request('transaction-summary-action', fnName, params, onSuccess, onFailure);
      if (fnName === 'getTransactions' && params && params[0] && params[0].approvalOnly === true) return request('approval-query-action', fnName, params, onSuccess, onFailure);
      return original(fnName, params, onSuccess, onFailure);
    }
    routed.__stageD = true;
    routed.__original = original;
    window.callApi = routed;
    return true;
  }
  if (!install()) {
    var attempts = 0, timer = setInterval(function () { attempts++; if (install() || attempts > 40) clearInterval(timer); }, 100);
  }
})();
