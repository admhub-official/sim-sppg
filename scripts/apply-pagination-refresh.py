from pathlib import Path

APP = Path('app.js')
text = APP.read_text(encoding='utf-8')

state_anchor = "var notifLoadingMore = false;\n"
helper = r'''

// Centralized server-pagination refresh after successful mutations.
// Filters and page size remain untouched; only the affected page returns to 1.
var PAGED_MUTATION_REFRESH = {
  addTransaction:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  editTransaction:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  deleteTransaction:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  approveTransaction:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  submitUserBuktiPembayaran:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  verifyUserPayment:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  sendCatatanApproval:{pages:['txPage','approvalPage'],loaders:['loadTransactions','loadTransactionData']},
  deleteUser:{pages:['usersPage'],loaders:['loadUsers','loadAllUsers']},
  updateUserProfile:{pages:['usersPage'],loaders:['loadUsers','loadAllUsers','loadProfile']},
  uploadFotoProfil:{pages:['usersPage'],loaders:['loadUsers','loadAllUsers','loadProfile']},
  addMasterBahanBaku:{pages:['bbPage'],loaders:['loadMasterBB','loadMasterBahanBaku']},
  updateMasterBahanBaku:{pages:['bbPage'],loaders:['loadMasterBB','loadMasterBahanBaku']},
  deleteMasterBahanBaku:{pages:['bbPage'],loaders:['loadMasterBB','loadMasterBahanBaku']},
  addMasterSupplier:{pages:['supplierPage'],loaders:['loadSuppliers','loadMasterSupplier']},
  updateMasterSupplier:{pages:['supplierPage'],loaders:['loadSuppliers','loadMasterSupplier']},
  deleteSupplier:{pages:['supplierPage'],loaders:['loadSuppliers','loadMasterSupplier']},
  addSurveiBahanBaku:{pages:['surveiPage'],loaders:['loadSurvei','loadSurveiBahanBaku']},
  updateSurvei:{pages:['surveiPage'],loaders:['loadSurvei','loadSurveiBahanBaku']},
  deleteSurvei:{pages:['surveiPage'],loaders:['loadSurvei','loadSurveiBahanBaku']},
  addSerahTerima:{pages:['stPage'],loaders:['loadSerahTerima']},
  updateSerahTerima:{pages:['stPage'],loaders:['loadSerahTerima']},
  deleteSerahTerima:{pages:['stPage'],loaders:['loadSerahTerima']},
  addMenuHarian:{pages:['menuMBGPage'],loaders:['loadMenuMBG','loadMenuHarian']},
  updateMenuMBG:{pages:['menuMBGPage'],loaders:['loadMenuMBG','loadMenuHarian']},
  deleteMenuMBG:{pages:['menuMBGPage'],loaders:['loadMenuMBG','loadMenuHarian']},
  addPendingPayment:{pages:['pendingPage'],loaders:['loadPendingPayments','loadPending']},
  updatePendingPayment:{pages:['pendingPage'],loaders:['loadPendingPayments','loadPending']},
  deletePendingPayment:{pages:['pendingPage'],loaders:['loadPendingPayments','loadPending']},
  addAdminAssignment:{pages:[],loaders:['loadAdminAssignments']},
  updateAdminAssignment:{pages:[],loaders:['loadAdminAssignments']},
  deleteAdminAssignment:{pages:[],loaders:['loadAdminAssignments']}
};
var _pagedRefreshTimers = {};
function schedulePagedMutationRefresh(fnName, result) {
  var spec = PAGED_MUTATION_REFRESH[fnName];
  if (!spec || (result && result.success === false)) return;
  (spec.pages || []).forEach(function(name) {
    try { window[name] = 1; } catch(e) {}
  });
  if (_pagedRefreshTimers[fnName]) clearTimeout(_pagedRefreshTimers[fnName]);
  _pagedRefreshTimers[fnName] = setTimeout(function() {
    delete _pagedRefreshTimers[fnName];
    for (var i = 0; i < spec.loaders.length; i++) {
      var loader = window[spec.loaders[i]];
      if (typeof loader === 'function') {
        try { loader(); } catch(e) { console.error('Refresh pagination gagal:', fnName, e); }
        break;
      }
    }
  }, 120);
}

function normalizePagedResponse(result) {
  if (Array.isArray(result)) return { data: result, page: 1, pageSize: result.length, total: result.length, hasMore: false, serverPaged: false };
  var source = result && typeof result === 'object' ? result : {};
  var data = Array.isArray(source.data) ? source.data : [];
  return {
    data: data,
    page: Math.max(1, Number(source.page) || 1),
    pageSize: Math.max(1, Number(source.pageSize) || ITEMS_PER_PAGE),
    total: Math.max(0, Number(source.total) || data.length),
    hasMore: source.hasMore === true,
    serverPaged: Number.isFinite(Number(source.total)) && Number.isFinite(Number(source.page))
  };
}
window.normalizePagedResponse = normalizePagedResponse;
'''

if 'var PAGED_MUTATION_REFRESH =' not in text:
    if state_anchor not in text:
        raise SystemExit('Missing pagination state anchor')
    text = text.replace(state_anchor, state_anchor + helper, 1)

success_anchor = "      if (onSuccess) onSuccess(result);\n"
success_new = "      if (onSuccess) onSuccess(result);\n      schedulePagedMutationRefresh(fnName, result);\n"
if 'schedulePagedMutationRefresh(fnName, result);' not in text:
    if success_anchor not in text:
        raise SystemExit('Missing callApi success anchor')
    text = text.replace(success_anchor, success_new, 1)

APP.write_text(text, encoding='utf-8')
print('Centralized pagination refresh patch applied.')
