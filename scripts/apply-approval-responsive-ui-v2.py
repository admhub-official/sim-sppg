from pathlib import Path
import re

app_path = Path('app.js')
index_path = Path('index.html')
sw_path = Path('sw.js')
check_path = Path('scripts/check-approval-row-detail.mjs')
verifier_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
verifier = verifier_path.read_text(encoding='utf-8')

# Clean and modernize the Approval loading state for both desktop and mobile.
load_pattern = re.compile(
    r"function loadApprovalData\(\) \{\n  showLoading\(true\);.*?  selectedApprovalIds\.clear\(\);",
    re.S,
)
load_replacement = """function loadApprovalData() {
  showLoading(true);
  var tbody = $('approvalTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton-screen approval-desktop-skeleton" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>'.repeat(5) +
      '</div></td></tr>';
  }
  var mobileList = $('approvalMobileList');
  if (mobileList) {
    mobileList.innerHTML = '<div class="approval-mobile-skeleton">' +
      '<div class="approval-card-skeleton"><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-40"></div></div>'.repeat(4) +
      '</div>';
  }
  selectedApprovalIds.clear();"""
app, count = load_pattern.subn(load_replacement, app, count=1)
if count != 1:
    raise SystemExit('loadApprovalData prefix not found')

render_pattern = re.compile(
    r"function renderApprovalTable\(\) \{.*?\n\}\nfunction goApprovalPage\(p\) \{ approvalPage = p; renderApprovalTable\(\); \}",
    re.S,
)
render_replacement = r"""function renderApprovalTable() {
  var approvalData = filteredApprovalData;
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  var pagination = $('approvalPagination');
  var isAdmin = !!(currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN'));

  if (!approvalData.length) {
    var emptyHtml = '<div class="empty-state"><div class="empty-illustration"><i class="fas fa-check-circle"></i></div><h4>Semua Lunas!</h4><p>Tidak ada transaksi yang menunggu approval.</p></div>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="8">' + emptyHtml + '</td></tr>';
    if (mobileList) mobileList.innerHTML = emptyHtml;
    if (pagination) pagination.innerHTML = '';
    syncApprovalSelectionControls(approvalData, isAdmin);
    updateApprovalBulkBar();
    return;
  }

  var totalPages = Math.ceil(approvalData.length / ITEMS_PER_PAGE);
  if (approvalPage > totalPages) approvalPage = totalPages;
  var start = (approvalPage - 1) * ITEMS_PER_PAGE;
  var pageData = approvalData.slice(start, start + ITEMS_PER_PAGE);

  if (tbody) tbody.innerHTML = renderApprovalDesktopRows(pageData, start, isAdmin);
  if (mobileList) mobileList.innerHTML = renderApprovalMobileCards(pageData, start, isAdmin);
  renderPagination('approvalPagination', approvalPage, totalPages, 'goApprovalPage');
  syncApprovalSelectionControls(approvalData, isAdmin);
  updateApprovalBulkBar();
}

function getApprovalStatusRowClass(metode) {
  var status = String(metode || '').trim().toUpperCase();
  if (status === 'BELUM_BAYAR') return 'status-belum-bayar';
  if (status === 'MENUNGGU_VERIFIKASI') return 'status-menunggu-verifikasi';
  if (status === 'BELUM_LUNAS') return 'status-belum-lunas';
  if (status === 'TRANSFER') return 'status-transfer';
  if (status === 'CASH') return 'status-cash';
  return 'status-default';
}

function getApprovalDocumentBadge(tx) {
  var doc = _approvalDocStatus(tx);
  var badgeClass = doc.status === 'Lengkap' ? 'badge-green' : (doc.status === 'Tidak Ada Keduanya' ? 'badge-red' : 'badge-amber');
  return '<span class="badge ' + badgeClass + '"><i class="fas ' + (doc.status === 'Lengkap' ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i> ' + esc(doc.status) + '</span>';
}

function renderApprovalDesktopRows(pageData, start, isAdmin) {
  return pageData.map(function(tx, idx) {
    var checked = selectedApprovalIds.has(tx.id);
    var statusClass = getApprovalStatusRowClass(tx.metodeTransaksi);
    var rowLabel = 'Lihat detail approval ' + (tx.kode || tx.item || tx.id || '');
    return '<tr data-id="' + esc(tx.id) + '" class="approval-row-clickable ' + esc(statusClass) + '" tabindex="0" role="button" aria-label="' + esc(rowLabel) + '" onclick="handleApprovalRowClick(event,this.dataset.id)" onkeydown="handleApprovalRowKeydown(event,this.dataset.id)">' +
      '<td class="approval-select-col hidden" style="text-align:center;">' +
        (isAdmin ? '<input type="checkbox" class="appr-checkbox" data-id="' + esc(tx.id) + '" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onchange="toggleApprovalSelect(this)" ' + (checked ? 'checked' : '') + ' aria-label="Pilih transaksi ' + esc(tx.kode || tx.id) + '">' : '') +
      '</td>' +
      '<td class="approval-number-cell">' + (start + idx + 1) + '</td>' +
      '<td class="approval-transaction-cell"><strong>' + esc(tx.item || '-') + '</strong><span>' + esc(tx.kode || tx.id || '-') + ' &bull; ' + esc(tx.tanggal || '-') + '</span></td>' +
      '<td><span class="approval-sppg-label"><i class="fas fa-building"></i>' + esc(tx.sppg || '-') + '</span></td>' +
      '<td class="approval-nominal-cell">' + formatRupiah(tx.nominal) + '</td>' +
      '<td>' + getMetodeBadge(tx.metodeTransaksi) + '</td>' +
      '<td>' + getApprovalDocumentBadge(tx) + '</td>' +
      '<td class="approval-user-cell"><i class="fas fa-user-circle"></i><span>' + esc(tx.user || '-') + '</span></td>' +
      '</tr>';
  }).join('');
}

function renderApprovalMobileCards(pageData, start, isAdmin) {
  return pageData.map(function(tx, idx) {
    var checked = selectedApprovalIds.has(tx.id);
    var statusClass = getApprovalStatusRowClass(tx.metodeTransaksi);
    var rowLabel = 'Lihat detail approval ' + (tx.kode || tx.item || tx.id || '');
    var selection = isAdmin
      ? '<label class="approval-card-select" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()"><input type="checkbox" class="appr-checkbox" data-id="' + esc(tx.id) + '" onchange="toggleApprovalSelect(this)" ' + (checked ? 'checked' : '') + ' aria-label="Pilih transaksi ' + esc(tx.kode || tx.id) + '"><span></span></label>'
      : '';
    var note = tx.catatan && tx.catatan !== '-' ? '<p class="approval-card-note"><i class="fas fa-comment-alt"></i>' + esc(tx.catatan) + '</p>' : '';
    return '<article class="approval-mobile-card ' + esc(statusClass) + '" data-id="' + esc(tx.id) + '" tabindex="0" role="button" aria-label="' + esc(rowLabel) + '" onclick="handleApprovalRowClick(event,this.dataset.id)" onkeydown="handleApprovalRowKeydown(event,this.dataset.id)">' +
      '<div class="approval-card-top">' + selection + '<span class="approval-card-number">#' + (start + idx + 1) + '</span><div class="approval-card-status">' + getMetodeBadge(tx.metodeTransaksi) + '</div><i class="fas fa-chevron-right approval-card-chevron"></i></div>' +
      '<div class="approval-card-main"><div class="approval-card-title-wrap"><span class="approval-card-code">' + esc(tx.kode || tx.id || '-') + '</span><h3>' + esc(tx.item || '-') + '</h3><span class="approval-card-date"><i class="far fa-calendar-alt"></i>' + esc(tx.tanggal || '-') + '</span></div><div class="approval-card-amount"><span>Nominal</span><strong>' + formatRupiah(tx.nominal) + '</strong></div></div>' +
      '<div class="approval-card-meta"><span><i class="fas fa-building"></i>' + esc(tx.sppg || '-') + '</span><span><i class="fas fa-user"></i>' + esc(tx.user || '-') + '</span></div>' +
      '<div class="approval-card-docs">' + getApprovalDocumentBadge(tx) + '</div>' + note +
      '<div class="approval-card-open"><span>Ketuk untuk melihat detail</span><i class="fas fa-arrow-right"></i></div>' +
      '</article>';
  }).join('');
}

function syncApprovalSelectionControls(approvalData, isAdmin) {
  var allSelected = approvalData.length > 0 && approvalData.every(function(tx) { return selectedApprovalIds.has(tx.id); });
  ['apprSelectAll', 'apprSelectAllMobile'].forEach(function(id) {
    var checkbox = $(id);
    if (checkbox) {
      checkbox.checked = allSelected;
      checkbox.disabled = !isAdmin || !approvalData.length;
    }
  });
  var mobileToolbar = $('approvalMobileToolbar');
  if (mobileToolbar) mobileToolbar.classList.toggle('hidden', !isAdmin);
  var mobileCount = $('approvalMobileCount');
  if (mobileCount) mobileCount.textContent = approvalData.length + ' transaksi';
  document.querySelectorAll('#page-approval .approval-select-col').forEach(function(cell) {
    cell.classList.toggle('hidden', !isAdmin);
  });
  document.querySelectorAll('#page-approval .appr-checkbox').forEach(function(checkbox) {
    checkbox.checked = selectedApprovalIds.has(checkbox.getAttribute('data-id'));
  });
}

function goApprovalPage(p) { approvalPage = p; renderApprovalTable(); }"""
app, count = render_pattern.subn(render_replacement, app, count=1)
if count != 1:
    raise SystemExit('renderApprovalTable block not found')

# Keep duplicate desktop/mobile selection controls synchronized without rerendering the whole list.
toggle_pattern = re.compile(
    r"function toggleApprovalSelect\(checkbox\) \{.*?\n\}\n\nfunction toggleSelectAllApproval",
    re.S,
)
toggle_replacement = """function toggleApprovalSelect(checkbox) {
  var id = checkbox.getAttribute('data-id');
  if (checkbox.checked) selectedApprovalIds.add(id);
  else selectedApprovalIds.delete(id);
  var isAdmin = !!(currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN'));
  syncApprovalSelectionControls(filteredApprovalData, isAdmin);
  updateApprovalBulkBar();
}

function toggleSelectAllApproval"""
app, count = toggle_pattern.subn(toggle_replacement, app, count=1)
if count != 1:
    raise SystemExit('toggleApprovalSelect block not found')

# Scope the premium responsive modal treatment only to Approval details.
app = app.replace(
    "    configureApprovalDetailActions(tx);\n    openModal('modalDetail');",
    "    configureApprovalDetailActions(tx);\n    if (modal) modal.classList.add('approval-detail-mode');\n    openModal('modalDetail');",
    1,
)
app = app.replace(
    "  currentApprovalDetailId = null;\n  var footer = modal.querySelector('.modal-footer');",
    "  currentApprovalDetailId = null;\n  modal.classList.remove('approval-detail-mode');\n  var footer = modal.querySelector('.modal-footer');",
    1,
)

# Replace the old Approval table markup with explicit desktop and mobile views.
table_pattern = re.compile(
    r"\s*<div class=\"table-container approval-table\">.*?<div class=\"pagination\" id=\"approvalPagination\"></div>\s*</div>",
    re.S,
)
table_replacement = """
        <div id="approvalDesktopView" class="approval-desktop-view table-container">
          <div class="table-scroll">
            <table class="approval-data-table">
              <thead>
                <tr>
                  <th class="approval-select-col hidden" style="width:42px;text-align:center;"><input type="checkbox" id="apprSelectAll" onchange="toggleSelectAllApproval(this)" aria-label="Pilih semua transaksi approval"></th>
                  <th style="width:54px;text-align:center;">No</th>
                  <th>Transaksi</th>
                  <th style="width:140px;">SPPG</th>
                  <th style="width:150px;">Nominal</th>
                  <th style="width:160px;">Status</th>
                  <th style="width:150px;">Dokumen</th>
                  <th style="width:190px;">Penginput</th>
                </tr>
              </thead>
              <tbody id="approvalTableBody"></tbody>
            </table>
          </div>
        </div>
        <div id="approvalMobileView" class="approval-mobile-view">
          <div id="approvalMobileToolbar" class="approval-mobile-toolbar hidden">
            <label class="approval-select-all-mobile"><input type="checkbox" id="apprSelectAllMobile" onchange="toggleSelectAllApproval(this)"><span>Pilih semua hasil filter</span></label>
            <span id="approvalMobileCount">0 transaksi</span>
          </div>
          <div id="approvalMobileList" class="approval-mobile-list"></div>
        </div>
        <div class="pagination approval-pagination" id="approvalPagination"></div>"""
index, count = table_pattern.subn(table_replacement, index, count=1)
if count != 1:
    raise SystemExit('legacy Approval table markup not found')

index = index.replace(
    '<p class="page-desc">Klik salah satu baris untuk melihat detail dan menindaklanjuti approval</p>',
    '<p class="page-desc">Tinjau transaksi melalui tabel desktop atau kartu ringkas di perangkat mobile</p>',
    1,
)

# Replace the earlier narrow visual patch with a full responsive design system.
style_pattern = re.compile(r'<style id="approval-row-detail-styles">.*?</style>', re.S)
style_replacement = r'''<style id="approval-responsive-ui-v2">
  /* Approval desktop: compact, scannable data table */
  .approval-mobile-view { display: none; }
  .approval-desktop-view { overflow: hidden; border: 1px solid #dbe7ef; border-radius: 16px; background: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, .05); }
  .approval-data-table { width: 100%; min-width: 1040px; border-collapse: separate; border-spacing: 0; }
  .approval-data-table thead th { padding: 13px 14px; background: #f7fafc; color: var(--slate-500); font-size: 10px; font-weight: 800; letter-spacing: .65px; text-transform: uppercase; border-bottom: 1px solid #dbe7ef; }
  .approval-data-table tbody td { padding: 14px; border-bottom: 1px solid #edf2f6; background: #fff; }
  .approval-data-table tbody tr:last-child td { border-bottom: 0; }
  #page-approval .approval-row-clickable { cursor: pointer; transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease; }
  #page-approval .approval-row-clickable:hover td { background: #f6fbfe; }
  #page-approval .approval-row-clickable:hover { box-shadow: inset 4px 0 0 var(--primary); }
  #page-approval .approval-row-clickable:focus { outline: 2px solid var(--primary); outline-offset: -2px; }
  #page-approval .approval-row-clickable td { vertical-align: middle; }
  #page-approval .approval-row-clickable.status-belum-bayar td:first-child { border-left: 4px solid var(--rose); }
  #page-approval .approval-row-clickable.status-menunggu-verifikasi td:first-child { border-left: 4px solid var(--amber); }
  #page-approval .approval-row-clickable.status-belum-lunas td:first-child { border-left: 4px solid var(--orange); }
  #page-approval .approval-row-clickable.status-transfer td:first-child,
  #page-approval .approval-row-clickable.status-cash td:first-child { border-left: 4px solid var(--emerald); }
  .approval-number-cell { text-align: center; color: var(--slate-400); font-size: 11px; font-weight: 800; }
  .approval-transaction-cell strong { display: block; max-width: 280px; overflow: hidden; color: var(--slate-900); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .approval-transaction-cell span { display: block; margin-top: 4px; color: var(--slate-500); font-size: 10px; }
  .approval-sppg-label { display: inline-flex; align-items: center; gap: 7px; color: var(--slate-700); font-size: 11px; font-weight: 700; }
  .approval-sppg-label i { color: var(--primary); }
  .approval-nominal-cell { color: var(--slate-900); font-size: 13px; font-weight: 800; white-space: nowrap; }
  .approval-user-cell { max-width: 190px; }
  .approval-user-cell i { margin-right: 7px; color: var(--slate-400); }
  .approval-user-cell span { display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; white-space: nowrap; }
  .approval-select-col input, .approval-card-select input, .approval-select-all-mobile input { accent-color: var(--primary); cursor: pointer; }
  .approval-pagination { margin-top: 14px; }

  /* Approval detail header and hero */
  .detail-modal-header { align-items: flex-start; gap: 14px; }
  .detail-modal-title-wrap { flex: 1; min-width: 0; }
  .detail-modal-title-wrap h3 { margin: 0; }
  .detail-modal-title-wrap p { margin: 5px 0 0; color: var(--slate-500); font-size: 12px; }
  .detail-modal-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
  .detail-context-actions { display: flex; align-items: center; gap: 8px; }
  .detail-context-actions .btn { min-height: 38px; white-space: nowrap; }
  #modalDetail.approval-detail-mode .modal-box { border: 1px solid #dbe7ef; box-shadow: 0 24px 70px rgba(15, 23, 42, .22); }
  #modalDetail.approval-detail-mode .modal-footer { display: none; }
  .approval-detail-hero { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 16px; padding: 18px 20px; margin-bottom: 20px; background: linear-gradient(135deg,#eff8fd 0%,#f8fbfd 55%,#f0fdf4 100%); border: 1px solid #d8eaf4; border-radius: 16px; }
  .approval-detail-icon { width: 54px; height: 54px; border-radius: 15px; display: grid; place-items: center; color: var(--primary); background: #fff; box-shadow: 0 7px 18px rgba(30,111,156,.12); font-size: 20px; }
  .approval-detail-summary { min-width: 0; }
  .approval-detail-eyebrow { display: block; margin-bottom: 3px; color: var(--primary); font-size: 10px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; }
  .approval-detail-summary h4 { margin: 0; color: var(--slate-900); font-size: 17px; line-height: 1.3; }
  .approval-detail-summary p { margin: 4px 0 9px; color: var(--slate-500); font-size: 11px; }
  .approval-detail-badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .approval-detail-nominal { min-width: 150px; text-align: right; }
  .approval-detail-nominal span { display: block; margin-bottom: 3px; color: var(--slate-500); font-size: 10px; font-weight: 800; letter-spacing: .65px; text-transform: uppercase; }
  .approval-detail-nominal strong { display: block; color: var(--slate-900); font-size: 18px; }

  @media (max-width: 768px) {
    #page-approval { padding-bottom: 8px; }
    #page-approval .page-header { align-items: flex-start; gap: 10px; }
    #page-approval .page-header-actions { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
    #page-approval .page-header-actions .toggle-switch-wrap { grid-column: 1 / -1; justify-content: space-between; }
    #page-approval .page-header-actions .btn { justify-content: center; min-width: 0; }
    #page-approval .filter-bar { border-radius: 14px; }
    #apprBulkBar { position: sticky; top: calc(var(--header-height) + 8px); z-index: 20; margin: 0 0 12px !important; border-radius: 14px !important; box-shadow: 0 10px 24px rgba(30,111,156,.14); }
    .approval-desktop-view { display: none !important; }
    .approval-mobile-view { display: block; }
    .approval-mobile-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; padding: 10px 12px; background: #fff; border: 1px solid #dbe7ef; border-radius: 12px; color: var(--slate-500); font-size: 11px; }
    .approval-select-all-mobile { display: inline-flex; align-items: center; gap: 8px; color: var(--slate-700); font-weight: 700; }
    .approval-mobile-list { display: grid; gap: 12px; }
    .approval-mobile-card { position: relative; overflow: hidden; padding: 14px; background: #fff; border: 1px solid #dbe7ef; border-radius: 17px; box-shadow: 0 7px 20px rgba(15,23,42,.055); cursor: pointer; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
    .approval-mobile-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--slate-300); }
    .approval-mobile-card.status-belum-bayar::before { background: var(--rose); }
    .approval-mobile-card.status-menunggu-verifikasi::before { background: var(--amber); }
    .approval-mobile-card.status-belum-lunas::before { background: var(--orange); }
    .approval-mobile-card.status-transfer::before, .approval-mobile-card.status-cash::before { background: var(--emerald); }
    .approval-mobile-card:active { transform: scale(.987); box-shadow: 0 3px 10px rgba(15,23,42,.08); }
    .approval-mobile-card:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
    .approval-card-top { display: flex; align-items: center; gap: 8px; min-height: 28px; }
    .approval-card-select { display: inline-flex; align-items: center; padding: 4px; }
    .approval-card-number { color: var(--slate-400); font-size: 10px; font-weight: 800; }
    .approval-card-status { margin-left: auto; }
    .approval-card-chevron { margin-left: 2px; color: var(--slate-300); font-size: 12px; }
    .approval-card-main { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 12px; margin-top: 12px; }
    .approval-card-code { display: block; margin-bottom: 3px; color: var(--primary); font-size: 9px; font-weight: 800; letter-spacing: .55px; text-transform: uppercase; }
    .approval-card-title-wrap h3 { display: -webkit-box; overflow: hidden; margin: 0 0 5px; color: var(--slate-900); font-size: 15px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .approval-card-date { display: inline-flex; align-items: center; gap: 5px; color: var(--slate-500); font-size: 10px; }
    .approval-card-amount { text-align: right; white-space: nowrap; }
    .approval-card-amount span { display: block; color: var(--slate-400); font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .approval-card-amount strong { display: block; margin-top: 2px; color: var(--slate-900); font-size: 15px; }
    .approval-card-meta { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 7px; margin-top: 13px; }
    .approval-card-meta span { display: flex; align-items: center; min-width: 0; gap: 6px; padding: 8px 9px; overflow: hidden; color: var(--slate-600); background: var(--slate-50); border-radius: 9px; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .approval-card-meta i { flex-shrink: 0; color: var(--primary); }
    .approval-card-docs { margin-top: 10px; }
    .approval-card-note { display: -webkit-box; overflow: hidden; margin: 10px 0 0; color: var(--slate-500); font-size: 10px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .approval-card-note i { margin-right: 6px; color: var(--slate-400); }
    .approval-card-open { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; color: var(--primary); border-top: 1px solid #edf2f6; font-size: 10px; font-weight: 800; }
    .approval-card-skeleton { min-height: 136px; padding: 16px; background: #fff; border: 1px solid #dbe7ef; border-radius: 17px; }
    .approval-mobile-skeleton { display: grid; gap: 12px; }

    #modalDetail.approval-detail-mode .modal-overlay { align-items: flex-end; padding: 0; }
    #modalDetail.approval-detail-mode .modal-box { width: 100%; max-width: none; max-height: 92dvh; margin: 0; border-width: 1px 0 0; border-radius: 22px 22px 0 0; animation: approvalSheetUp .22s ease-out; }
    #modalDetail.approval-detail-mode .modal-header { position: sticky; top: 0; z-index: 5; flex-wrap: wrap; padding: 16px; background: rgba(255,255,255,.98); border-radius: 22px 22px 0 0; backdrop-filter: blur(12px); }
    #modalDetail.approval-detail-mode .detail-modal-title-wrap { flex-basis: calc(100% - 48px); }
    #modalDetail.approval-detail-mode .detail-modal-header-actions { width: 100%; order: 3; justify-content: stretch; }
    #modalDetail.approval-detail-mode .detail-context-actions { flex: 1; }
    #modalDetail.approval-detail-mode .detail-context-actions .btn { width: 100%; justify-content: center; min-height: 44px; }
    #modalDetail.approval-detail-mode .detail-modal-header-actions .modal-close { position: absolute; top: 14px; right: 14px; }
    #modalDetail.approval-detail-mode .modal-body { padding: 14px 14px calc(18px + var(--safe-bottom)); overflow-y: auto; }
    .approval-detail-hero { grid-template-columns: auto minmax(0,1fr); padding: 15px; gap: 12px; border-radius: 14px; }
    .approval-detail-nominal { grid-column: 1/-1; min-width: 0; text-align: left; padding-top: 12px; border-top: 1px solid #d8eaf4; }
    .approval-detail-icon { width: 46px; height: 46px; border-radius: 13px; }
    .approval-detail-summary h4 { font-size: 15px; }
    @keyframes approvalSheetUp { from { transform: translateY(28px); opacity: .65; } to { transform: translateY(0); opacity: 1; } }
  }

  @media (min-width: 769px) {
    .approval-desktop-view { display: block; }
    .approval-mobile-view { display: none !important; }
  }
</style>'''
index, count = style_pattern.subn(style_replacement, index, count=1)
if count != 1:
    raise SystemExit('old Approval visual style block not found')

# Cache-bust the new dual renderer and service worker.
index, count = re.subn(r'app\.js\?v=[^"\']+', 'app.js?v=20260722-approval-responsive-v4', index)
if count < 1:
    raise SystemExit('app cache-bust script not found')
sw, count = re.subn(r"const CACHE_VERSION = 'sim-sppg-[^']+';", "const CACHE_VERSION = 'sim-sppg-v20260722-approval-responsive-v8';", sw, count=1)
if count != 1:
    raise SystemExit('service worker cache version not found')

# Keep the payment-verification regression aligned with the latest frontend cache keys.
verifier = re.sub(
    r'/<script src="\\\.\\/app\\\.js\\\?v=[^"]+"><\\/script>/\.test\(index\)',
    '/<script src="\\.\\/app\\.js\\?v=20260722-approval-responsive-v4"><\\/script>/.test(index)',
    verifier,
    count=1,
)
verifier = re.sub(
    r"serviceWorker\.includes\(\"const CACHE_VERSION = 'sim-sppg-[^']+';\"\)",
    "serviceWorker.includes(\"const CACHE_VERSION = 'sim-sppg-v20260722-approval-responsive-v8';\")",
    verifier,
    count=1,
)

check = r'''import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

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
requireMatch(index.includes('@media (max-width: 768px)'), 'mobile breakpoint must exist');
requireMatch(index.includes('#modalDetail.approval-detail-mode .modal-box'), 'mobile/desktop detail mode must be scoped');
requireMatch(app.includes("modal.classList.add('approval-detail-mode')"), 'Approval detail must enable scoped modal mode');
requireMatch(app.includes("modal.classList.remove('approval-detail-mode')"), 'generic detail reset must clean Approval modal mode');
requireMatch(/<script src="\.\/app\.js\?v=20260722-approval-responsive-v4"><\/script>/.test(index), 'new responsive bundle cache key must be active');
requireMatch(sw.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-responsive-v8';"), 'service worker must invalidate the prior Approval UI');

if (!process.exitCode) console.log('Approval responsive desktop/mobile UI check passed.');
'''

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
verifier_path.write_text(verifier, encoding='utf-8')
check_path.write_text(check, encoding='utf-8')
print('Applied Approval responsive desktop/mobile UI and cleanup')
