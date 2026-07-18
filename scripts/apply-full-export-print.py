from pathlib import Path

p = Path('app.js')
s = p.read_text(encoding='utf-8')
marker = '/* FULL_DATASET_EXPORT_PRINT_V1 */'
if marker in s:
    print('Full export/print patch already applied.')
    raise SystemExit(0)

code = r'''

/* FULL_DATASET_EXPORT_PRINT_V1 */
(function(){
'use strict';
var MODULES={
  transaksi:{fn:'getTransactions',page:'transaksi'},approval:{fn:'getTransactions',page:'approval'},
  users:{fn:'getAllUsers',page:'users'},'master-bahan':{fn:'getMasterBahanBaku',page:'master-bahan'},
  'master-supplier':{fn:'getMasterSupplier',page:'master-supplier'},survei:{fn:'getSurveiBahanBaku',page:'survei'},
  'serah-terima':{fn:'getSerahTerima',page:'serah-terima'},'menu-mbg':{fn:'getMenuHarian',page:'menu-mbg'},
  'pending-payment':{fn:'getPendingPayments',page:'pending-payment'},'audit-log':{fn:'getAuditLog',page:'audit-log'}
};
function api(fn,params){return new Promise(function(resolve,reject){callApi(fn,params||[],resolve,reject)})}
function rowsOf(result){
  if(Array.isArray(result))return result;
  if(result&&Array.isArray(result.data))return result.data;
  if(result&&result.result&&Array.isArray(result.result.data))return result.result.data;
  return [];
}
function elementValue(id){var e=document.getElementById(id);return e?String(e.value||'').trim():''}
function transactionFilters(){
  var ids=[['txFilterSPPG','sppg'],['filterSPPG','sppg'],['txFilterYayasan','yayasan'],['filterYayasan','yayasan'],['txFilterKategori','kategori'],['filterKategori','kategori'],['txFilterTglStart','dateStart'],['filterTglStart','dateStart'],['txFilterTglEnd','dateEnd'],['filterTglEnd','dateEnd']];
  var out={};ids.forEach(function(x){var v=elementValue(x[0]);if(v&&v!=='ALL'&&out[x[1]]===undefined)out[x[1]]=v});return out;
}
function apiParams(key){
  if(key==='transaksi'||key==='approval')return [transactionFilters()];
  if(key==='audit-log')return [{search:elementValue('auditSearchInput'),action:elementValue('auditFilterAction'),dateStart:elementValue('auditFilterTglStart'),dateEnd:elementValue('auditFilterTglEnd')}];
  return [{}];
}
function filterControls(page){
  var root=document.getElementById('page-'+page);if(!root)return[];
  return Array.prototype.slice.call(root.querySelectorAll('input,select')).filter(function(e){
    var id=String(e.id||'').toLowerCase(),v=String(e.value||'').trim();
    return v&&v!=='ALL'&&(id.indexOf('filter')>=0||id.indexOf('search')>=0);
  });
}
function localFilter(rows,page){
  var controls=filterControls(page);if(!controls.length)return rows;
  return rows.filter(function(row){
    var text=JSON.stringify(row||{}).toLowerCase();
    return controls.every(function(e){
      var id=String(e.id||'').toLowerCase(),v=String(e.value||'').trim().toLowerCase();
      if(!v||v==='all'||id.indexOf('tglstart')>=0||id.indexOf('tglend')>=0||id.indexOf('datestart')>=0||id.indexOf('dateend')>=0)return true;
      return text.indexOf(v)>=0;
    });
  });
}
async function fetchAll(key){
  var cfg=MODULES[key];if(!cfg)throw new Error('Modul ekspor tidak didukung: '+key);
  var first=await api(cfg.fn,apiParams(key));var firstRows=rowsOf(first);
  var total=Number(first&&first.total)||firstRows.length,hasMore=!!(first&&first.hasMore),page=Number(first&&first.page)||1,pageSize=Number(first&&first.pageSize)||100;
  var rows=firstRows.slice();
  while(hasMore&&page<100){page++;var params=apiParams(key);var opt=params[0]&&typeof params[0]==='object'?Object.assign({},params[0]):{};opt.page=page;opt.pageSize=Math.min(100,Math.max(25,pageSize));params=[opt];var next=await api(cfg.fn,params);rows=rows.concat(rowsOf(next));hasMore=!!(next&&next.hasMore);if(rows.length>=total)break;}
  return localFilter(rows,cfg.page);
}
function flatten(row){
  var out={};Object.keys(row||{}).forEach(function(k){var v=row[k];if(v===null||v===undefined)out[k]='';else if(typeof v==='object')out[k]=JSON.stringify(v);else out[k]=v});return out;
}
function csvCell(v){var x=String(v==null?'':v).replace(/\r?\n/g,' ');return '"'+x.replace(/"/g,'""')+'"'}
function downloadCsv(rows,key){
  var flat=rows.map(flatten),cols=[];flat.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});
  if(!cols.length)throw new Error('Tidak ada data sesuai filter aktif.');
  var lines=[cols.map(csvCell).join(',')];flat.forEach(function(r){lines.push(cols.map(function(c){return csvCell(r[c])}).join(','))});
  var blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SIM-SPPG_'+key+'_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
function printRows(rows,key){
  var flat=rows.map(flatten),cols=[];flat.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});if(!cols.length)throw new Error('Tidak ada data sesuai filter aktif.');
  var escFn=typeof esc==='function'?esc:function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var html='<!doctype html><html><head><meta charset="utf-8"><title>SIM-SPPG '+escFn(key)+'</title><style>@page{size:A4 landscape;margin:10mm}body{font:10px Arial;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#555}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:5px;vertical-align:top;word-break:break-word}th{background:#eef4f8}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>SIM-SPPG — '+escFn(key)+'</h1><p>Total '+rows.length+' data • '+new Date().toLocaleString('id-ID')+'</p><table><thead><tr>'+cols.map(function(c){return'<th>'+escFn(c)+'</th>'}).join('')+'</tr></thead><tbody>'+flat.map(function(r){return'<tr>'+cols.map(function(c){return'<td>'+escFn(r[c])+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>';
  var w=window.open('','_blank');if(!w)throw new Error('Popup print diblokir browser.');w.document.open();w.document.write(html);w.document.close();
}
function pageKey(){return String(window.currentPage||'').trim()}
async function run(kind){var key=pageKey();if(!MODULES[key])throw new Error('Ekspor penuh belum tersedia untuk halaman ini.');if(typeof showLoading==='function')showLoading(true);try{var rows=await fetchAll(key);if(kind==='csv')downloadCsv(rows,key);else printRows(rows,key);if(typeof showToast==='function')showToast('success',kind==='csv'?'CSV Dibuat':'Print Disiapkan',rows.length+' data sesuai filter aktif.');}finally{if(typeof showLoading==='function')showLoading(false)}}
window.exportCurrentFilteredCSV=function(){run('csv').catch(function(e){if(typeof showToast==='function')showToast('error','Ekspor Gagal',e.message);else alert(e.message)})};
window.printCurrentFilteredData=function(){run('print').catch(function(e){if(typeof showToast==='function')showToast('error','Print Gagal',e.message);else alert(e.message)})};
document.addEventListener('click',function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('button,a'):null;if(!b||pageKey()==='laporan')return;
  var signature=(String(b.textContent||'')+' '+String(b.title||'')+' '+String(b.getAttribute('aria-label')||'')+' '+String(b.getAttribute('onclick')||'')).toLowerCase();
  var kind=signature.indexOf('csv')>=0||signature.indexOf('export')>=0?'csv':signature.indexOf('print')>=0||signature.indexOf('cetak')>=0?'print':'';
  if(!kind||!MODULES[pageKey()])return;
  ev.preventDefault();ev.stopImmediatePropagation();if(kind==='csv')window.exportCurrentFilteredCSV();else window.printCurrentFilteredData();
},true);
})();
'''
p.write_text(s + code, encoding='utf-8')
print('Full dataset CSV and print layer appended.')
