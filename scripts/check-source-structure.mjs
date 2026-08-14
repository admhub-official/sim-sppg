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

if (errors.length > 0) {
  console.error('Pemeriksaan struktur source gagal:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Struktur source, migration, dan workflow valid.');
