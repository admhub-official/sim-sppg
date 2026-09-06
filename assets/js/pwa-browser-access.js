(function () {
  'use strict';

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0;
  }

  function syncBrowserInstallUI() {
    var button = document.getElementById('btnInstallPWA');
    if (!button) return;

    var standalone = isStandalone();
    button.classList.toggle('hidden', standalone);
    button.classList.toggle('show', !standalone);
    button.setAttribute('aria-hidden', standalone ? 'true' : 'false');
    button.tabIndex = standalone ? -1 : 0;
    button.title = 'Install SIM-SPPG sebagai aplikasi';

    var label = button.querySelector('span');
    if (label) label.textContent = 'Install App';
  }

  function sync() {
    syncBrowserInstallUI();
  }

  document.addEventListener('DOMContentLoaded', sync);
  window.addEventListener('load', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('appinstalled', sync);
  window.addEventListener('beforeinstallprompt', function () {
    window.setTimeout(sync, 0);
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) sync();
  });

  try {
    var displayMode = window.matchMedia('(display-mode: standalone)');
    if (typeof displayMode.addEventListener === 'function') displayMode.addEventListener('change', sync);
    else if (typeof displayMode.addListener === 'function') displayMode.addListener(sync);
  } catch (_) {}

  sync();
})();
