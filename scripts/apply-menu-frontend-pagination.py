from pathlib import Path
p=Path('app.js');s=p.read_text()
anchor="var pendingServerTotal = 0, pendingServerPaged = false;\nvar auditServerTotal = 0, auditServerPaged = false, auditFilterTimer = null;"
if anchor not in s:
    anchor="var stServerTotal = 0, stServerPaged = false, stFilterTimer = null;"
extra="var menuServerTotal = 0, menuServerPaged = false;"
if extra not in s:s=s.replace(anchor,anchor+'\n'+extra)
old="""function loadMenuMBG() {
  showLoading(true);
    callApi('getMenuHarian', [{}], function(result) {
        showLoading(false);
              if (result.success) {
                allMenuMBG = result.data || [];
                menuMBGPage = 1;
                renderMenuMBGTable();
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data menu');
      }
    );
}"""
new="""function loadMenuMBG(page){page=Math.max(1,Number(page)||menuMBGPage||1);showLoading(true);callApi('getMenuHarian',[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){showLoading(false);if(result&&result.success){allMenuMBG=Array.isArray(result.data)?result.data:[];menuServerPaged=Number(result.page)>0;menuServerTotal=menuServerPaged?Number(result.total||0):allMenuMBG.length;menuMBGPage=menuServerPaged?Number(result.page||page):1;renderMenuMBGTable();}},function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data menu');allMenuMBG=[];menuServerTotal=0;menuServerPaged=false;renderMenuMBGTable();});}"""
if old not in s:raise SystemExit('loadMenuMBG not found')
s=s.replace(old,new)
s=s.replace("var totalPages = Math.ceil(allMenuMBG.length / ITEMS_PER_PAGE);","var totalPages = Math.ceil((menuServerPaged ? menuServerTotal : allMenuMBG.length) / ITEMS_PER_PAGE);")
s=s.replace("var pageData = allMenuMBG.slice(start, start + ITEMS_PER_PAGE);","var pageData = menuServerPaged ? allMenuMBG : allMenuMBG.slice(start, start + ITEMS_PER_PAGE);")
s=s.replace("onclick=\"showMenuDetail(' + (start + idx) + ')\"","onclick=\"showMenuDetail(' + (menuServerPaged ? idx : start + idx) + ')\"")
s=s.replace("onclick=\"openEditMenuMBGModal(' + (start + idx) + ')\"","onclick=\"openEditMenuMBGModal(' + (menuServerPaged ? idx : start + idx) + ')\"")
s=s.replace("function goMenuMBGPage(p) { menuMBGPage = p; renderMenuMBGTable(); }","function goMenuMBGPage(p){if(menuServerPaged)loadMenuMBG(p);else{menuMBGPage=p;renderMenuMBGTable();}}")
for t in ['menuServerPaged','getMenuHarian','goMenuMBGPage']:
    if t not in s:raise SystemExit('validation '+t)
p.write_text(s)
