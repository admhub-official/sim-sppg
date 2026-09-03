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
const workerVersion = worker.match(/const version = '([^']+)'/);
const serviceWorkerVersion = sw.match(/const CACHE_VERSION = '([^']+)'/);
const indexAppVersion = index.match(/<script src="\.\/app\.js\?v=([^"]+)"><\/script>/);
const assetVersionPattern = /^\d{8}-[a-z0-9-]+-v\d+$/;
const serviceWorkerVersionPattern = /^sim-sppg-v\d{8}-[a-z0-9-]+-v\d+$/;

requireMatch(renderStart >= 0 && renderEnd > renderStart, 'Approval render block must exist');
requireMatch(renderBlock.includes('renderApprovalDesktopRows(pageData, start, canSelect)'), 'desktop Approval renderer must receive selection permission');
requireMatch(renderBlock.includes('renderApprovalMobileCards(pageData, start, canSelect)'), 'mobile Approval renderer must receive selection permission');
requireMatch(pageBlock.includes('id="approvalDesktopView"'), 'desktop Approval view must exist');
requireMatch(pageBlock.includes('id="approvalMobileView"'), 'mobile Approval view must exist');
requireMatch(!pageBlock.includes('>Aksi</th>'), 'Approval table must not restore action column');
requireMatch(app.includes("approvalOnly: true"), 'Approval loader must use the paged Approval query contract');
requireMatch(app.includes('var filters = approvalRequestFilters(page, false);'), 'Approval loader must send page and active filters');
requireMatch(app.includes('approvalServerTotal'), 'Approval pagination must use the server total');
requireMatch(!app.includes('function runQueuedApprovalReload()'), 'queued Approval reload helper must be removed');
requireMatch(app.includes('approvalLoadState.queuedPage = page;'), 'Approval reloads during an active request must queue the latest page');
requireMatch(app.includes('var normalizedResponse = normalizeApprovalApiResponse(result);'), 'canonical loader must normalize backend response');
requireMatch(app.includes("console.error('Approval render failure:'"), 'canonical loader must expose render errors');
requireMatch((app.match(/function loadApprovalData\(page\)/g) || []).length === 1, 'paged Approval loader must exist exactly once in source');
requireMatch(!worker.includes('approvalRuntime'), 'Cloudflare worker must not inject a second Approval loader');
requireMatch(workerVersion && assetVersionPattern.test(workerVersion[1]), 'Cloudflare runtime cache version must follow the release format');
requireMatch(serviceWorkerVersion && serviceWorkerVersionPattern.test(serviceWorkerVersion[1]), 'service worker cache version must follow the release format');
requireMatch(indexAppVersion && assetVersionPattern.test(indexAppVersion[1]), 'base index must load a versioned canonical app script');
requireMatch(workerVersion && serviceWorkerVersion && serviceWorkerVersion[1] === `sim-sppg-v${workerVersion[1]}`, 'Cloudflare worker and service worker cache versions must match');
requireMatch(sw.includes("fetch(request, { cache: 'no-store' })"), 'navigation and JavaScript must bypass browser cache');

if (!process.exitCode) console.log('Approval direct runtime render check passed.');
