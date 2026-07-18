from pathlib import Path
import re

p=Path('app.js')
s=p.read_text()

s=s.replace(
"var txServerTotal = 0, txServerPaged = false, txFilterTimer = null;",
"var txServerTotal = 0, txServerPaged = false, txFilterTimer = null;\nvar usersServerTotal = 0, usersServerPaged = false, usersFilterTimer = null;"
)

start=s.index('function loadUsers(silent) {')
end=s.index('function renderUsersTable()', start)
new_load="""function loadUsers(silent, page, forceAll) {
  return new Promise(function(resolve) {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) { resolve(); return; }
    page = Math.max(1, Number(page) || usersPage || 1);
    forceAll = !!forceAll;
    if (!silent) showLoading(true);
    var params = forceAll ? [] : [{ page: page, pageSize: ITEMS_PER_PAGE }];
    callApi('getAllUsers', params, function(result) {
      if (!silent) showLoading(false);
      if (result && result.success) {
        var rows = Array.isArray(result.data) ? result.data : [];
        usersServerPaged = !forceAll && Number(result.page) > 0;
        usersServerTotal = usersServerPaged ? Number(result.total || 0) : rows.length;
        usersPage = usersServerPaged ? Number(result.page || page) : 1;
        allUsers = rows;
        applyUsersFiltersLocal();
        populateUsersFilterOptions();
        renderUsersTable();
      }
      resolve();
    }, function(err) {
      if (!silent) { showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data users'); }
      allUsers=[]; filteredUsers=[]; usersServerTotal=0; usersServerPaged=false;
      renderUsersTable();
      resolve();
    });
  });
}
"""
s=s[:start]+new_load+s[end:]

s=s.replace(
"  var totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);\n  if (usersPage > totalPages) usersPage = totalPages;\n  var start = (usersPage - 1) * ITEMS_PER_PAGE;\n  var pageData = filteredUsers.slice(start, start + ITEMS_PER_PAGE);",
"  var totalPages = Math.ceil((usersServerPaged ? usersServerTotal : filteredUsers.length) / ITEMS_PER_PAGE);\n  if (usersPage > totalPages) usersPage = totalPages;\n  var start = (usersPage - 1) * ITEMS_PER_PAGE;\n  var pageData = usersServerPaged ? filteredUsers : filteredUsers.slice(start, start + ITEMS_PER_PAGE);"
)

filter_start=s.index('function filterUsers() {')
pop_start=s.index('function populateUsersFilterOptions()', filter_start)
new_filter="""function applyUsersFiltersLocal() {
  var search = $('usersSearchInput') ? $('usersSearchInput').value.toLowerCase().trim() : '';
  var sppg = $('usersFilterSppg') ? $('usersFilterSppg').value : 'ALL';
  var role = $('usersFilterRole') ? $('usersFilterRole').value : 'ALL';
  filteredUsers = allUsers.filter(function(u) {
    var teks = (u.namaLengkap || '') + ' ' + (u.username || '') + ' ' + (u.email || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (sppg !== 'ALL' && u.sppg !== sppg) return false;
    if (role !== 'ALL' && u.role !== role) return false;
    return true;
  });
}
function filterUsers() {
  var search = $('usersSearchInput') ? $('usersSearchInput').value.trim() : '';
  var sppg = $('usersFilterSppg') ? $('usersFilterSppg').value : 'ALL';
  var role = $('usersFilterRole') ? $('usersFilterRole').value : 'ALL';
  var needsFullDataset = !!search || sppg !== 'ALL' || role !== 'ALL';
  clearTimeout(usersFilterTimer);
  usersFilterTimer=setTimeout(function(){ usersPage=1; loadUsers(false,1,needsFullDataset); },300);
}
"""
s=s[:filter_start]+new_filter+s[pop_start:]

# preserve selected filters when options rebuild
old="""function populateUsersFilterOptions() {
  var sppgSel = $('usersFilterSppg'), roleSel = $('usersFilterRole');
  var sppgSet = {}, roleSet = {};
  allUsers.forEach(function(u) { if (u.sppg) sppgSet[u.sppg] = true; if (u.role) roleSet[u.role] = true; });
  sppgSel.innerHTML = '<option value=\"ALL\">Semua SPPG</option>' + Object.keys(sppgSet).sort().map(function(s){ return '<option value=\"' + esc(s) + '\">' + esc(s) + '</option>'; }).join('');
  roleSel.innerHTML = '<option value=\"ALL\">Semua Role</option>' + Object.keys(roleSet).sort().map(function(r){ return '<option value=\"' + esc(r) + '\">' + esc(r) + '</option>'; }).join('');
}

function goUsersPage(p) { usersPage = p; renderUsersTable(); }"""
new="""function populateUsersFilterOptions() {
  var sppgSel = $('usersFilterSppg'), roleSel = $('usersFilterRole');
  if (!sppgSel || !roleSel) return;
  var selectedSppg=sppgSel.value||'ALL', selectedRole=roleSel.value||'ALL';
  var sppgSet = {}, roleSet = {};
  allUsers.forEach(function(u) { if (u.sppg) sppgSet[u.sppg] = true; if (u.role) roleSet[u.role] = true; });
  sppgSel.innerHTML = '<option value=\"ALL\">Semua SPPG</option>' + Object.keys(sppgSet).sort().map(function(s){ return '<option value=\"' + esc(s) + '\">' + esc(s) + '</option>'; }).join('');
  roleSel.innerHTML = '<option value=\"ALL\">Semua Role</option>' + Object.keys(roleSet).sort().map(function(r){ return '<option value=\"' + esc(r) + '\">' + esc(r) + '</option>'; }).join('');
  if(selectedSppg!=='ALL'&&!sppgSet[selectedSppg])sppgSel.insertAdjacentHTML('beforeend','<option value=\"'+esc(selectedSppg)+'\">'+esc(selectedSppg)+'</option>');
  if(selectedRole!=='ALL'&&!roleSet[selectedRole])roleSel.insertAdjacentHTML('beforeend','<option value=\"'+esc(selectedRole)+'\">'+esc(selectedRole)+'</option>');
  sppgSel.value=selectedSppg; roleSel.value=selectedRole;
}

function goUsersPage(p) { if(usersServerPaged) loadUsers(false,p,false); else { usersPage=p; renderUsersTable(); } }"""
if old not in s:
    raise SystemExit('users options/go page pattern not found')
s=s.replace(old,new)

for marker in ['usersServerTotal','function applyUsersFiltersLocal','loadUsers(false,p,false)']:
    if marker not in s: raise SystemExit('validation failed: '+marker)
p.write_text(s)
