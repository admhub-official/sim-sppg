import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const read = fs.readFileSync('supabase/functions/approval-payment-action/read.ts', 'utf8');

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
requireMatch(!index.includes('id="approval-row-detail-styles"'), 'old Approval-only style patch must be removed');
requireMatch(!index.includes('/* --- Approval Table --- */'), 'retired Approval mobile mapper comment must be removed');
requireMatch(!index.includes('.approval-table tbody'), 'retired Approval table selectors must be removed');
requireMatch(index.includes('.approval-mobile-view { display: none; }'), 'mobile cards must be hidden on desktop by default');
requireMatch(index.includes('.approval-desktop-view { display: none !important; }'), 'desktop table must be hidden at the mobile breakpoint');
requireMatch(index.includes('.approval-mobile-view { display: block; }'), 'mobile cards must be shown at the mobile breakpoint');
requireMatch(index.includes('body.dark-mode .approval-mobile-card'), 'new mobile Approval cards must support dark mode');
requireMatch(index.includes('@media (max-width: 768px)'), 'mobile breakpoint must exist');
requireMatch(index.includes('#modalDetail.approval-detail-mode .modal-box'), 'mobile/desktop detail mode must be scoped');
requireMatch(app.includes("modal.classList.add('approval-detail-mode')"), 'Approval detail must enable scoped modal mode');
requireMatch(app.includes("modal.classList.remove('approval-detail-mode')"), 'generic detail reset must clean Approval modal mode');
requireMatch(/<script src="\.\/app\.js\?v=20260722-approval-data-v6"><\/script>/.test(index), 'Approval data bundle cache key must be active');
requireMatch(sw.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-data-v10';"), 'service worker must invalidate the prior Approval UI');

requireMatch(app.includes('function normalizeApprovalApiResponse(result)'), 'Approval loader must normalize array and wrapped responses');
requireMatch(app.includes("var filters = { kategori: 'PENGELUARAN', approvalOnly: true };"), 'Approval loader must request only pending expense transactions');
requireMatch(app.includes('.map(normalizeApprovalTransaction)'), 'Approval rows must be normalized before filtering');
requireMatch(app.includes('renderApprovalLoadError(message)'), 'Approval API failures must render a visible retry state');
requireMatch(!app.includes("if (!data || !Array.isArray(data))"), 'Approval loader must not reject wrapped API responses');
requireMatch(read.includes("const approvalOnly = filters.approvalOnly === true;"), 'Approval backend must support approvalOnly');
requireMatch(read.includes(".neq('Metode Transaksi', 'SUDAH_DIBAYAR')"), 'Approval backend must exclude paid transactions before document enrichment');

if (!process.exitCode) console.log('Approval responsive desktop/mobile UI and data loading check passed.');
