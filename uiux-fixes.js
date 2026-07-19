/* SIM-SPPG UI/UX compatibility and transport hardening hooks.
 * API routing remains native in app.js. This file only normalizes request
 * headers for the project's Supabase Edge Functions.
 */
(function(){
  'use strict';

  if (window.__simSppgFetchHardened || typeof window.fetch !== 'function') return;

  var nativeFetch = window.fetch.bind(window);
  var configuredBase = typeof window.API_BASE_URL === 'string' ? window.API_BASE_URL : '';
  var projectBase = configuredBase || 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';

  window.fetch = function(input, init) {
    var requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (!requestUrl || requestUrl.indexOf(projectBase) !== 0) {
      return nativeFetch(input, init);
    }

    var options = Object.assign({}, init || {});
    var inheritedHeaders = input && typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
    var headers = new Headers(options.headers || inheritedHeaders || {});
    var publishableKey = window._supabaseKey || '';
    var sessionToken = '';
    try { sessionToken = localStorage.getItem('sppg_jwt') || ''; } catch (_) {}
    var authorizationToken = sessionToken || publishableKey;

    if (authorizationToken && !headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer ' + authorizationToken);
    }
    if (publishableKey && !headers.has('apikey')) {
      headers.set('apikey', publishableKey);
    }

    options.headers = headers;
    return nativeFetch(input, options);
  };

  window.__simSppgFetchHardened = true;
})();
