/* SIM-SPPG AUTH RECOVERY HOTFIX
 * Password recovery uses email only.
 * Username recovery is intentionally disabled and its login link is removed.
 */
(function () {
  'use strict';

  function removeUsernameRecoveryLink() {
    var links = document.querySelectorAll('a[onclick*="showRecoveryModal"]');
    links.forEach(function (link) {
      var text = (link.textContent || '').trim().toLowerCase();
      var onclick = link.getAttribute('onclick') || '';
      if (text.indexOf('lupa username') !== -1 || onclick.indexOf("showRecoveryModal('username')") !== -1) {
        link.remove();
      }
    });
  }

  window.showRecoveryModal = function (type) {
    if (type === 'username') return;

    window.currentRecoveryType = 'password';
    var title = document.getElementById('recoveryTitle');
    var body = document.getElementById('recoveryBody');
    var btn = document.getElementById('btnRecoverySubmit');
    var error = document.getElementById('recoveryError');

    if (title) title.textContent = 'Lupa Kata Sandi';
    if (body) {
      body.innerHTML =
        '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">' +
        'Masukkan email terdaftar Anda. Link reset kata sandi akan dikirim ke email tersebut.' +
        '</p>' +
        '<div class="form-group">' +
        '<label class="form-label">Email <span class="req">*</span></label>' +
        '<input type="email" id="recEmail" class="form-input" placeholder="...@gmail.com" autocomplete="email">' +
        '</div>';
    }
    if (error) error.classList.remove('show');
    if (btn) {
      btn.style.display = '';
      btn.disabled = false;
      btn.innerHTML = 'Verifikasi';
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
    if (!email || !email.includes('@')) {
      if (errorEl) {
        var span = errorEl.querySelector('span');
        if (span) span.textContent = 'Email wajib diisi dengan format yang valid.';
        errorEl.classList.add('show');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Memverifikasi...';
    }

    if (typeof callApi !== 'function') {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Verifikasi'; }
      return;
    }

    callApi('recoverPassword', [{ email: email }], function (result) {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Verifikasi'; }
      if (result && result.success) {
        if (typeof closeModal === 'function') closeModal('modalRecovery');
        if (typeof showToast === 'function') {
          showToast('success', 'Permintaan Diproses', result.message || 'Jika email terdaftar, instruksi reset password akan dikirim ke email tersebut.');
        }
      } else if (errorEl) {
        var span = errorEl.querySelector('span');
        if (span) span.textContent = (result && result.message) || 'Permintaan reset password gagal diproses.';
        errorEl.classList.add('show');
      }
    }, function () {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Verifikasi'; }
      if (errorEl) {
        var span = errorEl.querySelector('span');
        if (span) span.textContent = 'Terjadi kesalahan sistem. Silakan coba lagi.';
        errorEl.classList.add('show');
      }
    });
  };

  removeUsernameRecoveryLink();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeUsernameRecoveryLink, { once: true });
  }
})();
