/* Responsive layout correction for SIM-SPPG authentication pages. */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && !el.classList.contains('hidden');
  }

  function installCss() {
    if (byId('auth-responsive-fix-styles')) return;
    var style = document.createElement('style');
    style.id = 'auth-responsive-fix-styles';
    style.textContent = [
      'html.auth-open,body.auth-open{height:100%!important;overflow:hidden!important}',
      '#authOverlay.auth-v2{width:100vw!important;height:100dvh!important;min-height:100dvh!important;overflow:hidden!important;grid-template-columns:minmax(0,54%) minmax(440px,46%)!important;align-items:stretch!important;justify-items:stretch!important}',
      '#authOverlay.auth-v2 .auth-v2-story{width:100%!important;height:100dvh!important;min-height:0!important;padding:clamp(32px,5vw,72px)!important;justify-content:center!important}',
      '#authOverlay.auth-v2 .auth-v2-formside{position:relative!important;width:100%!important;height:100dvh!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding:clamp(28px,4vw,58px)!important;display:flex!important;align-items:center!important;justify-content:center!important}',
      '#authOverlay.auth-v2 .auth-container{position:static!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:block!important;visibility:visible!important;opacity:1!important;transform:none!important;float:none!important;width:min(100%,500px)!important;max-width:500px!important;min-width:0!important;height:auto!important;max-height:none!important;margin:auto!important;padding:0!important;overflow:visible!important}',
      '#authOverlay.auth-v2 .auth-container>div,#authOverlay.auth-v2 .auth-container>form{max-width:100%!important}',
      '#authOverlay.auth-v2 #loginForm,#authOverlay.auth-v2 #registerForm,#authOverlay.auth-v2 #otpForm,#authOverlay.auth-v2 #recoveryForm{position:static!important;inset:auto!important;transform:none!important;width:100%!important;max-width:100%!important;margin:0!important}',
      '#authOverlay.auth-v2 #registerForm.auth-register-v2{max-height:none!important;overflow:visible!important;padding-right:0!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"]{grid-template-columns:minmax(330px,38%) minmax(520px,62%)!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] .auth-v2-story{padding:clamp(28px,4vw,58px)!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] .auth-v2-story h1{font-size:clamp(30px,3.2vw,47px)!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] .auth-v2-features{grid-template-columns:1fr!important;margin-top:24px!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] .auth-v2-feature:nth-child(n+3){display:none!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] .auth-v2-formside{align-items:flex-start!important;padding-top:34px!important;padding-bottom:40px!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] .auth-container{width:min(100%,760px)!important;max-width:760px!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] #registerForm{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px!important}',
      '#authOverlay.auth-v2[data-auth-mode="register"] #registerForm>.auth-required-note,#authOverlay.auth-v2[data-auth-mode="register"] #registerForm>.form-actions,#authOverlay.auth-v2[data-auth-mode="register"] #registerForm>.auth-switch,#authOverlay.auth-v2[data-auth-mode="register"] #registerForm>.full-width{grid-column:1/-1!important}',
      '#authOverlay.auth-v2 .auth-v2-heading{position:sticky;top:0;z-index:2;background:linear-gradient(180deg,#fff 82%,rgba(255,255,255,0));padding:4px 0 14px;margin-bottom:12px!important}',
      '#authOverlay.auth-v2 .auth-v2-note{margin-bottom:4px}',
      '@media(max-width:1100px){#authOverlay.auth-v2{grid-template-columns:minmax(300px,42%) minmax(440px,58%)!important}.auth-v2-story h1{font-size:clamp(30px,4vw,44px)!important}.auth-v2-story>p{font-size:13px!important}.auth-v2-features{grid-template-columns:1fr!important}.auth-v2-feature:nth-child(n+3){display:none!important}}',
      '@media(max-width:820px){html.auth-open,body.auth-open{overflow:auto!important}#authOverlay.auth-v2{display:block!important;height:auto!important;min-height:100dvh!important;overflow-y:auto!important;background:linear-gradient(180deg,#10385b 0,#1e6f9c 230px,#f5f8fb 230px,#f5f8fb 100%)!important;padding:18px!important}#authOverlay.auth-v2 .auth-v2-story{height:auto!important;min-height:0!important;padding:18px 18px 92px!important;border-radius:24px 24px 0 0!important;background:transparent!important}.auth-v2-brand{margin-bottom:14px!important}.auth-v2-kicker{font-size:9px!important}.auth-v2-story h1{font-size:27px!important;line-height:1.12!important;margin:12px 0 8px!important}.auth-v2-story>p{display:none!important}.auth-v2-features{display:none!important}#authOverlay.auth-v2 .auth-v2-formside{height:auto!important;min-height:0!important;overflow:visible!important;margin-top:-72px!important;padding:0 10px 28px!important;background:transparent!important;align-items:flex-start!important}#authOverlay.auth-v2 .auth-container{width:100%!important;max-width:620px!important;background:#fff!important;border:1px solid rgba(203,213,225,.75)!important;border-radius:22px!important;padding:24px!important;box-shadow:0 24px 60px rgba(15,23,42,.18)!important}#authOverlay.auth-v2 .auth-v2-heading{position:static!important;padding:0!important;background:none!important}.auth-v2-heading h2{font-size:25px!important}#authOverlay.auth-v2[data-auth-mode="register"] #registerForm{grid-template-columns:1fr!important}#authOverlay.auth-v2[data-auth-mode="register"] #registerForm>*{grid-column:1!important}}',
      '@media(max-width:520px){#authOverlay.auth-v2{padding:0!important;background:linear-gradient(180deg,#10385b 0,#1e6f9c 185px,#f5f8fb 185px,#f5f8fb 100%)!important}#authOverlay.auth-v2 .auth-v2-story{padding:17px 16px 72px!important;border-radius:0!important}.auth-v2-brand{font-size:15px!important}.auth-v2-logo{width:40px!important;height:40px!important;border-radius:12px!important}.auth-v2-logo img{width:32px!important;height:32px!important}.auth-v2-story h1{font-size:22px!important;letter-spacing:-.5px!important;max-width:330px!important}#authOverlay.auth-v2 .auth-v2-formside{margin-top:-55px!important;padding:0 12px calc(22px + env(safe-area-inset-bottom,0px))!important}#authOverlay.auth-v2 .auth-container{border-radius:18px!important;padding:20px 16px!important;box-shadow:0 18px 45px rgba(15,23,42,.16)!important}.auth-v2-heading h2{font-size:22px!important}.auth-v2-heading p{font-size:12px!important}.auth-v2-formside .form-group{margin-bottom:13px!important}.auth-v2-formside .form-input,.auth-v2-formside input,.auth-v2-formside select{min-height:46px!important;font-size:14px!important}.auth-v2-note{font-size:9.5px!important;padding:10px 11px!important}}',
      '@media(max-height:720px) and (min-width:821px){#authOverlay.auth-v2 .auth-v2-story{padding:28px 48px!important}.auth-v2-brand{margin-bottom:24px!important}.auth-v2-story h1{font-size:38px!important}.auth-v2-story>p{font-size:12px!important}.auth-v2-features{margin-top:20px!important}.auth-v2-feature{padding:10px!important}#authOverlay.auth-v2 .auth-v2-formside{align-items:flex-start!important;padding-top:26px!important;padding-bottom:26px!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function syncMode() {
    var overlay = byId('authOverlay');
    if (!overlay) return;
    var register = byId('registerForm');
    var otp = byId('otpForm');
    var recovery = byId('recoveryForm');
    var mode = isVisible(register) ? 'register' : isVisible(otp) ? 'otp' : isVisible(recovery) ? 'recovery' : 'login';
    overlay.setAttribute('data-auth-mode', mode);
    var open = !overlay.classList.contains('hidden') && window.getComputedStyle(overlay).display !== 'none';
    document.documentElement.classList.toggle('auth-open', open);
    document.body.classList.toggle('auth-open', open);

    var heading = overlay.querySelector('.auth-v2-heading');
    if (heading) {
      var title = heading.querySelector('h2');
      var desc = heading.querySelector('p');
      var eyebrow = heading.querySelector('span');
      if (mode === 'register') {
        if (eyebrow) eyebrow.textContent = 'Registrasi akun';
        if (title) title.textContent = 'Daftar akun SIM-SPPG';
        if (desc) desc.textContent = 'Lengkapi data identitas, SPPG, dan yayasan dengan benar.';
      } else if (mode === 'otp') {
        if (eyebrow) eyebrow.textContent = 'Verifikasi akun';
        if (title) title.textContent = 'Masukkan kode OTP';
        if (desc) desc.textContent = 'Periksa email Anda dan masukkan kode verifikasi yang diterima.';
      } else if (mode === 'recovery') {
        if (eyebrow) eyebrow.textContent = 'Pemulihan akun';
        if (title) title.textContent = 'Pulihkan akses akun';
        if (desc) desc.textContent = 'Ikuti langkah pemulihan untuk kembali mengakses SIM-SPPG.';
      } else {
        if (eyebrow) eyebrow.textContent = 'Selamat datang';
        if (title) title.textContent = 'Masuk ke SIM-SPPG';
        if (desc) desc.textContent = 'Gunakan email dan password akun Anda untuk melanjutkan.';
      }
    }
  }

  function start() {
    installCss();
    syncMode();
    var overlay = byId('authOverlay');
    if (!overlay) return;
    new MutationObserver(syncMode).observe(overlay, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('resize', syncMode, { passive: true });
    window.addEventListener('orientationchange', syncMode, { passive: true });
    setInterval(syncMode, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
