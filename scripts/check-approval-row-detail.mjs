import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const adapter = fs.readFileSync('approval-transaction-loader.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const worker = fs.readFileSync('_worker.js', 'utf8');

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function occurrenceCount(source, needle) {
  return source.split(needle).length - 1;
}

const renderStart = app.indexOf('function renderApprovalTable()');
const renderEnd = app.indexOf('// ===== CEKLIS / BULK ACTION APPROVAL =====', renderStart);
const renderBlock = app.slice(renderStart, renderEnd);
const pageStart = index.indexOf('<!-- ==================== APPROVAL PAGE ==================== -->');
const pageEnd = index.indexOf('<!-- ==================== MASTER BAHAN BAKU PAGE ==================== -->', pageStart);
const pageBlock = index.slice(pageStart, pageEnd);

requireMatch(renderStart >= 0 && renderEnd > renderStart, 'Approval render block must exist');
requireMatch(renderBlock.includes('renderApprovalDesktopRows(pageData, start, isAdmin)'), 'desktop Approval renderer must be used');
requireMatch(renderBlock.includes('renderApprovalMobileCards(pageData, start, isAdmin)'), 'mobile Approval card renderer must be used');
requireMatch(renderBlock.includes('class="approval-mobile-card '), 'mobile cards must be clickable cards');
requireMatch(renderBlock.includes('onclick="event.stopPropagation()"'), 'selection checkbox must not open detail');
requireMatch(renderBlock.includes('syncApprovalSelectionControls'), 'desktop and mobile selections must stay synchronized');
requireMatch(!renderBlock.includes('action-btn view'), 'legacy row detail icon must be removed');
requireMatch(!renderBlock.includes('action-btn approve'), 'legacy row approval icon must be removed');
requireMatch(!renderBlock.includes('<div class="action-group"'), 'legacy row action group must be removed');
requireMatch(pageBlock.includes('id="approvalDesktopView"'), 'desktop Approval view must exist');
requireMatch(pageBlock.includes('id="approvalMobileView"'), 'mobile Approval view must exist');
requireMatch(pageBlock.includes('id="approvalMobileList"'), 'mobile Approval list must exist');
requireMatch(pageBlock.includes('id="apprSelectAllMobile"'), 'mobile select-all control must exist');
requireMatch(!pageBlock.includes('>Aksi</th>'), 'Approval table must not restore an action column');
requireMatch(!pageBlock.includes('table-container approval-table'), 'legacy Approval table wrapper must be removed');
requireMatch(index.includes('id="approval-responsive-ui-v2"'), 'responsive Approval styles must exist');
requireMatch(index.includes('id="approval-loading-lifecycle-v3"'), 'Approval loading lifecycle styles must exist');
requireMatch(index.includes('.approval-mobile-view { display: none; }'), 'mobile cards must be hidden on desktop by default');
requireMatch(index.includes('.approval-desktop-view { display: none !important; }'), 'desktop table must be hidden at the mobile breakpoint');
requireMatch(index.includes('.approval-mobile-view { display: block; }'), 'mobile cards must be shown at the mobile breakpoint');
requireMatch(index.includes('body.dark-mode .approval-mobile-card'), 'new mobile Approval cards must support dark mode');
requireMatch(index.includes('@media (max-width: 768px)'), 'mobile breakpoint must exist');
requireMatch(index.includes('#modalDetail.approval-detail-mode .modal-box'), 'mobile/desktop detail mode must be scoped');
requireMatch(app.includes("modal.classList.add('approval-detail-mode')"), 'Approval detail must enable scoped modal mode');
requireMatch(app.includes("modal.classList.remove('approval-detail-mode')"), 'generic detail reset must clean Approval modal mode');

requireMatch(app.includes('var approvalLoadState = {'), 'Approval loader state must remain available');
requireMatch(occurrenceCount(app, 'function renderApprovalLoadingState()') === 1, 'Approval loading-state helper must be declared exactly once');
requireMatch(occurrenceCount(app, 'function loadApprovalData()') === 1, 'base Approval data loader must be declared exactly once');

requireMatch(adapter.includes('window.loadApprovalData = function'), 'transaction adapter must own the runtime Approval loader');
requireMatch(adapter.includes('if (state.inFlight) return;'), 'duplicate Approval loads must be ignored');
requireMatch(!adapter.includes('runQueued'), 'Approval adapter must not queue another request');
requireMatch(!adapter.includes('state.queued = true'), 'Approval adapter must not create a reload loop');
requireMatch(adapter.includes("var filters = { kategori: 'PENGELUARAN' };"), 'Approval must request the same expense dataset used by Transactions');
requireMatch(adapter.includes('if (Array.isArray(result)) rows = result;'), 'Approval must accept direct-array transaction responses');
requireMatch(adapter.includes('result && Array.isArray(result.data)'), 'Approval must accept paged transaction responses');
requireMatch(adapter.includes('window.allTransactions = rows.map(normalize).filter'), 'Approval must derive its queue from transaction rows locally');
requireMatch(!adapter.includes('approvalOnly'), 'Approval adapter must not depend on approvalOnly');
requireMatch(!adapter.includes('showLoading(true)'), 'Approval adapter must not flash the global overlay');

requireMatch(sw.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-single-request-v14';"), 'service worker must invalidate repeated-request bundles');
requireMatch(sw.includes("'./approval-transaction-loader.js'"), 'service worker app shell must include the Approval adapter');
requireMatch(worker.includes('`<script src="./approval-transaction-loader.js'), 'Cloudflare must inject the Approval transaction adapter');
requireMatch(worker.includes('20260722-approval-single-request-v15'), 'Cloudflare runtime cache key must be current');

if (!process.exitCode) console.log('Approval single-request data adapter check passed.');