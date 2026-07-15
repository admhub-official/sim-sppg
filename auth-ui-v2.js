/* SIM-SPPG authentication, session, RBAC UI and print hardening. */
(function () {
  'use strict';

  var REGISTER_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/register-user-v2';
  var SESSION_CHECK_MS = 30000;
  var installed = false;

  function $(id) { return document.getElementById(id); }
  function role() { return String(window.currentUser && window.currentUser.role || '').toUpperCase(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function toast(type, title, message) {
    if (typeof window.showToast === 'function') return window.showToast(type, title, message);
    alert(title + '\n' + message);
  }

  function installStyles() {
    if ($('auth-ui-v2-styles')) return;
    var style = document.createElement('style');
    style.id = 'auth-ui-v2-styles';
    style.textContent = [
      '#authOverlay.auth-v2{position:fixed!important;inset:0!important;padding:0!important;background:#f8fafc!important;overflow:auto!important;display:grid!important;grid-template-columns:minmax(420px,1.08fr) minmax(420px,.92fr);z-index:9999}',
      '#authOverlay.auth-v2.hidden{display:none!important}',
      '.auth-v2-story{position:relative;overflow:hidden;min-height:100vh;padding:clamp(42px,7vw,92px);display:flex;flex-direction:column;justify-content:center;color:#fff;background:radial-gradient(circle at 12% 10%,rgba(56,189,248,.25),transparent 28%),radial-gradient(circle at 88% 82%,rgba(16,185,129,.14),transparent 32%),linear-gradient(145deg,#0b1730 0%,#123d62 54%,#1e6f9c 100%)}',
      '.auth-v2-story:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,transparent,#000 20%,#000 80%,transparent)}',
      '.auth-v2-story>*{position:relative;z-index:1}.auth-v2-brand{display:flex;align-items:center;gap:14px;font-size:21px;font-weight:800;margin-bottom:58px}.auth-v2-logo{width:54px;height:54px;border-radius:17px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;box-shadow:0 16px 40px rgba(0,0,0,.18)}.auth-v2-logo img{width:42px;height:42px;object-fit:contain}',
      '.auth-v2-kicker{display:inline-flex;align-items:center;gap:8px;width:max-content;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.auth-v2-story h1{max-width:650px;margin:17px 0 14px;font-size:clamp(34px,4.2vw,62px);line-height:1.04;letter-spacing:-2px}.auth-v2-story>p{max-width:610px;color:rgba(255,255,255,.75);font-size:15px;line-height:1.8}',
      '.auth-v2-features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:38px;max-width:720px}.auth-v2-feature{display:flex;align-items:center;gap:12px;padding:14px 15px;border-radius:15px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px)}.auth-v2-feature i{width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.12);display:grid;place-items:center}.auth-v2-feature b{display:block;font-size:12px}.auth-v2-feature span{display:block;font-size:10px;color:rgba(255,255,255,.62);margin-top:2px}',
      '.auth-v2-formside{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:42px 7vw;background:linear-gradient(180deg,#fff,#f8fbfe)}',
      '.auth-v2-formside .auth-container{width:min(100%,520px)!important;max-width:520px!important;margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;border:0!important}',
      '.auth-v2-formside .auth-logo,.auth-v2-formside>.auth-container>h1,.auth-v2-formside>.auth-container>.auth-sub{display:none!important}',
      '.auth-v2-heading{margin-bottom:27px}.auth-v2-heading span{display:inline-flex;color:#1e6f9c;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}.auth-v2-heading h2{font-size:31px;color:#0f172a;letter-spacing:-.8px;margin:0 0 7px}.auth-v2-heading p{color:#64748b;font-size:13px}',
      '.auth-v2-formside .form-group{margin-bottom:16px}.auth-v2-formside .form-label{font-size:11px;font-weight:800;color:#334155;letter-spacing:.25px}.auth-v2-formside .form-input,.auth-v2-formside input,.auth-v2-formside select{min-height:50px;border-radius:13px!important;border:1px solid #d9e2ec!important;background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.025);transition:.2s}.auth-v2-formside input:focus,.auth-v2-formside select:focus{border-color:#38bdf8!important;box-shadow:0 0 0 4px rgba(56,189,248,.12)!important}',
      '.auth-v2-formside #btnLogin,.auth-v2-formside .btn-primary{min-height:52px;border-radius:13px!important;background:linear-gradient(135deg,#15577a,#1e6f9c 58%,#2688b8)!important;box-shadow:0 12px 25px rgba(30,111,156,.22)!important;border:0!important}',
      '.auth-v2-note{margin-top:18px;padding:12px 14px;border-radius:12px;background:#eff8ff;border:1px solid #d7ecfb;color:#476174;font-size:10px;line-height:1.55}.auth-v2-note strong{color:#15577a}',
      '#registerForm.auth-register-v2{max-height:76vh;overflow:auto;padding-right:6px}.auth-required-note{font-size:10px;color:#64748b;margin:-5px 0 15px}',
      'body.printing-all #appContainer,body.printing-all #authOverlay{display:none!important}body.printing-all #printAllContainer{display:block!important;position:static!important;left:auto!important;top:auto!important;page-break-before:auto!important;break-before:auto!important;margin:0!important;padding:0!important}',
      '@media print{@page{margin:10mm;size:A4 landscape}html,body{margin:0!important;padding:0!important}.print-all-container{page-break-before:auto!important;break-before:auto!important}.print-all-container h1,.print-all-container h2,.print-all-container table{page-break-before:auto!important}.print-all-container thead{display:table-header-group}.print-all-container tr{break-inside:avoid;page-break-inside:avoid}}',
      '@media(max-width:900px){#authOverlay.auth-v2{grid-template-columns:1fr}.auth-v2-story{min-height:auto;padding:25px 22px 28px}.auth-v2-brand{margin-bottom:22px}.auth-v2-story h1{font-size:28px;letter-spacing:-1px;margin:11px 0 8px}.auth-v2-story>p{font-size:12px;line-height:1.55}.auth-v2-features{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:20px;gap:8px}.auth-v2-feature{padding:10px}.auth-v2-feature i{width:31px;height:31px}.auth-v2-feature span{display:none}.auth-v2-formside{min-height:auto;padding:30px 20px 45px}.auth-v2-heading h2{font-size:26px}}',
      '@media(max-width:520px){.auth-v2-story{padding:20px 17px 22px}.auth-v2-brand{font-size:16px;gap:10px}.auth-v2-logo{width:43px;height:43px}.auth-v2-logo img{width:34px;height:34px}.auth-v2-story h1{font-size:24px}.auth-v2-story>p{display:none}.auth-v2-features{grid-template-columns:1fr 1fr}.auth-v2-feature:nth-child(n+3){display:none}.auth-v2-feature b{font-size:10px}.auth-v2-formside{padding:25px 16px 40px}.auth-v2-heading{margin-bottom:20px}.auth-v2-formside .form-input,.auth-v2-formside input,.auth-v2-formside select{min-height:47px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function enhanceAuth() {
    var overlay = $('authOverlay');
    if (!overlay || overlay.dataset.authV2 === '1') return;
    overlay.dataset.authV2 = '1';
    overlay.classList.add('auth-v2');

    var existing = overlay.querySelector('.auth-container');
    if (!existing) return;
    var story = document.createElement('section');
    story.className = 'auth-v2-story';
    story.innerHTML = '<div class="auth-v2-brand"><span class="auth-v2-logo"><img src="https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png" alt="SIM-SPPG"></span><span>SIM-SPPG</span></div>' +
      '<span class="auth-v2-kicker"><i class="fas fa-shield-heart"></i> Sistem operasional terintegrasi</span>' +
      '<h1>Kelola operasional SPPG dalam satu ruang kerja.</h1>' +
      '<p>Transaksi, approval, bahan baku, supplier, menu harian, serah terima, dan laporan tersusun rapi dengan akses berbasis peran.</p>' +
      '<div class="auth-v2-features">' +
      '<div class="auth-v2-feature"><i class="fas fa-chart-line"></i><span><b>Data real-time</b><span>Ringkasan operasional mudah dipantau</span></span></div>' +
      '<div class="auth-v2-feature"><i class="fas fa-user-shield"></i><span><b>Akses terkontrol</b><span>USER, ADMIN, dan SUPER ADMIN</span></span></div>' +
      '<div class="auth-v2-feature"><i class="fas fa-file-arrow-down"></i><span><b>Laporan modern</b><span>PDF dan Excel siap digunakan</span></span></div>' +
      '<div class="auth-v2-feature"><i class="fas fa-mobile-screen"></i><span><b>Responsif</b><span>Nyaman di desktop dan ponsel</span></span></div></div>';

    var side = document.createElement('section');
    side.className = 'auth-v2-formside';
    existing.parentNode.insertBefore(story, existing);
    existing.parentNode.insertBefore(side, existing);
    side.appendChild(existing);

    var heading = document.createElement('div');
    heading.className = 'auth-v2-heading';
    heading.innerHTML = '<span>Selamat datang</span><h2>Masuk ke SIM-SPPG</h2><p>Gunakan email dan password akun Anda untuk melanjutkan.</p>';
    existing.insertBefore(heading, existing.firstChild);

    var note = document.createElement('div');
    note.className = 'auth-v2-note';
    note.innerHTML = '<strong>Keamanan akun:</strong> sesi akan ditutup otomatis saat kedaluwarsa. Data yang terlihat mengikuti role dan cakupan SPPG/Yayasan Anda.';
    existing.appendChild(note);
  }

  function enforceRegistrationUi() {
    var yayasan = $('regYayasan');
    if (yayasan) {
      yayasan.required = true;
      yayasan.setAttribute('aria-required', 'true');
      if (!yayasan.placeholder) yayasan.placeholder = 'Nama yayasan wajib diisi';
      var label = yayasan.closest('.form-group') && yayasan.closest('.form-group').querySelector('label');
      if (label && label.textContent.indexOf('*') === -1) label.innerHTML += ' <span class="req">*</span>';
    }
    var form = $('registerForm');
    if (form) {
      form.classList.add('auth-register-v2');
      if (!form.querySelector('.auth-required-note')) {
        var n = document.createElement('div');
        n.className = 'auth-required-note';
        n.innerHTML = '<i class="fas fa-circle-info"></i> Akun baru otomatis memiliki role <b>USER</b>. Role hanya dapat diubah melalui Manajemen User oleh ADMIN/SUPER ADMIN.';
        form.insertBefore(n, form.firstChild);
      }
    }
  }

  function installApiRouting() {
    if (typeof window.callApi !== 'function' || window.callApi.__authV2) return;
    var original = window.callApi;
    window.callApi = function (action, params, success, failure) {
      if (action === 'registerUser') {
        var data = Array.isArray(params) ? (params[0] || {}) : {};
        if (!String(data.namaYayasan || '').trim()) {
          if (typeof failure === 'function') failure(new Error('Nama Yayasan wajib diisi.'));
          else toast('error', 'Registrasi belum lengkap', 'Nama Yayasan wajib diisi.');
          return;
        }
        fetch(REGISTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: window._supabaseKey || '' },
          body: JSON.stringify({ function: 'registerUser', parameters: [data] })
        }).then(function (res) { return res.json(); }).then(function (json) {
          if (json.error) throw new Error(json.error);
          if (typeof success === 'function') success(Object.prototype.hasOwnProperty.call(json, 'result') ? json.result : json);
        }).catch(function (error) { if (typeof failure === 'function') failure(error); else toast('error', 'Registrasi gagal', error.message); });
        return;
      }

      if ((action === 'getSPPGData' || action === 'getRekapHarian') && role() !== 'SUPER_ADMIN') {
        var dateStart = Array.isArray(params) ? params[0] : null;
        var dateEnd = Array.isArray(params) ? params[1] : null;
        return original('getTransactions', [{ dateStart: dateStart || undefined, dateEnd: dateEnd || undefined }], function (rows) {
          rows = Array.isArray(rows) ? rows : [];
          if (action === 'getSPPGData') {
            var map = {};
            rows.forEach(function (r) {
              var key = r.sppg || '-';
              if (!map[key]) map[key] = { name:key,pemasukan:0,pengeluaran:0,belumBayar:0,lunas:0,saldo:0 };
              var n = Number(r.nominal) || 0;
              if (r.kategori === 'PEMASUKAN') map[key].pemasukan += n;
              if (r.kategori === 'PENGELUARAN') {
                map[key].pengeluaran += n;
                if (String(r.metodeTransaksi).toUpperCase() === 'SUDAH_DIBAYAR') map[key].lunas += n; else map[key].belumBayar += n;
              }
              map[key].saldo = map[key].pemasukan - map[key].pengeluaran;
            });
            if (typeof success === 'function') success(Object.keys(map).map(function (k) { return map[k]; }));
          } else {
            var daily = {};
            rows.forEach(function (r) {
              var k = r.tanggal || '-';
              if (!daily[k]) daily[k] = { tanggal:k,pemasukan:0,pengeluaran:0,saldoHarian:0,saldoBerjalan:0 };
              var n = Number(r.nominal) || 0;
              if (r.kategori === 'PEMASUKAN') daily[k].pemasukan += n;
              if (r.kategori === 'PENGELUARAN') daily[k].pengeluaran += n;
              daily[k].saldoHarian = daily[k].pemasukan - daily[k].pengeluaran;
            });
            var running = 0;
            var result = Object.keys(daily).sort().map(function (k) { running += daily[k].saldoHarian; daily[k].saldoBerjalan = running; return daily[k]; });
            if (typeof success === 'function') success(result);
          }
        }, failure);
      }
      return original.apply(this, arguments);
    };
    window.callApi.__authV2 = true;
    window.callApi.__original = original;
  }

  function autoLogoutExpiredSession() {
    function expired() {
      var expiry = Number(window.sessionExpiry || 0);
      if (!expiry) {
        try {
          var raw = localStorage.getItem('sppg_session');
          var parsed = raw ? JSON.parse(raw) : null;
          expiry = Number(parsed && parsed.expiry || 0);
        } catch (_) {}
      }
      return !!(window.currentUser && expiry && Date.now() >= expiry);
    }
    setInterval(function () {
      if (!expired()) return;
      try { localStorage.removeItem('sppg_session'); localStorage.removeItem('sppg_jwt'); } catch (_) {}
      window.currentUser = null;
      window.sessionExpiry = 0;
      if (typeof window.executeLogout === 'function') window.executeLogout();
      else location.reload();
      setTimeout(function () { toast('warning', 'Sesi berakhir', 'Sesi Anda telah kedaluwarsa. Silakan masuk kembali.'); }, 250);
    }, SESSION_CHECK_MS);
  }

  function ensureUserRoleMenu() {
    if (!window.MENU_CONFIG || window.MENU_CONFIG.USER) return;
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

  function hideUserSppgWidgets() {
    if (role() !== 'USER') return;
    var nodes = document.querySelectorAll('#page-dashboard h1,#page-dashboard h2,#page-dashboard h3,#page-dashboard h4,#page-dashboard .card-title,#page-dashboard .chart-title,#page-dashboard .stat-label');
    nodes.forEach(function (node) {
      if (/pengeluaran\s+per\s+sppg/i.test(node.textContent || '')) {
        var block = node.closest('.chart-container,.card,.dashboard-card,.table-container,.section-card') || node.parentElement;
        if (block) block.style.display = 'none';
      }
    });
  }

  function hardenPrint() {
    if (typeof window.printCurrentPage === 'function' && !window.printCurrentPage.__v2) {
      var original = window.printCurrentPage;
      window.printCurrentPage = function () {
        document.documentElement.style.setProperty('--print-start-offset', '0');
        window.scrollTo(0, 0);
        return original.apply(this, arguments);
      };
      window.printCurrentPage.__v2 = true;
    }
  }

  function initialize() {
    if (installed) return;
    installed = true;
    installStyles();
    enhanceAuth();
    enforceRegistrationUi();
    installApiRouting();
    ensureUserRoleMenu();
    autoLogoutExpiredSession();
    hardenPrint();
    hideUserSppgWidgets();

    var observer = new MutationObserver(function () {
      enhanceAuth();
      enforceRegistrationUi();
      installApiRouting();
      ensureUserRoleMenu();
      hideUserSppgWidgets();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();