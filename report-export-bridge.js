/* Route legacy report buttons to the professional report generator. */
(function(){
  'use strict';

  function textOf(el){
    return String((el && (el.innerText || el.textContent || el.title || el.getAttribute('aria-label') || el.getAttribute('onclick'))) || '').toLowerCase();
  }

  function reportPage(){
    return document.getElementById('page-laporan') || document.querySelector('[data-page="laporan"], .page-laporan');
  }

  function professionalRoot(){
    return document.getElementById('professionalReportRoot');
  }

  function professionalReady(){
    return !!(professionalRoot() && document.getElementById('proBtnGenerate') && document.getElementById('proReportFormat'));
  }

  function selectedFormat(signature){
    if (/excel|xlsx/.test(signature)) return 'excel';
    if (/print|cetak/.test(signature)) return 'print';
    if (/pdf/.test(signature)) return 'pdf';
    return document.getElementById('proReportFormat') ? document.getElementById('proReportFormat').value : 'pdf';
  }

  function runProfessional(format){
    var select = document.getElementById('proReportFormat');
    var button = document.getElementById('proBtnGenerate');
    if (!select || !button) {
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'Generator laporan belum siap', 'Muat ulang halaman lalu buka kembali menu Laporan.');
      }
      return;
    }
    select.value = format;
    professionalRoot().scrollIntoView({behavior:'smooth', block:'start'});
    setTimeout(function(){ button.click(); }, 80);
  }

  document.addEventListener('click', function(event){
    var page = reportPage();
    var target = event.target && event.target.closest ? event.target.closest('button,a,[role="button"]') : null;
    if (!page || !target || !page.contains(target)) return;
    if (professionalRoot() && professionalRoot().contains(target)) return;

    var signature = textOf(target);
    var isLegacyExport = /(pdf|print|cetak|excel|xlsx|download|unduh|generate laporan|export laporan)/.test(signature);
    if (!isLegacyExport) return;

    if (!professionalReady()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runProfessional(selectedFormat(signature));
  }, true);

  function markLegacyButtons(){
    var page = reportPage();
    if (!page || !professionalReady()) return;
    page.querySelectorAll('button,a,[role="button"]').forEach(function(el){
      if (professionalRoot().contains(el)) return;
      var signature = textOf(el);
      if (!/(pdf|print|cetak|excel|xlsx|download|unduh|generate laporan|export laporan)/.test(signature)) return;
      el.setAttribute('data-routed-to-professional-report','1');
      el.title = 'Menggunakan generator laporan profesional';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markLegacyButtons, {once:true});
  else markLegacyButtons();
  setTimeout(markLegacyButtons, 700);
  setTimeout(markLegacyButtons, 1800);
  new MutationObserver(function(){ setTimeout(markLegacyButtons, 60); }).observe(document.documentElement,{childList:true,subtree:true});
})();
