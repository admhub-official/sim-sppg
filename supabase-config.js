/* SIM-SPPG Supabase frontend configuration
 * Safe for public frontend use: publishable key only.
 * Never place service_role or other secret keys in this repository.
 */
(function (window) {
  'use strict';

  var SUPABASE_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PqO81PlEN24os7R9OBEeaw_IOi_Dmws';
  var EDGE_FUNCTION_NAME = 'dynamic-action';
  var EDGE_FUNCTION_URL = SUPABASE_URL + '/functions/v1/' + EDGE_FUNCTION_NAME;

  async function healthCheck(options) {
    options = options || {};
    var timeoutMs = Number(options.timeoutMs) || 10000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

    try {
      var response = await fetch(EDGE_FUNCTION_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Accept: 'application/json'
        },
        signal: controller ? controller.signal : undefined
      });

      var raw = await response.text();
      var payload = null;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch (parseError) {
        payload = { message: raw || 'Respons kosong' };
      }

      if (!response.ok) {
        var detail = payload && payload.message ? ': ' + payload.message : '';
        throw new Error('Supabase health check gagal (HTTP ' + response.status + ')' + detail);
      }

      return payload;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Supabase health check timeout setelah ' + timeoutMs + ' ms');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  window.SIM_SPPG_SUPABASE = Object.freeze({
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    edgeFunctionName: EDGE_FUNCTION_NAME,
    edgeFunctionUrl: EDGE_FUNCTION_URL,
    healthCheck: healthCheck
  });
})(window);
