(function () {
  'use strict';

  var PAGE = 'add-user';
  var installedVisibilityGuard = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toast(type, title, message) {
    if (typeof window.showToast === 'function') {
      window.showToast(type, title, message);
    }
  }

  function currentRole() {
    var user = window.currentUser || null;
    return String(user && user.role || '').trim().toUpperCase();
  }

  function configureApiRoute() {
    if (window.API_ROUTES) {
      window.API_ROUTES['register-user-v2'] = { createUserBySuperAdmin: 1 };
      if (window.API_ROUTES['auth-public-action']) {
        delete window.API_ROUTES['auth-public-action'].verifyRegistrationOtp;
        delete window.API_ROUTES['auth-public-action'].resendRegistrationOtp;
      }
    }
    if (window.API_ROUTE_BY_FUNCTION) {
      delete window.API_ROUTE_BY_FUNCTION.registerUser;
      delete window.API_ROUTE_BY_FUNCTION.verifyRegistrationOtp;
      delete window.API_ROUTE_BY_FUNCTION.resendRegistrationOtp;
      window.API_ROUTE_BY_FUNCTION.createUserBySuperAdmin = 'register-user-v2';
    }
    if (window.PUBLIC_FN) {
      delete window.PUBLIC_FN.registerUser;
      delete window.PUBLIC_FN.verifyRegistrationOtp;
      delete window.PUBLIC_FN.resendRegistrationOtp;
    }
  }

  function disablePublicRegistrationUi() {
    var loginForm = byId('loginForm');
    if (loginForm) {
      var footer = loginForm.querySelector('.auth-footer');
      if (footer) {
        footer.innerHTML = '<span><i class="fas fa-user-shield" style="margin-right:6px;"></i>Akun baru hanya dibuat oleh Super Admin.</span>';
      }
    }

    ['registerForm', 'otpForm'].forEach(function (id) {
      var node = byId(id);
      if (!node) return;
      node.innerHTML = '';
      node.classList.add('hidden');
      node.setAttribute('aria-hidden', 'true');
      node.setAttribute('data-registration-disabled', '1');
    });

    var overlay = byId('authOverlay');
    if (overlay && (overlay.getAttribute('data-auth-mode') === 'register' || overlay.getAttribute('data-auth-mode') === 'otp')) {
      overlay.setAttribute('data-auth-mode', 'login');
    }

    var originalSetAuthMode = window.setAuthMode;
    if (typeof originalSetAuthMode === 'function' && !originalSetAuthMode.__publicRegistrationDisabled) {
      var guardedSetAuthMode = function (mode) {
        if (mode === 'register' || mode === 'otp') mode = 'login';
        return originalSetAuthMode.call(this, mode);
      };
      guardedSetAuthMode.__publicRegistrationDisabled = true;
      window.setAuthMode = guardedSetAuthMode;
    }

    window.showRegister = function () {
      if (typeof window.showLogin === 'function') window.showLogin();
      toast('info', 'Registrasi Ditutup', 'Akun baru hanya dapat dibuat oleh Super Admin.');
    };
    window.showOtpVerification = function () {
      if (typeof window.showLogin === 'function') window.showLogin();
    };
    window.doRegister = function () {
      toast('info', 'Registrasi Ditutup', 'Akun baru hanya dapat dibuat oleh Super Admin.');
    };
    window.submitRegister = window.doRegister;
    window.doVerifyOtp = window.doRegister;
    window.doResendOtp = window.doRegister;
  }

  function installVisibilityGuard() {
    if (installedVisibilityGuard) return;
    var original = window.isMenuPageVisibleForRole;
    if (typeof original !== 'function') return;
    window.isMenuPageVisibleForRole = function (page, role) {
      if (page === PAGE) return String(role || '').toUpperCase() === 'SUPER_ADMIN';
      return original.apply(this, arguments);
    };
    installedVisibilityGuard = true;
  }

  function installMenu() {
    if (!window.MENU_CONFIG || !Array.isArray(window.MENU_CONFIG.SUPER_ADMIN)) return false;
    var menu = window.MENU_CONFIG.SUPER_ADMIN;
    var exists = menu.some(function (item) { return item && item.page === PAGE; });
    if (!exists) {
      var settingsIndex = menu.findIndex(function (item) { return item && item.page === 'settings'; });
      var entry = { page: PAGE, label: 'Tambah User', icon: 'fa-user-plus' };
      if (settingsIndex >= 0) menu.splice(settingsIndex + 1, 0, entry);
      else menu.push(entry);
    }
    installVisibilityGuard();
    return true;
  }

  function injectPage() {
    if (byId('page-' + PAGE)) return true;
    var anchor = byId('page-users') || document.querySelector('.page-section');
    if (!anchor || !anchor.parentNode) return false;

    var page = document.createElement('div');
    page.id = 'page-' + PAGE;
    page.className = 'page-section hidden';
    page.innerHTML =
      '<div class="page-header">' +
        '<div class="page-header-info">' +
          '<div class="page-title"><i class="fas fa-user-plus" style="color:var(--primary);"></i> Tambah User</div>' +
          '<p class="page-desc">Khusus Super Admin untuk membuat akun login baru.</p>' +
        '</div>' +
      '</div>' +
      '<div class="table-container" style="max-width:680px;">' +
        '<div class="table-header"><h3><i class="fas fa-user-shield"></i> Daftarkan Akun User</h3></div>' +
        '<div style="padding:24px;">' +
          '<div class="info-card" style="margin-bottom:18px;background:var(--primary-light);border-color:#bae6fd;">' +
            '<div style="font-weight:700;color:var(--primary-dark);margin-bottom:5px;"><i class="fas fa-envelope-circle-check"></i> Konfirmasi Email</div>' +
            '<div style="font-size:12px;line-height:1.6;">Setelah akun dibuat, sistem mengirim email konfirmasi/undangan ke alamat yang didaftarkan. User menggunakan email dan password dari Super Admin setelah email dikonfirmasi. Data profil lain dapat dilengkapi kemudian melalui menu Profil.</div>' +
          '</div>' +
          '<form id="adminAddUserForm" onsubmit="event.preventDefault();submitAdminAddUser();">' +
            '<div class="form-group">' +
              '<label class="form-label" for="adminAddUserEmail">Email <span class="req">*</span></label>' +
              '<input type="email" id="adminAddUserEmail" class="form-input" placeholder="nama@email.com" autocomplete="off" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="adminAddUserPassword">Password <span class="req">*</span></label>' +
              '<div class="password-wrap">' +
                '<input type="password" id="adminAddUserPassword" class="form-input" placeholder="Password awal user" autocomplete="new-password" required>' +
                '<button type="button" class="toggle-password" onclick="if(window.togglePw)togglePw(\'adminAddUserPassword\',this)" aria-label="Tampilkan password"><i class="fas fa-eye"></i></button>' +
              '</div>' +
              '<p class="form-hint">Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka. User dapat mengganti password sendiri setelah login.</p>' +
            '</div>' +
            '<div id="adminAddUserResult" class="hidden" style="margin:12px 0;padding:11px 13px;border-radius:8px;font-size:12px;"></div>' +
            '<button type="submit" id="btnAdminAddUser" class="btn btn-primary">' +
              '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>' +
            '</button>' +
          '</form>' +
        '</div>' +
      '</div>';

    anchor.parentNode.insertBefore(page, anchor);
    return true;
  }

  function showResult(success, message) {
    var box = byId('adminAddUserResult');
    if (!box) return;
    box.classList.remove('hidden');
    box.style.background = success ? '#ecfdf5' : '#fff1f2';
    box.style.border = success ? '1px solid #a7f3d0' : '1px solid #fecdd3';
    box.style.color = success ? '#047857' : '#be123c';
    box.innerHTML = '<i class="fas ' + (success ? 'fa-check-circle' : 'fa-exclamation-circle') + '" style="margin-right:6px;"></i>' + esc(message);
  }

  window.submitAdminAddUser = function () {
    if (currentRole() !== 'SUPER_ADMIN') {
      toast('error', 'Akses Ditolak', 'Hanya Super Admin yang dapat menambah user.');
      return;
    }

    var emailInput = byId('adminAddUserEmail');
    var passwordInput = byId('adminAddUserPassword');
    var button = byId('btnAdminAddUser');
    var email = String(emailInput && emailInput.value || '').trim().toLowerCase();
    var password = String(passwordInput && passwordInput.value || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showResult(false, 'Alamat email tidak valid.');
      return;
    }
    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      showResult(false, 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.');
      return;
    }
    if (typeof window.callApi !== 'function') {
      showResult(false, 'API aplikasi belum siap. Muat ulang halaman lalu coba kembali.');
      return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span> Membuat akun...</span>';
    showResult(true, 'Sedang membuat akun dan mengirim email konfirmasi...');

    window.callApi('createUserBySuperAdmin', [{ email: email, password: password }], function (result) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>';
      if (result && result.success) {
        showResult(true, result.message || 'Akun berhasil dibuat dan email konfirmasi telah dikirim.');
        toast('success', 'User Berhasil Ditambahkan', result.message || 'Email konfirmasi telah dikirim.');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
      } else {
        showResult(false, result && result.message || 'Pembuatan akun gagal.');
        toast('error', 'Gagal', result && result.message || 'Pembuatan akun gagal.');
      }
    }, function (error) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>';
      var message = error && error.message ? error.message : 'Pembuatan akun gagal.';
      showResult(false, message);
      toast('error', 'Gagal', message);
    });
  };

  function install() {
    configureApiRoute();
    disablePublicRegistrationUi();
    installMenu();
    injectPage();
  }

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  }

  var attempts = 0;
  var timer = setInterval(function () {
    attempts += 1;
    configureApiRoute();
    installMenu();
    injectPage();
    if (attempts >= 40 || (window.MENU_CONFIG && byId('page-' + PAGE))) clearInterval(timer);
  }, 100);
})();
