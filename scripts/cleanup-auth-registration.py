from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)


def remove_between(text: str, start_marker: str, end_marker: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'missing start: {label}')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'missing end: {label}')
    return text[:start] + text[end:]


# -----------------------------------------------------------------------------
# app.js — make admin-created accounts the only account creation mechanism.
# -----------------------------------------------------------------------------
app_path = Path('app.js')
app = app_path.read_text(encoding='utf-8')

app = replace_once(
    app,
    "  'register-user-v2': { registerUser:1 },\n  'auth-public-action': { verifyRegistrationOtp:1, resendRegistrationOtp:1, loginUser:1, refreshSession:1, checkSession:1 },",
    "  'register-user-v2': { createUserBySuperAdmin:1 },\n  'auth-public-action': { loginUser:1, refreshSession:1, checkSession:1 },",
    'API routes registration',
)
app = replace_once(
    app,
    "var PUBLIC_FN = {\n  registerUser:1, verifyRegistrationOtp:1, resendRegistrationOtp:1,\n  loginUser:1, refreshSession:1, checkSession:1, recoverPassword:1, recoverUsername:1,",
    "var PUBLIC_FN = {\n  loginUser:1, refreshSession:1, checkSession:1, recoverPassword:1, recoverUsername:1,",
    'public functions registration',
)
app = replace_once(
    app,
    "  registerUser:1, verifyRegistrationOtp:1, resendRegistrationOtp:1,\n  recoverPassword:1, updateFeatureSettings:1, updateMenuVisibility:1,",
    "  createUserBySuperAdmin:1,\n  recoverPassword:1, updateFeatureSettings:1, updateMenuVisibility:1,",
    'mutation functions registration',
)

# Auth mode no longer has register/OTP screens.
set_auth_start = "function setAuthMode(mode) {"
show_login = "function showLogin() {"
start = app.find(set_auth_start)
end = app.find(show_login, start)
if start < 0 or end < 0:
    raise SystemExit('auth mode block not found')
app = app[:start] + """function setAuthMode() {
  var login = $('loginForm');
  if (login) login.classList.remove('hidden');
  var overlay = $('authOverlay');
  if (overlay) overlay.dataset.authMode = 'login';
  if (typeof updateAuthHeading === 'function') updateAuthHeading();
}

""" + app[end:]

# Remove public registration screen launcher while keeping shared password toggle.
app = remove_between(app, "function showRegister() {", "function togglePw(fieldId, btn) {", 'showRegister')

# Strength meter and registration photo preview are registration-only.
app = remove_between(app, "function checkPasswordStrength() {", "function previewEditFoto(input) {", 'registration strength/photo')

# Registration submit + OTP flow ends immediately before account recovery.
app = remove_between(
    app,
    "function doRegister() {",
    "// ============================================================\n// RECOVERY (LUPA PASSWORD / USERNAME / TOKEN)",
    'registration and OTP functions',
)

app = app.replace(
    '// YAYASAN AUTOCOMPLETE — dipakai di form Daftar Akun\n// Data diambil dari getDropdownOptions() (daftar Nama Yayasan yang sudah pernah diinput).',
    '// YAYASAN AUTOCOMPLETE — dipakai pada form profil, user, dan konfigurasi admin.\n// Data diambil dari getDropdownOptions() (daftar Nama Yayasan yang sudah pernah diinput).',
    1,
)

# Add SUPER_ADMIN menu entry next to Settings.
app = replace_once(
    app,
    "    { page: 'settings', label: 'Pengaturan', icon: 'fa-sliders-h' },\n    { page: 'transaksi', label: 'Semua Transaksi', icon: 'fa-exchange-alt' },",
    "    { page: 'settings', label: 'Pengaturan', icon: 'fa-sliders-h' },\n    { page: 'add-user', label: 'Tambah User', icon: 'fa-user-plus' },\n    { page: 'transaksi', label: 'Semua Transaksi', icon: 'fa-exchange-alt' },",
    'super admin menu',
)

app = replace_once(
    app,
    "function isMenuPageVisibleForRole(page, role) {\n  if (page === 'chattrx' || page === 'mytrx') return role === 'SUPER_ADMIN' || role === 'ADMIN';",
    "function isMenuPageVisibleForRole(page, role) {\n  if (page === 'add-user') return role === 'SUPER_ADMIN';\n  if (page === 'chattrx' || page === 'mytrx') return role === 'SUPER_ADMIN' || role === 'ADMIN';",
    'add user menu visibility',
)

app = replace_once(
    app,
    "    'audit-log': 'Riwayat Aktivitas', 'admin-assignment': 'Konfigurasi Admin',\n    'settings': 'Pengaturan'",
    "    'audit-log': 'Riwayat Aktivitas', 'admin-assignment': 'Konfigurasi Admin',\n    'settings': 'Pengaturan', 'add-user': 'Tambah User'",
    'page title add user',
)

# Integrate Add User behaviour directly into the main bundle.
users_anchor = "// ============================================================\n// 9. USERS (ADMIN)\n// ============================================================"
add_user_code = r'''// ============================================================
// SUPER ADMIN — TAMBAH USER
// ============================================================
function setAdminAddUserResult(success, message) {
  var box = $('adminAddUserResult');
  if (!box) return;
  box.classList.remove('hidden');
  box.style.background = success ? '#ecfdf5' : '#fff1f2';
  box.style.border = success ? '1px solid #a7f3d0' : '1px solid #fecdd3';
  box.style.color = success ? '#047857' : '#be123c';
  box.textContent = message || '';
}

function submitAdminAddUser() {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    showToast('error', 'Akses Ditolak', 'Hanya Super Admin yang dapat menambah user.');
    return;
  }

  var emailInput = $('adminAddUserEmail');
  var passwordInput = $('adminAddUserPassword');
  var button = $('btnAdminAddUser');
  var email = String(emailInput && emailInput.value || '').trim().toLowerCase();
  var password = String(passwordInput && passwordInput.value || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAdminAddUserResult(false, 'Alamat email tidak valid.');
    return;
  }
  if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
    setAdminAddUserResult(false, 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span> Membuat akun...</span>';
  setAdminAddUserResult(true, 'Sedang membuat akun dan mengirim email konfirmasi...');

  callApi('createUserBySuperAdmin', [{ email: email, password: password }], function(result) {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>';
    if (result && result.success) {
      setAdminAddUserResult(true, result.message || 'Akun berhasil dibuat dan email konfirmasi telah dikirim.');
      showToast('success', 'User Berhasil Ditambahkan', result.message || 'Email konfirmasi telah dikirim.');
      emailInput.value = '';
      passwordInput.value = '';
      if (typeof loadUsers === 'function') loadUsers(true);
      return;
    }
    var message = result && result.message || 'Pembuatan akun gagal.';
    setAdminAddUserResult(false, message);
    showToast('error', 'Gagal', message);
  }, function(error) {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>';
    var message = error && error.message ? error.message : 'Pembuatan akun gagal.';
    setAdminAddUserResult(false, message);
    showToast('error', 'Gagal', message);
  });
}

'''
if users_anchor not in app:
    raise SystemExit('users section anchor missing')
app = app.replace(users_anchor, add_user_code + users_anchor, 1)

# Unified runtime: remove all public-registration compatibility hooks.
app = app.replace(
    "    registerUrl: 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/register-user-v2',\n",
    '',
    1,
)
app = app.replace(
    "    registerUser: 1,\n    verifyRegistrationOtp: 1,\n    resendRegistrationOtp: 1,\n",
    '',
    1,
)
app = app.replace("    if (visible(byId('registerForm'))) return 'register';\n", '', 1)
app = app.replace("    if (visible(byId('otpForm'))) return 'otp';\n", '', 1)
app = app.replace(
    "      register: ['Registrasi akun', 'Buat akun SIM-SPPG', 'Lengkapi data akun dan unit kerja Anda.'],\n      otp: ['Verifikasi akun', 'Masukkan kode OTP', 'Periksa email Anda lalu masukkan enam digit kode verifikasi.'],\n",
    '',
    1,
)

# Registration input repair block inside repairInputs().
repair_start = app.find("    var registerEmail = byId('regEmail');")
if repair_start >= 0:
    repair_end = app.find("  }\n\n  function enhanceAuthentication()", repair_start)
    if repair_end < 0:
        raise SystemExit('registration repair block end missing')
    app = app[:repair_start] + app[repair_end:]

# Remove the old fetch wrapper that intercepted registerUser.
if "  function installRegistrationRouting() {" in app:
    app = remove_between(app, "  function installRegistrationRouting() {", "  function ensureRoleMenus() {", 'runtime registration routing')
app = app.replace("    installRegistrationRouting();\n", '', 1)

# Final source-level assertions: no browser public registration route or OTP remains.
for forbidden in [
    'registerUser:1', 'verifyRegistrationOtp', 'resendRegistrationOtp',
    'function showRegister()', 'function doRegister()', 'pendingOtpEmail',
    "byId('registerForm')", "byId('otpForm')", 'installRegistrationRouting'
]:
    if forbidden in app:
        raise SystemExit(f'legacy registration remains in app.js: {forbidden}')
if "'register-user-v2': { createUserBySuperAdmin:1 }" not in app:
    raise SystemExit('createUserBySuperAdmin route missing')
if "{ page: 'add-user', label: 'Tambah User'" not in app:
    raise SystemExit('add-user menu missing')

app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# index.html — physically remove the public registration and OTP DOM/CSS.
# -----------------------------------------------------------------------------
index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')

html = replace_once(
    html,
    '<div class="auth-footer">Belum punya akun? <a onclick="showRegister()">Daftar sekarang</a></div>',
    '<div class="auth-footer"><span><i class="fas fa-user-shield" style="margin-right:6px;"></i>Akun baru hanya dibuat oleh Admin.</span></div>',
    'login registration footer',
)

# Remove registration form followed by OTP form.
reg_start = html.find('      <div id="registerForm"')
otp_start = html.find('      <div id="otpForm"', reg_start)
if reg_start < 0 or otp_start < 0:
    raise SystemExit('registration/otp markup anchors missing')
html = html[:reg_start] + html[otp_start:]

otp_start = html.find('      <div id="otpForm"')
auth_section_end = html.find('    </section>\n  </main>\n</div><!-- /authOverlay -->', otp_start)
if otp_start < 0 or auth_section_end < 0:
    raise SystemExit('otp/auth section end missing')
html = html[:otp_start] + html[auth_section_end:]

# Registration-only CSS.
html = re.sub(
    r'\n\s*\.strength-bar \{[^\n]*\}\n\s*\.strength-bar span \{[^\n]*\}\n\s*\.strength-bar span\.weak \{[^\n]*\}\n\s*\.strength-bar span\.medium \{[^\n]*\}\n\s*\.strength-bar span\.strong \{[^\n]*\}\n',
    '\n',
    html,
    count=1,
)
html = re.sub(r'\n\.auth-register-note \{.*?\n\}\n', '\n', html, count=1, flags=re.S)
css_start = html.find('.auth-hidden-field { display: none !important; }')
css_end = html.find('@media (max-width: 820px) {', css_start)
if css_start >= 0 and css_end >= 0:
    html = html[:css_start] + html[css_end:]
html = html.replace(
    '  #authOverlay.auth-architecture,\n  #authOverlay.auth-architecture[data-auth-mode="register"] {',
    '  #authOverlay.auth-architecture {',
    1,
)
html = html.replace('  #registerForm, #registerForm .form-row { grid-template-columns: 1fr; gap: 0; }\n', '', 1)
html = html.replace('  #registerForm > * { grid-column: 1 !important; }\n', '', 1)

# Add static SUPER_ADMIN page before Users.
users_page_anchor = '      <!-- ==================== USERS PAGE (ADMIN) ==================== -->'
add_user_page = '''      <!-- ==================== TAMBAH USER PAGE (SUPER ADMIN) ==================== -->
      <div id="page-add-user" class="page-section hidden">
        <div class="page-header">
          <div class="page-header-info">
            <div class="page-title"><i class="fas fa-user-plus" style="color:var(--primary);"></i> Tambah User</div>
            <p class="page-desc">Khusus Super Admin untuk membuat akun login baru.</p>
          </div>
        </div>
        <div class="table-container" style="max-width:680px;">
          <div class="table-header"><h3><i class="fas fa-user-shield"></i> Daftarkan Akun User</h3></div>
          <div style="padding:24px;">
            <div class="info-card" style="margin-bottom:18px;background:var(--primary-light);border-color:#bae6fd;">
              <div style="font-weight:700;color:var(--primary-dark);margin-bottom:5px;"><i class="fas fa-envelope-circle-check"></i> Konfirmasi Email</div>
              <div style="font-size:12px;line-height:1.6;">Sistem mengirim email konfirmasi/undangan ke alamat yang didaftarkan. User menggunakan email dan password dari Admin setelah email dikonfirmasi. Data profil lain dapat dilengkapi kemudian melalui menu Profil.</div>
            </div>
            <form id="adminAddUserForm" onsubmit="event.preventDefault();submitAdminAddUser();">
              <div class="form-group">
                <label class="form-label" for="adminAddUserEmail">Email <span class="req">*</span></label>
                <input type="email" id="adminAddUserEmail" class="form-input" placeholder="nama@email.com" autocomplete="off" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="adminAddUserPassword">Password <span class="req">*</span></label>
                <div class="password-wrap">
                  <input type="password" id="adminAddUserPassword" class="form-input" placeholder="Password awal user" autocomplete="new-password" required>
                  <button type="button" class="toggle-password" onclick="togglePw('adminAddUserPassword',this)" aria-label="Tampilkan password"><i class="fas fa-eye"></i></button>
                </div>
                <p class="form-hint">Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka. User dapat mengganti password sendiri setelah login.</p>
              </div>
              <div id="adminAddUserResult" class="hidden" style="margin:12px 0;padding:11px 13px;border-radius:8px;font-size:12px;"></div>
              <button type="submit" id="btnAdminAddUser" class="btn btn-primary"><i class="fas fa-user-plus"></i><span> Tambahkan User</span></button>
            </form>
          </div>
        </div>
      </div>

'''
if users_page_anchor not in html:
    raise SystemExit('users page anchor missing')
html = html.replace(users_page_anchor, add_user_page + users_page_anchor, 1)

for forbidden in ['id="registerForm"', 'id="otpForm"', 'showRegister()', 'doVerifyOtp()', 'doResendOtp()', '#registerForm', 'otp-code-input']:
    if forbidden in html:
        raise SystemExit(f'legacy registration remains in index.html: {forbidden}')
if 'id="page-add-user"' not in html:
    raise SystemExit('static add user page missing')

index_path.write_text(html, encoding='utf-8')


# -----------------------------------------------------------------------------
# supplier-dropdown.js — no longer load a runtime override for account creation.
# -----------------------------------------------------------------------------
loader_path = Path('supplier-dropdown.js')
loader = loader_path.read_text(encoding='utf-8')
loader = loader.replace("  var USER_BASE = './assets/js/users/';\n", '', 1)
loader = loader.replace("    { base: USER_BASE, file: 'role-management.js', marker: 'data-role-management', version: '20260731-super-admin-role-v1' },\n", "    { base: './assets/js/users/', file: 'role-management.js', marker: 'data-role-management', version: '20260731-super-admin-role-v1' },\n", 1)
loader = loader.replace(",\n    { base: USER_BASE, file: 'admin-add-user.js', marker: 'data-admin-add-user', version: '20260814-admin-create-v1' }\n", "\n", 1)
if 'admin-add-user.js' in loader:
    raise SystemExit('admin-add-user loader remains')
loader_path.write_text(loader, encoding='utf-8')

print('registration/auth cleanup applied')
