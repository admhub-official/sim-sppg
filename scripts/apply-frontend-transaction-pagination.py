from pathlib import Path
import re

p=Path('app.js')
s=p.read_text()

# Add server pagination state once.
anchor="var txPage = 1, usersPage = 1, bbPage = 1, supplierPage = 1;"
if 'var txServerTotal' not in s:
    s=s.replace(anchor, anchor+"\nvar txServerTotal = 0, txServerPaged = false, txFilterTimer = null;")

load_pattern=r"function loadTransactions\(\) \{.*?\n\}\n\nfunction populateSPPGFilter\(\)"
load_replacement=r'''function loadTransactions(page, forceAll) {
  if (!currentUser) return;
  page = Math.max(1, Number(page) || txPage || 1);
  forceAll = !!forceAll;
  showLoading(true);
  var tbody = $('transaksiTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="skeleton-screen" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>'.repeat(5) +
      '</div></td></tr>';
  }

  var isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  var isAdmin = currentUser.role === 'ADMIN';
  var filters = {
    callerRole: currentUser.role,
    callerUser: (isSuperAdmin || isAdmin) ? '' : currentUser.email
  };
  var sppgEl=$('txFilterSPPG'), kategoriEl=$('txFilterKategori');
  if (sppgEl && sppgEl.value && sppgEl.value !== 'ALL') filters.sppg=sppgEl.value;
  if (kategoriEl && kategoriEl.value && kategoriEl.value !== 'ALL') filters.kategori=kategoriEl.value;
  if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;
  if (!forceAll) { filters.page=page; filters.pageSize=ITEMS_PER_PAGE; }

  callApi('getTransactions', [filters], function(result) {
    showLoading(false);
    var rows, meta=null;
    if (Array.isArray(result)) rows=result;
    else if (result && Array.isArray(result.data)) { rows=result.data; meta=result; }
    else {
      showToast('error', 'Gagal', 'Data transaksi tidak valid. Coba refresh.');
      allTransactions=[]; filteredTransactions=[]; txServerTotal=0; txServerPaged=false; renderTransaksiTable(); return;
    }
    allTransactions=rows;
    txServerPaged=!!(meta && Number(meta.page)>0);
    txServerTotal=txServerPaged ? Number(meta.total||0) : rows.length;
    txPage=txServerPaged ? Number(meta.page||page) : 1;
    applyTransactionFiltersLocal();
    populateSPPGFilter();
    populatePendingTransaksiSelect();
    renderTransaksiTable();
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat memuat transaksi: ' + (err.message || ''));
    allTransactions=[]; filteredTransactions=[]; txServerTotal=0; txServerPaged=false; renderTransaksiTable();
  });
}

function populateSPPGFilter()'''
ns,n=re.subn(load_pattern,load_replacement,s,flags=re.S)
if n!=1:
    raise SystemExit(f'loadTransactions patch count={n}')
s=ns

old_render="""  var totalPages = Math.ceil(count / ITEMS_PER_PAGE);\n  if (txPage > totalPages) txPage = totalPages;\n  var start = (txPage - 1) * ITEMS_PER_PAGE;\n  var pageData = filteredTransactions.slice(start, start + ITEMS_PER_PAGE);"""
new_render="""  var totalPages = Math.ceil((txServerPaged ? txServerTotal : count) / ITEMS_PER_PAGE);\n  if (txPage > totalPages) txPage = totalPages;\n  var start = (txPage - 1) * ITEMS_PER_PAGE;\n  var pageData = txServerPaged ? filteredTransactions : filteredTransactions.slice(start, start + ITEMS_PER_PAGE);"""
if old_render not in s:
    raise SystemExit('render transaction block not found')
s=s.replace(old_render,new_render,1)

s=s.replace("function goTxPage(p) { txPage = p; renderTransaksiTable(); }", "function goTxPage(p) { if (txServerPaged) loadTransactions(p, false); else { txPage = p; renderTransaksiTable(); } }",1)

filter_pattern=r"function filterTransaksi\(\) \{.*?\n\}\n\nvar editTxExistingFiles"
filter_replacement=r'''function applyTransactionFiltersLocal() {
  var search = $('txSearchInput') ? $('txSearchInput').value.toLowerCase().trim() : '';
  var sppg = $('txFilterSPPG') ? $('txFilterSPPG').value : 'ALL';
  var kategori = $('txFilterKategori') ? $('txFilterKategori').value : 'ALL';
  var status = $('txFilterStatus') ? $('txFilterStatus').value : 'ALL';
  filteredTransactions = allTransactions.filter(function(tx) {
    if (search) {
      var text = ((tx.kode || '') + ' ' + (tx.item || '') + ' ' + (tx.user || '') + ' ' + (tx.sppg || '')).toLowerCase();
      if (text.indexOf(search) === -1) return false;
    }
    if (sppg !== 'ALL' && tx.sppg !== sppg) return false;
    if (kategori !== 'ALL' && tx.kategori !== kategori) return false;
    var metode = String(tx.metodeTransaksi || '').trim().toUpperCase();
    if (status === 'PENDING' && metode === 'SUDAH_DIBAYAR') return false;
    if (status === 'SUDAH_DIBAYAR' && metode !== 'SUDAH_DIBAYAR') return false;
    return true;
  });
}

function filterTransaksi() {
  var search = $('txSearchInput') ? $('txSearchInput').value.trim() : '';
  var status = $('txFilterStatus') ? $('txFilterStatus').value : 'ALL';
  var needsFullDataset = !!search || status !== 'ALL';
  clearTimeout(txFilterTimer);
  txFilterTimer=setTimeout(function(){
    txPage=1;
    loadTransactions(1, needsFullDataset);
  }, 300);
}

var editTxExistingFiles'''
ns,n=re.subn(filter_pattern,filter_replacement,s,flags=re.S)
if n!=1:
    raise SystemExit(f'filterTransaksi patch count={n}')
s=ns

p.write_text(s)
print('frontend transaction pagination patched')
