import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(search, replacement);
}

const workerPath = '_worker.js';
let worker = fs.readFileSync(workerPath, 'utf8');
worker = worker.replace(/const version = '[^']+';/, "const version = '20260730-transaction-category-supplier-rules-v1';");
if (!worker.includes('transaction-category-supplier-rules.js')) {
  worker = replaceOnce(
    worker,
    '        `<script src="./yayasan-dropdown-hotfix.js?v=${version}"></script>`,',
    '        `<script src="./yayasan-dropdown-hotfix.js?v=${version}"></script>`,\n        `<script src="./transaction-category-supplier-rules.js?v=${version}"></script>`,',
    'inject frontend rules script'
  );
}
fs.writeFileSync(workerPath, worker);

const edgePath = 'supabase/functions/transaction-action/index.ts';
let edge = fs.readFileSync(edgePath, 'utf8');

const constants = `
const TRANSACTION_CATEGORY_TYPES = {
  PEMASUKAN: [
    'Anggaran Bahan Baku',
    'Anggaran Sewa Mobil',
    'Anggaran Insentif Fasilitas',
  ],
  SUPPLIER_REQUIRED: [
    'Belanja Bahan Baku',
    'Material Bangunan',
    'Gas LPG',
    'Sewa & Utilitas (AC/WIFI)',
    'IPAL',
    'Inventaris Kantor',
    'Cetak & Promosi',
  ],
  SUPPLIER_OPTIONAL: [
    'Gaji/Upah Karyawan',
    'Operasional Perjalanan',
    'Konsumsi',
    'Dana Talangan',
    'Cicilan',
    'Fee Yayasan',
    'Administrasi & Lainnya',
  ],
} as const;
const normalizeCategoryValue = (value: unknown) => text(value).replace(/\\s+/g, ' ').toLocaleLowerCase('id-ID');
const categoryIncludes = (values: readonly string[], value: unknown) => values.some((item) => normalizeCategoryValue(item) === normalizeCategoryValue(value));
const supplierRequiredFor = (category: unknown, type: unknown) => text(category).toUpperCase() === 'PENGELUARAN' && categoryIncludes(TRANSACTION_CATEGORY_TYPES.SUPPLIER_REQUIRED, type);
function validateTransactionCategory(category: unknown, type: unknown) {
  const normalizedCategory = text(category).toUpperCase();
  const normalizedType = text(type);
  const allowed = normalizedCategory === 'PEMASUKAN'
    ? TRANSACTION_CATEGORY_TYPES.PEMASUKAN
    : normalizedCategory === 'PENGELUARAN'
      ? [...TRANSACTION_CATEGORY_TYPES.SUPPLIER_REQUIRED, ...TRANSACTION_CATEGORY_TYPES.SUPPLIER_OPTIONAL]
      : [];
  if (!allowed.length) throw new Error('Kategori transaksi hanya boleh PEMASUKAN atau PENGELUARAN.');
  if (!categoryIncludes(allowed, normalizedType)) throw new Error('Jenis kategori wajib dipilih dari daftar kategori resmi.');
  return allowed.find((item) => categoryIncludes([item], normalizedType)) || normalizedType;
}
`;

if (!edge.includes('const TRANSACTION_CATEGORY_TYPES =')) {
  edge = replaceOnce(
    edge,
    "const lower = (value: unknown) => text(value).toLowerCase();",
    "const lower = (value: unknown) => text(value).toLowerCase();\n" + constants,
    'insert category constants'
  );
}

const supplierResolver = `async function resolveSupplier(data: any, sppg: string, yayasan: string, category: unknown, type: unknown) {
  const required = supplierRequiredFor(category, type);
  if (!required) {
    return {
      'SUPPLIER ID': null, 'NAMA SUPPLIER': null, 'NAMA BANK SUPPLIER': null,
      'NO REKENING SUPPLIER': null, 'ATAS NAMA REKENING SUPPLIER': null,
      'SUMBER SUPPLIER': null,
    };
  }

  const supplierId = text(data.supplierId ?? data['SUPPLIER ID']);
  if (!supplierId) {
    throw new Error('Supplier wajib dipilih dari Data Supplier. Jika belum tersedia, buat data supplier baru terlebih dahulu.');
  }

  const query = await sb.from(T.MS)
    .select('ID,"NAMA SUPPLIER","NAMA BANK","NO REKENING","ATAS NAMA REKENING",STATUS,SPPG,YAYASAN')
    .eq('ID', supplierId)
    .maybeSingle();
  if (query.error) throw query.error;
  if (!query.data) throw new Error('Supplier yang dipilih tidak ditemukan di Data Supplier.');
  if (text(query.data.STATUS || 'Aktif') !== 'Aktif') throw new Error('Supplier yang dipilih tidak aktif.');
  if (!sameText(query.data.SPPG, sppg) || !sameText(query.data.YAYASAN, yayasan)) {
    throw new Error('Supplier tidak terdaftar untuk SPPG dan Yayasan transaksi ini.');
  }
  return {
    'SUPPLIER ID': text(query.data.ID),
    'NAMA SUPPLIER': text(query.data['NAMA SUPPLIER']),
    'NAMA BANK SUPPLIER': text(query.data['NAMA BANK']),
    'NO REKENING SUPPLIER': text(query.data['NO REKENING']),
    'ATAS NAMA REKENING SUPPLIER': text(query.data['ATAS NAMA REKENING']),
    'SUMBER SUPPLIER': 'MASTER',
  };
}
`;

edge = edge.replace(/async function resolveSupplier\([\s\S]*?\n}\n\r?\nasync function canAccess/, `${supplierResolver}\nasync function canAccess`);

edge = edge.replace(
  "  const method = normalizeStatus(data.metodeTransaksi);",
  "  data.jenisKategori = validateTransactionCategory(data.kategori, data.jenisKategori);\n  const method = normalizeStatus(data.metodeTransaksi);"
);
edge = edge.replace(
  "Object.assign(core, await resolveSupplier(data, sppg, yayasan, core.Kategori));",
  "Object.assign(core, await resolveSupplier(data, sppg, yayasan, core.Kategori, core['Jenis Kategori']));"
);
edge = edge.replace(
  "  const targetCategory = text(patch.Kategori ?? old.Kategori);",
  "  const targetCategory = text(patch.Kategori ?? old.Kategori);\n  const targetType = validateTransactionCategory(targetCategory, patch['Jenis Kategori'] ?? old['Jenis Kategori']);\n  patch['Jenis Kategori'] = targetType;"
);
edge = edge.replace(
  "    }, sppg, yayasan, targetCategory));",
  "    }, sppg, yayasan, targetCategory, targetType));"
);
edge = edge.replace(
  "  } else if (targetCategory.toUpperCase() === 'PENGELUARAN' && !text(old['NAMA SUPPLIER'])) {\n    throw new Error('Supplier atau penjual wajib diisi untuk transaksi pengeluaran.');\n  }",
  "  } else if (supplierRequiredFor(targetCategory, targetType) && !text(old['SUPPLIER ID'])) {\n    throw new Error('Supplier wajib dipilih dari Data Supplier. Jika belum tersedia, buat data supplier baru terlebih dahulu.');\n  } else if (!supplierRequiredFor(targetCategory, targetType)) {\n    Object.assign(patch, await resolveSupplier({}, sppg, yayasan, targetCategory, targetType));\n  }"
);
edge = edge.replace(
  "    jenisKategori: uniqueSuggestionValues(rows, 'Jenis Kategori', 100),",
  "    jenisKategori: [...TRANSACTION_CATEGORY_TYPES.PEMASUKAN, ...TRANSACTION_CATEGORY_TYPES.SUPPLIER_REQUIRED, ...TRANSACTION_CATEGORY_TYPES.SUPPLIER_OPTIONAL],"
);
edge = edge.replace('    version: 11,', '    version: 12,');

if (!edge.includes("resolveSupplier(data, sppg, yayasan, core.Kategori, core['Jenis Kategori'])")) {
  throw new Error('transaction-action supplier patch verification failed');
}
fs.writeFileSync(edgePath, edge);

console.log('Transaction category and supplier rules applied.');
