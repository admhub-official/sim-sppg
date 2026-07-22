import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const renderStart = app.indexOf('function renderApprovalTable()');
const renderEnd = app.indexOf('function goApprovalPage(p)', renderStart);
const renderBlock = app.slice(renderStart, renderEnd);
const approvalPageStart = index.indexOf('<!-- ==================== APPROVAL PAGE ==================== -->');
const approvalPageEnd = index.indexOf('<!-- ==================== MASTER BAHAN BAKU PAGE ==================== -->', approvalPageStart);
const approvalPage = index.slice(approvalPageStart, approvalPageEnd);

requireMatch(renderStart >= 0 && renderEnd > renderStart, 'renderApprovalTable must exist');
requireMatch(renderBlock.includes('class="approval-row-clickable '), 'approval rows must be clickable');
requireMatch(renderBlock.includes('onclick="handleApprovalRowClick(event,this.dataset.id)"'), 'approval row click must open detail by transaction id');
requireMatch(renderBlock.includes('onkeydown="handleApprovalRowKeydown(event,this.dataset.id)"'), 'approval rows must support Enter and Space');
requireMatch(renderBlock.includes('onclick="event.stopPropagation()"'), 'bulk checkbox must not open the detail modal');
requireMatch(renderBlock.includes('onkeydown="event.stopPropagation()"'), 'bulk checkbox keyboard events must not open detail');
requireMatch(!renderBlock.includes('action-group'), 'approval rows must not contain an action group');
requireMatch(!renderBlock.includes('action-btn'), 'approval rows must not contain action buttons');
requireMatch(!approvalPage.includes('>Aksi</th>'), 'Approval table must not include an action column');

requireMatch(app.includes('var currentApprovalDetailId = null;'), 'approval detail state must exist');
requireMatch(app.includes('function openApprovalDetail(id)'), 'approval detail controller must exist');
requireMatch(app.includes("callApi('getTransactionDetail', [id]"), 'approval detail must load canonical transaction detail');
requireMatch(app.includes('function configureApprovalDetailActions(tx)'), 'contextual approval actions must exist');
requireMatch(app.includes("status === 'MENUNGGU_VERIFIKASI'"), 'pending user proof must route to verifier action');
requireMatch(app.includes("runApprovalDetailAction('verify')") || app.includes("runApprovalDetailAction(\\'verify\\')"), 'verifier action button must exist');
requireMatch(app.includes("runApprovalDetailAction('approve')") || app.includes("runApprovalDetailAction(\\'approve\\')"), 'approve action button must exist');
requireMatch(app.includes("runApprovalDetailAction('upload')") || app.includes("runApprovalDetailAction(\\'upload\\')"), 'user proof action button must exist');
requireMatch(app.includes("openVerifikasiModal(id)"), 'verifier action must open verification modal');
requireMatch(app.includes("openApprovalModal(id)"), 'approve action must open approval modal');
requireMatch(app.includes("openUserBuktiModal(id)"), 'user action must open proof upload modal');
requireMatch(app.includes("actions.classList.add('hidden')"), 'generic detail modal must clear contextual actions');

requireMatch(index.includes('id="detailHeaderActions"'), 'detail modal must expose a header action container');
requireMatch(index.includes('id="approval-row-detail-styles"'), 'Approval row/detail responsive styles must exist');
requireMatch(index.includes('approval-detail-hero'), 'Approval detail must include the summary hero layout');
requireMatch(/<script src="\.\/app\.js\?v=20260722-approval-detail-v3"><\/script>/.test(index), 'frontend bundle cache key must match Approval detail release');
requireMatch(serviceWorker.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-detail-v7';"), 'service worker cache must match Approval detail release');

if (!process.exitCode) console.log('Approval row detail check passed.');
