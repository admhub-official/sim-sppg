from pathlib import Path
import re

app_path = Path('app.js')
index_path = Path('index.html')
sw_path = Path('sw.js')
user_check_path = Path('scripts/check-user-management-row-detail.mjs')
verifier_check_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
user_check = user_check_path.read_text(encoding='utf-8')
verifier_check = verifier_check_path.read_text(encoding='utf-8')

old_render = """    var rowNum = Number(u._row) || 0;
    var rowLabel = 'Lihat detail user ' + (u.namaLengkap || u.username || '');
    html += '<tr class="user-row-clickable" tabindex="0" role="button" data-user-row="' + rowNum + '" aria-label="' + esc(rowLabel) + '" onclick="openUserDetailModal(' + rowNum + ')" onkeydown="handleUserRowKeydown(event,' + rowNum + ')">' +"""
new_render = """    var userKey = getManagedUserKey(u);
    var rowLabel = 'Lihat detail user ' + (u.namaLengkap || u.username || '');
    html += '<tr class="user-row-clickable" tabindex="0" role="button" data-user-key="' + esc(userKey) + '" aria-label="' + esc(rowLabel) + '" onclick="openUserDetailModal(this.dataset.userKey)" onkeydown="handleUserRowKeydown(event,this.dataset.userKey)">' +"""
if old_render not in app:
    raise SystemExit('render user row block not found')
app = app.replace(old_render, new_render, 1)

old_helpers = """function findManagedUser(rowNum) {
  return allUsers.find(function(u) { return String(u._row) === String(rowNum); });
}

function handleUserRowKeydown(event, rowNum) {
  if (!event) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openUserDetailModal(rowNum);
  }
}

function openUserDetailModal(rowNum) {
  var user = findManagedUser(rowNum);"""
new_helpers = """function getManagedUserKey(user) {
  return String(user && (user.id || user.username || user._row) || '');
}

function findManagedUser(userKey) {
  var key = String(userKey || '');
  return allUsers.find(function(u) { return getManagedUserKey(u) === key; });
}

function handleUserRowKeydown(event, userKey) {
  if (!event) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openUserDetailModal(userKey);
  }
}

function openUserDetailModal(userKey) {
  var user = findManagedUser(userKey);"""
if old_helpers not in app:
    raise SystemExit('user detail helper block not found')
app = app.replace(old_helpers, new_helpers, 1)

app = app.replace('  currentDetailUserRow = user._row;', '  currentDetailUserRow = getManagedUserKey(user);', 1)
app = app.replace('if (fotoUrl && currentDetailUserRow === user._row && avatar)', 'if (fotoUrl && currentDetailUserRow === getManagedUserKey(user) && avatar)', 1)

old_edit_detail = """function editUserFromDetail() {
  var rowNum = currentDetailUserRow;
  if (rowNum === null || rowNum === undefined) return;
  closeModal('modalUserDetail');
  openEditUserModal(rowNum);
}"""
new_edit_detail = """function editUserFromDetail() {
  var userKey = currentDetailUserRow;
  if (!userKey) return;
  closeModal('modalUserDetail');
  openEditUserModal(userKey);
}"""
if old_edit_detail not in app:
    raise SystemExit('edit from detail block not found')
app = app.replace(old_edit_detail, new_edit_detail, 1)

old_open_edit = """function openEditUserModal(rowNum) {
  var user = findManagedUser(rowNum);
  if (!user) return;
  currentEditRow = rowNum;
  $('editUserRow').value = rowNum;"""
new_open_edit = """function openEditUserModal(userKey) {
  var user = findManagedUser(userKey);
  if (!user) return;
  currentEditRow = getManagedUserKey(user);
  $('editUserRow').value = currentEditRow;"""
if old_open_edit not in app:
    raise SystemExit('open edit user block not found')
app = app.replace(old_open_edit, new_open_edit, 1)

old_call = """    callApi('updateUserProfile', [
      allUsers.find(function(u) { return u._row == currentEditRow; }).username,
      fields
    ], function(result) {"""
new_call = """    var managedUser = findManagedUser(currentEditRow);
    if (!managedUser || !managedUser.username) {
      showToast('error', 'Gagal', 'Data user tidak ditemukan');
      return;
    }
    callApi('updateUserProfile', [
      managedUser.username,
      fields
    ], function(result) {"""
if old_call not in app:
    raise SystemExit('save edit user target block not found')
app = app.replace(old_call, new_call, 1)

index, count = re.subn(r'app\.js\?v=[^"\']+', 'app.js?v=20260722-user-detail-key-v2', index)
if count < 1:
    raise SystemExit('app cache key not found')

sw, count = re.subn(r"const CACHE_VERSION = 'sim-sppg-[^']+';", "const CACHE_VERSION = 'sim-sppg-v20260722-user-detail-key-v6';", sw, count=1)
if count != 1:
    raise SystemExit('service worker cache version not found')

user_check = user_check.replace(
    "requireMatch(renderBlock.includes('onclick=\"openUserDetailModal('), 'row click must open user detail');",
    "requireMatch(renderBlock.includes('data-user-key=\"'), 'row must carry a stable user key');\nrequireMatch(renderBlock.includes('onclick=\"openUserDetailModal(this.dataset.userKey)\"'), 'row click must open detail with the stable key');"
)
user_check = user_check.replace(
    "requireMatch(renderBlock.includes('onkeydown=\"handleUserRowKeydown('), 'row must support keyboard access');",
    "requireMatch(renderBlock.includes('onkeydown=\"handleUserRowKeydown(event,this.dataset.userKey)\"'), 'row must support keyboard access with the stable key');"
)
anchor = "requireMatch(!renderBlock.includes('action-btn delete'), 'delete icon must be removed from user rows');"
extra = "\nrequireMatch(!renderBlock.includes('Number(u._row)'), 'row click must not depend on the retired numeric _row field');\nrequireMatch(app.includes('function getManagedUserKey(user)'), 'stable user key helper must exist');\nrequireMatch(app.includes('user.id || user.username || user._row'), 'stable key must prefer API user id and username');\nrequireMatch(app.includes('var managedUser = findManagedUser(currentEditRow);'), 'edit save must resolve the same stable user key');"
if "retired numeric _row field" not in user_check:
    user_check = user_check.replace(anchor, anchor + extra, 1)

verifier_check = re.sub(
    r"serviceWorker\.includes\(\"const CACHE_VERSION = 'sim-sppg-[^']+';\"\)",
    "serviceWorker.includes(\"const CACHE_VERSION = 'sim-sppg-v20260722-user-detail-key-v6';\")",
    verifier_check,
    count=1
)
verifier_check = re.sub(
    r'/<script src="\\\.\\/app\\\.js\\\?v=[^"]+"><\\/script>/\.test\(index\)',
    '/<script src="\\.\\/app\\.js\\?v=20260722-user-detail-key-v2"><\\/script>/.test(index)',
    verifier_check,
    count=1
)

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
user_check_path.write_text(user_check, encoding='utf-8')
verifier_check_path.write_text(verifier_check, encoding='utf-8')
print('Applied stable user detail key patch')
