/* SIM-SPPG runtime routing fixes. */
(function(){
  'use strict';
  if (typeof window === 'undefined' || typeof window.callApi !== 'function') return;

  var originalCallApi = window.callApi;
  var geocodeUrl = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/geocode-action';

  window.callApi = function(fnName, params, onSuccess, onFailure) {
    if (fnName !== 'geocodeAlamat') {
      return originalCallApi(fnName, params, onSuccess, onFailure);
    }

    var headers = { 'Content-Type': 'application/json' };
    try {
      var token = localStorage.getItem('sppg_jwt') || '';
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch (_) {}

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function(){ controller.abort(); }, 12000) : null;

    fetch(geocodeUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ function: fnName, parameters: Array.isArray(params) ? params : [] }),
      signal: controller ? controller.signal : undefined
    })
    .then(function(res){
      return res.text().then(function(text){
        var json = {};
        try { json = text ? JSON.parse(text) : {}; }
        catch (_) { throw new Error('Respons geocoding tidak valid.'); }
        if (!res.ok || json.error) throw new Error(json.error || ('Server error (HTTP ' + res.status + ')'));
        return Object.prototype.hasOwnProperty.call(json, 'result') ? json.result : json;
      });
    })
    .then(function(result){ if (onSuccess) onSuccess(result); })
    .catch(function(err){
      if (err && err.name === 'AbortError') err = new Error('Pencarian alamat timeout.');
      if (onFailure) onFailure(err);
      else console.error('geocodeAlamat failed:', err);
    })
    .finally(function(){ if (timer) clearTimeout(timer); });
  };
})();