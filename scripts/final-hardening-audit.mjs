import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const edgeFiles=[
  'supabase/functions/transaction-action/index.ts',
  'supabase/functions/operations-action/index.ts',
  'supabase/functions/reporting-action/index.ts',
  'supabase/functions/master-action/index.ts',
  'supabase/functions/file-access-action/index.ts',
  'supabase/functions/push-action/index.ts',
  'supabase/functions/geocode-action/index.ts'
].filter(fs.existsSync);
const source=edgeFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};

assert(app.includes("'geocode-action': { geocodeAlamat:1 }"), 'geocode route is missing from API_ROUTES');
assert(app.includes('API_ROUTE_BY_FUNCTION[fn] = slug'), 'central API route map is missing');
assert(app.includes('var requestUrl = API_BASE_URL + slug;'), 'callApi does not use the central route map');
assert(app.includes('Fungsi API tidak terdaftar'), 'unknown routes are not denied');
assert(!/PUSH_FN\[fnName\]\s*\?\s*PUSH_FN_URL\s*:\s*SUPABASE_FN_URL/.test(app), 'dynamic-action fallback still present');
assert(!/requestUrl[^;]*SUPABASE_FN_URL/.test(app), 'request resolver still references dynamic fallback');
assert(!/ROLE_MAP[\s\S]{0,500}PIC\s*:\s*['"]PIC/.test(source), 'operational position is still mapped into ROLE');

// Detect known unsafe cross-product authorization patterns.
const unsafe=[...source.matchAll(/\.in\(['"]SPPG['"][^\n]*\)\.in\(['"](?:YAYASAN|NAMA YAYASAN|\\"NAMA YAYASAN\\")['"]/g)];
assert(unsafe.length===0, `found ${unsafe.length} unsafe SPPG IN + Yayasan IN exact-pair pattern(s)`);

// Export/pagination/file cleanup guardrails.
assert(/preparePrintDataset|_printDatasetOverride/.test(app), 'full print/export helper missing');
assert(/pageSize/.test(app) && /hasMore/.test(app), 'server pagination markers missing');
assert(/deleteFromStorage|storage\.from\([^\)]*\)\.remove/.test(source), 'storage cleanup implementation missing');

console.log('Final hardening audit passed.');
