from pathlib import Path
import re

path = Path('app.js')
source = path.read_text()

state_block = (
    "var pendingServerTotal = 0, pendingServerPaged = false;\n"
    "var auditServerTotal = 0, auditServerPaged = false, auditFilterTimer = null;"
)
if state_block not in source:
    state_anchor = re.search(
        r"var menuServerTotal\s*=\s*0,\s*menuServerPaged\s*=\s*false;|"
        r"var stServerTotal\s*=\s*0,\s*stServerPaged\s*=\s*false,\s*stFilterTimer\s*=\s*null;",
        source,
    )
    if not state_anchor:
        raise SystemExit('pagination state anchor not found')
    pos = state_anchor.end()
    source = source[:pos] + "\n" + state_block + source[pos:]


def replace_function_block(start_pattern, next_pattern, replacement, label):
    global source
    pattern = start_pattern + r".*?(?=" + next_pattern + r")"
    updated, count = re.subn(pattern, replacement + "\n\n", source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(label + ' function block not found')
    source = updated


replace_function_block(
    r"function\s+loadPendingPayment\s*\([^)]*\)\s*\{",
    r"\nfunction\s+renderPendingTable\s*\(",
    "function loadPendingPayment(page){page=Math.max(1,Number(page)||pendingPage||1);showLoading(true);callApi('getPendingPayments',[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){showLoading(false);if(Array.isArray(result)){allPending=result;pendingServerPaged=false;pendingServerTotal=result.length;pendingPage=1;}else if(result&&result.success){allPending=Array.isArray(result.data)?result.data:[];pendingServerPaged=Number(result.page)>0;pendingServerTotal=pendingServerPaged?Number(result.total||0):allPending.length;pendingPage=pendingServerPaged?Number(result.page||page):1;}else{allPending=[];pendingServerTotal=0;pendingServerPaged=false;}renderPendingTable();},function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allPending=[];pendingServerTotal=0;pendingServerPaged=false;renderPendingTable();});}",
    'loadPendingPayment',
)

source = source.replace(
    "var totalPages = Math.ceil(allPending.length / ITEMS_PER_PAGE);",
    "var totalPages = Math.ceil((pendingServerPaged ? pendingServerTotal : allPending.length) / ITEMS_PER_PAGE);",
)
source = source.replace(
    "var pageData = allPending.slice(start, start + ITEMS_PER_PAGE);",
    "var pageData = pendingServerPaged ? allPending : allPending.slice(start, start + ITEMS_PER_PAGE);",
)
source = re.sub(
    r"function\s+goPendingPage\s*\([^)]*\)\s*\{.*?\}(?=\n)",
    "function goPendingPage(p){if(pendingServerPaged)loadPendingPayment(p);else{pendingPage=p;renderPendingTable();}}",
    source,
    count=1,
)

replace_function_block(
    r"function\s+loadAuditLog\s*\([^)]*\)\s*\{",
    r"\nfunction\s+populateAuditActionFilter\s*\(",
    "function loadAuditLog(page){if(!currentUser||['ADMIN','SUPER_ADMIN'].indexOf(currentUser.role)===-1)return;page=Math.max(1,Number(page)||auditLogPage||1);showLoading(true);var f={page:page,pageSize:ITEMS_PER_PAGE};if($('auditSearchInput')&&$('auditSearchInput').value.trim())f.search=$('auditSearchInput').value.trim();if($('auditFilterAction')&&$('auditFilterAction').value!=='ALL')f.actionType=$('auditFilterAction').value;if($('auditFilterTglStart')&&$('auditFilterTglStart').value)f.dateStart=$('auditFilterTglStart').value;if($('auditFilterTglEnd')&&$('auditFilterTglEnd').value)f.dateEnd=$('auditFilterTglEnd').value;callApi('getAuditLog',[f],function(result){showLoading(false);if(result&&result.success){allAuditLog=Array.isArray(result.data)?result.data:[];filteredAuditLog=allAuditLog.slice();auditServerPaged=Number(result.page)>0;auditServerTotal=auditServerPaged?Number(result.total||0):allAuditLog.length;auditLogPage=auditServerPaged?Number(result.page||page):1;populateAuditActionFilter();renderAuditLogTable();}else{showToast('error','Gagal',result&&result.message||'Tidak dapat memuat riwayat aktivitas');}},function(err){showLoading(false);showToast('error','Gagal','Tidak dapat memuat riwayat aktivitas');allAuditLog=[];filteredAuditLog=[];auditServerTotal=0;auditServerPaged=false;renderAuditLogTable();});}",
    'loadAuditLog',
)

replace_function_block(
    r"function\s+populateAuditActionFilter\s*\([^)]*\)\s*\{",
    r"\nfunction\s+renderAuditLogTable\s*\(",
    "function populateAuditActionFilter() {\n  var sel = $('auditFilterAction');\n  if (!sel) return;\n  var selectedAction = sel.value || 'ALL';\n  var actions = {};\n  allAuditLog.forEach(function(a) { if (a.actionType) actions[a.actionType] = true; });\n  var html = '<option value=\"ALL\">Semua Aksi</option>';\n  Object.keys(actions).sort().forEach(function(a) { html += '<option value=\"' + esc(a) + '\">' + esc(a) + '</option>'; });\n  sel.innerHTML = html;\n  if (selectedAction !== 'ALL' && !actions[selectedAction]) sel.insertAdjacentHTML('beforeend', '<option value=\"' + esc(selectedAction) + '\">' + esc(selectedAction) + '</option>');\n  sel.value = selectedAction;\n}",
    'populateAuditActionFilter',
)

source = source.replace(
    "var totalPages = Math.ceil(filteredAuditLog.length / ITEMS_PER_PAGE);",
    "var totalPages = Math.ceil((auditServerPaged ? auditServerTotal : filteredAuditLog.length) / ITEMS_PER_PAGE);",
)
source = source.replace(
    "var pageData = filteredAuditLog.slice(start, start + ITEMS_PER_PAGE);",
    "var pageData = auditServerPaged ? filteredAuditLog : filteredAuditLog.slice(start, start + ITEMS_PER_PAGE);",
)
source = re.sub(
    r"function\s+goAuditLogPage\s*\([^)]*\)\s*\{.*?\}(?=\n)",
    "function goAuditLogPage(p){if(auditServerPaged)loadAuditLog(p);else{auditLogPage=p;renderAuditLogTable();}}",
    source,
    count=1,
)
replace_function_block(
    r"function\s+filterAuditLog\s*\([^)]*\)\s*\{",
    r"\nfunction\s+resetAuditFilter\s*\(",
    "function filterAuditLog(){clearTimeout(auditFilterTimer);auditFilterTimer=setTimeout(function(){auditLogPage=1;loadAuditLog(1);},300);}",
    'filterAuditLog',
)

required = [
    'pendingServerPaged',
    'auditServerPaged',
    "getPendingPayments',[{page:page,pageSize:ITEMS_PER_PAGE}]",
    "var f={page:page,pageSize:ITEMS_PER_PAGE}",
]
for token in required:
    if token not in source:
        raise SystemExit('validation failed: ' + token)

path.write_text(source)
