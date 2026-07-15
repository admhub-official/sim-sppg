/* Recovery shim: previous responsive runtime was disabled because it could keep the app in an auth-locked state after refresh. */
(function () {
  'use strict';

  function recover() {
    var oldStyle = document.getElementById('auth-responsive-fix-styles');
    if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);

    var overlay = document.getElementById('authOverlay');
    var authIsOpen = overlay && !overlay.classList.contains('hidden') && window.getComputedStyle(overlay).display !== 'none';

    if (!authIsOpen) {
      document.documentElement.classList.remove('auth-open');
      document.body.classList.remove('auth-open');
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('height');
      document.body.style.removeProperty('height');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recover, { once: true });
  } else {
    recover();
  }

  window.addEventListener('pageshow', recover, { passive: true });
})();