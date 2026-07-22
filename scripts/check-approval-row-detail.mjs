import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const worker = fs.readFileSync('_worker.js', 'utf8');

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const renderStart = app.indexOf('function renderApprovalTable()');
const renderEnd = app.indexOf('// ===== CEKLIS / BULK ACTION APPROVAL =====', renderStart);
const renderBlock = app.slice(renderStart, renderEnd);
const pageStart = index.indexOf('<!-- ==================== APPROVAL PAGE ==================== -->');
const pageEnd = index.indexOf('<!-- ==================== MASTER BAHAN BAKU PAGE ==================== -->', pageStart);
const pageBlock = index.slice(pageStart, pageEnd);

requireMatch(renderStart >= 0 && renderEnd > renderStart, 'Approval render block must exist');
requireMatch(renderBlock.includes('renderApprovalDesktopRows(pageData, start, isAdmin)'), 'desktop Approval renderer must be used');
requireMatch(renderBlock.includes('renderApprovalMobileCards(pageData, start, isAdmin)'), 'mobile Approval renderer must be used');
requireMatch(pageBlock.includes('id="approvalDesktopView"'), 'desktop Approval view must exist');
requireMatch(pageBlock.includes('id="approvalMobileView"'), 'mobile Approval view must exist');
requireMatch(!pageBlock.includes('>Aksi</th>'), 'Approval table must not restore action column');
requireMatch(worker.includes('Cloudflare canonical Approval loader v16'), 'served app bundle must include direct Approval loader');
requireMatch(worker.includes('loadApprovalData = function ()'), 'direct runtime must override Approval loader');
requireMatch(worker.includes("var filters = { kategori: 'PENGELUARAN' };"), 'Approval must reuse Transactions query contract');
requireMatch(worker.includes('if (Array.isArray(result)) rows = result;'), 'direct array response must be accepted');
requireMatch(worker.includes('result && Array.isArray(result.data)'), 'wrapped response must be accepted');
requireMatch(worker.includes('filteredApprovalData = allTransactions.slice();'), 'received data must be assigned before render');
requireMatch(worker.includes("throw new Error('Renderer Approval tidak mengganti tampilan loading.')"), 'stuck loading must become visible error');
requireMatch(worker.includes('try {') && worker.includes('catch (renderError)'), 'render callback must be guarded');
requireMatch(!worker.includes('`<script src="./approval-transaction-loader.js'), 'retired adapter must not be injected');
requireMatch(worker.includes('20260722-approval-direct-render-v16'), 'Cloudflare runtime cache key must be current');
requireMatch(sw.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-direct-render-v15';"), 'service worker must invalidate prior Approval runtime');
requireMatch(!sw.includes('approval-transaction-loader.js'), 'service worker must not cache retired adapter');

if (!process.exitCode) console.log('Approval direct runtime render check passed.');
