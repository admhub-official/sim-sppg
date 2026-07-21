/* SIM-SPPG Professional Report V1
 * Stage 1: report configuration, dynamic document number, executive summary,
 * print-friendly preview, and stable PDF export using jsPDF + AutoTable.
 */
(function(){
  'use strict';

  var MODULES = [
    ['transaksi','Transaksi'],['approval','Approval'],['master-bahan','Master Bahan Baku'],
    ['master-supplier','Data Supplier'],['survei','Survei Harga'],['serah-terima','Serah Terima'],
    ['menu-mbg','Data Menu MBG'],['users','Pengguna'],['audit-log','Riwayat Aktivitas']
  ];
  var mounted = false;
  var lastReport = null;

  function q(id){ return document.getElementById(id); }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return txt(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function money(v){ return 'Rp ' + (Number(v)||0).toLocaleString('id-ID'); }
  function dateID(v){ var d=new Date(v); return isNaN(d)?'-':d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}); }
  function nowID(){ return new Date().toLocaleString('id-ID',{dateStyle:'long',timeStyle:'short'}); }
  function docNo(){ var d=new Date(),u=(window.currentUser||{}),role=txt(u.role||'USER').replace(/[^A-Z]/gi,'').toUpperCase(); return 'SIM-SPPG/LAP/'+d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'/'+role; }
  function currentName(){ var u=window.currentUser||{}; return txt(u.namaLengkap||u.nama||u.name||u.email||u.username||'Pengguna SIM-SPPG'); }
  function currentRole(){ return txt((window.currentUser||{}).role||'USER').toUpperCase(); }

  function api(fn,params){ return new Promise(function(resolve,reject){ if(typeof window.callApi!=='function') return reject(new Error('API aplikasi belum siap.')); window.callApi(fn,params||[],resolve,reject); }); }
  function rowsOf(r){ if(Array.isArray(r))return r; if(r&&Array.isArray(r.data))return r.data; if(r&&r.result&&Array.isArray(r.result.data))return r.result.data; return []; }
  async function allRows(fn,filter){
    var page=1,rows=[],more=true,total=0;
    while(more&&page<=100){
      var opt=Object.assign({},filter||{},{page:page,pageSize:100});
      var result=await api(fn,[opt]); var part=rowsOf(result); rows=rows.concat(part);
      total=Number(result&&result.total)||rows.length; more=!!(result&&result.hasMore)&&rows.length<total; page++;
      if(!result||Array.isArray(result)) more=false;
    }
    return rows;
  }

  function value(row,names){ for(var i=0;i<names.length;i++){ if(row&&row[names[i]]!=null&&row[names[i]]!=='')return row[names[i]]; } return ''; }
  function normalizeStatus(v){ return txt(v).toUpperCase().replace(/\s+/g,'_'); }
  function transactionModel(row){
    return {
      id:value(row,['id','ID']), tanggal:value(row,['tanggal','Tanggal']), kategori:txt(value(row,['kategori','Kategori'])).toUpperCase(),
      jenis:value(row,['jenisKategori','Jenis Kategori']), sppg:value(row,['sppg','SPPG']), yayasan:value(row,['yayasan','YAYASAN']),
      item:value(row,['item','namaItem','Nama Item/ Bahan Baku']), nominal:Number(value(row,['nominal','Nominal']))||0,
      status:normalizeStatus(value(row,['metodeTransaksi','Metode Transaksi','status'])), user:value(row,['user','User']),
      bukti:!!(value(row,['uploadFoto','uploadFile','notaPembelian','jumlahBuktiPembayaran'])||value(row,['ttdUser','ttdVerifikator']))
    };
  }

  function config(){
    var selected=[]; document.querySelectorAll('#proReportModules input:checked').forEach(function(x){selected.push(x.value);});
    return {dateStart:q('proReportStart').value,dateEnd:q('proReportEnd').value,detail:q('proReportDetail').value,proof:q('proReportProof').checked,modules:selected,format:q('proReportFormat').value};
  }

  function filterTransactions(rows,cfg){
    return rows.map(transactionModel).filter(function(r){
      var d=txt(r.tanggal).slice(0,10); if(cfg.dateStart&&d&&d<cfg.dateStart)return false; if(cfg.dateEnd&&d&&d>cfg.dateEnd)return false; return true;
    });
  }

  function summarize(rows){
    var s={income:0,expense:0,approved:0,pending:0,total:rows.length,withProof:0,categories:{},sppg:{}};
    rows.forEach(function(r){
      if(r.kategori==='PEMASUKAN')s.income+=r.nominal; else if(r.kategori==='PENGELUARAN'){s.expense+=r.nominal;var k=txt(r.jenis||r.item||'Lainnya')||'Lainnya';s.categories[k]=(s.categories[k]||0)+r.nominal;}
      if(['SUDAH_DIBAYAR','APPROVED','LUNAS'].indexOf(r.status)>=0)s.approved++; else s.pending++;
      if(r.bukti)s.withProof++;
      var sp=txt(r.sppg)||'Tanpa SPPG'; if(!s.sppg[sp])s.sppg[sp]={income:0,expense:0,count:0}; s.sppg[sp].count++; if(r.kategori==='PEMASUKAN')s.sppg[sp].income+=r.nominal; else if(r.kategori==='PENGELUARAN')s.sppg[sp].expense+=r.nominal;
    });
    s.balance=s.income-s.expense;
    s.topCategories=Object.keys(s.categories).map(function(k){return{name:k,value:s.categories[k]};}).sort(function(a,b){return b.value-a.value;}).slice(0,3);
    return s;
  }

  function installCss(){ if(q('professionalReportStyle'))return; var st=document.createElement('style');st.id='professionalReportStyle';st.textContent='\
#professionalReportRoot{margin:0 0 22px}.pro-report-panel{background:#fff;border:1px solid #dbe4ec;border-radius:20px;padding:22px;box-shadow:0 8px 24px rgba(15,23,42,.06)}.pro-report-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}.pro-report-head h2{margin:0 0 5px;font-size:22px;color:#172033}.pro-report-head p{margin:0;color:#64748b;font-size:12px}.pro-report-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.pro-field label,.pro-section-title{display:block;margin-bottom:7px;color:#475569;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.pro-field input,.pro-field select{width:100%;min-height:44px;border:1px solid #cfd8e3;border-radius:10px;padding:9px 11px;background:#fff}.pro-modules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.pro-check{display:flex;gap:8px;align-items:center;padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;font-size:12px}.pro-report-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.pro-report-actions button{border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer}.pro-primary{background:#1972b5;color:#fff}.pro-secondary{background:#edf4f8;color:#15577a}.pro-preview{margin-top:20px;background:#f1f5f9;border-radius:16px;padding:18px}.pro-document{max-width:1120px;margin:auto;background:#fff;color:#172033;padding:34px;box-shadow:0 8px 30px rgba(15,23,42,.08)}.pro-cover{min-height:620px;display:flex;flex-direction:column;justify-content:center;border:2px solid #15577a;padding:52px}.pro-cover h1{font-size:34px;margin:0 0 12px;color:#15577a}.pro-cover .meta{margin-top:34px;display:grid;grid-template-columns:170px 1fr;gap:9px;font-size:13px}.pro-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:25px 0}.pro-kpi{border:1px solid #dbe4ec;border-radius:14px;padding:17px}.pro-kpi span{display:block;color:#64748b;font-size:10px;font-weight:800;letter-spacing:.6px}.pro-kpi strong{display:block;margin-top:7px;font-size:21px}.pro-kpi.green{border-top:4px solid #10b981}.pro-kpi.red{border-top:4px solid #ef4444}.pro-kpi.blue{border-top:4px solid #1972b5}.pro-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.pro-summary-box{border:1px solid #dbe4ec;border-radius:14px;padding:16px}.pro-summary-box h3{margin:0 0 12px;font-size:14px}.pro-bar{height:9px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:5px}.pro-bar i{display:block;height:100%;background:#1972b5}.pro-proof{font-weight:700;color:#059669}.pro-page-break{break-before:page;page-break-before:always}@media(max-width:900px){.pro-report-grid{grid-template-columns:1fr 1fr}.pro-modules{grid-template-columns:1fr 1fr}}@media(max-width:560px){.pro-report-grid,.pro-modules,.pro-kpi-grid,.pro-summary-grid{grid-template-columns:1fr}.pro-document{padding:18px}.pro-cover{padding:28px;min-height:520px}}@media print{body>*:not(#professionalPrintHost){display:none!important}#professionalPrintHost{display:block!important}.pro-document{box-shadow:none;max-width:none;padding:0}.pro-cover{min-height:250mm}.pro-kpi,.pro-summary-box{break-inside:avoid;page-break-inside:avoid}}';document.head.appendChild(st); }

  function mount(){
    if(mounted)return; var page=q('page-laporan')||document.querySelector('[data-page="laporan"],.page-laporan'); if(!page)return;
    installCss(); var host=document.createElement('div');host.id='professionalReportRoot';host.innerHTML='<div class="pro-report-panel"><div class="pro-report-head"><div><h2>Laporan Profesional SIM-SPPG</h2><p>Pilih cakupan modul, periode, detail, dan format sebelum membuat laporan.</p></div><span style="font-size:11px;color:#64748b">Nomor dibuat otomatis saat generate</span></div><div class="pro-report-grid"><div class="pro-field"><label>Mulai periode</label><input id="proReportStart" type="date"></div><div class="pro-field"><label>Akhir periode</label><input id="proReportEnd" type="date"></div><div class="pro-field"><label>Level detail</label><select id="proReportDetail"><option value="summary">Ringkas</option><option value="full">Lengkap</option></select></div><div class="pro-field"><label>Format output</label><select id="proReportFormat"><option value="pdf">PDF</option><option value="print">Print-friendly HTML</option><option value="excel">Excel (tahap berikutnya)</option></select></div></div><div class="pro-section-title" style="margin-top:17px">Section yang disertakan</div><div class="pro-modules" id="proReportModules">'+MODULES.map(function(m){return'<label class="pro-check"><input type="checkbox" value="'+m[0]+'" '+(m[0]==='transaksi'||m[0]==='approval'?'checked':'')+'> '+m[1]+'</label>';}).join('')+'</div><label class="pro-check" style="margin-top:12px;display:inline-flex"><input id="proReportProof" type="checkbox" checked> Sertakan indikator ketersediaan bukti</label><div class="pro-report-actions"><button class="pro-secondary" id="proBtnPreview">Tampilkan Preview</button><button class="pro-primary" id="proBtnGenerate">Generate / Download</button></div><div id="proReportPreview" class="pro-preview" hidden></div></div>';
    page.insertBefore(host,page.firstChild); mounted=true;
    var d=new Date(),first=new Date(d.getFullYear(),d.getMonth(),1);q('proReportStart').value=first.toISOString().slice(0,10);q('proReportEnd').value=d.toISOString().slice(0,10);
    q('proBtnPreview').onclick=function(){run('preview');}; q('proBtnGenerate').onclick=function(){run(q('proReportFormat').value);};
  }

  function reportHtml(report){ var s=report.summary,c=report.config,period=(c.dateStart?dateID(c.dateStart):'Awal data')+' – '+(c.dateEnd?dateID(c.dateEnd):'Hari ini'); var maxCat=s.topCategories.length?s.topCategories[0].value:1;
    return '<article class="pro-document"><section class="pro-cover"><div style="font-weight:800;letter-spacing:1.5px;color:#64748b">SIM-SPPG</div><h1>Laporan Operasional dan Keuangan</h1><p style="color:#64748b;max-width:620px">Dokumen ringkasan terstruktur berdasarkan modul dan periode yang dipilih pengguna.</p><div class="meta"><b>Nomor dokumen</b><span>'+esc(report.number)+'</span><b>Periode</b><span>'+esc(period)+'</span><b>Dicetak oleh</b><span>'+esc(currentName())+'</span><b>Role</b><span>'+esc(currentRole())+'</span><b>Waktu generate</b><span>'+esc(report.generatedAt)+'</span><b>Section</b><span>'+esc(c.modules.join(', '))+'</span></div></section><section class="pro-page-break"><h2>Ringkasan Eksekutif</h2><p style="color:#64748b">Ikhtisar transaksi dan status pemrosesan pada periode laporan.</p><div class="pro-kpi-grid"><div class="pro-kpi green"><span>TOTAL PEMASUKAN</span><strong>'+money(s.income)+'</strong><small>'+s.total+' transaksi keseluruhan</small></div><div class="pro-kpi red"><span>TOTAL PENGELUARAN</span><strong>'+money(s.expense)+'</strong><small>Realisasi belanja dan operasional</small></div><div class="pro-kpi blue"><span>SALDO BERSIH</span><strong>'+money(s.balance)+'</strong><small>Pemasukan dikurangi pengeluaran</small></div><div class="pro-kpi green"><span>SELESAI / DISETUJUI</span><strong>'+s.approved+'</strong><small>Transaksi selesai diproses</small></div><div class="pro-kpi red"><span>MASIH PENDING</span><strong>'+s.pending+'</strong><small>Belum selesai atau menunggu verifikasi</small></div><div class="pro-kpi blue"><span>BUKTI TERSEDIA</span><strong>'+s.withProof+'</strong><small>Indikator bukti, tanpa lampiran gambar</small></div></div><div class="pro-summary-grid"><div class="pro-summary-box"><h3>Top 3 kategori pengeluaran</h3>'+(s.topCategories.length?s.topCategories.map(function(x){var pct=s.expense?x.value/s.expense*100:0;return'<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:10px"><span>'+esc(x.name)+'</span><b>'+money(x.value)+' ('+pct.toFixed(1)+'%)</b></div><div class="pro-bar"><i style="width:'+Math.min(100,x.value/maxCat*100)+'%"></i></div></div>';}).join(''):'<p>Belum ada pengeluaran.</p>')+'</div><div class="pro-summary-box"><h3>Ikhtisar per SPPG</h3>'+Object.keys(s.sppg).sort().slice(0,8).map(function(k){var x=s.sppg[k];return'<div style="display:grid;grid-template-columns:1fr auto;gap:8px;border-bottom:1px solid #eef2f6;padding:8px 0"><span>'+esc(k)+' <small>('+x.count+' transaksi)</small></span><b>'+money(x.income-x.expense)+'</b></div>';}).join('')+'</div></div></section></article>'; }

  async function build(){ var c=config(); if(!c.modules.length)throw new Error('Pilih minimal satu section laporan.'); var rows=[]; if(c.modules.indexOf('transaksi')>=0||c.modules.indexOf('approval')>=0)rows=await allRows('getTransactions',{dateStart:c.dateStart,dateEnd:c.dateEnd}); rows=filterTransactions(rows,c); return {number:docNo(),generatedAt:nowID(),config:c,transactions:rows,summary:summarize(rows)}; }
  function showLoading(v){ if(typeof window.showLoading==='function')window.showLoading(v); }
  function toast(type,title,msg){ if(typeof window.showToast==='function')window.showToast(type,title,msg); else if(type==='error')alert(msg); }

  function ensureScript(src,test){ return new Promise(function(resolve,reject){if(test())return resolve();var s=document.createElement('script');s.src=src;s.onload=function(){test()?resolve():reject(new Error('Library PDF gagal dimuat.'));};s.onerror=function(){reject(new Error('Library PDF gagal dimuat.'));};document.head.appendChild(s);}); }
  async function ensurePdf(){ await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF);}); }
  function addFooter(doc,report){ var pages=doc.getNumberOfPages();for(var i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(100);doc.text('SIM-SPPG • '+report.number,14,202);doc.text('Halaman '+i+' dari '+pages,283,202,{align:'right'});} }
  async function pdf(report){ await ensurePdf();var jsPDF=window.jspdf.jsPDF,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),s=report.summary,c=report.config;doc.setFillColor(21,87,122);doc.rect(0,0,297,210,'F');doc.setTextColor(255);doc.setFontSize(11);doc.text('SIM-SPPG',20,25);doc.setFontSize(28);doc.text('Laporan Operasional dan Keuangan',20,60);doc.setFontSize(12);doc.text('Periode: '+(c.dateStart||'Awal data')+' s.d. '+(c.dateEnd||'Hari ini'),20,77);doc.text('Nomor: '+report.number,20,88);doc.text('Dicetak oleh: '+currentName()+' • '+currentRole(),20,99);doc.addPage('a4','landscape');doc.setTextColor(23,32,51);doc.setFontSize(22);doc.text('Ringkasan Eksekutif',14,18);var cards=[['Pemasukan',money(s.income)],[ 'Pengeluaran',money(s.expense)],['Saldo bersih',money(s.balance)],['Selesai',String(s.approved)],['Pending',String(s.pending)],['Bukti tersedia',String(s.withProof)]];cards.forEach(function(x,i){var col=i%3,row=Math.floor(i/3),xx=14+col*92,yy=30+row*42;doc.setDrawColor(210);doc.roundedRect(xx,yy,84,32,3,3);doc.setFontSize(9);doc.setTextColor(100);doc.text(x[0].toUpperCase(),xx+6,yy+9);doc.setFontSize(16);doc.setTextColor(23,32,51);doc.text(x[1],xx+6,yy+22);});doc.setFontSize(13);doc.text('Top kategori pengeluaran',14,124);doc.setFontSize(10);s.topCategories.forEach(function(x,i){var pct=s.expense?x.value/s.expense*100:0;doc.text((i+1)+'. '+x.name+' — '+money(x.value)+' ('+pct.toFixed(1)+'%)',18,136+i*10);});addFooter(doc,report);doc.save('SIM-SPPG_Laporan_'+new Date().toISOString().slice(0,10)+'.pdf'); }
  function printReport(report){ var old=q('professionalPrintHost');if(old)old.remove();var host=document.createElement('div');host.id='professionalPrintHost';host.innerHTML=reportHtml(report);document.body.appendChild(host);setTimeout(function(){window.print();setTimeout(function(){host.remove();},500);},150); }

  async function run(kind){ showLoading(true);try{var report=await build();lastReport=report;var preview=q('proReportPreview');preview.innerHTML=reportHtml(report);preview.hidden=false;if(kind==='preview'){toast('success','Preview siap','Ringkasan Eksekutif berhasil disusun.');return;}if(kind==='pdf')await pdf(report);else if(kind==='print')printReport(report);else toast('warning','Tahap berikutnya','Export Excel multi-sheet akan diterapkan setelah section transaksi selesai.');}catch(e){toast('error','Laporan gagal',e&&e.message?e.message:String(e));}finally{showLoading(false);} }

  function tryMount(){mount();if(!mounted)setTimeout(tryMount,500);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryMount,{once:true});else tryMount();
  new MutationObserver(function(){if(!mounted)mount();}).observe(document.documentElement,{childList:true,subtree:true});
})();