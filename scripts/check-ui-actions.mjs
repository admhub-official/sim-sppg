import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const javascriptFiles = [
  path.join(root, 'app.js'),
  path.join(root, 'supplier-dropdown.js'),
  ...walk(path.join(root, 'assets', 'js')).filter((file) => file.endsWith('.js')),
];
const source = javascriptFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const errors = [];

const knownGlobals = new Set([
  'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'open', 'close', 'print', 'parseInt', 'parseFloat', 'Number', 'String', 'Boolean',
]);

const handlers = new Set();
for (const match of html.matchAll(/\bon(?:click|change|input|submit|keydown|focus|blur)\s*=\s*(["'])(.*?)\1/gis)) {
  const expression = match[2];
  for (const call of expression.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = call[1];
    if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(name) && !knownGlobals.has(name)) {
      handlers.add(name);
    }
  }
}

function isDefined(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`function\\s+${escaped}\\s*\\(`),
    new RegExp(`(?:window\\.)?${escaped}\\s*=\\s*(?:async\\s*)?function\\b`),
    new RegExp(`(?:window\\.)?${escaped}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>`),
    new RegExp(`(?:var|let|const)\\s+${escaped}\\s*=`),
  ].some((pattern) => pattern.test(source));
}

for (const handler of [...handlers].sort()) {
  if (!isDefined(handler)) errors.push(`Handler UI tidak ditemukan: ${handler}()`);
}

const ids = new Set([...html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gis)].map((match) => match[2]));
for (const match of source.matchAll(/(?:openModal|closeModal)\s*\(\s*['"]([^'"]+)['"]/g)) {
  if (!ids.has(match[1])) errors.push(`Target modal tidak ditemukan di index.html: ${match[1]}`);
}

const requiredEditControls = [
  'modalEditTransaksi', 'editTxId', 'editTxTanggal', 'editTxKategori', 'editTxSPPG',
  'editTxItem', 'editTxNominal', 'editTxSupplier', 'editTxSupplierId',
];
for (const id of requiredEditControls) {
  if (!ids.has(id)) errors.push(`Kontrol Edit Transaksi tidak ditemukan: ${id}`);
}

if (!source.includes("request('transaction-edit-action', fnName")) {
  errors.push('Router editTransaction belum diarahkan ke transaction-edit-action.');
}
if (!source.includes('window.saveEditTransaksi = async function')) {
  errors.push('Handler save Edit Transaksi yang andal belum dimuat.');
}

if (errors.length) {
  console.error('Audit aksi UI gagal:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Audit aksi UI lulus: ${handlers.size} handler inline dan target modal tervalidasi.`);
