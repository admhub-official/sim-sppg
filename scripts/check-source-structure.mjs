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
    AUTH_BASE: 'assets/js',
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
  if (!loaderSource.includes("file: 'auth-recovery.js'")) {
    errors.push('Canonical auth-recovery.js belum dimuat oleh supplier-dropdown.js.');
  }
}

if (errors.length > 0) {
  console.error('Pemeriksaan struktur source gagal:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Struktur source, migration, workflow, dan dynamic loader valid.');
