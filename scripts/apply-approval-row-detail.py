from pathlib import Path
import re

app_path = Path('app.js')
index_path = Path('index.html')
sw_path = Path('sw.js')
verifier_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
verifier = verifier_path.read_text(encoding='utf-8')

# State for the approval transaction currently shown in the generic detail modal.
anchor = "var currentDetailUserRow = null;"
if "var currentApprovalDetailId = null;" not in app:
    if anchor not in app:
        raise SystemExit('detail state anchor not found')
    app = app.replace(anchor, anchor + "\nvar currentApprovalDetailId = null;", 1)

# Replace the Approval table renderer: row click opens detail, checkbox remains independent,
# and the old action buttons/column are removed.
pattern = re.compile(r"function renderApprovalTable\(\) \{.*?\n\}\nfunction goApprovalPage\(p\) \{ approvalPage = p; renderApprovalTable\(\); \}", re.S)
if not pattern.search(app):
    raise SystemExit('renderApprovalTable block not found')

replacement = r'''function renderApprovalTable() {
  var approvalData = filteredApprovalData;
  var tbody = $('approvalTableBody');
  if (!approvalData.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-check-circle"></i></div><h4>Semua Lunas!</h4><p>Tidak ada transaksi yang menunggu approval.</p></div></td></tr>';
    $('approvalPagination').innerHTML = '';
    updateApprovalBulkBar();
    return;
  }
  var totalPages = Math.ceil(approvalData.length / ITEMS_PER_PAGE);
  if (approvalPage > totalPages) approvalPage = totalPages;
  var start = (approvalPage - 1) * ITEMS_PER_PAGE;
  var pageData = approvalData.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  var isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN');

  function getStatusRowClass(metode) {
    var m = String(metode || '').trim().toUpperCase();
    if (m === 'BELUM_BAYAR') return 'status-belum-bayar';
    if (m === 'MENUNGGU_VERIFIKASI') return 'status-menunggu-verifikasi';
    if (m === 'BELUM_LUNAS') return 'status-belum-lunas';
    if (m === 'TRANSFER') return 'status-transfer';
    if (m === 'CASH') return 'status-cash';
    return '';
  }

  pageData.forEach(function(tx, idx) {
    var no = start + idx + 1;
    var isChecked = selectedApprovalIds.has(tx.id);
    var statusClass = getStatusRowClass(tx.metodeTransaksi);
    var rowLabel = 'Lihat detail approval ' + (tx.kode || tx.item || tx.id || '');
    html += '<tr data-id="' + esc(tx.id) + '" class="approval-row-clickable ' + esc(statusClass) + '" tabindex="0" role="button" aria-label="' + esc(rowLabel) + '" onclick="handleApprovalRowClick(event,this.dataset.id)" onkeydown="handleApprovalRowKeydown(event,this.dataset.id)">' +
      '<td style="text-align:center;">' +
        (isAdmin ? '<input type="checkbox" class="appr-checkbox" data-id="' + esc(tx.id) + '" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onchange="toggleApprovalSelect(this)" ' + (isChecked ? 'checked' : '') + ' aria-label="Pilih transaksi ' + esc(tx.kode || tx.id) + '">' : '') +
      '</td>' +
      '<td style="text-align:center;color:var(--slate-400);font-weight:600;">' + no + '</td>' +
      '<td><strong style="color:var(--slate-800);font-size:12px;">' + esc(tx.kode || '-') + '</strong></td>' +
      '<td>' + esc(tx.tanggal || '-') + '</td>' +
      '<td><span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span></td>' +
      '<td><strong style="color:var(--slate-700);">' + esc(tx.item || '-') + '</strong></td>' +
      '<td><strong style="color:var(--slate-800);">' + formatRupiah(tx.nominal) + '</strong></td>' +
      '<td>' + getMetodeBadge(tx.metodeTransaksi) + '</td>' +
      '<td>' + esc(tx.user || '-') + '</td>' +
      '<td style="max-width:160px;"><span style="color:var(--slate-500);font-size:12px;font-style:italic;">' + esc(tx.catatan && tx.catatan !== '-' ? tx.catatan : '-') + '</span></td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
  renderPagination('approvalPagination', approvalPage, totalPages, 'goApprovalPage');

  var selAll = $('apprSelectAll');
  if (selAll) {
    selAll.checked = approvalData.length > 0 && approvalData.every(function(tx) { return selectedApprovalIds.has(tx.id); });
  }
  updateApprovalBulkBar();
}
function goApprovalPage(p) { approvalPage = p; renderApprovalTable(); }'''
app = pattern.sub(replacement, app, count=1)

helper_anchor = "function goApprovalPage(p) { approvalPage = p; renderApprovalTable(); }\n"
if helper_anchor not in app:
    raise SystemExit('approval helper anchor not found')
if "function openApprovalDetail(id)" not in app:
    helpers = r'''

function isApprovalInteractiveTarget(target) {
  return !!(target && target.closest && target.closest('input,button,a,select,textarea,label'));
}

function handleApprovalRowClick(event, id) {
  if (isApprovalInteractiveTarget(event && event.target)) return;
  openApprovalDetail(id);
}

function handleApprovalRowKeydown(event, id) {
  if (!event || isApprovalInteractiveTarget(event.target)) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openApprovalDetail(id);
  }
}

function openApprovalDetail(id) {
  if (!id) return;
  showLoading(true);
  callApi('getTransactionDetail', [id], function(tx) {
    showLoading(false);
    if (!tx) {
      showToast('error', 'Error', 'Transaksi approval tidak ditemukan');
      return;
    }
    renderDetailTransaksi(tx);
    currentApprovalDetailId = tx.id || id;
    var body = $('detailBody');
    if (body) body.insertAdjacentHTML('afterbegin', renderApprovalDetailHero(tx));
    var modal = $('modalDetail');
    if (modal) {
      var title = modal.querySelector('.modal-header h3');
      var subtitle = modal.querySelector('.modal-header p');
      if (title) title.innerHTML = '<i class="fas fa-clipboard-check" style="color:var(--emerald);margin-right:8px;"></i>Detail Approval';
      if (subtitle) subtitle.textContent = 'Tinjau transaksi dan dokumen sebelum menindaklanjuti';
    }
    configureApprovalDetailActions(tx);
    openModal('modalDetail');
  }, function() {
    showLoading(false);
    showToast('error', 'Error', 'Gagal memuat detail approval');
  });
}

function renderApprovalDetailHero(tx) {
  var doc = _approvalDocStatus(tx);
  var docBadge = doc.status === 'Lengkap' ? 'badge-green' : (doc.status === 'Tidak Ada Keduanya' ? 'badge-red' : 'badge-amber');
  return '<div class="approval-detail-hero">' +
    '<div class="approval-detail-icon"><i class="fas fa-file-invoice-dollar"></i></div>' +
    '<div class="approval-detail-summary">' +
      '<span class="approval-detail-eyebrow">Transaksi Approval</span>' +
      '<h4>' + esc(tx.item || '-') + '</h4>' +
      '<p>' + esc(tx.kode || tx.id || '-') + ' &bull; ' + esc(tx.tanggal || '-') + '</p>' +
      '<div class="approval-detail-badges">' + getMetodeBadge(tx.metodeTransaksi) + '<span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span><span class="badge ' + docBadge + '">' + esc(doc.status) + '</span></div>' +
    '</div>' +
    '<div class="approval-detail-nominal"><span>Nominal</span><strong>' + formatRupiah(tx.nominal) + '</strong></div>' +
  '</div>';
}

function configureApprovalDetailActions(tx) {
  var actions = $('detailHeaderActions');
  if (!actions) return;
  var status = String(tx.metodeTransaksi || '').trim().toUpperCase();
  var isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN');
  var currentKeys = currentUser ? [currentUser.email, currentUser.username].map(function(v) { return String(v || '').trim().toLowerCase(); }) : [];
  var isOwner = currentKeys.indexOf(String(tx.user || '').trim().toLowerCase()) > -1;
  var html = '';
  if (isAdmin) {
    if (status === 'MENUNGGU_VERIFIKASI') {
      html = '<button type="button" class="btn btn-success btn-sm" onclick="runApprovalDetailAction(\'verify\')"><i class="fas fa-stamp"></i><span>Verifikasi &amp; TTD</span></button>';
    } else {
      html = '<button type="button" class="btn btn-success btn-sm" onclick="runApprovalDetailAction(\'approve\')"><i class="fas fa-check"></i><span>Approve</span></button>';
    }
  } else if (uploadBuktiModeEnabled && isOwner && ['BELUM_BAYAR', 'BELUM_LUNAS'].indexOf(status) > -1) {
    html = '<button type="button" class="btn btn-primary btn-sm" onclick="runApprovalDetailAction(\'upload\')"><i class="fas fa-upload"></i><span>Kirim Bukti</span></button>';
  }
  actions.innerHTML = html;
  actions.classList.toggle('hidden', !html);
}

function runApprovalDetailAction(action) {
  var id = currentApprovalDetailId;
  if (!id) return;
  closeModal('modalDetail');
  if (action === 'verify') openVerifikasiModal(id);
  else if (action === 'approve') openApprovalModal(id);
  else if (action === 'upload') openUserBuktiModal(id);
}
'''
    app = app.replace(helper_anchor, helper_anchor + helpers, 1)

reset_pattern = re.compile(r"function resetDetailModalFooter\(\) \{.*?\n\}", re.S)
if not reset_pattern.search(app):
    raise SystemExit('resetDetailModalFooter block not found')
reset = r'''function resetDetailModalFooter() {
  var modal = $('modalDetail');
  if (!modal) return;
  currentApprovalDetailId = null;
  var footer = modal.querySelector('.modal-footer');
  if (footer) footer.innerHTML = '<button onclick="closeModal(\'modalDetail\')" class="btn btn-outline">Tutup</button>';
  var actions = $('detailHeaderActions');
  if (actions) {
    actions.innerHTML = '';
    actions.classList.add('hidden');
  }
  var title = modal.querySelector('.modal-header h3');
  var subtitle = modal.querySelector('.modal-header p');
  if (title) title.innerHTML = '<i class="fas fa-file-invoice icon-modal-title"></i>Detail Transaksi';
  if (subtitle) subtitle.textContent = 'Informasi lengkap transaksi & dokumen pendukung';
}'''
app = reset_pattern.sub(reset, app, count=1)

index = index.replace('<p class="page-desc">Transaksi yang belum di-approve (BELUM_BAYAR)</p>', '<p class="page-desc">Klik salah satu baris untuk melihat detail dan menindaklanjuti approval</p>', 1)
action_header = '                  <th style="width:120px;text-align:center;">Aksi</th>\n'
if action_header not in index:
    raise SystemExit('approval action header not found')
index = index.replace(action_header, '', 1)

old_header = '''      <div class="modal-header">
        <div>
          <h3 id="modalDetailTitle"><i class="fas fa-file-invoice icon-modal-title"></i>Detail Transaksi</h3>
          <p>Informasi lengkap transaksi &amp; dokumen pendukung</p>
        </div>
        <button onclick="closeModal('modalDetail')" class="modal-close"><i class="fas fa-times"></i></button>
      </div>'''
new_header = '''      <div class="modal-header detail-modal-header">
        <div class="detail-modal-title-wrap">
          <h3 id="modalDetailTitle"><i class="fas fa-file-invoice icon-modal-title"></i>Detail Transaksi</h3>
          <p>Informasi lengkap transaksi &amp; dokumen pendukung</p>
        </div>
        <div class="detail-modal-header-actions">
          <div id="detailHeaderActions" class="detail-context-actions hidden"></div>
          <button onclick="closeModal('modalDetail')" class="modal-close" aria-label="Tutup detail"><i class="fas fa-times"></i></button>
        </div>
      </div>'''
if old_header not in index:
    raise SystemExit('modalDetail header not found')
index = index.replace(old_header, new_header, 1)

styles = r'''
<style id="approval-row-detail-styles">
  #page-approval .approval-row-clickable{cursor:pointer;transition:background-color .18s ease,box-shadow .18s ease,transform .18s ease}
  #page-approval .approval-row-clickable:hover{background:#f0f7fb;box-shadow:inset 0 0 0 1px #d8eaf4}
  #page-approval .approval-row-clickable:focus{outline:2px solid var(--primary);outline-offset:-2px;background:var(--primary-light)}
  #page-approval .approval-row-clickable td{vertical-align:middle}
  #page-approval .approval-row-clickable .appr-checkbox{cursor:pointer}
  .detail-modal-header{align-items:flex-start;gap:14px}.detail-modal-title-wrap{flex:1;min-width:0}.detail-modal-title-wrap h3{margin:0}.detail-modal-title-wrap p{margin:5px 0 0}
  .detail-modal-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-shrink:0}.detail-context-actions{display:flex;align-items:center;gap:8px}.detail-context-actions .btn{min-height:38px;white-space:nowrap}
  .approval-detail-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;padding:18px 20px;margin-bottom:20px;background:linear-gradient(135deg,#eff8fd 0%,#f8fbfd 55%,#f0fdf4 100%);border:1px solid #d8eaf4;border-radius:16px}
  .approval-detail-icon{width:54px;height:54px;border-radius:15px;display:grid;place-items:center;color:var(--primary);background:#fff;box-shadow:0 7px 18px rgba(30,111,156,.12);font-size:20px}.approval-detail-summary{min-width:0}
  .approval-detail-eyebrow{display:block;margin-bottom:3px;color:var(--primary);font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase}.approval-detail-summary h4{margin:0;color:var(--slate-900);font-size:17px;line-height:1.3}.approval-detail-summary p{margin:4px 0 9px;color:var(--slate-500);font-size:11px}.approval-detail-badges{display:flex;flex-wrap:wrap;gap:6px}
  .approval-detail-nominal{min-width:150px;text-align:right}.approval-detail-nominal span{display:block;margin-bottom:3px;color:var(--slate-500);font-size:10px;font-weight:800;letter-spacing:.65px;text-transform:uppercase}.approval-detail-nominal strong{display:block;color:var(--slate-900);font-size:18px}
  @media(max-width:700px){.detail-modal-header{flex-wrap:wrap}.detail-modal-title-wrap{flex-basis:calc(100% - 48px)}.detail-modal-header-actions{width:100%;order:3;justify-content:stretch}.detail-context-actions{flex:1}.detail-context-actions .btn{width:100%;justify-content:center}.detail-modal-header-actions .modal-close{flex:0 0 42px}.approval-detail-hero{grid-template-columns:auto minmax(0,1fr);padding:16px;gap:13px}.approval-detail-nominal{grid-column:1/-1;min-width:0;text-align:left;padding-top:12px;border-top:1px solid #d8eaf4}.approval-detail-icon{width:46px;height:46px;border-radius:13px}.approval-detail-summary h4{font-size:15px}}
</style>
'''
if 'id="approval-row-detail-styles"' not in index:
    index = index.replace('</head>', styles + '</head>', 1)

index = index.replace('app.js?v=20260722-user-detail-key-v2', 'app.js?v=20260722-approval-detail-v3', 1)
sw = sw.replace("const CACHE_VERSION = 'sim-sppg-v20260722-user-detail-key-v6';", "const CACHE_VERSION = 'sim-sppg-v20260722-approval-detail-v7';", 1)
verifier = verifier.replace('app.js\\?v=20260722-user-detail-key-v2', 'app.js\\?v=20260722-approval-detail-v3', 1)
verifier = verifier.replace("sim-sppg-v20260722-user-detail-key-v6", "sim-sppg-v20260722-approval-detail-v7", 1)

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
verifier_path.write_text(verifier, encoding='utf-8')
print('Applied clickable approval detail UI patch')
