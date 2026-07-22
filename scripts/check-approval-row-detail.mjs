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
requireMatch(app.includes("var filters = { kategori: 'PENGELUARAN' };"), 'canonical Approval loader must use Transactions query contract');
requireMatch(!app.includes("var filters = { kategori: 'PENGELUARAN', approvalOnly: true };"), 'legacy approvalOnly loader must be removed');
requireMatch(!app.includes('function runQueuedApprovalReload()'), 'queued Approval reload helper must be removed');
requireMatch(app.includes('if (!currentUser || approvalLoadState.inFlight) return;'), 'duplicate Approval loads must be ignored');
requireMatch(app.includes('var normalizedResponse = normalizeApprovalApiResponse(result);'), 'canonical loader must normalize backend response');
requireMatch(app.includes("console.error('Approval render failure:'"), 'canonical loader must expose render errors');
requireMatch((app.match(/function loadApprovalData\(\)/g) || []).length === 1, 'Approval loader must exist exactly once in source');
requireMatch(!worker.includes('approvalRuntime'), 'Cloudflare worker must not inject a second Approval loader');
requireMatch(worker.includes('20260722-approval-canonical-source-v17'), 'Cloudflare runtime cache key must be current');
requireMatch(sw.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-canonical-source-v16';"), 'service worker must invalidate previous Approval bundles');

if (!process.exitCode) console.log('Approval direct runtime render check passed.');
