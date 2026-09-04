import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

const migrationFiles = walk(path.join(ROOT, 'supabase', 'migrations'))
  .filter((file) => file.endsWith('.sql'));

const migrationVersions = new Map();
for (const file of migrationFiles) {
  const name = path.basename(file);
  const match = name.match(/^(\d+)_/);
  if (!match) {
    errors.push(`${relative(file)} tidak memakai prefix timestamp migration.`);
    continue;
  }

  const version = match[1];
  const existing = migrationVersions.get(version) ?? [];
  existing.push(relative(file));
  migrationVersions.set(version, existing);
}

for (const [version, files] of migrationVersions) {
  if (files.length > 1) {
    errors.push(`Timestamp migration ${version} dipakai lebih dari sekali: ${files.join(', ')}`);
  }
}

const forbiddenWorkflowPatterns = [
  /git\s+push\s+origin\s+HEAD:main/i,
  /find\s+supabase\/migrations[^\n]*-delete/i,
  /supabase\s+migration\s+repair[^\n]*--status\s+reverted/i,
];

for (const file of walk(path.join(ROOT, '.github', 'workflows')).filter((item) => /\.ya?ml$/.test(item))) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of forbiddenWorkflowPatterns) {
    if (pattern.test(content)) {
      errors.push(`${relative(file)} memuat pola workflow yang dapat mengubah source/history secara destruktif.`);
    }
  }
}

// Canonical frontend/runtime modules. Keep this list aligned with what index.html
// and supplier-dropdown.js actually load; retired patch bundles must not be revived.
const maintainedJavaScript = [
  'supplier-dropdown.js',
  'yayasan-dropdown-hotfix.js',
  'sidebar-menu-structure.js',
  'transaction-category-supplier-rules.js',
  'assets/js/auth-recovery.js',
  'assets/js/documents.js',
  'assets/js/users/role-management.js',
  'assets/js/transactions/edit-supplier-options-fix.js',
  'assets/js/transactions/filter-and-edit-supplier.js',
  'assets/js/transactions/edit-save-reliability.js',
  'assets/js/transactions/supplier-label-update.js',
  'assets/js/supplier/app-dropdowns.js',
  'assets/js/supplier/edit-transaction-ui.js',
  'assets/js/supplier/storage-egress-optimizer.js',
  'assets/js/supplier/supplier-actions-fix.js',
  'assets/js/reports/approval-export-columns.js',
  'assets/js/reports/approval-supplier-summary.js',
  'assets/js/reports/approval-print-all-pages.js',
  'assets/js/reports/transaction-export-category.js',
  '_worker.js',
  'sw.js',
];

for (const file of maintainedJavaScript) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    errors.push(`Modul frontend terpelihara tidak ditemukan: ${file}`);
  }
}

const chatTrxMessagePath = path.join(ROOT, 'supabase', 'functions', 'chattrx-message-action', 'index.ts');
const chatTrxConfirmPath = path.join(ROOT, 'supabase', 'functions', 'chattrx-confirm-action', 'index.ts');
if (fs.existsSync(chatTrxMessagePath) && fs.existsSync(chatTrxConfirmPath)) {
  const messageSource = fs.readFileSync(chatTrxMessagePath, 'utf8');
  const confirmSource = fs.readFileSync(chatTrxConfirmPath, 'utf8');
  if (!messageSource.includes("d.kategori==='Gaji/Upah Karyawan'&&!d.penerima")) {
    errors.push('ChatTrx harus meminta penerima untuk transaksi gaji.');
  }
  if (!messageSource.includes('function requiresReceipt')) {
    errors.push('ChatTrx harus menentukan kewajiban nota berdasarkan kategori.');
  }
  if (!messageSource.includes('function evidenceReuseTarget')) {
    errors.push('ChatTrx harus mendukung penggunaan satu dokumen sebagai nota dan bukti sesuai instruksi pengguna.');
  }
  if (!messageSource.includes('staleEvidenceRequest')) {
    errors.push('Balasan ChatTrx harus diselaraskan dengan status akhir bukti pada draft.');
  }
  if (!messageSource.includes('prematureConfirmation')) {
    errors.push('ChatTrx tidak boleh menjanjikan tombol konfirmasi sebelum draft benar-benar lengkap.');
  }
  if (!messageSource.includes('function oneQuestion')) {
    errors.push('ChatTrx harus membatasi klarifikasi menjadi satu pertanyaan terpenting.');
  }
  if (!messageSource.includes("patch.status_pembayaran='sudah_dibayar'")) {
    errors.push('Bukti pembayaran valid harus otomatis menentukan status sudah dibayar.');
  }
  if (!messageSource.includes('basis:ai.basis||null')) {
    errors.push('ChatTrx harus menyimpan dasar fakta dan rekomendasi dari keputusan AI.');
  }
  if (!messageSource.includes('recent_conversation:recentHistory')) {
    errors.push('ChatTrx harus memberikan konteks percakapan terbaru kepada AI.');
  }
  if (!messageSource.includes('existing_evidence:evidence')) {
    errors.push('ChatTrx harus memberi tahu AI tentang nota dan bukti yang sudah tersimpan.');
  }
  if (!messageSource.includes("text(im.fileName)||text(im.name)")) {
    errors.push('Nama asli lampiran ChatTrx harus diteruskan ke OpenAI.');
  }
  if (!messageSource.includes("note.valid||draft.verifikasi_nota?.valid!==true")) {
    errors.push('Lampiran baru yang tidak valid tidak boleh menimpa nota lama yang sudah valid.');
  }
  if (/from\(['"]TRANSAKSI['"]\)/.test(messageSource + confirmSource)) {
    errors.push('ChatTrx tidak boleh membaca atau menulis tabel TRANSAKSI utama.');
  }
  if (!confirmSource.includes("from('CHATTRX_TRANSAKSI').upsert")) {
    errors.push('Konfirmasi ChatTrx harus menyimpan ke CHATTRX_TRANSAKSI.');
  }
  if (/TTD konfirmasi wajib|ttdBase64/.test(confirmSource)) {
    errors.push('Konfirmasi ChatTrx tidak boleh mewajibkan TTD.');
  }
}

const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const authActionSource = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'auth-public-action', 'index.ts'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
for (const match of indexSource.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+)(?:\?[^"']*)?["']/g)) {
  const scriptPath = path.join(ROOT, match[1].replace(/\//g, path.sep));
  if (!fs.existsSync(scriptPath)) errors.push(`index.html memuat script lokal yang tidak ada: ${match[1]}`);
}
if (!appSource.includes('var IDLE_LOGOUT_MS = 30 * 60 * 1000')) errors.push('Batas idle frontend harus 30 menit.');
if (!appSource.includes('var IDLE_WARNING_MS = 5 * 60 * 1000')) errors.push('Peringatan sesi harus muncul 5 menit sebelum logout.');
if (!appSource.includes('var SESSION_ABSOLUTE_MAX_MS = 8 * 60 * 60 * 1000')) errors.push('Sesi harus memiliki batas absolut 8 jam.');
const presenceSource = appSource.match(/function sendPresenceHeartbeat\(\)[\s\S]*?\n}/)?.[0] || '';
if (presenceSource.includes('resetIdleLogoutTimer')) errors.push('Heartbeat tidak boleh memperpanjang sesi pengguna.');
if (!indexSource.includes('id="modalSessionWarning"') || !indexSource.includes('id="sessionWarningCountdown"')) errors.push('UI peringatan sesi belum tersedia.');
if (!authActionSource.includes("admin.auth.admin.signOut(token, scope)")) errors.push('Logout harus mencabut sesi Supabase di server.');
if (!authActionSource.includes("fn === 'logoutSession'")) errors.push('Endpoint logoutSession belum tersedia.');
const sidebarSource = fs.readFileSync(path.join(ROOT, 'sidebar-menu-structure.js'), 'utf8');
if (sidebarSource.includes('registration-flow.js')) errors.push('Sidebar masih memuat modul registrasi yang sudah tidak tersedia.');
if (sidebarSource.includes('auth-recovery.js')) errors.push('Sidebar tidak boleh memuat ulang modul recovery yang sudah dimuat index.html.');
if (/recoverUsername|recoverToken/.test(appSource)) errors.push('Route recovery lama masih tertinggal di app.js.');
const documentActionPath = path.join(ROOT, 'supabase', 'functions', 'document-action', 'index.ts');
const documentMigration = migrationFiles.find((file) => file.endsWith('add_document_center.sql'));
if (!fs.existsSync(documentActionPath)) errors.push('Edge Function Pusat Dokumen belum tersedia.');
if (!documentMigration) errors.push('Migration Pusat Dokumen belum tersedia.');
if (!indexSource.includes('id="page-documents"') || !indexSource.includes('./assets/js/documents.js')) errors.push('UI Pusat Dokumen belum terpasang lengkap.');
if (!indexSource.includes('G-FSK0RC1L24')) errors.push('Google Analytics SIM-SPPG belum terpasang.');
if (!appSource.includes("'document-action'")) errors.push('Route API Pusat Dokumen belum terdaftar.');
if (fs.existsSync(documentActionPath)) {
  const documentActionSource = fs.readFileSync(documentActionPath, 'utf8');
  if (/from\(['"]TRANSAKSI['"]\)|chattrx-evidence|storage\.from\(['"]transaksi/i.test(documentActionSource)) {
    errors.push('Pusat Dokumen tidak boleh menyentuh tabel atau storage transaksi.');
  }
  if (!documentActionSource.includes("const BUCKET = 'sppg-documents'")) errors.push('Pusat Dokumen harus memakai bucket privat tersendiri.');
  if (!documentActionSource.includes('createSignedUrl')) errors.push('Preview dokumen harus memakai URL sementara.');
  if (!documentActionSource.includes('useDocumentTemplate')) errors.push('Template harus dapat disalin menjadi dokumen kerja tanpa mengubah file asli.');
  if (!documentActionSource.includes("'PERSONAL_DATA' : requestedClassification")) errors.push('Folder Penerima Manfaat harus otomatis diklasifikasikan sebagai Data Pribadi.');
}
if (documentMigration) {
  const documentMigrationSource = fs.readFileSync(documentMigration, 'utf8');
  if (!documentMigrationSource.includes("values ('sppg-documents', 'sppg-documents', false")) errors.push('Bucket dokumen harus bersifat privat.');
  for (const table of ['DOC_FOLDERS', 'DOC_FILES', 'DOC_FAVORITES', 'DOC_AUDIT_LOG']) {
    if (!documentMigrationSource.includes(`alter table public."${table}" enable row level security`)) errors.push(`RLS ${table} belum diaktifkan.`);
  }
}
const appShellMatch = serviceWorkerSource.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!appShellMatch) {
  errors.push('Daftar APP_SHELL service worker tidak ditemukan.');
} else {
  for (const match of appShellMatch[1].matchAll(/['"]\.\/([^'"]+)['"]/g)) {
    const assetPath = path.join(ROOT, match[1].replace(/\//g, path.sep));
    if (!fs.existsSync(assetPath)) errors.push(`Service worker melakukan precache file yang tidak ada: ${match[1]}`);
  }
}

// Transaction edit helpers must not independently wrap the same global modal
// lifecycle. Multiple wrappers caused repeated refreshes and duplicate API/event
// side effects in the edit form.
const editSupplierOptionsSource = fs.readFileSync(path.join(ROOT, 'assets/js/transactions/edit-supplier-options-fix.js'), 'utf8');
const editTransactionUiSource = fs.readFileSync(path.join(ROOT, 'assets/js/supplier/edit-transaction-ui.js'), 'utf8');
const editSaveSource = fs.readFileSync(path.join(ROOT, 'assets/js/transactions/edit-save-reliability.js'), 'utf8');
const editModalWrapperCount = [editSupplierOptionsSource, editTransactionUiSource]
  .filter((source) => source.includes('window.openModal = function')).length;
if (editModalWrapperCount > 1) {
  errors.push('Modal Edit Transaksi dibungkus oleh lebih dari satu runtime helper.');
}
if (!editSaveSource.includes('SIM_SPPG_TRANSACTION_CATEGORY_RULES')) {
  errors.push('Validasi supplier Edit Transaksi harus mengikuti aturan jenis kategori canonical.');
}

// Validate the sequential dynamic loader against the filesystem so stale hotfix
// references cannot silently generate a 404 on every page load.
const loaderPath = path.join(ROOT, 'supplier-dropdown.js');
if (fs.existsSync(loaderPath)) {
  const loaderSource = fs.readFileSync(loaderPath, 'utf8');
  const loaderBases = {
    MODULE_BASE: 'assets/js/supplier',
    REPORT_BASE: 'assets/js/reports',
    TRANSACTION_BASE: 'assets/js/transactions',
    USER_BASE: 'assets/js/users',
  };

  for (const match of loaderSource.matchAll(/\{\s*base:\s*([A-Z_]+),\s*file:\s*'([^']+)'/g)) {
    const [, baseName, fileName] = match;
    const baseDir = loaderBases[baseName];
    if (!baseDir) {
      errors.push(`Loader memakai base yang tidak dikenali: ${baseName} untuk ${fileName}`);
      continue;
    }
    const target = path.join(ROOT, baseDir, fileName);
    if (!fs.existsSync(target)) {
      errors.push(`Loader mengarah ke modul yang tidak ada: ${relative(target)}`);
    }
  }

  if (loaderSource.includes('auth-recovery-hotfix.js')) {
    errors.push('Dead reference auth-recovery-hotfix.js masih ada di supplier-dropdown.js.');
  }
  if (!indexSource.includes('./assets/js/auth-recovery.js')) {
    errors.push('Canonical auth-recovery.js belum dimuat langsung setelah app.js.');
  }
}

if (errors.length > 0) {
  console.error('Pemeriksaan struktur source gagal:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Struktur source, migration, workflow, dan dynamic loader valid.');
