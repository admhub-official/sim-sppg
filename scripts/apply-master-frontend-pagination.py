from pathlib import Path

p=Path('app.js')
s=p.read_text()

s=s.replace(
"var usersServerTotal = 0, usersServerPaged = false, usersFilterTimer = null;",
"var usersServerTotal = 0, usersServerPaged = false, usersFilterTimer = null;\nvar bbServerTotal = 0, bbServerPaged = false, bbFilterTimer = null;\nvar supplierServerTotal = 0, supplierServerPaged = false, supplierFilterTimer = null;"
)

# Master BB loader
start=s.index('function loadMasterBB() {')
end=s.index('function renderMasterBBTable()', start)
new="""function loadMasterBB(page, forceAll) {
  page=Math.max(1,Number(page)||bbPage||1); forceAll=!!forceAll;
  showLoading(true);
  callApi('getMasterBahanBaku', forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}], function(result) {
    showLoading(false);
    if(result&&result.success){
      var rows=Array.isArray(result.data)?result.data:[];
      bbServerPaged=!forceAll&&Number(result.page)>0;
      bbServerTotal=bbServerPaged?Number(result.total||0):rows.length;
      bbPage=bbServerPaged?Number(result.page||page):1;
      allMasterBB=rows; applyMasterBBFiltersLocal(); renderMasterBBTable();
    }
  }, function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allMasterBB=[];filteredMasterBB=[];bbServerTotal=0;bbServerPaged=false;renderMasterBBTable();});
}
"""
s=s[:start]+new+s[end:]
s=s.replace(
"  var totalPages = Math.ceil(filteredMasterBB.length / ITEMS_PER_PAGE);\n  if (bbPage > totalPages) bbPage = totalPages;\n  var start = (bbPage - 1) * ITEMS_PER_PAGE;\n  var pageData = filteredMasterBB.slice(start, start + ITEMS_PER_PAGE);",
"  var totalPages = Math.ceil((bbServerPaged ? bbServerTotal : filteredMasterBB.length) / ITEMS_PER_PAGE);\n  if (bbPage > totalPages) bbPage = totalPages;\n  var start = (bbPage - 1) * ITEMS_PER_PAGE;\n  var pageData = bbServerPaged ? filteredMasterBB : filteredMasterBB.slice(start, start + ITEMS_PER_PAGE);"
)
old="""function goBBPage(p) { bbPage = p; renderMasterBBTable(); }
function filterMasterBB() {
  var search = $('bbSearchInput').value.toLowerCase().trim();
  var kat = $('bbFilterKategori').value;
  filteredMasterBB = allMasterBB.filter(function(b) {
    var nama = b['NAMA  BAHAN BAKU'] || b['NAMA BAHAN BAKU'] || b['Nama Bahan Baku'] || '';
    var kode = b['KODE BAHAN'] || b['Kode Bahan'] || '';
    if (search && (nama + ' ' + kode).toLowerCase().indexOf(search) === -1) return false;
    if (kat !== 'ALL' && (b['KATEGORI BAHAN BAKU'] || b['Kategori']) !== kat) return false;
    return true;
  });
  bbPage = 1;
  renderMasterBBTable();
}"""
new="""function goBBPage(p) { if(bbServerPaged)loadMasterBB(p,false);else{bbPage=p;renderMasterBBTable();} }
function applyMasterBBFiltersLocal() {
  var search=$('bbSearchInput')?$('bbSearchInput').value.toLowerCase().trim():'';
  var kat=$('bbFilterKategori')?$('bbFilterKategori').value:'ALL';
  filteredMasterBB=allMasterBB.filter(function(b){
    var nama=b['NAMA  BAHAN BAKU']||b['NAMA BAHAN BAKU']||b['Nama Bahan Baku']||'';
    var kode=b['KODE BAHAN']||b['Kode Bahan']||'';
    if(search&&(nama+' '+kode).toLowerCase().indexOf(search)===-1)return false;
    if(kat!=='ALL'&&(b['KATEGORI BAHAN BAKU']||b['Kategori'])!==kat)return false;
    return true;
  });
}
function filterMasterBB(){
  var search=$('bbSearchInput')?$('bbSearchInput').value.trim():'';
  var kat=$('bbFilterKategori')?$('bbFilterKategori').value:'ALL';
  var full=!!search||kat!=='ALL';clearTimeout(bbFilterTimer);
  bbFilterTimer=setTimeout(function(){bbPage=1;loadMasterBB(1,full);},300);
}"""
if old not in s: raise SystemExit('master BB filter block not found')
s=s.replace(old,new)

# Supplier loader
start=s.index('function loadSuppliers(silent) {')
end=s.index('function renderSupplierTable()', start)
new="""function loadSuppliers(silent,page,forceAll) {
  return new Promise(function(resolve){
    if(!currentUser){resolve();return;} page=Math.max(1,Number(page)||supplierPage||1);forceAll=!!forceAll;
    if(!silent)showLoading(true);
    callApi('getMasterSupplier',forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){
      if(!silent)showLoading(false);
      if(result&&result.success){var rows=Array.isArray(result.data)?result.data:[];supplierServerPaged=!forceAll&&Number(result.page)>0;supplierServerTotal=supplierServerPaged?Number(result.total||0):rows.length;supplierPage=supplierServerPaged?Number(result.page||page):1;allSuppliers=rows;applySupplierFiltersLocal();renderSupplierTable();}
      resolve();
    },function(err){if(!silent){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data supplier');}allSuppliers=[];filteredSuppliers=[];supplierServerTotal=0;supplierServerPaged=false;renderSupplierTable();resolve();});
  });
}
"""
s=s[:start]+new+s[end:]
s=s.replace(
"  var totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);\n  if (supplierPage > totalPages) supplierPage = totalPages;\n  var start = (supplierPage - 1) * ITEMS_PER_PAGE;\n  var pageData = filteredSuppliers.slice(start, start + ITEMS_PER_PAGE);",
"  var totalPages = Math.ceil((supplierServerPaged ? supplierServerTotal : filteredSuppliers.length) / ITEMS_PER_PAGE);\n  if (supplierPage > totalPages) supplierPage = totalPages;\n  var start = (supplierPage - 1) * ITEMS_PER_PAGE;\n  var pageData = supplierServerPaged ? filteredSuppliers : filteredSuppliers.slice(start, start + ITEMS_PER_PAGE);"
)
old="""function filterSupplier() {
  var search = $('supplierSearchInput').value.toLowerCase().trim();
  var status = $('supplierFilterStatus').value;
  filteredSuppliers = allSuppliers.filter(function(s) {
    var teks = (s['NAMA SUPPLIER'] || s['Nama Supplier'] || '') + ' ' + (s['NO WHATSAPP'] || s['No WhatsApp'] || '') + ' ' + (s['EMAIL'] || s['Email'] || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (status !== 'ALL' && (s['STATUS'] || s['Status']) !== status) return false;
    return true;
  });
  supplierPage = 1;
  renderSupplierTable();
}

function goSupplierPage(p) { supplierPage = p; renderSupplierTable(); }"""
new="""function applySupplierFiltersLocal(){
  var search=$('supplierSearchInput')?$('supplierSearchInput').value.toLowerCase().trim():'';
  var status=$('supplierFilterStatus')?$('supplierFilterStatus').value:'ALL';
  filteredSuppliers=allSuppliers.filter(function(x){var teks=(x['NAMA SUPPLIER']||x['Nama Supplier']||'')+' '+(x['NO WHATSAPP']||x['No WhatsApp']||'')+' '+(x['EMAIL']||x['Email']||'');if(search&&teks.toLowerCase().indexOf(search)===-1)return false;if(status!=='ALL'&&(x['STATUS']||x['Status'])!==status)return false;return true;});
}
function filterSupplier(){var search=$('supplierSearchInput')?$('supplierSearchInput').value.trim():'';var status=$('supplierFilterStatus')?$('supplierFilterStatus').value:'ALL';var full=!!search||status!=='ALL';clearTimeout(supplierFilterTimer);supplierFilterTimer=setTimeout(function(){supplierPage=1;loadSuppliers(false,1,full);},300);}

function goSupplierPage(p){if(supplierServerPaged)loadSuppliers(false,p,false);else{supplierPage=p;renderSupplierTable();}}"""
if old not in s: raise SystemExit('supplier filter block not found')
s=s.replace(old,new)

for marker in ['bbServerTotal','supplierServerTotal','function applyMasterBBFiltersLocal','function applySupplierFiltersLocal']:
  if marker not in s: raise SystemExit('validation failed: '+marker)
p.write_text(s)
