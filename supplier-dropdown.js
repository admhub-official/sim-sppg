(function () {
  'use strict';
  if (document.querySelector('script[data-app-dropdowns="1"]')) return;
  var script = document.createElement('script');
  script.src = './app-dropdowns.js?v=20260730-unified-v1';
  script.defer = true;
  script.dataset.appDropdowns = '1';
  document.head.appendChild(script);
})();
