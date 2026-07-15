/* SIM-SPPG report runtime v2: backend data source + safe menu ordering */
(function () {
  'use strict';

  var DATASETS = [
    { key:'TRANSAKSI', label:'Data Transaksi', icon:'fa-exchange-alt', action:'getTransactions', dateFields:['tanggal','Tanggal','Timestamp','timestamp'] },
    { key:'APPROVAL', label:'Data Approval Transaksi', icon:'fa-clipboard-check', action:'getTransactions', approval:true, dateFields:['waktuApprove','WAKTU APPROVE','tanggal','Tanggal'] },
    { key:'PENDING', label:'Data Pending Payment', icon:'fa-hand-holding-usd', action:'getPendingPayments', dateFields:['tanggalPending','Tanggal Pending','Timestamp'] },
    { key:'SUPPLIER', label:'Data Supplier', icon:'fa-truck', action:'getMasterSupplier', dateFields:['TIMESTAMP','Timestamp','created_at'] },
    { key:'BAHAN', label:'Master Bahan Baku', icon:'fa-boxes', action:'getMasterBahanBaku', dateFields:['TIMESTAMP','Timestamp','UPDATE','created_at'] },
    { key:'SURVEI', label:'Data Survei Harga', icon:'fa-search-dollar', action:'getSurveiBahanBaku', dateFields:['waktuSurvei','WAKTU SURVEI','TIMESTAMP','Timestamp'] },
    { key:'SERAH_TERIMA', label:'Data Serah Terima', icon:'fa-dolly', action:'getSerahTerima', dateFields:['TIMESTAMP','Timestamp','Tanggal','tanggal'] },
    { key:'MENU', label:'Data Menu Harian', icon:'fa-utensils', action:'getMenuHarian', dateFields:['tanggal','TANGGAL','Tanggal','TIMESTAMP'] },
    { key:'USERS', label:'Data Pengguna', icon:'fa-users', action:'getAllUsers', dateFields:['timestamp','TIMESTAMP','created_at'] },
    { key:'ADMIN_ASSIGNMENT', label:'Konfigurasi Admin', icon:'fa-user-shield', action:'getAdminAssignments', dateFields:['created_at'] },
    { key:'AUDIT', label:'Riwayat Aktivitas', icon:'fa-history', action:'getAuditLog', dateFields:['waktuRaw','TIMESTAMP','timestamp','waktu'] }
  ];

  var SENSITIVE = /(password|passwd|secret|token|refresh|service_role|private_key|\bpin\b|otp|endpoint|p256dh|auth_key)/i;
  function el(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function notify(type,title,msg){ if(typeof window.showToast==='function') window.showToast(type,title,msg); else alert(title+'\n'+msg); }
  function currentRole(){ return window.currentUser && (window.currentUser.role || window.currentUser.ROLE) || ''; }
  function currentEmail(){ return window.currentUser && (window.currentUser.email || window.currentUser.EMAIL || window.currentUser.username) || ''; }

  function reorderMenus(){
    if(!window.MENU_CONFIG) return;
    Object.keys(window.MENU_CONFIG).forEach(function(role){
      var items=window.MENU_CONFIG[role];
      if(!Array.isArray(items)) return;
      var report=items.find(function(x){return x && x.page==='laporan';});
      if(!report) return;
      items=items.filter(function(x){return !(x && x.page==='laporan');});
      var accountIndex=items.findIndex(function(x){return x && x.isHeader && String(x.label).toUpperCase()==='AKUN';});
      if(accountIndex<0){
        var logoutIndex=items.findIndex(function(x){return x && x.action==='logout';});
        accountIndex=logoutIndex<0?items.length:logoutIndex;
      }
      items.splice(accountIndex,0,{label:'PELAPORAN',isHeader:true},report);
      window.MENU_CONFIG[role]=items;
    });
    if(typeof window.buildSidebar==='function') window.buildSidebar();
  }

  function api(action,args){
    return new Promise(function(resolve,reject){
      if(typeof window.callApi!=='function') return reject(new Error('API aplikasi belum siap.'));
      window.callApi(action,args||[],resolve,reject);
    });
  }
  function unwrap(result){
    if(Array.isArray(result)) return result;
    if(result && Array.isArray(result.data)) return result.data;
    if(result && result.success===false) throw new Error(result.message||'Backend menolak permintaan.');
    return [];
  }
  function paramsFor(cfg,start,end){
    var role=currentRole(), email=currentEmail();
    if(cfg.action==='getTransactions') return [{callerRole:role,callerUser:(role==='ADMIN'||role==='SUPER_ADMIN')?'':email,dateStart:start,dateEnd:end}];
    if(cfg.action==='getAllUsers') return [role];
    if(cfg.action==='getMenuHarian') return [{}];
    if(cfg.action==='getAuditLog') return [{}];
    if(cfg.action==='getAdminAssignments') return [''];
    return [];
  }
  function parseDate(v){
    if(!v) return null;
    if(v instanceof Date) return isNaN(v.getTime())?null:v;
    var s=String(v).trim(), m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if(m) return new Date(+m[3],+m[2]-1,+m[1]);
    var d=new Date(s); return isNaN(d.getTime())?null:d;
  }
  function filterDates(rows,cfg,start,end){
    var sd=new Date(start+'T00:00:00'), ed=new Date(end+'T23:59:59.999');
    var field=cfg.dateFields.find(function(f){return rows.some(function(r){return r && parseDate(r[f]);});});
    if(!field) return rows;
    return rows.filter(function(r){var d=parseDate(r[field]); return d && d>=sd && d<=ed;});
  }
  function sanitize(rows){
    return rows.map(function(r){var o={};Object.keys(r||{}).forEach(function(k){if(!SENSITIVE.test(k))o[k]=r[k];});return o;});
  }
  async function loadDataset(cfg,start,end){
    var rows=unwrap(await api(cfg.action,paramsFor(cfg,start,end)));
    if(cfg.approval) rows=rows.filter(function(r){return !!(r.approvedBy||r['APPROVED BY']||r.waktuApprove||r['WAKTU APPROVE']);});
    return sanitize(filterDates(rows,cfg,start,end));
  }

  function replaceChoices(){
    var grid=document.querySelector('.report-check-grid');
    if(!grid) return;
    grid.innerHTML=DATASETS.map(function(d,i){return '<label class="report-check"><input class="report-data-check" type="checkbox" value="'+esc(d.key)+'" '+(i<8?'checked':'')+'><span class="report-check-icon"><i class="fas '+d.icon+'"></i></span><span><b>'+esc(d.label)+'</b><small>Sumber backend aplikasi</small></span><i class="fas fa-check report-check-mark"></i></label>';}).join('');
    grid.querySelectorAll('.report-data-check').forEach(function(c){c.addEventListener('change',updateCount);});
    updateCount();
  }
  function updateCount(){var c=document.querySelectorAll('.report-data-check:checked').length;if(el('reportSelectedCount'))el('reportSelectedCount').textContent=c+' dipilih';}
  function selected(){return Array.from(document.querySelectorAll('.report-data-check:checked')).map(function(c){return DATASETS.find(function(d){return d.key===c.value;});}).filter(Boolean);}
  function columns(rows){var a=[];rows.forEach(function(r){Object.keys(r||{}).forEach(function(k){if(a.indexOf(k)<0)a.push(k);});});return a;}
  function cell(v){return v==null?'':(typeof v==='object'?JSON.stringify(v):String(v));}
  function loadScript(src,test){if(test())return Promise.resolve();return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){no(new Error('Library file gagal dimuat.'));};document.head.appendChild(s);});}

  async function excel(data,start,end){
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',function(){return !!window.XLSX;});
    var wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['LAPORAN SIM-SPPG'],['Periode',start+' s.d. '+end],['Dibuat oleh',currentEmail()],[],['Data','Jumlah']].concat(data.map(function(d){return [d.cfg.label,d.rows.length];}))),'Ringkasan');
    data.forEach(function(d,i){var cols=columns(d.rows), rows=d.rows.map(function(r){var o={};cols.forEach(function(k){o[k]=cell(r[k]);});return o;});var sh=rows.length?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([['Tidak ada data pada periode terpilih']]);sh['!cols']=cols.map(function(k){return {wch:Math.min(Math.max(k.length+2,14),42)};});XLSX.utils.book_append_sheet(wb,sh,d.cfg.label.replace(/[\\\/?*\[\]:]/g,'').slice(0,28)||('Data '+(i+1)));});
    XLSX.writeFile(wb,'laporan-sim-sppg_'+start+'_'+end+'.xlsx',{compression:true});
  }
  async function pdf(data,start,end){
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF);});
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',function(){return !!window.jspdf.jsPDF.API.autoTable;});
    var doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}), w=doc.internal.pageSize.getWidth();
    function head(title,sub){doc.setFillColor(30,111,156);doc.roundedRect(10,10,w-20,24,3,3,'F');doc.setTextColor(255);doc.setFontSize(15);doc.setFont('helvetica','bold');doc.text(title,16,21);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text(sub,16,28);doc.setTextColor(30);}
    head('Laporan SIM-SPPG','Periode '+start+' s.d. '+end+' • '+currentEmail());
    doc.autoTable({startY:42,head:[['No','Kelompok Data','Jumlah']],body:data.map(function(d,i){return [i+1,d.cfg.label,d.rows.length];}),headStyles:{fillColor:[30,111,156]},styles:{fontSize:8}});
    data.forEach(function(d){doc.addPage();head(d.cfg.label,'Periode '+start+' s.d. '+end+' • '+d.rows.length+' baris');var c=columns(d.rows).slice(0,12);if(!d.rows.length){doc.text('Tidak ada data pada periode yang dipilih.',14,48);return;}doc.autoTable({startY:40,head:[['No'].concat(c)],body:d.rows.map(function(r,i){return [i+1].concat(c.map(function(k){return cell(r[k]);}));}),headStyles:{fillColor:[30,111,156],fontSize:7},styles:{fontSize:6.2,cellPadding:1.6,overflow:'linebreak'},alternateRowStyles:{fillColor:[243,248,251]}});});
    doc.save('laporan-sim-sppg_'+start+'_'+end+'.pdf');
  }

  async function download(){
    var start=el('reportStartDate').value,end=el('reportEndDate').value,format=el('reportFormat').value,cfgs=selected(),btn=el('btnDownloadReport');
    if(!start||!end)return notify('warning','Periode belum lengkap','Pilih tanggal mulai dan selesai.');
    if(new Date(start)>new Date(end))return notify('warning','Periode tidak valid','Tanggal mulai tidak boleh melewati tanggal selesai.');
    if(!cfgs.length)return notify('warning','Data belum dipilih','Pilih minimal satu jenis data.');
    btn.disabled=true;btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i><span>Mengambil data...</span>';
    try{var data=[];for(var i=0;i<cfgs.length;i++){if(el('reportProgressText'))el('reportProgressText').textContent='Mengambil '+cfgs[i].label+' ('+(i+1)+'/'+cfgs.length+')...';data.push({cfg:cfgs[i],rows:await loadDataset(cfgs[i],start,end)});}if(format==='xlsx')await excel(data,start,end);else await pdf(data,start,end);notify('success','Laporan berhasil dibuat','Data berhasil diambil melalui backend aplikasi dan file telah diunduh.');}
    catch(e){console.error('[REPORT V2]',e);notify('error','Gagal mengambil laporan',e.message||String(e));}
    finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-download"></i><span>Download Laporan</span>';}
  }

  function install(){
    reorderMenus();
    var tries=0,t=setInterval(function(){tries++;var old=el('btnDownloadReport');if(!old){if(tries>40)clearInterval(t);return;}clearInterval(t);replaceChoices();var fresh=old.cloneNode(true);old.parentNode.replaceChild(fresh,old);fresh.addEventListener('click',download);var all=el('reportSelectAll'),clear=el('reportClearAll');if(all){var na=all.cloneNode(true);all.parentNode.replaceChild(na,all);na.addEventListener('click',function(){document.querySelectorAll('.report-data-check').forEach(function(x){x.checked=true;});updateCount();});}if(clear){var nc=clear.cloneNode(true);clear.parentNode.replaceChild(nc,clear);nc.addEventListener('click',function(){document.querySelectorAll('.report-data-check').forEach(function(x){x.checked=false;});updateCount();});}},150);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();