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

const maintainedJavaScript = [
  'supplier-dropdown.js',
  'assets/js/supplier/app-dropdowns.js',
  'assets/js/supplier/edit-transaction-ui.js',
  'assets/js/supplier/stage-d-api-router.js',
  'assets/js/supplier/storage-egress-optimizer.js',
  'assets/js/supplier/supplier-actions-fix.js',
  'professional-report-v1.js',
  'transaction-category-supplier-rules.js',
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
