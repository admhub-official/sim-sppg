(function () {
  'use strict';
  var BASE = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/transaction-create-action';
  function token() { try { return localStorage.getItem('sppg_jwt') || window._supabaseToken || ''; } catch (_) { return window._supabaseToken || ''; } }
  function messageOf(value, fallback) {
    if (!value) return fallback || 'Terjadi kesalahan pada server.';
    if (typeof value === 'string') return value;
    if (value.message) return String(value.message);
    if (value.error) return String(value.error);
    try { var json = JSON.stringify(value); return json && json !== '{}' ? json : (fallback || 'Terjadi kesalahan pada server.'); }
    catch (_) { return fallback || 'Terjadi kesalahan pada server.'; }
  }
  function request(params, ok, fail) {
    var headers = { 'Content-Type': 'application/json' };
    var jwt = token(); if (jwt) headers.Authorization = 'Bearer ' + jwt;
    fetch(BASE, { method: 'POST', headers: headers, body: JSON.stringify({ function: 'addTransaction', parameters: Array.isArray(params) ? params : [] }) })
      .then(function (response) { return response.text().then(function (raw) {
        var body; try { body = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error('Respons server tidak valid.'); }
        if (!response.ok || body.error) throw new Error(messageOf(body.error || body.result || body, 'Transaksi gagal disimpan.'));
        return Object.prototype.hasOwnProperty.call(body, 'result') ? body.result : body;
      }); })
      .then(function (result) { if (typeof ok === 'function') ok(result); })
      .catch(function (error) { var normalized = new Error(messageOf(error, 'Transaksi gagal disimpan.')); if (typeof fail === 'function') fail(normalized); else console.error(normalized); });
  }
  function install() {
    if (typeof window.callApi !== 'function' || window.callApi.__addTransactionReliability) return false;
    var previous = window.callApi;
    function wrapped(fnName, params, ok, fail) { if (fnName === 'addTransaction') return request(params, ok, fail); return previous.apply(this, arguments); }
    wrapped.__addTransactionReliability = true; wrapped.__previous = previous; window.callApi = wrapped; return true;
  }
  if (!install()) { var attempts = 0; var timer = setInterval(function () { attempts += 1; if (install() || attempts >= 50) clearInterval(timer); }, 100); }
})();
