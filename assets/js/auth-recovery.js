/* SIM-SPPG account recovery module.
 * Password recovery uses email only. Username/token recovery is removed.
 * Production reset destination is explicit so Supabase never falls back to localhost/site root.
 */
(function () {
  'use strict';

  var PRODUCTION_ORIGIN = 'https://sim-sppg.pages.dev';

  function resetRedirect() {
    return PRODUCTION_ORIGIN + '/reset-password.html';
  }

  window.showRecoveryModal = function () {
    var title = document.getElementById('recoveryTitle');
    var body = document.getElementById('recoveryBody');
    var btn = document.getElementById('btnRecoverySubmit');
    var error = document.getElementById('recoveryError');

    if (title) title.textContent = 'Lupa Kata Sandi';
    if (body) {
      body.innerHTML =
        '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">' +
        'Masukkan email terdaftar Anda. Tautan untuk membuat kata sandi baru akan dikirim ke email tersebut.' +
        '</p>' +
        '<div class="form-group">' +
        '<label class="form-label">Email <span class="req">*</span></label>' +
        '<input type="email" id="recEmail" class="form-input" placeholder="nama@email.com" autocomplete="email">' +
        '</div>';
    }
    if (error) error.classList.remove('show');
    if (btn) {
      btn.style.display = '';
      btn.disabled = false;
      btn.innerHTML = 'Kirim Tautan Reset';
    }
    if (typeof openModal === 'function') openModal('modalRecovery');
    setTimeout(function () {
      var input = document.getElementById('recEmail');
      if (input) {
        input.focus();
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') window.submitRecovery();
        });
      }
    }, 0);
  };

  window.submitRecovery = function () {
    var errorEl = document.getElementById('recoveryError');
    var btn = document.getElementById('btnRecoverySubmit');
    var input = document.getElementById('recEmail');
    var email = input ? String(input.value || '').trim().toLowerCase() : '';
    if (errorEl) errorEl.classList.remove('show');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errorEl) {
        var span = errorEl.querySelector('span');
        if (span) span.textContent = 'Masukkan alamat email yang valid.';
        errorEl.classList.add('show');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengirim...';
    }

    if (typeof callApi !== 'function') {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Tautan Reset'; }
      return;
    }

    callApi('recoverPassword', [{ email: email, redirectTo: resetRedirect() }], function (result) {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Tautan Reset'; }
      if (result && result.success) {
        if (typeof closeModal === 'function') closeModal('modalRecovery');
        if (typeof showToast === 'function') showToast('success', 'Permintaan Diproses', result.message || 'Jika email terdaftar, tautan reset kata sandi akan dikirim.');
      } else if (errorEl) {
        var span = errorEl.querySelector('span');
        if (span) span.textContent = (result && result.message) || 'Permintaan reset kata sandi gagal diproses.';
        errorEl.classList.add('show');
      }
    }, function () {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Tautan Reset'; }
      if (errorEl) {
        var span = errorEl.querySelector('span');
        if (span) span.textContent = 'Terjadi kesalahan sistem. Silakan coba lagi.';
        errorEl.classList.add('show');
      }
    });
  };

})();
