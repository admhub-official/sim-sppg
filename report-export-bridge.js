/* Make the professional generator the only active report-generation path. */
(function(){
  'use strict';

  function q(id){ return document.getElementById(id); }
  function root(){ return q('professionalReportRoot'); }
  function ready(){ return !!(root() && q('proBtnGenerate') && q('proReportFormat')); }
  function toast(type,title,message){
    if(typeof window.showToast==='function') window.showToast(type,title,message);
    else if(type==='error') alert(message);
  }

  function syncLegacyPeriod(){
    var oldStart=q('laporan-tgl-mulai'), oldEnd=q('laporan-tgl-selesai');
    var newStart=q('proReportStart'), newEnd=q('proReportEnd');
    if(oldStart&&newStart&&oldStart.value) newStart.value=oldStart.value;
    if(oldEnd&&newEnd&&oldEnd.value) newEnd.value=oldEnd.value;
  }

  function runProfessional(format){
    if(!ready()){
      toast('error','Generator laporan belum siap','Muat ulang halaman lalu buka kembali menu Laporan.');
      return false;
    }
    syncLegacyPeriod();
    q('proReportFormat').value=format||'pdf';
    root().scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(function(){ q('proBtnGenerate').click(); },80);
    return false;
  }

  function replaceLegacyFunction(){
    /* The old report page calls this exact global function. */
    window.handleKirimLaporan=function(){ return runProfessional('pdf'); };
    window.handleKirimLaporan.__professionalReport=true;

    /* Common legacy aliases, when present, must not reopen the raw-table report. */
    ['generateLaporan','generateReport','downloadLaporan','downloadReportPdf','cetakLaporan','printLaporan'].forEach(function(name){
      if(typeof window[name]==='function'){
        window[name]=function(){ return runProfessional(/print|cetak/i.test(name)?'print':'pdf'); };
        window[name].__professionalReport=true;
      }
    });
  }

  function redesignLegacyPanel(){
    var page=q('page-laporan');
    if(!page||!ready()) return;

    var oldButton=q('btn-kirim-laporan');
    if(oldButton){
      oldButton.onclick=function(event){ if(event) event.preventDefault(); return runProfessional('pdf'); };
      oldButton.setAttribute('data-routed-to-professional-report','1');
      oldButton.title='Generate PDF dengan template laporan profesional';
      var label=q('btn-laporan-text'); if(label) label.textContent='Generate PDF Profesional';
      var icon=q('btn-laporan-icon'); if(icon) icon.textContent='📄';
    }

    /* The first legacy card contains the obsolete Telegram/raw-table generator. */
    var oldStart=q('laporan-tgl-mulai');
    var oldCard=oldStart&&oldStart.closest('.card');
    if(oldCard){
      oldCard.style.display='none';
      oldCard.setAttribute('aria-hidden','true');
      oldCard.setAttribute('data-legacy-report-generator','disabled');
    }

    /* Historical files remain accessible but clearly identify that they may use the old layout. */
    var history=q('riwayat-laporan-tbody');
    var historyCard=history&&history.closest('.card');
    if(historyCard&&!historyCard.querySelector('.professional-history-note')){
      var note=document.createElement('div');
      note.className='professional-history-note';
      note.style.cssText='margin:0 0 14px;padding:10px 12px;border:1px solid #facc15;background:#fffbeb;color:#854d0e;border-radius:9px;font-size:12px;line-height:1.5';
      note.textContent='Catatan: file pada riwayat sebelum pembaruan masih menggunakan template laporan lama. Gunakan panel Laporan Profesional di atas untuk membuat dokumen baru.';
      historyCard.insertBefore(note,historyCard.children[1]||null);
    }
  }

  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('button,a,[role="button"]'):null;
    if(!target||!q('page-laporan')||!q('page-laporan').contains(target)) return;
    if(root()&&root().contains(target)) return;
    var sig=String(target.innerText||target.textContent||target.title||target.getAttribute('onclick')||'').toLowerCase();
    if(!/(pdf|print|cetak|excel|xlsx|download|unduh|generate laporan|kirim laporan|export laporan)/.test(sig)) return;
    if(!ready()) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    runProfessional(/excel|xlsx/.test(sig)?'excel':/print|cetak/.test(sig)?'print':'pdf');
  },true);

  function install(){
    replaceLegacyFunction();
    redesignLegacyPanel();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,400);
  setTimeout(install,1200);
  setTimeout(install,2500);
  new MutationObserver(function(){ setTimeout(install,40); }).observe(document.documentElement,{childList:true,subtree:true});
})();