(function () {
  'use strict';

  var promises = Object.create(null);
  var CHART_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
  var JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

  function loadScript(key, url, ready) {
    if (ready()) return Promise.resolve();
    if (promises[key]) return promises[key];

    promises[key] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-sim-sppg-vendor="' + key + '"]');
      if (existing) {
        existing.addEventListener('load', function () { ready() ? resolve() : reject(new Error(key + ' gagal diinisialisasi.')); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error(key + ' gagal dimuat.')); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.dataset.simSppgVendor = key;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        if (ready()) resolve();
        else reject(new Error(key + ' selesai dimuat tetapi API belum tersedia.'));
      };
      script.onerror = function () { reject(new Error(key + ' gagal dimuat.')); };
      document.head.appendChild(script);
    }).catch(function (error) {
      delete promises[key];
      throw error;
    });
    return promises[key];
  }

  function ensureChart() {
    return loadScript('chartjs', CHART_URL, function () { return typeof window.Chart === 'function'; });
  }

  function ensurePdf() {
    return loadScript('jspdf', JSPDF_URL, function () {
      return !!(window.jspdf && typeof window.jspdf.jsPDF === 'function');
    }).then(function () {
      return loadScript('jspdf-autotable', AUTOTABLE_URL, function () {
        var ctor = window.jspdf && window.jspdf.jsPDF;
        return !!(ctor && ctor.API && typeof ctor.API.autoTable === 'function');
      });
    });
  }

  function isAuthenticatedAppVisible() {
    var app = document.getElementById('appContainer');
    var login = document.getElementById('loginPage') || document.getElementById('loginContainer');
    if (!app) return false;
    var appVisible = !app.classList.contains('hidden') && window.getComputedStyle(app).display !== 'none';
    var loginVisible = login && !login.classList.contains('hidden') && window.getComputedStyle(login).display !== 'none';
    return appVisible && !loginVisible;
  }

  function reportLoadFailure(name, error) {
    console.error(name + ' lazy-load gagal:', error);
    if (typeof window.showToast === 'function') {
      window.showToast('error', 'Komponen belum siap', 'Komponen ' + name + ' gagal dimuat. Periksa koneksi lalu coba lagi.');
    }
  }

  function wrapInitChart() {
    var original = window.initChart;
    if (typeof original !== 'function' || original.__simSppgLazyVendorWrapped) return;
    var wrapped = function () {
      var self = this;
      var args = arguments;
      return ensureChart().then(function () {
        return original.apply(self, args);
      }).catch(function (error) {
        reportLoadFailure('grafik dashboard', error);
      });
    };
    wrapped.__simSppgLazyVendorWrapped = true;
    wrapped.__simSppgOriginal = original;
    window.initChart = wrapped;
  }

  function warmAfterLogin() {
    if (!isAuthenticatedAppVisible()) return;
    ensureChart().catch(function (error) { console.warn('Chart.js warmup gagal:', error); });
    var idle = window.requestIdleCallback || function (callback) { return window.setTimeout(callback, 800); };
    idle(function () {
      ensurePdf().then(function () {
        document.dispatchEvent(new CustomEvent('sim-sppg:pdf-vendors-ready'));
      }).catch(function (error) {
        console.warn('PDF vendor warmup gagal:', error);
      });
    });
  }

  window.SimSppgVendors = {
    ensureChart: ensureChart,
    ensurePdf: ensurePdf
  };

  wrapInitChart();

  var observer = new MutationObserver(function () {
    wrapInitChart();
    warmAfterLogin();
  });

  function start() {
    var app = document.getElementById('appContainer');
    if (app) observer.observe(app, { attributes: true, attributeFilter: ['class', 'style'] });
    wrapInitChart();
    warmAfterLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
