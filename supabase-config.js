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

  async function healthCheck() {
    var response = await fetch(EDGE_FUNCTION_URL, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY
      }
    });

    if (!response.ok) {
      throw new Error('Supabase health check gagal (HTTP ' + response.status + ')');
    }

    return response.json();
  }

  window.SIM_SPPG_SUPABASE = Object.freeze({
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    edgeFunctionName: EDGE_FUNCTION_NAME,
    edgeFunctionUrl: EDGE_FUNCTION_URL,
    healthCheck: healthCheck
  });
})(window);
