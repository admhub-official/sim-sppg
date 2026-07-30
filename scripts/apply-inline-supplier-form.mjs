import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(search, replacement);
}

const workerPath = '_worker.js';
let worker = fs.readFileSync(workerPath, 'utf8');
worker = worker.replace(/const version = '[^']+';/, "const version = '20260730-inline-supplier-form-v1';");
if (!worker.includes('supplier-inline-create.js')) {
  const categoryScript = '        `<script src="./transaction-category-supplier-rules.js?v=${version}"></script>`,';
  const fallbackScript = '        `<script src="./yayasan-dropdown-hotfix.js?v=${version}"></script>`,';
  if (worker.includes(categoryScript)) {
    worker = replaceOnce(worker, categoryScript, `${categoryScript}\n        \`<script src="./supplier-inline-create.js?v=\${version}"></script>\`,`, 'inject supplier inline script');
  } else {
    worker = replaceOnce(worker, fallbackScript, `${fallbackScript}\n        \`<script src="./supplier-inline-create.js?v=\${version}"></script>\`,`, 'inject supplier inline script fallback');
  }
}
fs.writeFileSync(workerPath, worker);

const supplierPath = 'supabase/functions/master-action/supplier.ts';
let supplier = fs.readFileSync(supplierPath, 'utf8');
const oldStart = `export async function addSupplier(d:any,c:Caller){
  requireAdmin(c);
  if(!c.sppg||!c.yayasan)throw new Error('SPPG dan Yayasan caller wajib tersedia.');`;
const newStart = `export async function addSupplier(d:any,c:Caller){
  if(!['USER','ADMIN','SUPER_ADMIN'].includes(c.role))throw new Error('Akses tambah supplier ditolak.');
  if(!c.sppg||!c.yayasan)throw new Error('SPPG dan Yayasan caller wajib tersedia.');
  const required={
    'Nama Supplier':s(d.NAMA_SUPPLIER),
    'No. WhatsApp':s(d.NO_WHATSAPP),
    'Alamat Toko':s(d.ALAMAT_TOKO),
    'Nama Bank':s(d.NAMA_BANK),
    'No. Rekening':s(d.NO_REKENING),
    'Atas Nama Rekening':s(d.ATAS_NAMA_REKENING),
    'Item yang Dijual':itemList(d.ITEM_YANG_DIJUAL).join(', '),
  };
  const missing=Object.entries(required).filter(([,value])=>!value).map(([key])=>key);
  if(missing.length)throw new Error(\`Data supplier belum lengkap: \${missing.join(', ')}.\`);
  if(!/^(?:\\+62|62|0)8\\d{7,12}$/.test(required['No. WhatsApp'].replace(/[\\s-]/g,'')))throw new Error('Nomor WhatsApp supplier tidak valid.');`;
if (supplier.includes(oldStart)) supplier = replaceOnce(supplier, oldStart, newStart, 'allow scoped user supplier creation');
if (!supplier.includes("if(!['USER','ADMIN','SUPER_ADMIN'].includes(c.role))")) throw new Error('supplier access patch verification failed');
fs.writeFileSync(supplierPath, supplier);

console.log('Inline supplier form and scoped supplier creation applied.');
