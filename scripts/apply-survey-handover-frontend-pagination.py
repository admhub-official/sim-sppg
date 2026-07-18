from pathlib import Path

p=Path('app.js')
s=p.read_text()

state="var surveiServerTotal = 0, surveiServerPaged = false, surveiFilterTimer = null;\nvar stServerTotal = 0, stServerPaged = false, stFilterTimer = null;"
anchor="var surveiPage = 1, stPage = 1, menuMBGPage = 1, pendingPage = 1;"
if state not in s:
    s=s.replace(anchor,anchor+'\n'+state)

old="""function loadSurvei() {
  showLoading(true);
    callApi('getSurveiBahanBaku', [], function(result) {
        showLoading(false);
              if (result.success) {
                allSurvei = result.data || [];
                filteredSurvei = allSurvei.slice();
                populateSurveiFilterOptions();
                surveiPage = 1;
                renderSurveiTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data survei');
      }
    );
}"""
new="""function loadSurvei(page, forceAll) {
  page=Math.max(1,Number(page)||surveiPage||1); forceAll=!!forceAll; showLoading(true);
  callApi('getSurveiBahanBaku',forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){
    showLoading(false);
    if(result&&result.success){var rows=Array.isArray(result.data)?result.data:[];surveiServerPaged=!forceAll&&Number(result.page)>0;surveiServerTotal=surveiServerPaged?Number(result.total||0):rows.length;surveiPage=surveiServerPaged?Number(result.page||page):1;allSurvei=rows;applySurveiFiltersLocal();populateSurveiFilterOptions();renderSurveiTable();}
  },function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data survei');allSurvei=[];filteredSurvei=[];surveiServerTotal=0;surveiServerPaged=false;renderSurveiTable();});
}"""
if old not in s: raise SystemExit('loadSurvei source not found')
s=s.replace(old,new)
s=s.replace("var totalPages = Math.ceil(filteredSurvei.length / ITEMS_PER_PAGE);","var totalPages = Math.ceil((surveiServerPaged ? surveiServerTotal : filteredSurvei.length) / ITEMS_PER_PAGE);")
s=s.replace("var pageData = filteredSurvei.slice(start, start + ITEMS_PER_PAGE);","var pageData = surveiServerPaged ? filteredSurvei : filteredSurvei.slice(start, start + ITEMS_PER_PAGE);")
old_filter="""function filterSurvei() {
  var search = $('surveiSearchInput').value.toLowerCase().trim();
  var kat = $('surveiFilterKategori').value;
  filteredSurvei = allSurvei.filter(function(s) {
    var teks = (s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '') + ' ' + (s['KODE BAHAN BAKU'] || s['Kode Bahan Baku'] || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (kat !== 'ALL' && (s['KATEGORI BAHAN BAKU'] || s['Kategori']) !== kat) return false;
    return true;
  });
  surveiPage = 1;
  renderSurveiTable();
}"""
new_filter="""function applySurveiFiltersLocal(){var search=$('surveiSearchInput')?$('surveiSearchInput').value.toLowerCase().trim():'';var kat=$('surveiFilterKategori')?$('surveiFilterKategori').value:'ALL';filteredSurvei=allSurvei.filter(function(x){var teks=(x['NAMA BAHAN BAKU']||x['Nama Bahan Baku']||'')+' '+(x['KODE BAHAN BAKU']||x['Kode Bahan Baku']||'');if(search&&teks.toLowerCase().indexOf(search)===-1)return false;if(kat!=='ALL'&&(x['KATEGORI BAHAN BAKU']||x['Kategori'])!==kat)return false;return true;});}
function filterSurvei(){var search=$('surveiSearchInput')?$('surveiSearchInput').value.trim():'';var kat=$('surveiFilterKategori')?$('surveiFilterKategori').value:'ALL';var full=!!search||kat!=='ALL';clearTimeout(surveiFilterTimer);surveiFilterTimer=setTimeout(function(){surveiPage=1;loadSurvei(1,full);},300);}"""
if old_filter not in s: raise SystemExit('filterSurvei source not found')
s=s.replace(old_filter,new_filter)
s=s.replace("function goSurveiPage(p) { surveiPage = p; renderSurveiTable(); }","function goSurveiPage(p){if(surveiServerPaged)loadSurvei(p,false);else{surveiPage=p;renderSurveiTable();}}")
s=s.replace("  var katSel = $('surveiFilterKategori');\n  var katSet = {};","  var katSel = $('surveiFilterKategori');\n  var selectedKat=katSel?katSel.value||'ALL':'ALL';\n  var katSet = {};")
s=s.replace("  katSel.innerHTML = '<option value=\"ALL\">Semua Kategori</option>' + Object.keys(katSet).sort().map(function(k){ return '<option value=\"' + esc(k) + '\">' + esc(k) + '</option>'; }).join('');","  katSel.innerHTML = '<option value=\"ALL\">Semua Kategori</option>' + Object.keys(katSet).sort().map(function(k){ return '<option value=\"' + esc(k) + '\">' + esc(k) + '</option>'; }).join('');\n  if(selectedKat!=='ALL'&&!katSet[selectedKat])katSel.insertAdjacentHTML('beforeend','<option value=\"'+esc(selectedKat)+'\">'+esc(selectedKat)+'</option>');\n  katSel.value=selectedKat;")

old="""function loadSerahTerima() {
  showLoading(true);
    callApi('getSerahTerima', [], function(result) {
        showLoading(false);
              if (result.success) {
                allSerahTerima = result.data || [];
                filteredSerahTerima = allSerahTerima.slice();
                stPage = 1;
                renderSerahTerimaTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data');
      }
    );
}"""
new="""function loadSerahTerima(page,forceAll){page=Math.max(1,Number(page)||stPage||1);forceAll=!!forceAll;showLoading(true);callApi('getSerahTerima',forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){showLoading(false);if(result&&result.success){var rows=Array.isArray(result.data)?result.data:[];stServerPaged=!forceAll&&Number(result.page)>0;stServerTotal=stServerPaged?Number(result.total||0):rows.length;stPage=stServerPaged?Number(result.page||page):1;allSerahTerima=rows;applySerahTerimaFiltersLocal();renderSerahTerimaTable();}},function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allSerahTerima=[];filteredSerahTerima=[];stServerTotal=0;stServerPaged=false;renderSerahTerimaTable();});}"""
if old not in s: raise SystemExit('loadSerahTerima source not found')
s=s.replace(old,new)
s=s.replace("var totalPages = Math.ceil(filteredSerahTerima.length / ITEMS_PER_PAGE);","var totalPages = Math.ceil((stServerPaged ? stServerTotal : filteredSerahTerima.length) / ITEMS_PER_PAGE);")
s=s.replace("var pageData = filteredSerahTerima.slice(start, start + ITEMS_PER_PAGE);","var pageData = stServerPaged ? filteredSerahTerima : filteredSerahTerima.slice(start, start + ITEMS_PER_PAGE);")
old_filter="""function filterSerahTerima() {
  var search = $('stSearchInput').value.toLowerCase().trim();
  var kondisi = $('stFilterKondisi').value;
  filteredSerahTerima = allSerahTerima.filter(function(s) {
    var teks = (s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '') + ' ' + (s['PENERIMA'] || s['Penerima'] || '') + ' ' + (s['SUPPLIER'] || s['Supplier'] || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (kondisi !== 'ALL' && (s['KONDISI BAHAN BAKU'] || s['Kondisi']) !== kondisi) return false;
    return true;
  });
  stPage = 1;
  renderSerahTerimaTable();
}"""
new_filter="""function applySerahTerimaFiltersLocal(){var search=$('stSearchInput')?$('stSearchInput').value.toLowerCase().trim():'';var kondisi=$('stFilterKondisi')?$('stFilterKondisi').value:'ALL';filteredSerahTerima=allSerahTerima.filter(function(x){var teks=(x['NAMA BAHAN BAKU']||x['Nama Bahan Baku']||'')+' '+(x['PENERIMA']||x['Penerima']||'')+' '+(x['SUPPLIER']||x['Supplier']||'');if(search&&teks.toLowerCase().indexOf(search)===-1)return false;if(kondisi!=='ALL'&&(x['KONDISI BAHAN BAKU']||x['Kondisi'])!==kondisi)return false;return true;});}
function filterSerahTerima(){var search=$('stSearchInput')?$('stSearchInput').value.trim():'';var kondisi=$('stFilterKondisi')?$('stFilterKondisi').value:'ALL';var full=!!search||kondisi!=='ALL';clearTimeout(stFilterTimer);stFilterTimer=setTimeout(function(){stPage=1;loadSerahTerima(1,full);},300);}"""
if old_filter not in s: raise SystemExit('filterSerahTerima source not found')
s=s.replace(old_filter,new_filter)
s=s.replace("function goSTPage(p) { stPage = p; renderSerahTerimaTable(); }","function goSTPage(p){if(stServerPaged)loadSerahTerima(p,false);else{stPage=p;renderSerahTerimaTable();}}")

for token in ['surveiServerPaged','applySurveiFiltersLocal','stServerPaged','applySerahTerimaFiltersLocal']:
    if token not in s: raise SystemExit('validation failed '+token)
p.write_text(s)
