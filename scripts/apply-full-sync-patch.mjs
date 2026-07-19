import fs from 'node:fs';

const path = 'app.js';
let source = fs.readFileSync(path, 'utf8');

const oldHeaderBlock = `  var headers = { 'Content-Type': 'application/json' };
  if (!PUBLIC_FN[fnName]) {
    var token = getJwtToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }
  if (slug === 'secure-user-action' && window._supabaseKey) headers.apikey = window._supabaseKey;`;

const newHeaderBlock = `  var headers = { 'Content-Type': 'application/json' };
  var token = getJwtToken();
  var authToken = token || window._supabaseKey || '';
  if (authToken) headers.Authorization = 'Bearer ' + authToken;
  if (window._supabaseKey) headers.apikey = window._supabaseKey;`;

if (source.includes(oldHeaderBlock)) {
  source = source.replace(oldHeaderBlock, newHeaderBlock);
} else if (!source.includes(newHeaderBlock)) {
  throw new Error('Blok header callApi tidak cocok dengan baseline yang diaudit.');
}

const functionMarker = 'function renderSupplierTable() {\n';
const boundaryMarker = '  if (!filteredSuppliers.length)';
const functionStart = source.indexOf(functionMarker);
if (functionStart < 0) throw new Error('renderSupplierTable tidak ditemukan.');
const boundary = source.indexOf(boundaryMarker, functionStart);
if (boundary < 0) throw new Error('Batas awal renderSupplierTable tidak ditemukan.');

const prelude = source.slice(functionStart + functionMarker.length, boundary);
const block = `  var btnAddSupplier = $('btnAddSupplier');
  if (btnAddSupplier) btnAddSupplier.style.display = (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '' : 'none';
`;
const occurrenceCount = (prelude.match(/var btnAddSupplier = \$\('btnAddSupplier'\);/g) || []).length;
const residue = prelude.split(block).join('').trim();
if (residue) throw new Error('Prelude renderSupplierTable berisi kode lain; patch dihentikan agar tidak menimpa perubahan orang lain.');
if (occurrenceCount < 1) throw new Error('Blok visibilitas tombol supplier tidak ditemukan.');
source = source.slice(0, functionStart + functionMarker.length) + block + source.slice(boundary);

const finalHeaderCount = (source.match(/var authToken = token \|\| window\._supabaseKey \|\| '';/g) || []).length;
const finalSupplierCount = (source.slice(functionStart, source.indexOf(boundaryMarker, functionStart)).match(/var btnAddSupplier = \$\('btnAddSupplier'\);/g) || []).length;
if (finalHeaderCount !== 1) throw new Error(`Header auth hasil patch tidak tunggal: ${finalHeaderCount}.`);
if (finalSupplierCount !== 1) throw new Error(`Blok tombol supplier hasil patch tidak tunggal: ${finalSupplierCount}.`);

fs.writeFileSync(path, source, 'utf8');
console.log(`Patched ${path}: auth header normalized; supplier blocks ${occurrenceCount} -> 1.`);
