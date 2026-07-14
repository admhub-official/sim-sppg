/* SIM-SPPG session guard
 * Menjaga sesi aplikasi tidak hidup lebih lama daripada JWT Supabase.
 * File ini sengaja terisolasi agar perbaikan autentikasi tidak mengubah modul bisnis lain.
 */
(function () {
  'use strict';

  if (window.__sppgSessionGuardLoaded) return;
  window.__sppgSessionGuardLoaded = true;

  var TOKEN_KEY = 'sppg_jwt';
  var SESSION_KEY = 'sppg_session';
  var CLOCK_SKEW_MS = 60 * 1000;
  var CHECK_INTERVAL_MS = 30 * 1000;
  var PUBLIC_FUNCTIONS = {
    registerUser: 1,
    verifyRegistrationOtp: 1,
    resendRegistrationOtp: 1,
    loginUser: 1,
    checkSession: 1,
    recoverPassword: 1,
    recoverUsername: 1,
    recoverToken: 1,
    getAppConfig: 1,
    getDropdownOptions: 1,
    getPushPublicKey: 1
  };

  function storageGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (_e) { return ''; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_e) { return false; }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (_e) { /* noop */ }
  }

  function decodeJwtPayload(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      var binary = window.atob(base64);
      var json = '';
      try {
        json = decodeURIComponent(Array.prototype.map.call(binary, function (ch) {
          return '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (_decodeError) {
        json = binary;
      }
      return JSON.parse(json);
    } catch (_e) {
      return null;
    }
  }

  function jwtExpiryMs(token) {
    var payload = decodeJwtPayload(token);
    var exp = payload && Number(payload.exp);
    return exp > 0 ? exp * 1000 : 0;
  }

  function isTokenUsable(token) {
    var expiry = jwtExpiryMs(token);
    return !!expiry && expiry > Date.now() + CLOCK_SKEW_MS;
  }

  function stopBackgroundTasks() {
    try {
      if (window.notifPollTimer) {
        clearInterval(window.notifPollTimer);
        window.notifPollTimer = null;
      }
    } catch (_e) { /* noop */ }
  }

  function applyLoggedOutUi(message) {
    function render() {
      var app = document.getElementById('appContainer');
      var auth = document.getElementById('authOverlay');
      var loading = document.getElementById('appLoadingOverlay');
      if (app) app.classList.add('hidden');
      if (auth) auth.classList.remove('hidden');
      if (loading) loading.classList.add('hidden');

      if (typeof window.showLogin === 'function') {
        try { window.showLogin(); } catch (_e) { /* noop */ }
      }

      if (message) {
        var errorBox = document.getElementById('loginError');
        if (errorBox) {
          var span = errorBox.querySelector('span');
          if (span) span.textContent = message;
          errorBox.classList.add('show');
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render, { once: true });
    } else {
      render();
    }
  }

  function clearAuthState(message, updateUi) {
    storageRemove(TOKEN_KEY);
    storageRemove(SESSION_KEY);
    try { window._supabaseToken = ''; } catch (_e) { /* noop */ }
    try { window.currentUser = null; } catch (_e2) { /* noop */ }
    try { window.sessionExpiry = 0; } catch (_e3) { /* noop */ }
    stopBackgroundTasks();
    if (updateUi) applyLoggedOutUi(message || 'Sesi berakhir. Silakan login kembali.');
  }

  function readValidStoredSession(restoreGlobals) {
    var rawSession = storageGet(SESSION_KEY);
    var token = storageGet(TOKEN_KEY);

    if (!rawSession && !token) return false;
    if (!rawSession || !isTokenUsable(token)) {
      clearAuthState('', false);
      return false;
    }

    var session;
    try { session = JSON.parse(rawSession); } catch (_e) { session = null; }
    if (!session || !session.user) {
      clearAuthState('', false);
      return false;
    }

    var tokenLimit = jwtExpiryMs(token) - CLOCK_SKEW_MS;
    var appLimit = Number(session.expiry) || 0;
    var effectiveExpiry = appLimit > 0 ? Math.min(appLimit, tokenLimit) : tokenLimit;

    if (!effectiveExpiry || Date.now() >= effectiveExpiry) {
      clearAuthState('', false);
      return false;
    }

    if (session.expiry !== effectiveExpiry) {
      session.expiry = effectiveExpiry;
      storageSet(SESSION_KEY, JSON.stringify(session));
    }

    if (restoreGlobals) {
      window.currentUser = session.user;
      window.sessionExpiry = effectiveExpiry;
      window._supabaseToken = token;
    }
    return true;
  }

  function isAuthFailure(errOrResult) {
    var message = '';
    if (errOrResult) {
      message = String(
        errOrResult.message ||
        errOrResult.error ||
        errOrResult.msg ||
        errOrResult
      );
    }
    return /token.*(invalid|expired|kedaluwarsa)|jwt.*(invalid|expired|kedaluwarsa)|authorization.*(wajib|missing|required)|sesi.*(berakhir|kedaluwarsa)/i.test(message);
  }

  function validTokenOrEmpty() {
    var token = storageGet(TOKEN_KEY);
    if (!isTokenUsable(token)) {
      if (token || storageGet(SESSION_KEY)) clearAuthState('', false);
      return '';
    }
    return token;
  }

  // Jalankan sebelum bundle utama melakukan restore session. Ini mencegah aplikasi
  // membuka dashboard dengan JWT lama yang sebenarnya sudah kedaluwarsa.
  readValidStoredSession(false);

  window.SPPGSessionGuard = {
    getToken: validTokenOrEmpty,
    isTokenUsable: isTokenUsable,
    getTokenExpiry: jwtExpiryMs,
    validateSession: function () { return readValidStoredSession(true); },
    clearAuth: function (message) { clearAuthState(message, true); }
  };

  function installRuntimeGuard() {
    if (window.__sppgSessionGuardInstalled) return true;
    if (typeof window.callApi !== 'function' || typeof window.checkSession !== 'function') return false;

    window.__sppgSessionGuardInstalled = true;
    var originalCallApi = window.callApi;

    window.getJwtToken = function () {
      var token = validTokenOrEmpty();
      if (!token && window.currentUser) {
        clearAuthState('Sesi berakhir. Silakan login kembali.', true);
      }
      return token;
    };

    window.checkSession = function () {
      return readValidStoredSession(true);
    };

    window.callApi = function (fnName, params, onSuccess, onFailure) {
      var isPublic = !!PUBLIC_FUNCTIONS[fnName];

      // Login harus dimulai dari keadaan bersih agar JWT lama tidak ikut
      // terbawa ke proses baru. Form dan data input tidak disentuh.
      if (fnName === 'loginUser') {
        clearAuthState('', false);
      } else if (!isPublic && !validTokenOrEmpty()) {
        var missingSessionError = new Error('Sesi berakhir. Silakan login kembali.');
        clearAuthState(missingSessionError.message, true);
        if (typeof onFailure === 'function') {
          setTimeout(function () { onFailure(missingSessionError); }, 0);
        }
        return;
      }

      return originalCallApi(fnName, params, function (result) {
        if (fnName === 'loginUser' && result && result.success && result.token) {
          var tokenExpiry = jwtExpiryMs(result.token);
          if (!tokenExpiry || tokenExpiry <= Date.now() + CLOCK_SKEW_MS) {
            clearAuthState('', false);
            var invalidLoginToken = new Error('Server mengirim sesi yang tidak valid. Silakan coba login kembali.');
            if (typeof onFailure === 'function') onFailure(invalidLoginToken);
            return;
          }

          // Sesi UI tidak boleh lebih panjang daripada access token Supabase.
          var serverExpiry = Number(result.sessionExpiry) || tokenExpiry;
          result.sessionExpiry = Math.min(serverExpiry, tokenExpiry - CLOCK_SKEW_MS);
          storageSet(TOKEN_KEY, result.token);
          window._supabaseToken = result.token;
        }

        if (!isPublic && isAuthFailure(result)) {
          clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        }
        if (typeof onSuccess === 'function') onSuccess(result);
      }, function (error) {
        if (!isPublic && isAuthFailure(error)) {
          clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        }
        if (typeof onFailure === 'function') onFailure(error);
      });
    };

    // Jika bundle utama sempat restore sesi sebelum guard terpasang, validasi ulang.
    if ((window.currentUser || storageGet(SESSION_KEY)) && !readValidStoredSession(true)) {
      clearAuthState('Sesi berakhir. Silakan login kembali.', true);
    }

    console.info('[SIM-SPPG] Session guard aktif.');
    return true;
  }

  if (!installRuntimeGuard()) {
    var attempts = 0;
    var installTimer = setInterval(function () {
      attempts += 1;
      if (installRuntimeGuard() || attempts >= 200) clearInterval(installTimer);
    }, 50);
  }

  document.addEventListener('DOMContentLoaded', function () {
    installRuntimeGuard();
    if ((storageGet(SESSION_KEY) || storageGet(TOKEN_KEY)) && !readValidStoredSession(true)) {
      clearAuthState('Sesi berakhir. Silakan login kembali.', true);
    }
  });

  setInterval(function () {
    if (storageGet(SESSION_KEY) && !readValidStoredSession(true)) {
      clearAuthState('Sesi berakhir. Silakan login kembali.', true);
    }
  }, CHECK_INTERVAL_MS);
})();
