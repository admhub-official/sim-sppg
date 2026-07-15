/* SIM-SPPG unified runtime
 * Session guard, authentication experience, registration routing,
 * role-aware UI hardening, file-input repair, and report downloads.
 */
(function () {
  'use strict';

  if (window.__SIMSPPG_UNIFIED_RUNTIME__) return;
  window.__SIMSPPG_UNIFIED_RUNTIME__ = true;

  var CONFIG = {
    registerUrl: 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/register-user-v2',
    tokenKey: 'sppg_jwt',
    sessionKey: 'sppg_session',
    clockSkewMs: 60 * 1000,
    sessionCheckMs: 30 * 1000,
    logoUrl: 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png'
  };

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

  var REPORT_DATASETS = [
    { key:'TRANSAKSI', label:'Data Transaksi', icon:'fa-exchange-alt', action:'getTransactions', dateFields:['tanggal','Tanggal','Timestamp','timestamp'] },
    { key:'APPROVAL', label:'Data Approval Transaksi', icon:'fa-clipboard-check', action:'getTransactions', approval:true, dateFields:['waktuApprove','WAKTU APPROVE','tanggal','Tanggal'] },
    { key:'PENDING', label:'Data Pending Payment', icon:'fa-hand-holding-usd', action:'getPendingPayments', dateFields:['tanggalPending','Tanggal Pending','Timestamp'] },
    { key:'SUPPLIER', label:'Data Supplier', icon:'fa-truck', action:'getMasterSupplier', dateFields:['TIMESTAMP','Timestamp','created_at'] },
    { key:'BAHAN', label:'Master Bahan Baku', icon:'fa-boxes', action:'getMasterBahanBaku', dateFields:['TIMESTAMP','Timestamp','UPDATE','created_at'] },
    { key:'SURVEI', label:'Data Survei Harga', icon:'fa-search-dollar', action:'getSurveiBahanBaku', dateFields:['waktuSurvei','WAKTU SURVEI','TIMESTAMP','Timestamp'] },
    { key:'SERAH_TERIMA', label:'Data Serah Terima', icon:'fa-dolly', action:'getSerahTerima', dateFields:['TIMESTAMP','Timestamp','Tanggal','tanggal'] },
    { key:'MENU', label:'Data Menu Harian', icon:'fa-utensils', action:'getMenuHarian', dateFields:['tanggal','TANGGAL','Tanggal','TIMESTAMP'] },
    { key:'USERS', label:'Data Pengguna', icon:'fa-users', action:'getAllUsers', dateFields:['timestamp','TIMESTAMP','created_at'] },
    { key:'ADMIN_ASSIGNMENT', label:'Konfigurasi Admin', icon:'fa-user-shield', action:'getAdminAssignments', dateFields:['created_at'] },
    { key:'AUDIT', label:'Riwayat Aktivitas', icon:'fa-history', action:'getAuditLog', dateFields:['waktuRaw','TIMESTAMP','timestamp','waktu'] }
  ];

  var SENSITIVE_COLUMN = /(password|passwd|secret|token|refresh|service_role|private_key|\bpin\b|otp|endpoint|p256dh|auth_key)/i;
  var installAttempts = 0;
  var reportInstalled = false;
  var authObserver = null;

  function byId(id) { return document.getElementById(id); }
  function storageGet(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
  function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  function storageRemove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char];
    });
  }
  function notify(type, title, message) {
    if (typeof window.showToast === 'function') return window.showToast(type, title, message);
    if (window.Swal) return window.Swal.fire(title, message, type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success');
    window.alert(title + '\n' + message);
  }
  function role() {
    return String(window.currentUser && (window.currentUser.role || window.currentUser.ROLE) || '').toUpperCase();
  }
  function email() {
    return String(window.currentUser && (window.currentUser.email || window.currentUser.EMAIL || window.currentUser.username) || '').toLowerCase();
  }

  function decodeJwtPayload(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (encoded.length % 4) encoded += '=';
      var binary = window.atob(encoded);
      var text;
      try {
        text = decodeURIComponent(Array.prototype.map.call(binary, function (char) {
          return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (_) {
        text = binary;
      }
      return JSON.parse(text);
    } catch (_) {
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
    return !!expiry && expiry > Date.now() + CONFIG.clockSkewMs;
  }

  function stopBackgroundTasks() {
    try {
      if (window.notifPollTimer) {
        clearInterval(window.notifPollTimer);
        window.notifPollTimer = null;
      }
    } catch (_) {}
  }

  function renderLoggedOut(message) {
    var app = byId('appContainer');
    var auth = byId('authOverlay');
    var loading = byId('appLoadingOverlay');
    if (app) app.classList.add('hidden');
    if (auth) auth.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (typeof window.showLogin === 'function') {
      try { window.showLogin(); } catch (_) {}
    }
    if (message) {
      var box = byId('loginError');
      if (box) {
        var span = box.querySelector('span');
        if (span) span.textContent = message;
        box.classList.add('show');
      }
    }
  }

  function clearAuthState(message, updateUi) {
    storageRemove(CONFIG.tokenKey);
    storageRemove(CONFIG.sessionKey);
    window._supabaseToken = '';
    window.currentUser = null;
    window.sessionExpiry = 0;
    stopBackgroundTasks();
    if (updateUi) renderLoggedOut(message || 'Sesi berakhir. Silakan login kembali.');
  }

  function readValidSession(restoreGlobals) {
    var raw = storageGet(CONFIG.sessionKey);
    var token = storageGet(CONFIG.tokenKey);
    if (!raw && !token) return false;
    if (!raw || !isTokenUsable(token)) {
      clearAuthState('', false);
      return false;
    }
    var session;
    try { session = JSON.parse(raw); } catch (_) { session = null; }
    if (!session || !session.user) {
      clearAuthState('', false);
      return false;
    }
    var tokenLimit = jwtExpiryMs(token) - CONFIG.clockSkewMs;
    var appLimit = Number(session.expiry) || 0;
    var effectiveExpiry = appLimit > 0 ? Math.min(appLimit, tokenLimit) : tokenLimit;
    if (!effectiveExpiry || Date.now() >= effectiveExpiry) {
      clearAuthState('', false);
      return false;
    }
    if (Number(session.expiry) !== effectiveExpiry) {
      session.expiry = effectiveExpiry;
      storageSet(CONFIG.sessionKey, JSON.stringify(session));
    }
    if (restoreGlobals) {
      window.currentUser = session.user;
      window.sessionExpiry = effectiveExpiry;
      window._supabaseToken = token;
    }
    return true;
  }

  function isAuthFailure(value) {
    var message = value && String(value.message || value.error || value.msg || value) || '';
    return /token.*(invalid|expired|kedaluwarsa)|jwt.*(invalid|expired|kedaluwarsa)|authorization.*(wajib|missing|required)|sesi.*(berakhir|kedaluwarsa)/i.test(message);
  }

  function validTokenOrEmpty() {
    var token = storageGet(CONFIG.tokenKey);
    if (!isTokenUsable(token)) {
      if (token || storageGet(CONFIG.sessionKey)) clearAuthState('', false);
      return '';
    }
    return token;
  }

  function installSessionGuard() {
    if (window.__sppgUnifiedSessionInstalled) return true;
    if (typeof window.callApi !== 'function' || typeof window.checkSession !== 'function') return false;
    window.__sppgUnifiedSessionInstalled = true;

    var original = window.callApi;
    window.getJwtToken = function () {
      var token = validTokenOrEmpty();
      if (!token && window.currentUser) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
      return token;
    };
    window.checkSession = function () { return readValidSession(true); };

    window.callApi = function (action, params, success, failure) {
      var isPublic = !!PUBLIC_FUNCTIONS[action];
      if (action === 'loginUser') {
        clearAuthState('', false);
      } else if (!isPublic && !validTokenOrEmpty()) {
        var error = new Error('Sesi berakhir. Silakan login kembali.');
        clearAuthState(error.message, true);
        if (typeof failure === 'function') setTimeout(function () { failure(error); }, 0);
        return;
      }

      return original(action, params, function (result) {
        if (action === 'loginUser' && result && result.success && result.token) {
          var tokenExpiry = jwtExpiryMs(result.token);
          if (!tokenExpiry || tokenExpiry <= Date.now() + CONFIG.clockSkewMs) {
            clearAuthState('', false);
            if (typeof failure === 'function') failure(new Error('Server mengirim sesi yang tidak valid. Silakan login kembali.'));
            return;
          }
          result.sessionExpiry = Math.min(Number(result.sessionExpiry) || tokenExpiry, tokenExpiry - CONFIG.clockSkewMs);
          storageSet(CONFIG.tokenKey, result.token);
          window._supabaseToken = result.token;
        }
        if (!isPublic && isAuthFailure(result)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        if (typeof success === 'function') success(result);
      }, function (error) {
        if (!isPublic && isAuthFailure(error)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        if (typeof failure === 'function') failure(error);
      });
    };
    window.callApi.__unifiedRuntime = true;
    window.callApi.__original = original;
    readValidSession(true);
    return true;
  }

  function installStyles() {
    if (byId('sppg-unified-styles')) return;
    var style = document.createElement('style');
    style.id = 'sppg-unified-styles';
    style.textContent = [
      '#authOverlay.auth-architecture{position:fixed!important;inset:0!important;z-index:9999!important;padding:0!important;display:grid!important;grid-template-columns:minmax(380px,44%) minmax(440px,56%)!important;align-items:stretch!important;background:#eef3f7!important;overflow:auto!important}',
      '#authOverlay.auth-architecture.hidden{display:none!important}',
      '.auth-architecture-story{position:relative;isolation:isolate;overflow:hidden;min-height:100dvh;padding:clamp(34px,5vw,76px);display:flex;flex-direction:column;justify-content:space-between;color:#fff;background:linear-gradient(145deg,#0b1d30 0%,#123d5d 52%,#1e6f9c 100%)}',
      '.auth-architecture-story:before{content:"";position:absolute;inset:0;z-index:-2;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(180deg,rgba(0,0,0,.9),rgba(0,0,0,.35))}',
      '.auth-architecture-story:after{content:"";position:absolute;right:-8%;bottom:-12%;z-index:-1;width:min(44vw,620px);aspect-ratio:1;border:1px solid rgba(255,255,255,.16);border-radius:52% 48% 16% 84%/45% 72% 28% 55%;box-shadow:inset 0 0 0 38px rgba(255,255,255,.025),inset 0 0 0 90px rgba(255,255,255,.018);transform:rotate(-12deg)}',
      '.auth-architecture-brand{display:flex;align-items:center;gap:13px;font-weight:800;font-size:18px;letter-spacing:-.2px}.auth-architecture-logo{width:50px;height:50px;border-radius:15px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;box-shadow:0 18px 44px rgba(0,0,0,.2)}.auth-architecture-logo img{width:39px;height:39px;object-fit:contain}',
      '.auth-architecture-copy{max-width:700px;margin:clamp(46px,8vh,100px) 0}.auth-architecture-kicker{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);font-size:10px;font-weight:800;letter-spacing:1.15px;text-transform:uppercase}.auth-architecture-copy h1{font-size:clamp(36px,4.6vw,68px);line-height:1.02;letter-spacing:-2.2px;margin:19px 0 17px;max-width:680px}.auth-architecture-copy>p{max-width:590px;color:rgba(255,255,255,.75);font-size:14px;line-height:1.78}',
      '.auth-architecture-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:680px;margin-top:34px}.auth-architecture-metric{min-height:94px;padding:15px;border:1px solid rgba(255,255,255,.12);border-radius:15px;background:rgba(255,255,255,.075);backdrop-filter:blur(8px)}.auth-architecture-metric i{font-size:17px;margin-bottom:13px}.auth-architecture-metric b{display:block;font-size:11px}.auth-architecture-metric span{display:block;margin-top:4px;color:rgba(255,255,255,.6);font-size:9px;line-height:1.45}',
      '.auth-architecture-foot{display:flex;justify-content:space-between;gap:18px;color:rgba(255,255,255,.54);font-size:9px;letter-spacing:.3px}',
      '.auth-architecture-formside{position:relative;min-height:100dvh;padding:clamp(28px,5vw,72px);display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff,#f7fafc)}',
      '.auth-architecture-formside .auth-container{position:static!important;inset:auto!important;width:min(100%,560px)!important;max-width:560px!important;min-width:0!important;height:auto!important;max-height:none!important;margin:auto!important;padding:0!important;overflow:visible!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;opacity:1!important;visibility:visible!important}',
      '.auth-architecture-formside .auth-logo,.auth-architecture-formside>.auth-container>h1,.auth-architecture-formside>.auth-container>.auth-sub{display:none!important}',
      '.auth-architecture-heading{margin-bottom:26px}.auth-architecture-heading span{display:inline-flex;color:#1e6f9c;font-size:10px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;margin-bottom:8px}.auth-architecture-heading h2{margin:0 0 7px;color:#0f172a;font-size:clamp(27px,3vw,35px);line-height:1.12;letter-spacing:-.9px}.auth-architecture-heading p{color:#64748b;font-size:12px;line-height:1.6}',
      '.auth-architecture-formside .form-group{margin-bottom:15px}.auth-architecture-formside .form-label{font-size:10px!important;font-weight:800!important;color:#334155!important;letter-spacing:.35px}.auth-architecture-formside .form-input,.auth-architecture-formside input,.auth-architecture-formside select{width:100%;min-height:50px!important;border:1px solid #d6e0e8!important;border-radius:13px!important;background:#fff!important;color:#0f172a!important;font-size:14px!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important;transition:border-color .18s,box-shadow .18s,transform .18s}.auth-architecture-formside input:focus,.auth-architecture-formside select:focus{outline:0!important;border-color:#38bdf8!important;box-shadow:0 0 0 4px rgba(56,189,248,.13)!important}',
      '.auth-architecture-formside #btnLogin,.auth-architecture-formside #btnRegister,.auth-architecture-formside #btnVerifyOtp,.auth-architecture-formside .btn-primary{min-height:52px!important;border:0!important;border-radius:13px!important;background:linear-gradient(135deg,#15577a,#1e6f9c 58%,#2688b8)!important;box-shadow:0 14px 28px rgba(30,111,156,.21)!important}',
      '.auth-architecture-note{margin-top:18px;padding:12px 14px;border:1px solid #d7eaf6;border-radius:12px;background:#eff8fd;color:#496274;font-size:9.5px;line-height:1.55}.auth-architecture-note strong{color:#15577a}',
      '.auth-register-note{grid-column:1/-1;margin:-2px 0 14px;color:#64748b;font-size:10px;line-height:1.55}.auth-hidden-field{display:none!important}',
      '#authOverlay.auth-architecture[data-auth-mode="register"]{grid-template-columns:minmax(310px,34%) minmax(620px,66%)!important}.auth-architecture[data-auth-mode="register"] .auth-architecture-copy h1{font-size:clamp(31px,3.7vw,52px)}.auth-architecture[data-auth-mode="register"] .auth-architecture-metrics{grid-template-columns:1fr}.auth-architecture[data-auth-mode="register"] .auth-architecture-metric:nth-child(n+3){display:none}.auth-architecture[data-auth-mode="register"] .auth-architecture-formside{align-items:flex-start;overflow:auto;padding-top:34px;padding-bottom:40px}.auth-architecture[data-auth-mode="register"] .auth-container{width:min(100%,820px)!important;max-width:820px!important}.auth-architecture[data-auth-mode="register"] #registerForm{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}.auth-architecture[data-auth-mode="register"] #registerForm>.form-actions,.auth-architecture[data-auth-mode="register"] #registerForm>.auth-switch,.auth-architecture[data-auth-mode="register"] #registerForm>.full-width{grid-column:1/-1!important}',
      '.report-unified-hero{background:linear-gradient(135deg,#15577a,#1e6f9c 55%,#2d8fbf);color:#fff;border-radius:20px;padding:26px;display:flex;justify-content:space-between;gap:20px;box-shadow:0 16px 36px rgba(21,87,122,.2);margin-bottom:18px}.report-unified-hero h2{font-size:24px;margin:12px 0 7px}.report-unified-hero p{max-width:720px;color:rgba(255,255,255,.82);font-size:12px}.report-unified-eyebrow{display:inline-flex;gap:7px;align-items:center;font-size:10px;font-weight:800;letter-spacing:1px;background:rgba(255,255,255,.14);padding:6px 10px;border-radius:999px}.report-unified-grid{display:grid;grid-template-columns:minmax(270px,.72fr) minmax(0,1.7fr);gap:18px}.report-unified-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;box-shadow:0 5px 18px rgba(15,23,42,.045)}.report-unified-title{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.report-unified-title>span{width:30px;height:30px;min-width:30px;border-radius:10px;background:#e0f2fe;color:#15577a;display:flex;align-items:center;justify-content:center;font-weight:800}.report-unified-title h3{font-size:15px}.report-unified-title p{font-size:10px;color:#64748b}.report-unified-fields{display:grid;gap:13px}.report-unified-fields label{display:grid;gap:6px}.report-unified-fields label>span{font-size:10px;font-weight:800;color:#475569;text-transform:uppercase}.report-unified-fields input,.report-unified-fields select{min-height:43px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#fff}.report-unified-actions{display:flex;align-items:center;gap:8px;margin-bottom:14px}.report-unified-actions button{border:0;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:700;padding:7px 10px;border-radius:8px}.report-unified-actions strong{margin-left:auto;color:#64748b;font-size:10px}.report-unified-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:430px;overflow:auto}.report-unified-check{position:relative;display:flex;align-items:center;gap:10px;padding:11px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer}.report-unified-check input{position:absolute;opacity:0}.report-unified-check:has(input:checked){border-color:#38bdf8;background:#f0f9ff;box-shadow:inset 0 0 0 1px #38bdf8}.report-unified-check i:first-of-type{width:34px;height:34px;border-radius:10px;background:#f1f5f9;color:#1e6f9c;display:grid;place-items:center}.report-unified-check b{display:block;font-size:11px}.report-unified-check small{display:block;font-size:8px;color:#94a3b8;margin-top:2px}.report-unified-bar{margin-top:18px;padding:14px 16px;background:#fff;border:1px solid #dbe5ee;border-radius:16px;display:flex;justify-content:space-between;align-items:center;gap:16px}.report-unified-bar strong,.report-unified-bar span{display:block}.report-unified-bar strong{font-size:12px}.report-unified-bar span{font-size:10px;color:#64748b}.report-unified-progress{margin-top:14px;padding:11px 14px;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700}.report-unified-progress.hidden{display:none}',
      'body.printing-all #appContainer,body.printing-all #authOverlay{display:none!important}body.printing-all #printAllContainer{display:block!important;position:static!important;left:auto!important;top:auto!important;margin:0!important;padding:0!important}',
      '@media(max-width:1100px){#authOverlay.auth-architecture{grid-template-columns:minmax(300px,40%) minmax(430px,60%)!important}.auth-architecture-story{padding:32px}.auth-architecture-copy h1{font-size:40px}.auth-architecture-metrics{grid-template-columns:1fr}.auth-architecture-metric:nth-child(n+3){display:none}}',
      '@media(max-width:820px){#authOverlay.auth-architecture,#authOverlay.auth-architecture[data-auth-mode="register"]{display:block!important;min-height:100dvh!important;background:linear-gradient(180deg,#0f3553 0,#1e6f9c 235px,#f4f7fa 235px)!important;padding:16px!important}.auth-architecture-story{min-height:0;padding:18px 18px 88px;border-radius:24px 24px 0 0;background:transparent}.auth-architecture-brand{font-size:15px}.auth-architecture-logo{width:42px;height:42px}.auth-architecture-copy{margin:22px 0 0}.auth-architecture-copy h1{font-size:27px;line-height:1.12;letter-spacing:-.8px;margin:12px 0 8px}.auth-architecture-copy>p,.auth-architecture-metrics,.auth-architecture-foot{display:none}.auth-architecture-formside,.auth-architecture[data-auth-mode="register"] .auth-architecture-formside{min-height:0;margin-top:-68px;padding:0 10px 28px;background:transparent;align-items:flex-start;overflow:visible}.auth-architecture-formside .auth-container{width:100%!important;max-width:680px!important;padding:24px!important;border:1px solid rgba(203,213,225,.75)!important;border-radius:22px!important;background:#fff!important;box-shadow:0 24px 60px rgba(15,23,42,.18)!important}.auth-architecture[data-auth-mode="register"] #registerForm{grid-template-columns:1fr!important}.auth-architecture[data-auth-mode="register"] #registerForm>*{grid-column:1!important}.report-unified-grid{grid-template-columns:1fr}.report-unified-checks{max-height:none}}',
      '@media(max-width:520px){#authOverlay.auth-architecture,#authOverlay.auth-architecture[data-auth-mode="register"]{padding:0!important;background:linear-gradient(180deg,#103753 0,#1e6f9c 188px,#f4f7fa 188px)!important}.auth-architecture-story{padding:16px 15px 70px;border-radius:0}.auth-architecture-logo{width:39px;height:39px}.auth-architecture-logo img{width:31px;height:31px}.auth-architecture-copy{margin-top:18px}.auth-architecture-copy h1{font-size:22px}.auth-architecture-kicker{font-size:8px}.auth-architecture-formside,.auth-architecture[data-auth-mode="register"] .auth-architecture-formside{margin-top:-52px;padding:0 11px calc(22px + env(safe-area-inset-bottom,0px))}.auth-architecture-formside .auth-container{padding:20px 16px!important;border-radius:18px!important}.auth-architecture-heading{margin-bottom:19px}.auth-architecture-heading h2{font-size:22px}.auth-architecture-formside .form-group{margin-bottom:13px}.auth-architecture-formside .form-input,.auth-architecture-formside input,.auth-architecture-formside select{min-height:47px!important}.report-unified-hero{padding:20px}.report-unified-hero h2{font-size:20px}.report-unified-checks{grid-template-columns:1fr}.report-unified-bar{align-items:stretch;flex-direction:column}.report-unified-bar .btn{width:100%}}',
      '@media print{@page{margin:10mm;size:A4 landscape}.print-all-container thead{display:table-header-group}.print-all-container tr{break-inside:avoid;page-break-inside:avoid}}'
    ].join('');
    document.head.appendChild(style);
  }

  function visible(element) {
    if (!element || element.classList.contains('hidden')) return false;
    var computed = window.getComputedStyle(element);
    return computed.display !== 'none' && computed.visibility !== 'hidden';
  }

  function authMode() {
    if (visible(byId('registerForm'))) return 'register';
    if (visible(byId('otpForm'))) return 'otp';
    if (visible(byId('recoveryForm'))) return 'recovery';
    return 'login';
  }

  function updateAuthHeading() {
    var overlay = byId('authOverlay');
    if (!overlay || !overlay.classList.contains('auth-architecture')) return;
    var mode = authMode();
    overlay.dataset.authMode = mode;
    var heading = overlay.querySelector('.auth-architecture-heading');
    if (!heading) return;
    var eyebrow = heading.querySelector('span');
    var title = heading.querySelector('h2');
    var description = heading.querySelector('p');
    var content = {
      login: ['Selamat datang', 'Masuk ke SIM-SPPG', 'Gunakan email dan password akun Anda untuk melanjutkan.'],
      register: ['Registrasi akun', 'Bangun akses operasional Anda', 'Lengkapi identitas, unit SPPG, dan yayasan secara akurat.'],
      otp: ['Verifikasi akun', 'Masukkan kode OTP', 'Periksa email Anda lalu masukkan enam digit kode verifikasi.'],
      recovery: ['Pemulihan akun', 'Pulihkan akses SIM-SPPG', 'Ikuti langkah verifikasi untuk mendapatkan kembali akses akun.']
    }[mode];
    eyebrow.textContent = content[0];
    title.textContent = content[1];
    description.textContent = content[2];
  }

  function repairInputs() {
    document.querySelectorAll('input[type="file"]').forEach(function (input) {
      var accept = input.getAttribute('accept') || '';
      if (accept.indexOf('image<!--') !== -1) input.setAttribute('accept', accept.replace(/image<!--/g, 'image/*'));
    });
    var loginEmail = byId('loginUsername');
    if (loginEmail) {
      loginEmail.type = 'email';
      loginEmail.autocomplete = 'email';
      loginEmail.inputMode = 'email';
      loginEmail.required = true;
      loginEmail.setAttribute('aria-label', 'Email akun');
    }
    var loginPassword = byId('loginPassword');
    if (loginPassword) {
      loginPassword.autocomplete = 'current-password';
      loginPassword.required = true;
    }
    var registerEmail = byId('regEmail');
    if (registerEmail) {
      registerEmail.autocomplete = 'email';
      registerEmail.required = true;
    }
    var registerPassword = byId('regPassword');
    if (registerPassword) registerPassword.autocomplete = 'new-password';
    var registerPassword2 = byId('regPassword2');
    if (registerPassword2) registerPassword2.autocomplete = 'new-password';

    var photo = byId('regFoto');
    if (photo) {
      photo.setAttribute('accept', 'image/*');
      var photoGroup = photo.closest('.form-group');
      if (photoGroup) photoGroup.classList.add('auth-hidden-field');
    }
  }

  function enhanceAuthentication() {
    var overlay = byId('authOverlay');
    if (!overlay) return false;
    repairInputs();

    if (overlay.dataset.architectureReady !== '1') {
      var container = overlay.querySelector('.auth-container');
      if (!container) return false;
      overlay.dataset.architectureReady = '1';
      overlay.classList.add('auth-architecture');

      var story = document.createElement('section');
      story.className = 'auth-architecture-story';
      story.innerHTML =
        '<div class="auth-architecture-brand"><span class="auth-architecture-logo"><img src="' + CONFIG.logoUrl + '" alt="Logo SIM-SPPG"></span><span>SIM-SPPG</span></div>' +
        '<div class="auth-architecture-copy"><span class="auth-architecture-kicker"><i class="fas fa-compass-drafting"></i> Arsitektur operasional terintegrasi</span>' +
        '<h1>Satu fondasi digital untuk operasional SPPG.</h1>' +
        '<p>Kelola transaksi, bahan baku, supplier, menu, serah terima, approval, dan pelaporan melalui struktur kerja yang konsisten dan terukur.</p>' +
        '<div class="auth-architecture-metrics">' +
        '<div class="auth-architecture-metric"><i class="fas fa-layer-group"></i><b>Terstruktur</b><span>Alur kerja dan data tersusun dalam satu sistem.</span></div>' +
        '<div class="auth-architecture-metric"><i class="fas fa-shield-halved"></i><b>Terkendali</b><span>Akses mengikuti role, SPPG, dan cakupan yayasan.</span></div>' +
        '<div class="auth-architecture-metric"><i class="fas fa-mobile-screen-button"></i><b>Adaptif</b><span>Nyaman digunakan di desktop, tablet, dan mobile.</span></div>' +
        '</div></div><div class="auth-architecture-foot"><span>Sistem Informasi Manajemen SPPG</span><span>Operasional • Keuangan • Pelaporan</span></div>';

      var side = document.createElement('section');
      side.className = 'auth-architecture-formside';
      container.parentNode.insertBefore(story, container);
      container.parentNode.insertBefore(side, container);
      side.appendChild(container);

      var heading = document.createElement('div');
      heading.className = 'auth-architecture-heading';
      heading.innerHTML = '<span>Selamat datang</span><h2>Masuk ke SIM-SPPG</h2><p>Gunakan email dan password akun Anda untuk melanjutkan.</p>';
      container.insertBefore(heading, container.firstChild);

      var note = document.createElement('div');
      note.className = 'auth-architecture-note';
      note.innerHTML = '<strong>Keamanan akses:</strong> sesi mengikuti masa berlaku token Supabase dan data ditampilkan sesuai peran pengguna.';
      container.appendChild(note);
    }

    var yayasan = byId('regYayasan');
    if (yayasan) {
      yayasan.required = true;
      yayasan.setAttribute('aria-required', 'true');
      var label = yayasan.closest('.form-group') && yayasan.closest('.form-group').querySelector('label');
      if (label && label.textContent.indexOf('*') === -1) label.insertAdjacentHTML('beforeend', ' <span class="req">*</span>');
    }
    var register = byId('registerForm');
    if (register && !register.querySelector('.auth-register-note')) {
      var registerNote = document.createElement('div');
      registerNote.className = 'auth-register-note';
      registerNote.innerHTML = '<i class="fas fa-circle-info"></i> Foto profil dapat ditambahkan setelah akun aktif melalui menu <b>Profil</b>.';
      register.insertBefore(registerNote, register.firstChild);
    }

    updateAuthHeading();
    if (!authObserver) {
      authObserver = new MutationObserver(function () {
        window.requestAnimationFrame(function () {
          repairInputs();
          updateAuthHeading();
        });
      });
      authObserver.observe(overlay, { subtree:true, attributes:true, attributeFilter:['class','style','hidden'] });
    }
    return true;
  }

  function installRegistrationRouting() {
    if (typeof window.callApi !== 'function' || window.callApi.__registrationRouting) return false;
    var original = window.callApi;
    window.callApi = function (action, params, success, failure) {
      if (action !== 'registerUser') return original.apply(this, arguments);
      var data = Array.isArray(params) ? (params[0] || {}) : {};
      if (!String(data.namaYayasan || '').trim()) {
        var validationError = new Error('Nama Yayasan wajib diisi.');
        if (typeof failure === 'function') failure(validationError);
        else notify('error', 'Registrasi belum lengkap', validationError.message);
        return;
      }
      data.fotoProfilBase64 = '';
      data.fotoMimeType = '';
      data.fotoFileName = '';
      fetch(CONFIG.registerUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', apikey: window._supabaseKey || '' },
        body: JSON.stringify({ function:'registerUser', parameters:[data] })
      }).then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok) throw new Error(json.error || json.message || 'Registrasi gagal.');
          return json;
        });
      }).then(function (json) {
        if (json.error) throw new Error(json.error);
        if (typeof success === 'function') success(Object.prototype.hasOwnProperty.call(json, 'result') ? json.result : json);
      }).catch(function (error) {
        if (typeof failure === 'function') failure(error);
        else notify('error', 'Registrasi gagal', error.message);
      });
    };
    window.callApi.__registrationRouting = true;
    window.callApi.__original = original;
    return true;
  }

  function ensureRoleMenus() {
    if (!window.MENU_CONFIG) return false;
    if (!window.MENU_CONFIG.USER) {
      window.MENU_CONFIG.USER = [
        { page:'dashboard', label:'Beranda', icon:'fa-th-large' },
        { page:'profil', label:'Profil', icon:'fa-user-circle' },
        { label:'AKTIVITAS SAYA', isHeader:true },
        { page:'transaksi', label:'Transaksi Saya', icon:'fa-exchange-alt' },
        { page:'pending-payment', label:'Pending Payment Saya', icon:'fa-hand-holding-usd' },
        { label:'AKUN', isHeader:true },
        { action:'logout', label:'Keluar', icon:'fa-sign-out-alt' }
      ];
      if (window.BOTTOM_NAV_CONFIG && !window.BOTTOM_NAV_CONFIG.USER) window.BOTTOM_NAV_CONFIG.USER = ['dashboard','transaksi','profil'];
    }
    Object.keys(window.MENU_CONFIG).forEach(function (key) {
      var items = window.MENU_CONFIG[key];
      if (!Array.isArray(items)) return;
      var report = items.find(function (item) { return item && item.page === 'laporan'; });
      if (!report) return;
      items = items.filter(function (item) {
        return !(item && (item.page === 'laporan' || (item.isHeader && String(item.label).toUpperCase() === 'PELAPORAN')));
      });
      var accountIndex = items.findIndex(function (item) { return item && item.isHeader && String(item.label).toUpperCase() === 'AKUN'; });
      if (accountIndex < 0) {
        var logoutIndex = items.findIndex(function (item) { return item && item.action === 'logout'; });
        accountIndex = logoutIndex < 0 ? items.length : logoutIndex;
      }
      items.splice(accountIndex, 0, { label:'PELAPORAN', isHeader:true }, report);
      window.MENU_CONFIG[key] = items;
    });
    return true;
  }

  function hideRestrictedUserWidgets() {
    if (role() !== 'USER') return;
    document.querySelectorAll('#page-dashboard h1,#page-dashboard h2,#page-dashboard h3,#page-dashboard h4,#page-dashboard .card-title,#page-dashboard .chart-title,#page-dashboard .stat-label').forEach(function (node) {
      if (/pengeluaran\s+per\s+sppg/i.test(node.textContent || '')) {
        var block = node.closest('.chart-container,.card,.dashboard-card,.table-container,.section-card') || node.parentElement;
        if (block) block.style.display = 'none';
      }
    });
  }

  function hardenPrint() {
    if (typeof window.printCurrentPage !== 'function' || window.printCurrentPage.__unifiedRuntime) return;
    var original = window.printCurrentPage;
    window.printCurrentPage = function () {
      document.documentElement.style.setProperty('--print-start-offset', '0');
      window.scrollTo(0, 0);
      return original.apply(this, arguments);
    };
    window.printCurrentPage.__unifiedRuntime = true;
  }

  function api(action, args) {
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') return reject(new Error('API aplikasi belum siap.'));
      window.callApi(action, args || [], resolve, reject);
    });
  }

  function unwrap(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && result.success === false) throw new Error(result.message || 'Backend menolak permintaan.');
    return [];
  }

  function reportParams(dataset, start, end) {
    if (dataset.action === 'getTransactions') return [{ dateStart:start, dateEnd:end }];
    if (dataset.action === 'getMenuHarian') return [{}];
    if (dataset.action === 'getAuditLog') return [{}];
    if (dataset.action === 'getAdminAssignments') return [''];
    return [];
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var raw = String(value).trim();
    var indo = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (indo) return new Date(Number(indo[3]), Number(indo[2]) - 1, Number(indo[1]));
    var date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  }

  function sanitizeRows(rows) {
    return rows.map(function (row) {
      var clean = {};
      Object.keys(row || {}).forEach(function (key) {
        if (!SENSITIVE_COLUMN.test(key)) clean[key] = row[key];
      });
      return clean;
    });
  }

  async function loadReportDataset(dataset, start, end) {
    var rows = unwrap(await api(dataset.action, reportParams(dataset, start, end)));
    if (dataset.approval) rows = rows.filter(function (row) {
      return !!(row.approvedBy || row['APPROVED BY'] || row.waktuApprove || row['WAKTU APPROVE']);
    });
    var startDate = new Date(start + 'T00:00:00');
    var endDate = new Date(end + 'T23:59:59.999');
    var field = dataset.dateFields.find(function (candidate) {
      return rows.some(function (row) { return row && parseDate(row[candidate]); });
    });
    if (field) rows = rows.filter(function (row) {
      var date = parseDate(row[field]);
      return date && date >= startDate && date <= endDate;
    });
    return sanitizeRows(rows);
  }

  function reportColumns(rows) {
    var columns = [];
    rows.forEach(function (row) {
      Object.keys(row || {}).forEach(function (key) { if (columns.indexOf(key) < 0) columns.push(key); });
    });
    return columns;
  }

  function reportCell(value) {
    if (value == null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  function loadLibrary(src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Library laporan gagal dimuat.')); };
      document.head.appendChild(script);
    });
  }

  async function createExcel(datasets, start, end) {
    await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', function () { return !!window.XLSX; });
    var workbook = window.XLSX.utils.book_new();
    var summary = [['LAPORAN SIM-SPPG'], ['Periode', start + ' s.d. ' + end], ['Dibuat oleh', email() || '-'], ['Dibuat pada', new Date().toLocaleString('id-ID')], [], ['Data','Jumlah']];
    datasets.forEach(function (dataset) { summary.push([dataset.config.label, dataset.rows.length]); });
    window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(summary), 'Ringkasan');
    datasets.forEach(function (dataset, index) {
      var columns = reportColumns(dataset.rows);
      var rows = dataset.rows.map(function (row) {
        var output = {};
        columns.forEach(function (key) { output[key] = reportCell(row[key]); });
        return output;
      });
      var sheet = rows.length ? window.XLSX.utils.json_to_sheet(rows) : window.XLSX.utils.aoa_to_sheet([['Tidak ada data pada periode terpilih']]);
      sheet['!cols'] = columns.map(function (key) { return { wch:Math.min(Math.max(key.length + 2, 14), 42) }; });
      var name = dataset.config.label.replace(/[\\\/?*\[\]:]/g, '').slice(0, 28) || ('Data ' + (index + 1));
      window.XLSX.utils.book_append_sheet(workbook, sheet, name);
    });
    window.XLSX.writeFile(workbook, 'laporan-sim-sppg_' + start + '_' + end + '.xlsx', { compression:true });
  }

  async function createPdf(datasets, start, end) {
    await loadLibrary('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); });
    await loadLibrary('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js', function () { return !!window.jspdf.jsPDF.API.autoTable; });
    var doc = new window.jspdf.jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    var width = doc.internal.pageSize.getWidth();
    function header(title, subtitle) {
      doc.setFillColor(30,111,156);
      doc.roundedRect(10,10,width - 20,24,3,3,'F');
      doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text(title,16,21);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(subtitle,16,28); doc.setTextColor(30);
    }
    header('Laporan SIM-SPPG', 'Periode ' + start + ' s.d. ' + end + ' • ' + (email() || '-'));
    doc.autoTable({ startY:42, head:[['No','Kelompok Data','Jumlah']], body:datasets.map(function (dataset, index) { return [index + 1, dataset.config.label, dataset.rows.length]; }), headStyles:{fillColor:[30,111,156]}, styles:{fontSize:8} });
    datasets.forEach(function (dataset) {
      doc.addPage();
      header(dataset.config.label, 'Periode ' + start + ' s.d. ' + end + ' • ' + dataset.rows.length + ' baris');
      if (!dataset.rows.length) { doc.text('Tidak ada data pada periode yang dipilih.',14,48); return; }
      var columns = reportColumns(dataset.rows).slice(0,12);
      doc.autoTable({ startY:40, head:[['No'].concat(columns)], body:dataset.rows.map(function (row, index) { return [index + 1].concat(columns.map(function (key) { return reportCell(row[key]); })); }), headStyles:{fillColor:[30,111,156],fontSize:7}, styles:{fontSize:6.2,cellPadding:1.6,overflow:'linebreak'}, alternateRowStyles:{fillColor:[243,248,251]} });
    });
    doc.save('laporan-sim-sppg_' + start + '_' + end + '.pdf');
  }

  function selectedReportDatasets() {
    return Array.prototype.slice.call(document.querySelectorAll('.report-unified-check input:checked')).map(function (input) {
      return REPORT_DATASETS.find(function (dataset) { return dataset.key === input.value; });
    }).filter(Boolean);
  }

  function updateReportCount() {
    var target = byId('reportUnifiedCount');
    if (target) target.textContent = document.querySelectorAll('.report-unified-check input:checked').length + ' dipilih';
  }

  async function downloadReport() {
    var start = byId('reportUnifiedStart').value;
    var end = byId('reportUnifiedEnd').value;
    var format = byId('reportUnifiedFormat').value;
    var configs = selectedReportDatasets();
    var button = byId('reportUnifiedDownload');
    var progress = byId('reportUnifiedProgress');
    if (!start || !end) return notify('warning','Periode belum lengkap','Pilih tanggal mulai dan tanggal selesai.');
    if (new Date(start) > new Date(end)) return notify('warning','Periode tidak valid','Tanggal mulai tidak boleh melewati tanggal selesai.');
    if (!configs.length) return notify('warning','Data belum dipilih','Pilih minimal satu jenis data.');
    button.disabled = true;
    progress.classList.remove('hidden');
    try {
      var datasets = [];
      for (var i = 0; i < configs.length; i += 1) {
        progress.textContent = 'Mengambil ' + configs[i].label + ' (' + (i + 1) + '/' + configs.length + ')...';
        datasets.push({ config:configs[i], rows:await loadReportDataset(configs[i], start, end) });
      }
      progress.textContent = 'Menyusun file ' + format.toUpperCase() + '...';
      if (format === 'xlsx') await createExcel(datasets, start, end); else await createPdf(datasets, start, end);
      notify('success','Laporan berhasil dibuat','File ' + format.toUpperCase() + ' telah diunduh ke perangkat.');
    } catch (error) {
      console.error('[SIM-SPPG REPORT]', error);
      notify('error','Gagal membuat laporan',error.message || String(error));
    } finally {
      button.disabled = false;
      progress.classList.add('hidden');
      button.innerHTML = '<i class="fas fa-download"></i><span>Download Laporan</span>';
    }
  }

  function installReportCenter() {
    var page = byId('page-laporan') || byId('laporanPage') || document.querySelector('[data-page-content="laporan"]');
    if (!page || page.dataset.unifiedReportReady === '1') return false;
    page.dataset.unifiedReportReady = '1';
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    page.innerHTML =
      '<div class="report-unified-hero"><div><span class="report-unified-eyebrow"><i class="fas fa-chart-pie"></i> PUSAT LAPORAN</span><h2>Unduh laporan sesuai kebutuhan</h2><p>Pilih periode, beberapa kelompok data, dan format file. Kolom sensitif seperti password, token, PIN, dan OTP otomatis dikecualikan.</p></div></div>' +
      '<div class="report-unified-grid"><section class="report-unified-card"><div class="report-unified-title"><span>1</span><div><h3>Periode & Format</h3><p>Tentukan rentang data yang akan diproses.</p></div></div><div class="report-unified-fields">' +
      '<label><span>Tanggal Mulai</span><input id="reportUnifiedStart" type="date" value="' + first.toISOString().slice(0,10) + '"></label>' +
      '<label><span>Tanggal Selesai</span><input id="reportUnifiedEnd" type="date" value="' + now.toISOString().slice(0,10) + '"></label>' +
      '<label><span>Format File</span><select id="reportUnifiedFormat"><option value="pdf">PDF — siap cetak</option><option value="xlsx">Excel — multi-sheet</option></select></label></div></section>' +
      '<section class="report-unified-card"><div class="report-unified-title"><span>2</span><div><h3>Pilih Data</h3><p>Data diambil melalui backend sesuai hak akses akun.</p></div></div>' +
      '<div class="report-unified-actions"><button id="reportUnifiedAll" type="button">Pilih Semua</button><button id="reportUnifiedNone" type="button">Kosongkan</button><strong id="reportUnifiedCount">0 dipilih</strong></div>' +
      '<div class="report-unified-checks">' + REPORT_DATASETS.map(function (dataset, index) {
        return '<label class="report-unified-check"><input type="checkbox" value="' + escapeHtml(dataset.key) + '" ' + (index < 8 ? 'checked' : '') + '><i class="fas ' + dataset.icon + '"></i><span><b>' + escapeHtml(dataset.label) + '</b><small>Sumber backend aplikasi</small></span></label>';
      }).join('') + '</div></section></div>' +
      '<div id="reportUnifiedProgress" class="report-unified-progress hidden">Menyiapkan data...</div>' +
      '<div class="report-unified-bar"><div><strong>File dibuat langsung di perangkat</strong><span>Data mengikuti cakupan akses pengguna yang sedang login.</span></div><button id="reportUnifiedDownload" type="button" class="btn btn-primary"><i class="fas fa-download"></i><span>Download Laporan</span></button></div>';

    document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.addEventListener('change', updateReportCount); });
    byId('reportUnifiedAll').addEventListener('click', function () { document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.checked = true; }); updateReportCount(); });
    byId('reportUnifiedNone').addEventListener('click', function () { document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.checked = false; }); updateReportCount(); });
    byId('reportUnifiedDownload').addEventListener('click', downloadReport);
    updateReportCount();
    window.generateDanKirimLaporan = downloadReport;
    window.kirimLaporanTelegram = function () { throw new Error('Pengiriman Telegram dinonaktifkan. Gunakan Download Laporan.'); };
    reportInstalled = true;
    return true;
  }

  function bootstrapRuntime() {
    installStyles();
    enhanceAuthentication();
    installSessionGuard();
    installRegistrationRouting();
    ensureRoleMenus();
    hardenPrint();
    hideRestrictedUserWidgets();
    installReportCenter();

    installAttempts += 1;
    if (installAttempts < 200 && (!window.__sppgUnifiedSessionInstalled || !window.callApi || !window.MENU_CONFIG)) {
      setTimeout(bootstrapRuntime, 60);
    }
  }

  readValidSession(false);
  window.SPPGSessionGuard = {
    getToken: validTokenOrEmpty,
    isTokenUsable: isTokenUsable,
    getTokenExpiry: jwtExpiryMs,
    validateSession: function () { return readValidSession(true); },
    clearAuth: function (message) { clearAuthState(message, true); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrapRuntime, { once:true });
  else bootstrapRuntime();

  window.addEventListener('pageshow', bootstrapRuntime, { passive:true });
  setInterval(function () {
    if (storageGet(CONFIG.sessionKey) && !readValidSession(true)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
  }, CONFIG.sessionCheckMs);

  var domObserver = new MutationObserver(function () {
    window.requestAnimationFrame(function () {
      repairInputs();
      updateAuthHeading();
      hideRestrictedUserWidgets();
      if (!reportInstalled) installReportCenter();
    });
  });
  domObserver.observe(document.documentElement, { childList:true, subtree:true });
})();