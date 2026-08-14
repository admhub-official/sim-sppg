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
const approvalQuery = read('supabase/functions/approval-query-action/index.ts');
const transactionSummary = read('supabase/functions/transaction-summary-action/index.ts');
const operations = read('supabase/functions/operations-action/index.ts');
const masterBb = read('supabase/functions/master-action/master-bb.ts');
const reporting = read('supabase/functions/reporting-action/core.ts');

assert(app.includes('API_READ_CACHE_TTL'), 'client read cache must remain enabled');
assert(app.includes('clearApiReadCache()'), 'mutations must invalidate client read cache');
assert(app.includes('API_MUTATION_FUNCTIONS[fnName]'), 'only explicit mutations may invalidate cached reads');
assert(
  transactions.includes('.range(page.from, page.to)') ||
    transactions.includes('.range((page - 1) * pageSize, page * pageSize - 1)'),
  'transaction pagination must run in PostgREST',
);
assert(approvals.includes('APPROVAL_CANDIDATE_COLUMNS'), 'legacy Approval filtering must keep a narrow candidate projection');
assert(approvalQuery.includes("get_approval_queue_stage_d_v2"), 'Approval pagination and KPI must use the full-scope SQL RPC');
assert(approvalQuery.includes('p_filters:f'), 'Approval filters must be applied before KPI aggregation');
assert(transactionSummary.includes("get_transaction_kpi_v2"), 'transaction KPI must use the full role-scope SQL RPC');
assert(app.includes("'transaction-summary-action': { getTransactionSummary:1 }"), 'central client router must target transaction-summary-action');
assert(app.includes('getTransactionSummary:15000'), 'transaction KPI responses must use a short-lived client cache');
assert(app.includes('apiReadInFlight'), 'identical cacheable reads must share one in-flight request');
assert(app.includes('apiReadInFlight[cacheKey].push'), 'coalesced reads must preserve all caller callbacks');
assert(app.includes('AbortController'), 'central API requests must retain a timeout path');
assert(operations.includes('q=q.range(page.from,page.to)'), 'operational lists must use database ranges');
assert(masterBb.includes('q=q.range(from,to)'), 'master material pagination must use a database range');
assert(reporting.includes("select('Tanggal,Kategori,SPPG,YAYASAN,Nominal,User"), 'reporting must keep its narrow transaction projection');
assert(!transactions.includes("from(T.DA)\n    .select('*')"), 'transaction documents must not use SELECT *');
assert(!approvals.includes("from(TABLE.docsAvailable)\n    .select('*')"), 'approval documents must not use SELECT *');

if (!process.exitCode) console.log('Supabase egress regression checks passed.');
