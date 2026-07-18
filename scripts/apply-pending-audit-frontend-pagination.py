from pathlib import Path
p=Path('app.js');s=p.read_text()
anchor="var surveiServerTotal = 0, surveiServerPaged = false, surveiFilterTimer = null;\nvar stServerTotal = 0, stServerPaged = false, stFilterTimer = null;"
extra="var pendingServerTotal = 0, pendingServerPaged = false;\nvar auditServerTotal = 0, auditServerPaged = false, auditFilterTimer = null;"
if extra not in s:s=s.replace(anchor,anchor+'\n'+extra)
old="""function loadPendingPayment() {
  showLoading(true);
    callApi('getPendingPayments', [], function(data) {
        showLoading(false);
              allPending = data || [];
              pendingPage = 1;
              renderPendingTable();
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data');
      }
    );
}"""
new="""function loadPendingPayment(page){page=Math.max(1,Number(page)||pendingPage||1);showLoading(true);callApi('getPendingPayments',[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){showLoading(false);if(Array.isArray(result)){allPending=result;pendingServerPaged=false;pendingServerTotal=result.length;pendingPage=1;}else if(result&&result.success){allPending=Array.isArray(result.data)?result.data:[];pendingServerPaged=Number(result.page)>0;pendingServerTotal=pendingServerPaged?Number(result.total||0):allPending.length;pendingPage=pendingServerPaged?Number(result.page||page):1;}else{allPending=[];pendingServerTotal=0;pendingServerPaged=false;}renderPendingTable();},function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allPending=[];pendingServerTotal=0;pendingServerPaged=false;renderPendingTable();});}"""
if old not in s:raise SystemExit('loadPendingPayment not found')
s=s.replace(old,new)
s=s.replace("var totalPages = Math.ceil(allPending.length / ITEMS_PER_PAGE);","var totalPages = Math.ceil((pendingServerPaged ? pendingServerTotal : allPending.length) / ITEMS_PER_PAGE);")
s=s.replace("var pageData = allPending.slice(start, start + ITEMS_PER_PAGE);","var pageData = pendingServerPaged ? allPending : allPending.slice(start, start + ITEMS_PER_PAGE);")
s=s.replace("function goPendingPage(p) { pendingPage = p; renderPendingTable(); }","function goPendingPage(p){if(pendingServerPaged)loadPendingPayment(p);else{pendingPage=p;renderPendingTable();}}")
old="""function loadAuditLog() {
  if (!currentUser || currentUser.role !== 'ADMIN') return;
  showLoading(true);
    callApi('getAuditLog', [{}], function(result) {
        showLoading(false);
              if (result.success) {
                allAuditLog = result.data || [];
                populateAuditActionFilter();
                filteredAuditLog = allAuditLog.slice();
                auditLogPage = 1;
                renderAuditLogTable();
              } else {
                showToast('error', 'Gagal', result.message || 'Tidak dapat memuat riwayat aktivitas');
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat riwayat aktivitas');
      }
    );
}"""
new="""function loadAuditLog(page){if(!currentUser||['ADMIN','SUPER_ADMIN'].indexOf(currentUser.role)===-1)return;page=Math.max(1,Number(page)||auditLogPage||1);showLoading(true);var f={page:page,pageSize:ITEMS_PER_PAGE};if($('auditSearchInput')&&$('auditSearchInput').value.trim())f.search=$('auditSearchInput').value.trim();if($('auditFilterAction')&&$('auditFilterAction').value!=='ALL')f.actionType=$('auditFilterAction').value;if($('auditFilterTglStart')&&$('auditFilterTglStart').value)f.dateStart=$('auditFilterTglStart').value;if($('auditFilterTglEnd')&&$('auditFilterTglEnd').value)f.dateEnd=$('auditFilterTglEnd').value;callApi('getAuditLog',[f],function(result){showLoading(false);if(result&&result.success){allAuditLog=Array.isArray(result.data)?result.data:[];filteredAuditLog=allAuditLog.slice();auditServerPaged=Number(result.page)>0;auditServerTotal=auditServerPaged?Number(result.total||0):allAuditLog.length;auditLogPage=auditServerPaged?Number(result.page||page):1;populateAuditActionFilter();renderAuditLogTable();}else{showToast('error','Gagal',result&&result.message||'Tidak dapat memuat riwayat aktivitas');}},function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat riwayat aktivitas');allAuditLog=[];filteredAuditLog=[];auditServerTotal=0;auditServerPaged=false;renderAuditLogTable();});}"""
if old not in s:raise SystemExit('loadAuditLog not found')
s=s.replace(old,new)
s=s.replace("var totalPages = Math.ceil(filteredAuditLog.length / ITEMS_PER_PAGE);","var totalPages = Math.ceil((auditServerPaged ? auditServerTotal : filteredAuditLog.length) / ITEMS_PER_PAGE);")
s=s.replace("var pageData = filteredAuditLog.slice(start, start + ITEMS_PER_PAGE);","var pageData = auditServerPaged ? filteredAuditLog : filteredAuditLog.slice(start, start + ITEMS_PER_PAGE);")
s=s.replace("function goAuditLogPage(p) { auditLogPage = p; renderAuditLogTable(); }","function goAuditLogPage(p){if(auditServerPaged)loadAuditLog(p);else{auditLogPage=p;renderAuditLogTable();}}")
start=s.index('function filterAuditLog() {');end=s.index('\n}\n\nfunction resetAuditFilter()',start)+2
s=s[:start]+"function filterAuditLog(){clearTimeout(auditFilterTimer);auditFilterTimer=setTimeout(function(){auditLogPage=1;loadAuditLog(1);},300);}"+s[end:]
old_pop="""function populateAuditActionFilter() {
  var sel = $('auditFilterAction');
  if (!sel) return;
  var actions = {};
  allAuditLog.forEach(function(a) { if (a.actionType) actions[a.actionType] = true; });
  var html = '<option value="ALL">Semua Aksi</option>';
  Object.keys(actions).sort().forEach(function(a) { html += '<option value="' + esc(a) + '">' + esc(a) + '</option>'; });
  sel.innerHTML = html;
}"""
new_pop="""function populateAuditActionFilter() {
  var sel = $('auditFilterAction');
  if (!sel) return;
  var selectedAction=sel.value||'ALL';
  var actions = {};
  allAuditLog.forEach(function(a) { if (a.actionType) actions[a.actionType] = true; });
  var html = '<option value="ALL">Semua Aksi</option>';
  Object.keys(actions).sort().forEach(function(a) { html += '<option value="' + esc(a) + '">' + esc(a) + '</option>'; });
  sel.innerHTML = html;
  if(selectedAction!=='ALL'&&!actions[selectedAction])sel.insertAdjacentHTML('beforeend','<option value="'+esc(selectedAction)+'">'+esc(selectedAction)+'</option>');
  sel.value=selectedAction;
}"""
if old_pop not in s:raise SystemExit('populateAuditActionFilter not found')
s=s.replace(old_pop,new_pop)
for t in ['pendingServerPaged','auditServerPaged','getPendingPayments','getAuditLog']:
    if t not in s:raise SystemExit('validation '+t)
p.write_text(s)
