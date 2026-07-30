import fs from 'node:fs';

const path = 'supabase/migrations/20260724030219_normalize_transaction_document_paths_and_remove_legacy_links.sql';
let sql = fs.readFileSync(path, 'utf8');
const start = '-- Move path-like values from legacy link columns into canonical columns.';
const end = '-- Rebuild normalized document metadata from canonical path columns.';
const from = sql.indexOf(start);
const to = sql.indexOf(end);
if (from < 0 || to < 0 || to <= from) {
  throw new Error('Legacy migration block markers were not found.');
}
const replacement = `-- Legacy link-column backfill intentionally skipped on fresh preview databases.\n-- Production already executed this historical migration before the legacy columns\n-- were removed. Current previews are built from the normalized canonical schema.\n\n`;
sql = sql.slice(0, from) + replacement + sql.slice(to);
fs.writeFileSync(path, sql);
console.log('Supabase preview legacy migration compatibility patch applied.');
