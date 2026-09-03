/* SIM-SPPG Cloudflare Turnstile protection for the login flow only. */
(function() {
  'use strict';

  var originalCallApi = window.callApi;
  if (typeof originalCallApi !== 'function') {
    console.error('Turnstile login: callApi tidak tersedia.');
    return;
  }

  var widgetId = null;
  var turnstileToken = '';
  var turnstileScriptPromise = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function showLoginError(message) {
    var errorBox = byId('loginError');
    if (!errorBox) return;
    var messageEl = errorBox.querySelector('span');
    if (messageEl) messageEl.textContent = message;
    errorBox.classList.add('show');
  }

  function clearLoginError() {
    var errorBox = byId('loginError');
    if (errorBox) errorBox.classList.remove('show');
  }

  function setLoginButtonReady(ready) {
    var button = byId('btnLogin');
    if (button) button.disabled = !ready;
  }

  function ensureTokenInput() {
    var input = byId('cf-turnstile-response');
    if (input) return input;

    input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'cf-turnstile-response';
    input.id = 'cf-turnstile-response';
    input.value = '';

    var button = byId('btnLogin');
    if (button && button.parentNode) button.parentNode.insertBefore(input, button);
    return input;
  }

  function setToken(token) {
    turnstileToken = String(token || '').trim();
    var input = ensureTokenInput();
    if (input) input.value = turnstileToken;
  }

  function getToken() {
    var input = byId('cf-turnstile-response');
    return String((input && input.value) || turnstileToken || '').trim();
  }

  function resetTurnstile(message) {
    setToken('');
    setLoginButtonReady(false);
    if (message) showLoginError(message);

    if (window.turnstile && widgetId !== null && typeof window.turnstile.reset === 'function') {
      try {
        window.turnstile.reset(widgetId);
      } catch (error) {
        console.warn('Turnstile reset gagal:', error);
      }
    }
  }

  window.onTurnstileSuccess = function(token) {
    setToken(token);
    clearLoginError();
    setLoginButtonReady(true);
  };

  window.onTurnstileExpired = function() {
    resetTurnstile('Verifikasi keamanan kedaluwarsa. Silakan lakukan verifikasi lagi.');
  };

  window.onTurnstileError = function() {
    resetTurnstile('Verifikasi keamanan gagal. Silakan refresh halaman dan coba lagi.');
  };

  function loadTurnstileScript() {
    if (window.turnstile && typeof window.turnstile.render === 'function') {
      return Promise.resolve(window.turnstile);
    }
    if (turnstileScriptPromise) return turnstileScriptPromise;

    turnstileScriptPromise = new Promise(function(resolve, reject) {
      var script = document.querySelector('script[data-sim-sppg-turnstile="1"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-sim-sppg-turnstile', '1');
        document.head.appendChild(script);
      }

      function finish() {
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          resolve(window.turnstile);
        } else {
          reject(new Error('Turnstile API tidak tersedia.'));
        }
      }

      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', function() {
        reject(new Error('Turnstile API gagal dimuat.'));
      }, { once: true });
    });

    return turnstileScriptPromise;
  }

  function renderTurnstile() {
    var button = byId('btnLogin');
    if (!button || !button.parentNode) return;

    setLoginButtonReady(false);
    ensureTokenInput();

    var host = byId('loginTurnstile');
    if (!host) {
      host = document.createElement('div');
      host.id = 'loginTurnstile';
      host.className = 'turnstile-login-wrap';
      host.style.cssText = 'display:flex;justify-content:center;margin:14px 0;min-height:65px;';
      button.parentNode.insertBefore(host, button);
    }

    var sitekey = String(window.__TURNSTILE_SITEKEY__ || '').trim();
    if (!sitekey) {
      showLoginError('Konfigurasi server tidak lengkap.');
      return;
    }

    loadTurnstileScript().then(function(turnstile) {
      if (widgetId !== null) return;
      widgetId = turnstile.render(host, {
        sitekey: sitekey,
        action: 'login',
        theme: 'auto',
        size: 'flexible',
        callback: window.onTurnstileSuccess,
        'expired-callback': window.onTurnstileExpired,
        'error-callback': window.onTurnstileError
      });
    }).catch(function(error) {
      console.error('Turnstile login:', error);
      resetTurnstile('Verifikasi keamanan gagal. Silakan refresh halaman dan coba lagi.');
    });
  }

  function callLoginApi(params, onSuccess, onFailure) {
    var token = getToken();
    if (!token) {
      setTimeout(function() {
        if (onSuccess) {
          onSuccess({
            success: false,
            message: 'Verifikasi keamanan gagal. Silakan refresh halaman dan coba lagi.'
          });
        }
        resetTurnstile();
      }, 0);
      return;
    }

    var headers = { 'Content-Type': 'application/json' };
    var authorizationToken = window._supabaseKey || '';
    if (authorizationToken) headers.Authorization = 'Bearer ' + authorizationToken;
    if (window._supabaseKey) headers.apikey = window._supabaseKey;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 20000) : null;
    var requestUrl = String(window.API_BASE_URL || 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/') + 'auth-public-action';
    var loginParams = Array.isArray(params) ? params.slice(0, 2) : [];
    loginParams.push(token);

    fetch(requestUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ function: 'loginUser', parameters: loginParams }),
      signal: controller ? controller.signal : undefined
    }).then(function(response) {
      if (timeoutId) clearTimeout(timeoutId);
      return response.text().then(function(text) {
        var payload = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error('Respons server tidak valid (HTTP ' + response.status + ').');
        }

        if (!response.ok || payload.error) {
          return {
            httpError: true,
            message: payload.error || ('Server error (HTTP ' + response.status + ')')
          };
        }
        return {
          httpError: false,
          result: Object.prototype.hasOwnProperty.call(payload, 'result') ? payload.result : payload
        };
      });
    }).then(function(envelope) {
      if (envelope.httpError) {
        if (onSuccess) onSuccess({ success: false, message: envelope.message });
        resetTurnstile();
        return;
      }

      var result = envelope.result;
      if (result && result.success && result.token) {
        if (typeof window.clearApiReadCache === 'function') window.clearApiReadCache();
        try { localStorage.setItem('sppg_jwt', result.token); } catch (error) {}
        window._supabaseToken = result.token;
      }

      if (onSuccess) onSuccess(result);
      if (!result || result.success !== true) resetTurnstile();
    }).catch(function(error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error && error.name === 'AbortError') {
        error = new Error('Koneksi ke server timeout, silakan coba lagi.');
      }
      if (onFailure) onFailure(error);
      else console.error('Login request gagal:', error);
      resetTurnstile();
    });
  }

  window.callApi = function(fnName, params, onSuccess, onFailure) {
    if (fnName !== 'loginUser') {
      return originalCallApi(fnName, params, onSuccess, onFailure);
    }
    return callLoginApi(params, onSuccess, onFailure);
  };

  try { callApi = window.callApi; } catch (error) {}

  var originalShowLogin = window.showLogin;
  if (typeof originalShowLogin === 'function') {
    window.showLogin = function() {
      var result = originalShowLogin.apply(this, arguments);
      setTimeout(function() { resetTurnstile(); }, 0);
      return result;
    };
    try { showLogin = window.showLogin; } catch (error) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderTurnstile, { once: true });
  } else {
    renderTurnstile();
  }
})();
