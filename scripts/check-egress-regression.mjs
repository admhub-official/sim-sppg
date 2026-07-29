import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
};

const app = read('app.js');
const transactions = read('supabase/functions/transaction-action/index.ts');
const approvals = read('supabase/functions/approval-payment-action/read.ts');
const operations = read('supabase/functions/operations-action/index.ts');
const masterBb = read('supabase/functions/master-action/master-bb.ts');
const reporting = read('supabase/functions/reporting-action/core.ts');

assert(app.includes('API_READ_CACHE_TTL'), 'client read cache must remain enabled');
assert(app.includes('clearApiReadCache()'), 'mutations must invalidate client read cache');
assert(app.includes('API_MUTATION_FUNCTIONS[fnName]'), 'only explicit mutations may invalidate cached reads');
assert(transactions.includes('.range(page.from, page.to)'), 'transaction pagination must run in PostgREST');
assert(approvals.includes('APPROVAL_CANDIDATE_COLUMNS'), 'Approval filtering must use a narrow candidate projection');
assert(approvals.includes('candidates.rows.slice(page.from, page.to + 1)'), 'Approval detail loading must be limited to page IDs');
assert(approvals.includes('const selectedIds = selected.map'), 'Approval documents and proofs must be scoped to selected page IDs');
assert(operations.includes('q=q.range(page.from,page.to)'), 'operational lists must use database ranges');
assert(masterBb.includes('q=q.range(from,to)'), 'master material pagination must use a database range');
assert(reporting.includes("select('Tanggal,Kategori,SPPG,YAYASAN,Nominal,User"), 'reporting must keep its narrow transaction projection');
assert(!transactions.includes("from(T.DA)\n    .select('*')"), 'transaction documents must not use SELECT *');
assert(!approvals.includes("from(TABLE.docsAvailable)\n    .select('*')"), 'approval documents must not use SELECT *');

if (!process.exitCode) console.log('Supabase egress regression checks passed.');
