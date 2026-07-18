from pathlib import Path
import re

p=Path('app.js')
s=p.read_text(encoding='utf-8')

anchor="function printCurrentPage() {"
helper=r'''var _printDatasetOverride = null;

function normalizeApiRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function filterPrintRows(page, rows) {
  rows = Array.isArray(rows) ? rows.slice() : [];
  function val(id) { var el=$(id); return el ? String(el.value||'').trim() : ''; }
  function low(v) { return String(v==null?'':v).toLowerCase(); }
  if (page === 'transaksi') {
    var status=val('txFilterStatus'), search=low(val('txSearchInput'));
    return rows.filter(function(x){
      if (status && status !== 'ALL' && String(x.statusPembayaran||x.status||'') !== status) return false;
      if (search && low((x.kode||'')+' '+(x.item||'')+' '+(x.user||'')+' '+(x.sppg||'')).indexOf(search)<0) return false;
      return true;
    });
  }
  if (page === 'master-bahan') {
    var kat=val('bbFilterKategori'), q=low(val('bbSearchInput'));
    return rows.filter(function(x){var k=x['KATEGORI BAHAN BAKU']||x.Kategori||'',t=(x['KODE BAHAN']||'')+' '+(x['NAMA  BAHAN BAKU']||x['NAMA BAHAN BAKU']||'');return(!kat||kat==='ALL'||String(k)===kat)&&(!q||low(t).indexOf(q)>=0);});
  }
  if (page === 'master-supplier') {
    var st=val('supplierFilterStatus'), qs=low(val('supplierSearchInput'));
    return rows.filter(function(x){var status=x.STATUS||x.Status||'',t=(x['NAMA SUPPLIER']||'')+' '+(x['NO WHATSAPP']||'')+' '+(x.EMAIL||'');return(!st||st==='ALL'||String(status)===st)&&(!qs||low(t).indexOf(qs)>=0);});
  }
  if (page === 'survei') {
    var sk=val('surveiFilterKategori'), sq=low(val('surveiSearchInput'));
    return rows.filter(function(x){var k=x['KATEGORI BAHAN BAKU']||x.Kategori||'',t=(x['KODE BAHAN BAKU']||'')+' '+(x['NAMA BAHAN BAKU']||'');return(!sk||sk==='ALL'||String(k)===sk)&&(!sq||low(t).indexOf(sq)>=0);});
  }
  if (page === 'serah-terima') {
    var cond=val('stFilterKondisi'), ss=low(val('stSearchInput'));
    return rows.filter(function(x){var c=x['KONDISI BAHAN BAKU']||x.Kondisi||'',t=(x['NAMA BAHAN BAKU']||'')+' '+(x.PENERIMA||'')+' '+(x.SUPPLIER||'');return(!cond||cond==='ALL'||String(c)===cond)&&(!ss||low(t).indexOf(ss)>=0);});
  }
  if (page === 'users') {
    var ur=val('usersFilterRole'), us=val('usersFilterSPPG'), uq=low(val('usersSearchInput'));
    return rows.filter(function(x){var t=(x.namaLengkap||'')+' '+(x.username||'')+' '+(x.email||'');return(!ur||ur==='ALL'||String(x.role||'')===ur)&&(!us||us==='ALL'||String(x.sppg||'')===us)&&(!uq||low(t).indexOf(uq)>=0);});
  }
  return rows;
}

function preparePrintDataset(done) {
  var map={
    'transaksi':['getTransactions',[{sppgFilter:($('txFilterSPPG')&&$('txFilterSPPG').value!=='ALL')?$('txFilterSPPG').value:'',kategoriFilter:($('txFilterKategori')&&$('txFilterKategori').value!=='ALL')?$('txFilterKategori').value:'',dateStart:$('txFilterTglStart')?$('txFilterTglStart').value:'',dateEnd:$('txFilterTglEnd')?$('txFilterTglEnd').value:''}]],
    'master-bahan':['getMasterBahanBaku',[]],
    'master-supplier':['getMasterSupplier',[]],
    'survei':['getSurveiBahanBaku',[]],
    'serah-terima':['getSerahTerima',[]],
    'menu-mbg':['getMenuHarian',[{}]],
    'pending-payment':['getPendingPayments',[]],
    'users':['getAllUsers',[]]
  };
  var spec=map[currentPage];
  if(!spec){done(null);return;}
  showLoading(true);
  callApi(spec[0],spec[1],function(result){showLoading(false);done(filterPrintRows(currentPage,normalizeApiRows(result)));},function(){showLoading(false);showToast('error','Gagal','Tidak dapat mengambil seluruh data untuk dicetak');done(null);});
}

function printData(defaultRows) {
  return Array.isArray(_printDatasetOverride) ? _printDatasetOverride : (defaultRows || []);
}

'''
if '_printDatasetOverride' not in s:
    if anchor not in s: raise SystemExit('printCurrentPage anchor not found')
    s=s.replace(anchor,helper+anchor,1)

# Replace print function with async preparation while preserving original body as nested executor.
pat=re.compile(r"function printCurrentPage\(\) \{(.*?)\n\}\n\nfunction getActiveFilterInfo",re.S)
m=pat.search(s)
if not m: raise SystemExit('printCurrentPage function not found')
if 'preparePrintDataset(function(rows)' not in m.group(0):
    body=m.group(1)
    new="""function printCurrentPage() {
  if (!currentPage) return;
  var runPrint = function() {"""+body+"""
  };
  var normalPrintPages = ['dashboard','profil'];
  if (normalPrintPages.indexOf(currentPage) > -1 || currentPage === 'approval') { runPrint(); return; }
  preparePrintDataset(function(rows) {
    if (rows === null) return;
    _printDatasetOverride = rows;
    try { runPrint(); }
    finally { setTimeout(function(){ _printDatasetOverride = null; }, 1200); }
  });
}

function getActiveFilterInfo"""
    s=s[:m.start()]+new+s[m.end():]

repls={
"var data = filteredTransactions || [];":"var data = printData(filteredTransactions);",
"var data = filteredMasterBB || [];":"var data = printData(filteredMasterBB);",
"var data = allSuppliers || [];":"var data = printData(allSuppliers);",
"var data = allSurvei || [];":"var data = printData(allSurvei);",
"var data = allSerahTerima || [];":"var data = printData(allSerahTerima);",
"var data = allMenuMBG || [];":"var data = printData(allMenuMBG);",
"var data = allPending || [];":"var data = printData(allPending);",
"var data = allUsers || [];":"var data = printData(allUsers);"
}
for old,new in repls.items():
    if old in s:s=s.replace(old,new,1)

# Menu CSV must fetch the complete unpaginated dataset.
menu_pat=re.compile(r"function exportMenuMBG\(format\) \{.*?\n\}",re.S)
menu_match=menu_pat.search(s)
if not menu_match: raise SystemExit('exportMenuMBG not found')
if 'exportMenuRows(rows)' not in menu_match.group(0):
    menu_new=r'''function exportMenuRows(rows) {
  var flat=[];
  (rows||[]).forEach(function(m){if(m.detail&&m.detail.length){m.detail.forEach(function(d){flat.push({tanggal:m.tanggal,jumlahKpm:m.jumlahKpm,menu:m.menu,namaItem:d.namaItem,jumlah:d.jumlah,satuan:d.satuan,hargaSatuan:d.hargaSatuan,totalHarga:d.totalHarga});});}else{flat.push({tanggal:m.tanggal,jumlahKpm:m.jumlahKpm,menu:m.menu,namaItem:'',jumlah:'',satuan:'',hargaSatuan:'',totalHarga:''});}});
  downloadCSV(flat,[{key:'tanggal',label:'Tanggal'},{key:'jumlahKpm',label:'Jumlah KPM'},{key:'menu',label:'Menu'},{key:'namaItem',label:'Nama Item'},{key:'jumlah',label:'Jumlah'},{key:'satuan',label:'Satuan'},{key:'hargaSatuan',label:'Harga Satuan'},{key:'totalHarga',label:'Total Harga'}],'Menu_MBG');
}
function exportMenuMBG(format) {
  if(format!=='csv'){printCurrentPage();return;}
  showLoading(true);
  callApi('getMenuHarian',[{}],function(result){showLoading(false);exportMenuRows(normalizeApiRows(result));},function(){showLoading(false);showToast('error','Gagal','Tidak dapat mengambil seluruh data menu');});
}'''
    s=s[:menu_match.start()]+menu_new+s[menu_match.end():]

for token in ['preparePrintDataset(function(rows)','function printData(defaultRows)','exportMenuRows(rows)','normalizeApiRows(result)']:
    if token not in s: raise SystemExit('validation '+token)
p.write_text(s,encoding='utf-8')
