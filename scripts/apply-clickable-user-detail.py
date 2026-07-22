from pathlib import Path
import re

APP = Path('app.js')
INDEX = Path('index.html')
SW = Path('sw.js')
VERIFIER_TEST = Path('scripts/check-verifier-flow-regression.mjs')
TEMP_WORKFLOW = Path('.github/workflows/apply-clickable-user-detail.yml')
SELF = Path('scripts/apply-clickable-user-detail.py')

app = APP.read_text(encoding='utf-8')
index = INDEX.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')
verifier_test = VERIFIER_TEST.read_text(encoding='utf-8')

state_old = "var currentEditRow = null;\n"
state_new = "var currentEditRow = null;\nvar currentDetailUserRow = null;\n"
if state_old not in app:
    raise SystemExit('currentEditRow state marker not found')
app = app.replace(state_old, state_new, 1)

render_users = r'''function renderUsersTable() {
  var tbody = $('usersTableBody');
  if (!filteredUsers.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-users"></i></div><h4>Tidak Ada Users</h4></div></td></tr>';
    renderPagination('usersPagination', 1, 0, 'goUsersPage');
    return;
  }
  var totalPages = Math.ceil((usersServerPaged ? usersServerTotal : filteredUsers.length) / ITEMS_PER_PAGE);
  if (usersPage > totalPages) usersPage = totalPages;
  var start = (usersPage - 1) * ITEMS_PER_PAGE;
  var pageData = usersServerPaged ? filteredUsers : filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(u, i) {
    var avatarFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.namaLengkap || u.username) + '&background=1e6f9c&color=fff&size=60&rounded=true';
    var avatarImgId = 'userAvatar_' + esc(u.username);
    var rowNum = Number(u._row) || 0;
    var rowLabel = 'Lihat detail user ' + (u.namaLengkap || u.username || '');
    html += '<tr class="user-row-clickable" tabindex="0" role="button" data-user-row="' + rowNum + '" aria-label="' + esc(rowLabel) + '" onclick="openUserDetailModal(' + rowNum + ')" onkeydown="handleUserRowKeydown(event,' + rowNum + ')">' +
      '<td style="text-align:center;color:var(--slate-400);font-weight:600;">' + (start + i + 1) + '</td>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<img id="' + avatarImgId + '" src="' + esc(avatarFallback) + '" style="width:36px;height:36px;border-radius:10px;object-fit:cover;border:2px solid var(--slate-200);flex-shrink:0;" alt="' + esc(u.namaLengkap) + '" onerror="this.src=\'' + avatarFallback + '\'">' +
          '<div><div style="font-weight:600;color:var(--slate-800);">' + esc(u.namaLengkap) + '</div><div style="font-size:11px;color:var(--slate-400);">@' + esc(u.username) + '</div></div>' +
        '</div></td>' +
      '<td>' + esc(u.email || '-') + '</td>' +
      '<td><span class="badge badge-blue">' + esc(u.jabatan || '-') + '</span></td>' +
      '<td><span class="badge badge-outline">' + esc(u.sppg || '-') + '</span></td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
  renderPagination('usersPagination', usersPage, totalPages, 'goUsersPage');

  pageData.forEach(function(u) {
    if (u.fotoProfil && String(u.fotoProfil).trim() !== '' && u.fotoProfil !== '-') {
      callApi('getFileUrl', ['FOTO_PROFIL', u.fotoProfil], function(res) {
        var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
        if (fotoUrl) {
          var img = document.getElementById('userAvatar_' + u.username);
          if (img) img.src = fotoUrl;
        }
      }, null);
    }
  });
}'''

pattern = re.compile(r"function renderUsersTable\(\) \{.*?\n\}\n\nfunction applyUsersFiltersLocal\(\)", re.S)
app, count = pattern.subn(render_users + "\n\nfunction applyUsersFiltersLocal()", app, count=1)
if count != 1:
    raise SystemExit(f'renderUsersTable replacement count: {count}')

helpers = r'''function findManagedUser(rowNum) {
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
  var user = findManagedUser(rowNum);
  if (!user) {
    showToast('error', 'Error', 'Data user tidak ditemukan');
    return;
  }
  currentDetailUserRow = user._row;

  var fullName = user.namaLengkap || user.username || '-';
  var username = user.username || '-';
  var fallbackAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=1e6f9c&color=fff&size=240&rounded=true';
  var avatar = $('userDetailAvatar');
  if (avatar) {
    avatar.src = fallbackAvatarUrl;
    avatar.alt = 'Foto profil ' + fullName;
    avatar.onerror = function() { this.src = fallbackAvatarUrl; };
  }

  $('userDetailName').textContent = fullName;
  $('userDetailUsername').textContent = '@' + username;
  $('userDetailEmail').textContent = user.email || '-';
  $('userDetailJabatan').textContent = user.jabatan || '-';
  $('userDetailSppg').textContent = user.sppg || '-';
  $('userDetailYayasan').textContent = user.namaYayasan || '-';
  $('userDetailRole').textContent = user.role || '-';
  $('userDetailRegistered').textContent = user.timestamp ? formatDate(user.timestamp) : '-';

  var roleBadge = $('userDetailRoleBadge');
  if (roleBadge) {
    roleBadge.textContent = user.role || '-';
    roleBadge.className = 'badge ' + (user.role === 'SUPER_ADMIN' ? 'badge-purple' : (user.role === 'ADMIN' ? 'badge-blue' : 'badge-outline'));
  }
  var sppgBadge = $('userDetailSppgBadge');
  if (sppgBadge) sppgBadge.textContent = user.sppg || '-';

  openModal('modalUserDetail');

  if (user.fotoProfil && String(user.fotoProfil).trim() !== '' && user.fotoProfil !== '-') {
    callApi('getFileUrl', ['FOTO_PROFIL', user.fotoProfil], function(res) {
      var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
      if (fotoUrl && currentDetailUserRow === user._row && avatar) avatar.src = fotoUrl;
    }, null);
  }
}

function editUserFromDetail() {
  var rowNum = currentDetailUserRow;
  if (rowNum === null || rowNum === undefined) return;
  closeModal('modalUserDetail');
  openEditUserModal(rowNum);
}

function deleteUserFromDetail() {
  var user = findManagedUser(currentDetailUserRow);
  if (!user) return;
  closeModal('modalUserDetail');
  confirmHapus('user', 0, user.username, 'user ' + String(user.namaLengkap || '').substring(0, 20));
}

'''
marker = "function openEditUserModal(rowNum) {\n"
if marker not in app:
    raise SystemExit('openEditUserModal marker not found')
app = app.replace(marker, helpers + marker, 1)
app = app.replace(
    "function openEditUserModal(rowNum) {\n  var user = allUsers.find(function(u) { return u._row === rowNum; });",
    "function openEditUserModal(rowNum) {\n  var user = findManagedUser(rowNum);",
    1,
)

styles = r'''
<style id="user-management-row-detail-styles">
  #page-users .user-row-clickable {
    cursor: pointer;
    transition: background-color .18s ease, box-shadow .18s ease;
  }
  #page-users .user-row-clickable:hover {
    background: #f0f7fb;
    box-shadow: inset 3px 0 0 var(--primary);
  }
  #page-users .user-row-clickable:focus {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
    background: var(--primary-light);
  }
  #page-users .user-row-clickable td { vertical-align: middle; }
  .user-detail-modal { max-width: 720px; }
  .user-detail-header { align-items: flex-start; gap: 14px; }
  .user-detail-title-wrap { flex: 1; min-width: 0; }
  .user-detail-title-wrap h3 { margin: 0; }
  .user-detail-title-wrap p { margin: 5px 0 0; color: var(--slate-500); font-size: 12px; }
  .user-detail-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
  .user-detail-header-actions .btn { min-height: 38px; }
  .user-detail-hero {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px;
    margin-bottom: 18px;
    background: linear-gradient(135deg, #eff8fd 0%, #f8fbfd 100%);
    border: 1px solid #d8eaf4;
    border-radius: 16px;
  }
  .user-detail-avatar {
    width: 84px;
    height: 84px;
    border-radius: 22px;
    object-fit: cover;
    border: 4px solid #fff;
    box-shadow: 0 8px 20px rgba(30,111,156,.14);
    flex-shrink: 0;
  }
  .user-detail-identity { min-width: 0; }
  .user-detail-identity h4 { margin: 0 0 4px; color: var(--slate-900); font-size: 20px; line-height: 1.25; }
  .user-detail-identity p { margin: 0 0 10px; color: var(--slate-500); font-size: 13px; }
  .user-detail-badges { display: flex; flex-wrap: wrap; gap: 7px; }
  .user-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .user-detail-item { padding: 14px 15px; background: #fff; border: 1px solid var(--slate-200); border-radius: 12px; min-width: 0; }
  .user-detail-label { display: block; margin-bottom: 5px; color: var(--slate-500); font-size: 10px; font-weight: 800; letter-spacing: .65px; text-transform: uppercase; }
  .user-detail-value { display: block; color: var(--slate-800); font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  @media (max-width: 640px) {
    .user-detail-header { flex-wrap: wrap; }
    .user-detail-title-wrap { flex-basis: calc(100% - 48px); }
    .user-detail-header-actions { width: 100%; order: 3; justify-content: stretch; }
    .user-detail-header-actions .btn { flex: 1; justify-content: center; }
    .user-detail-header-actions .modal-close { flex: 0 0 42px; }
    .user-detail-hero { align-items: flex-start; padding: 16px; gap: 14px; }
    .user-detail-avatar { width: 68px; height: 68px; border-radius: 18px; }
    .user-detail-identity h4 { font-size: 17px; }
    .user-detail-grid { grid-template-columns: 1fr; }
  }
</style>
'''
if 'user-management-row-detail-styles' in index:
    raise SystemExit('user detail styles already exist')
if '</head>' not in index:
    raise SystemExit('</head> not found')
index = index.replace('</head>', styles + '</head>', 1)

index = index.replace(
    '<p class="page-desc">Daftar semua pengguna aplikasi</p>',
    '<p class="page-desc">Klik salah satu baris untuk melihat detail pengguna</p>',
    1,
)
index = index.replace(
    '                  <th>SPPG</th>\n                  <th style="width:80px;text-align:center;">Aksi</th>',
    '                  <th>SPPG</th>',
    1,
)

modal = r'''<!-- ==================== MODAL DETAIL USER (ADMIN) ==================== -->
<div id="modalUserDetail" class="hidden">
  <div class="modal-overlay" onclick="if(event.target===this)closeModal('modalUserDetail')">
    <div class="modal-box user-detail-modal">
      <div class="modal-header user-detail-header">
        <div class="user-detail-title-wrap">
          <h3><i class="fas fa-id-card" style="color:var(--primary);margin-right:8px;"></i>Detail User</h3>
          <p>Informasi akun dan penempatan pengguna</p>
        </div>
        <div class="user-detail-header-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="editUserFromDetail()" title="Edit user">
            <i class="fas fa-edit"></i><span>Edit</span>
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="deleteUserFromDetail()" title="Hapus user">
            <i class="fas fa-trash"></i><span>Hapus</span>
          </button>
          <button type="button" onclick="closeModal('modalUserDetail')" class="modal-close" aria-label="Tutup detail user"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="modal-body">
        <div class="user-detail-hero">
          <img id="userDetailAvatar" class="user-detail-avatar" src="" alt="Foto profil user">
          <div class="user-detail-identity">
            <h4 id="userDetailName">-</h4>
            <p id="userDetailUsername">-</p>
            <div class="user-detail-badges">
              <span id="userDetailRoleBadge" class="badge badge-outline">-</span>
              <span id="userDetailSppgBadge" class="badge badge-outline">-</span>
            </div>
          </div>
        </div>
        <div class="user-detail-grid">
          <div class="user-detail-item"><span class="user-detail-label">Email</span><span class="user-detail-value" id="userDetailEmail">-</span></div>
          <div class="user-detail-item"><span class="user-detail-label">Jabatan</span><span class="user-detail-value" id="userDetailJabatan">-</span></div>
          <div class="user-detail-item"><span class="user-detail-label">Role</span><span class="user-detail-value" id="userDetailRole">-</span></div>
          <div class="user-detail-item"><span class="user-detail-label">SPPG</span><span class="user-detail-value" id="userDetailSppg">-</span></div>
          <div class="user-detail-item"><span class="user-detail-label">Nama Yayasan</span><span class="user-detail-value" id="userDetailYayasan">-</span></div>
          <div class="user-detail-item"><span class="user-detail-label">Terdaftar Sejak</span><span class="user-detail-value" id="userDetailRegistered">-</span></div>
        </div>
      </div>
    </div>
  </div>
</div>

'''
modal_marker = '<!-- ==================== MODAL EDIT USER (ADMIN) ==================== -->'
if modal_marker not in index:
    raise SystemExit('edit user modal marker not found')
index = index.replace(modal_marker, modal + modal_marker, 1)

old_cache_key = '<script src="./app.js?v=20260721-verifier-ttd-v3"></script>'
new_cache_key = '<script src="./app.js?v=20260722-user-detail-v1"></script>'
if old_cache_key not in index:
    raise SystemExit('old app cache key not found')
index = index.replace(old_cache_key, new_cache_key, 1)

old_test_key = r'/<script src="\.\/app\.js\?v=20260721-verifier-ttd-v3"><\/script>/.test(index)'
new_test_key = r'/<script src="\.\/app\.js\?v=20260722-user-detail-v1"><\/script>/.test(index)'
if old_test_key not in verifier_test:
    raise SystemExit('verifier regression cache key marker not found')
verifier_test = verifier_test.replace(old_test_key, new_test_key, 1)
verifier_test = verifier_test.replace('index must use the verifier-flow cache-bust key', 'index must use the current frontend cache-bust key', 1)

sw, sw_count = re.subn(
    r"const CACHE_VERSION = 'sim-sppg-v[^']+';",
    "const CACHE_VERSION = 'sim-sppg-v20260722-user-detail-v5';",
    sw,
    count=1,
)
if sw_count != 1:
    raise SystemExit('service worker cache version not found')

permanent_test = r'''import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const renderStart = app.indexOf('function renderUsersTable()');
const renderEnd = app.indexOf('function applyUsersFiltersLocal()', renderStart);
const renderBlock = app.slice(renderStart, renderEnd);
const usersPageStart = index.indexOf('<!-- ==================== USERS PAGE (ADMIN) ==================== -->');
const usersPageEnd = index.indexOf('<!-- ==================== TRANSAKSI PAGE ==================== -->', usersPageStart);
const usersPage = index.slice(usersPageStart, usersPageEnd);

requireMatch(renderStart >= 0 && renderEnd > renderStart, 'renderUsersTable must exist');
requireMatch(renderBlock.includes('class="user-row-clickable"'), 'user table rows must be clickable');
requireMatch(renderBlock.includes('onclick="openUserDetailModal('), 'row click must open user detail');
requireMatch(renderBlock.includes('onkeydown="handleUserRowKeydown('), 'row must support keyboard access');
requireMatch(!renderBlock.includes('action-btn edit'), 'edit icon must be removed from user rows');
requireMatch(!renderBlock.includes('action-btn delete'), 'delete icon must be removed from user rows');
requireMatch(!usersPage.includes('>Aksi</th>'), 'users table must not include an action column');
requireMatch(index.includes('id="modalUserDetail"'), 'user detail modal must exist');
requireMatch(index.includes('onclick="editUserFromDetail()"'), 'edit action must be in detail modal');
requireMatch(index.includes('onclick="deleteUserFromDetail()"'), 'delete action must be in detail modal');
requireMatch(app.includes('function openUserDetailModal(rowNum)'), 'detail modal controller must exist');
requireMatch(app.includes('function editUserFromDetail()'), 'detail edit controller must exist');
requireMatch(app.includes('function deleteUserFromDetail()'), 'detail delete controller must exist');
requireMatch(index.includes('user-management-row-detail-styles'), 'responsive detail layout styles must exist');

if (!process.exitCode) console.log('User management row detail check passed.');
'''
Path('scripts/check-user-management-row-detail.mjs').write_text(permanent_test, encoding='utf-8')

permanent_workflow = r'''name: User management row detail

on:
  pull_request:
    paths:
      - 'app.js'
      - 'index.html'
      - 'scripts/check-user-management-row-detail.mjs'
      - '.github/workflows/user-management-row-detail.yml'
  push:
    branches: [main]
    paths:
      - 'app.js'
      - 'index.html'
      - 'scripts/check-user-management-row-detail.mjs'
      - '.github/workflows/user-management-row-detail.yml'

jobs:
  user-row-detail:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Check clickable user detail flow
        run: node scripts/check-user-management-row-detail.mjs
'''
Path('.github/workflows/user-management-row-detail.yml').write_text(permanent_workflow, encoding='utf-8')

APP.write_text(app, encoding='utf-8')
INDEX.write_text(index, encoding='utf-8')
SW.write_text(sw, encoding='utf-8')
VERIFIER_TEST.write_text(verifier_test, encoding='utf-8')

if TEMP_WORKFLOW.exists():
    TEMP_WORKFLOW.unlink()
if SELF.exists():
    SELF.unlink()

print('Clickable user detail modal patch applied.')
