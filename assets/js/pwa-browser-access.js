(function () {
  'use strict';

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0;
  }

  function syncBrowserInstallUI() {
    var gate = document.getElementById('pwaRequirementGate');
    if (gate) {
      gate.classList.add('hidden');
      gate.setAttribute('aria-hidden', 'true');
      gate.removeAttribute('aria-modal');
    }

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

  function disableLegacyRequirementGate() {
    if (typeof window.updatePwaRequirementGate === 'function' &&
        window.updatePwaRequirementGate.__browserAccessOptional !== true) {
      var optionalUpdate = function () { syncBrowserInstallUI(); };
      optionalUpdate.__browserAccessOptional = true;
      window.updatePwaRequirementGate = optionalUpdate;
    }
  }

  function sync() {
    disableLegacyRequirementGate();
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

  var observer = new MutationObserver(function () {
    var gate = document.getElementById('pwaRequirementGate');
    if (gate && !gate.classList.contains('hidden')) gate.classList.add('hidden');
    var button = document.getElementById('btnInstallPWA');
    if (button) {
      var standalone = isStandalone();
      if (standalone && !button.classList.contains('hidden')) button.classList.add('hidden');
      if (!standalone && button.classList.contains('hidden')) button.classList.remove('hidden');
    }
  });

  function observe() {
    var root = document.getElementById('appContainer') || document.body;
    if (root) observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();

  sync();
  window.setTimeout(sync, 250);
  window.setTimeout(sync, 1500);
})();
