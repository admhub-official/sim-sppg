/* SIM-SPPG SINGLE JAVASCRIPT BUNDLE
 * Seluruh logika lokal aplikasi dipusatkan dalam file ini.
 * UI, UX, markup, dan CSS berada di index.html.
 */
 
/* ===== INLINE MODULE 1 ===== */
(function() {
  function iconsConverted() {
    // Kalau SVG+JS berhasil, <i class="fas ..."> sudah diganti jadi <svg class="svg-inline--fa">
    return document.querySelectorAll('svg.svg-inline--fa').length > 0;
  }
  function fontLoaded() {
    try { return document.fonts.check('900 1em "Font Awesome 6 Free"'); }
    catch (error) { return false; }
  }
  function fallbackCDN() {
    var link = document.getElementById('faCssLink');
    if (link && link.getAttribute('data-fallback-applied') !== '1') {
      link.setAttribute('data-fallback-applied', '1');
      link.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css';
    }
  }
  setTimeout(function() {
    if (!iconsConverted() && !fontLoaded()) {
      fallbackCDN();
      setTimeout(function() {
        if (!iconsConverted() && !fontLoaded()) {
          console.warn('Font Awesome gagal dimuat dari semua sumber. Cek koneksi internet / firewall / ad-blocker.');
        }
      }, 2500);
    }
  }, 2500);
})();

/* BULK PAYMENT + APPROVAL */
(function(){
'use strict';
function rows(){return filteredApprovalData.filter(function(tx){return selectedApprovalIds.has(tx.id)})}
function remainingAmount(tx){return Math.max(0,(Number(tx.nominal)||0)-(Number(tx.nominalDibayar)||0))}
function remainingTotal(list){return list.reduce(function(sum,tx){return sum+remainingAmount(tx)},0)}
function transactionTotal(list){return list.reduce(function(sum,tx){return sum+(Number(tx.nominal)||0)},0)}
function refreshAll(){selectedApprovalIds.clear();loadApprovalData();loadTransactions();loadDashboardData()}

window.openBulkApprovalPin=function(){
  var list=rows();
  if(list.length<2){showToast('warning','Perhatian','Pilih minimal dua transaksi.');return}
  if(currentUser&&currentUser.role==='USER'){
    if(!uploadBuktiModeEnabled){showToast('warning','Tidak Tersedia','Upload bukti mandiri sedang dinonaktifkan.');return}
    currentUserBuktiTxId=null;window.currentUserBuktiTxIds=list.map(function(tx){return tx.id});userBuktiFileData=null;
    var items=list.map(function(tx){return '<div class="info-row"><span>'+esc(tx.kode||tx.item||'-')+'</span><strong>'+formatRupiah(remainingAmount(tx))+'</strong></div>'}).join('');
    $('userBuktiBody').innerHTML='<div class="info-card"><div style="font-weight:700;margin-bottom:8px">'+list.length+' transaksi dalam satu pelunasan</div>'+items+infoRow('Total bukti bersama','<strong style="color:var(--emerald)">'+formatRupiah(remainingTotal(list))+'</strong>')+'</div><p class="form-hint" style="margin:10px 0">Satu file akan disimpan sebagai bukti pada masing-masing transaksi terpilih.</p><div class="form-group"><label class="form-label">Upload bukti pembayaran bersama <span class="req">*</span></label><div class="file-input-wrap"><input type="file" id="userBuktiFile" accept="image/*,.pdf" onchange="handleUserBuktiFile(this)"><div class="file-input-label" id="labelUserBukti"><i class="fas fa-receipt"></i><span>Pilih foto/PDF</span></div></div><div id="userBuktiPreview" style="margin-top:10px"></div></div>';
    openModal('modalUserBukti');return;
  }
  var waitingFlags=list.map(function(tx){return String(tx.metodeTransaksi||'').toUpperCase()==='MENUNGGU_VERIFIKASI'});
  if(waitingFlags.some(Boolean)&&waitingFlags.some(function(value){return !value})){showToast('warning','Pilihan Tidak Seragam','Pilih bersama-sama transaksi yang sudah memiliki bukti user, atau transaksi yang semuanya masih membutuhkan bukti admin.');return}
  bulkApprovalMode=true;window.bulkApprovalIds=list.map(function(tx){return tx.id});window.bulkApprovalNeedsProof=!waitingFlags.every(Boolean);approvalFileData=null;currentApprovalNominal=transactionTotal(list);
  var items=list.map(function(tx){return '<div class="info-row"><span>'+esc(tx.kode||tx.item||'-')+'</span><strong>'+formatRupiah(Number(tx.nominal)||0)+'</strong></div>'}).join('');
  $('approvalBody').innerHTML='<div class="info-card"><div style="font-weight:700;margin-bottom:8px">'+list.length+' transaksi dipilih</div>'+items+infoRow('Total konfirmasi','<strong style="color:var(--emerald)">'+formatRupiah(currentApprovalNominal)+'</strong>')+'</div><p class="form-hint" style="margin:10px 0">Satu bukti dan satu TTD diterapkan ke seluruh transaksi terpilih.</p>'+(window.bulkApprovalNeedsProof?'<div class="form-group"><label class="form-label">Bukti pelunasan bersama <span class="req">*</span></label><input type="file" id="approvalFileInput" class="form-input" accept="image/*,.pdf" onchange="handleApprovalFile(this)"></div>':'<div class="info-card" style="border-color:#a7f3d0;background:#ecfdf5"><i class="fas fa-check-circle"></i> Semua transaksi sudah memiliki bukti user; admin cukup menandatangani satu kali.</div>')+'<div class="form-group"><label class="form-label">Catatan (Opsional)</label><textarea id="approvalCatatan" class="form-input"></textarea></div><div class="form-group"><label class="form-label">TTD Verifikator Bersama <span class="req">*</span></label><div class="canvas-container"><canvas id="approvalTtdCanvas"></canvas></div><div class="canvas-actions"><button type="button" onclick="clearApprovalCanvas()"><i class="fas fa-eraser"></i> Hapus</button></div></div>';
  openModal('modalApproval');setTimeout(initApprovalCanvas,100);
};
openBulkApprovalPin=window.openBulkApprovalPin;

var previousSubmitUserBukti=window.submitUserBukti;
window.submitUserBukti=function(){
  var ids=Array.isArray(window.currentUserBuktiTxIds)?window.currentUserBuktiTxIds:[];
  if(ids.length<2)return previousSubmitUserBukti();
  if(!userBuktiFileData){showToast('error','Validasi','Bukti pembayaran wajib diupload.');return}
  showLoading(true);callApi('submitUserBulkBuktiPembayaran',[{transactionIds:ids,buktiBase64:userBuktiFileData.base64,buktiMimeType:userBuktiFileData.mimeType,buktiFileName:userBuktiFileData.fileName}],function(r){showLoading(false);if(r&&r.success){window.currentUserBuktiTxIds=[];closeModal('modalUserBukti');showToast('success','Bukti Bersama Terkirim',r.message);refreshAll()}else showToast('error','Gagal',r&&r.message||'Bukti gagal disimpan')},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Terjadi kesalahan')});
};
submitUserBukti=window.submitUserBukti;

window.submitBulkApproval=function(){
  var ids=Array.isArray(window.bulkApprovalIds)?window.bulkApprovalIds:[];
  if(ids.length<2)return;
  if(window.bulkApprovalNeedsProof&&!approvalFileData){showToast('error','Validasi','Bukti pelunasan bersama wajib diupload.');return}
  if(!$('approvalTtdCanvas')||isCanvasBlank('approvalTtdCanvas')){showToast('error','Validasi','TTD verifikator wajib diisi.');return}
  var payload={transactionIds:ids,approvedBy:currentUser.namaLengkap||currentUser.username,ttdBase64:$('approvalTtdCanvas').toDataURL('image/png').split(',')[1],catatanApproval:$('approvalCatatan')?$('approvalCatatan').value:''};
  if(approvalFileData){payload.buktiBase64=approvalFileData.base64;payload.buktiMimeType=approvalFileData.mimeType;payload.buktiFileName=approvalFileData.fileName}
  closeModal('modalApproval');showLoading(true);callApi('approveTransactionsBulk',[payload],function(r){showLoading(false);bulkApprovalMode=false;if(r&&r.success){showToast('success','Bulk Approval Selesai',r.message);refreshAll()}else showToast('error','Gagal',r&&r.message||'Bulk approval gagal')},function(e){showLoading(false);bulkApprovalMode=false;showToast('error','Gagal',e&&e.message||'Terjadi kesalahan')});
};
submitBulkApproval=window.submitBulkApproval;

var previousPreSubmit=window.preSubmitApproval;
window.preSubmitApproval=function(){
  if(!bulkApprovalMode)return previousPreSubmit();
  if(window.bulkApprovalNeedsProof&&!approvalFileData){showToast('error','Validasi','Bukti pelunasan bersama wajib diupload.');return}
  if(!$('approvalTtdCanvas')||isCanvasBlank('approvalTtdCanvas')){showToast('error','Validasi','TTD verifikator wajib diisi.');return}
  pendingConfirmNominal=currentApprovalNominal||0;$('nominalConfirmTitle').textContent='Total Bulk Approval';$('nominalConfirmDisplay').textContent=formatRupiah(pendingConfirmNominal);$('nominalConfirmLabel').textContent='Ketik ulang total nominal untuk konfirmasi';$('nominalConfirmInput').value='';$('pinError').style.display='none';openModal('modalPin');
};
preSubmitApproval=window.preSubmitApproval;

var previousSubmitPin=window.submitApprovalWithPin;
window.submitApprovalWithPin=function(){
  if(!bulkApprovalMode)return previousSubmitPin();
  var typed=String($('nominalConfirmInput')?$('nominalConfirmInput').value:'').trim();
  if(!/^\d+$/.test(typed)||parseInt(typed,10)!==Math.round(pendingConfirmNominal)){if($('pinErrorText'))$('pinErrorText').textContent='Nominal konfirmasi tidak cocok.';if($('pinError'))$('pinError').style.display='block';return}
  closeModal('modalPin');window.submitBulkApproval();
};
submitApprovalWithPin=window.submitApprovalWithPin;
window.__bulkOpenApproval=window.openBulkApprovalPin;
window.__bulkSubmitApproval=window.submitBulkApproval;
window.__bulkSubmitUserProof=window.submitUserBukti;
window.__bulkPreSubmitApproval=window.preSubmitApproval;
window.__bulkSubmitApprovalPin=window.submitApprovalWithPin;
})();

/* ===== INLINE MODULE 2 ===== */
// ============================================================
// ============================================================
// 0. API HELPER — langsung ke Supabase Edge Function
// ============================================================
var API_BASE_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';
var API_ROUTES = {
  'transaction-action': {
    addTransaction:1, editTransaction:1, sendCatatanApproval:1, getTransactionSuggestions:1,
    getTransactionSummary:1, uploadTxFile:1, deleteTransaction:1
  },
  'chattrx-message-action': { sendChatTrxMessage:1 },
  'chattrx-suggest-action': { getChatTrxSuggestions:1 },
  'chattrx-confirm-action': { confirmChatTrx:1 },
  'chattrx-records-action': { listMyTrx:1, updateMyTrx:1, deleteMyTrx:1 },
  'approval-payment-action': {
    getTransactions:1, getTransactionDetail:1, approveTransaction:1,
    submitUserBuktiPembayaran:1, submitUserBulkBuktiPembayaran:1,
    verifyUserPayment:1, approveTransactionsBulk:1
  },
  'operations-action': {
    getAllUsers:1, updatePresence:1, deleteUser:1, getUploadBuktiMode:1,
    getTransactionEditMode:1,
    addPendingPayment:1, addSurveiBahanBaku:1, addSerahTerima:1, addMenuHarian:1,
    getAdminAssignments:1, addAdminAssignment:1, updateAdminAssignment:1, deleteAdminAssignment:1,
    getPendingPayments:1, updatePendingPayment:1, deletePendingPayment:1,
    getSurveiBahanBaku:1, updateSurvei:1, deleteSurvei:1,
    getSerahTerima:1, updateSerahTerima:1, deleteSerahTerima:1,
    getMenuHarian:1, updateMenuMBG:1, deleteMenuMBG:1
  },
  'reporting-action': {
    getDashboardKPI:1, getChartData:1, getSPPGData:1, getRekapHarian:1,
    getFilterOptions:1, getAuditLog:1, getNotifications:1,
    markNotificationRead:1, markAllNotificationsRead:1
  },
  'master-action': {
    getMasterBahanBaku:1, addMasterBahanBaku:1, updateMasterBahanBaku:1, deleteMasterBahanBaku:1,
    getMasterSupplier:1, addMasterSupplier:1, updateMasterSupplier:1, deleteSupplier:1,
    uploadSupplierFile:1, uploadFotoSurvei:1, uploadSerahTerimaFile:1
  },
  'file-access-action': { getFileUrl:1, showCredentials:1 },
  'secure-user-action': { updateUserProfile:1, uploadFotoProfil:1 },
  'push-action': { savePushSubscription:1, deletePushSubscription:1 },
  'push-public-action': { getPushPublicKey:1 },
  'geocode-action': { geocodeAlamat:1 },
  'register-user-v2': { createUserBySuperAdmin:1 },
  'auth-public-action': { loginUser:1, refreshSession:1, checkSession:1 },
  'account-recovery-action': { recoverPassword:1, recoverUsername:1, recoverToken:1 },
  'app-config-action': { getAppConfig:1, getDropdownOptions:1 },
  'notification-dispatch-action': { dispatchNotification:1 },
  'settings-action': {
    getMyMenuVisibility:1, getMyAnnouncements:1, getSettingsHub:1,
    updateFeatureSettings:1, updateMenuVisibility:1,
    createAnnouncement:1, setAnnouncementActive:1
  }
};
var PUBLIC_FN = {
  loginUser:1, refreshSession:1, checkSession:1, recoverPassword:1, recoverUsername:1,
  recoverToken:1, getAppConfig:1, getDropdownOptions:1, getPushPublicKey:1
};
var API_ROUTE_BY_FUNCTION = {};
Object.keys(API_ROUTES).forEach(function(slug) {
  Object.keys(API_ROUTES[slug]).forEach(function(fn) { API_ROUTE_BY_FUNCTION[fn] = slug; });
});

// Publishable/anon key only; never place service-role credentials in the browser.
window._supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanNndGljaHJmeGh5eXdzdHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MTU2MTUsImV4cCI6MjA5ODM5MTYxNX0.D_ZJ286uSpLeZEsg_vSf3iEoG-SnokHV62X6hPXreHM';

function getJwtToken() {
  try { return localStorage.getItem('sppg_jwt') || ''; } catch(e) { return ''; }
}

// Short-lived, memory-only cache for idempotent reads. It is scoped by the
// current token and cleared after mutations, reducing duplicate Edge Function
// responses without persisting authenticated payloads in browser storage.
var API_READ_CACHE_TTL = {
  getAppConfig:300000, getDropdownOptions:300000,
  getMasterBahanBaku:30000, getMasterSupplier:30000,
  getTransactions:10000, getAllUsers:15000,
  getPendingPayments:15000, getSurveiBahanBaku:15000,
  getSerahTerima:15000, getMenuHarian:15000,
  getDashboardKPI:15000, getChartData:15000, getSPPGData:15000,
  getRekapHarian:15000, getFilterOptions:30000, getAuditLog:10000,
  getNotifications:5000, getUploadBuktiMode:30000,
  getTransactionEditMode:30000, getMyMenuVisibility:30000,
  getMyAnnouncements:30000, getSettingsHub:15000, listMyTrx:10000
};
// Only successful writes invalidate cached reads. Read endpoints that are not
// cached (for example getTransactionDetail/getFileUrl) must not evict list and
// dashboard entries, otherwise opening a modal causes avoidable Supabase fetches.
var API_MUTATION_FUNCTIONS = {
  addTransaction:1, editTransaction:1, sendCatatanApproval:1, uploadTxFile:1, deleteTransaction:1,
  approveTransaction:1, submitUserBuktiPembayaran:1, submitUserBulkBuktiPembayaran:1,
  verifyUserPayment:1, approveTransactionsBulk:1,
  deleteUser:1, addPendingPayment:1, addSurveiBahanBaku:1, addSerahTerima:1, addMenuHarian:1,
  addAdminAssignment:1, updateAdminAssignment:1, deleteAdminAssignment:1,
  updatePendingPayment:1, deletePendingPayment:1, updateSurvei:1, deleteSurvei:1,
  updateSerahTerima:1, deleteSerahTerima:1, updateMenuMBG:1, deleteMenuMBG:1,
  addMasterBahanBaku:1, updateMasterBahanBaku:1, deleteMasterBahanBaku:1,
  addMasterSupplier:1, updateMasterSupplier:1, deleteSupplier:1,
  uploadSupplierFile:1, uploadFotoSurvei:1, uploadSerahTerimaFile:1,
  markNotificationRead:1, markAllNotificationsRead:1,
  updateUserProfile:1, uploadFotoProfil:1,
  savePushSubscription:1, deletePushSubscription:1,
  createUserBySuperAdmin:1,
  recoverPassword:1, updateFeatureSettings:1, updateMenuVisibility:1,
  createAnnouncement:1, setAnnouncementActive:1, dispatchNotification:1,
  confirmChatTrx:1, updateMyTrx:1, deleteMyTrx:1
};
var apiReadCache = Object.create(null);

function apiReadCacheKey(fnName, params, token) {
  // A short token suffix separates sessions without retaining the full JWT.
  var scope = token ? token.slice(-24) : 'public';
  return scope + '|' + fnName + '|' + JSON.stringify(Array.isArray(params) ? params : []);
}

function clearApiReadCache() {
  apiReadCache = Object.create(null);
}
window.clearApiReadCache = clearApiReadCache;

function callApi(fnName, params, onSuccess, onFailure) {
  var slug = API_ROUTE_BY_FUNCTION[fnName];
  if (!slug) {
    var unknown = new Error('Fungsi API tidak terdaftar: ' + String(fnName || ''));
    if (onFailure) onFailure(unknown); else console.error(unknown.message);
    return;
  }

  var headers = { 'Content-Type': 'application/json' };
  var token = getJwtToken();
  var authorizationToken = token || window._supabaseKey || '';
  if (authorizationToken) headers.Authorization = 'Bearer ' + authorizationToken;
  if (window._supabaseKey) headers.apikey = window._supabaseKey;

  var cacheTtl = Number(API_READ_CACHE_TTL[fnName]) || 0;
  var cacheKey = cacheTtl ? apiReadCacheKey(fnName, params, token) : '';
  var cached = cacheKey && apiReadCache[cacheKey];
  if (cached && cached.expiresAt > Date.now()) {
    // Clone cached JSON so table renderers can safely mutate their local copy.
    var cachedResult = JSON.parse(cached.json);
    setTimeout(function() { if (onSuccess) onSuccess(cachedResult); }, 0);
    return;
  }
  if (cached) delete apiReadCache[cacheKey];

  var requestUrl = API_BASE_URL + slug;
  var TIMEOUT_MS = 20000;
  var MAX_RETRY = 2;

  function doFetch(attempt) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tid = controller ? setTimeout(function(){ controller.abort(); }, TIMEOUT_MS) : null;
    fetch(requestUrl, {
      method: 'POST', headers: headers,
      body: JSON.stringify({ function: fnName, parameters: Array.isArray(params) ? params : [] }),
      signal: controller ? controller.signal : undefined
    }).then(function(res) {
      if (tid) clearTimeout(tid);
      return res.text().then(function(text) {
        var json = {};
        try { json = text ? JSON.parse(text) : {}; }
        catch(e) { throw new Error('Respons server tidak valid (HTTP ' + res.status + ').'); }
        if (!res.ok || json.error) throw new Error(json.error || ('Server error (HTTP ' + res.status + ')'));
        return Object.prototype.hasOwnProperty.call(json, 'result') ? json.result : json;
      });
    }).then(function(result) {
      if (fnName === 'loginUser' && result && result.success && result.token) {
        clearApiReadCache();
        try { localStorage.setItem('sppg_jwt', result.token); } catch(e) {}
        window._supabaseToken = result.token;
      }
      if (cacheKey) {
        try { apiReadCache[cacheKey] = { json: JSON.stringify(result), expiresAt: Date.now() + cacheTtl }; }
        catch(e) { /* A non-serializable response simply bypasses the cache. */ }
      } else if (API_MUTATION_FUNCTIONS[fnName]) {
        // Mutations may change any paged/read model; invalidate before refresh.
        clearApiReadCache();
      }
      if (onSuccess) onSuccess(result);
      schedulePagedMutationRefresh(fnName, result);
    }).catch(function(err) {
      if (tid) clearTimeout(tid);
      var isNet = err && (err.name === 'AbortError' || err.name === 'TypeError');
      if (isNet && attempt < MAX_RETRY) {
        setTimeout(function(){ doFetch(attempt + 1); }, 800 * (attempt + 1));
        return;
      }
      if (err && err.name === 'AbortError') err = new Error('Koneksi ke server timeout, silakan coba lagi.');
      if (onFailure) onFailure(err); else console.error('callApi fetch failed (' + fnName + '):', err);
    });
  }
  doFetch(0);
}

// ============================================================
// 1. STATE MANAGEMENT
// ============================================================
var SESSION_DURATION = 60 * 60 * 1000; // 1 jam tanpa aktivitas
var ITEMS_PER_PAGE = 15;
var CFG_SPPG_FALLBACK = ['DARMARAJA','CIAMIS','TANJUNG MEDAR','PAKUALAM','KIRISIK','CIBUNAR','CINTA JAYA'];

var currentUser = null;
var sessionExpiry = 0;
var currentPage = 'dashboard';
var sidebarCollapsed = false;
var presenceHeartbeatTimer = null;

// Data stores
var allTransactions = [];
var filteredTransactions = [];
var allUsers = [];
var filteredUsers = [];
var allMasterBB = [];
var filteredMasterBB = [];
var allSuppliers = [];
var filteredSuppliers = [];
var allSurvei = [];
var filteredSurvei = [];
var allSerahTerima = [];
var filteredSerahTerima = [];
var allMenuMBG = [];
var allPending = [];
var dropdownOptions = {};
var transactionSuggestionHistory = {
  loaded: false,
  loading: false,
  jenisKategori: [],
  items: [],
  catatan: []
};

// Pagination state
var txPage = 1, usersPage = 1, bbPage = 1, supplierPage = 1;
var txServerTotal = 0, txServerPaged = false, txFilterTimer = null, txKpiRequestId = 0;
var usersServerTotal = 0, usersServerPaged = false, usersFilterTimer = null;
var bbServerTotal = 0, bbServerPaged = false, bbFilterTimer = null;
var supplierServerTotal = 0, supplierServerPaged = false, supplierFilterTimer = null;
var surveiPage = 1, stPage = 1, menuMBGPage = 1, pendingPage = 1;
var surveiServerTotal = 0, surveiServerPaged = false, surveiFilterTimer = null;
var stServerTotal = 0, stServerPaged = false, stFilterTimer = null;
var pendingServerTotal = 0, pendingServerPaged = false;
var auditServerTotal = 0, auditServerPaged = false, auditFilterTimer = null;
var menuServerTotal = 0, menuServerPaged = false;
var approvalPage = 1;
var approvalServerTotal = 0;
var approvalServerNominal = 0;
var approvalServerPaged = false;
var approvalFilterTimer = null;
var approvalFilterOptions = { sppg: [], jenisKategori: [], supplier: [] };
var approvalSupplierGroups = [];
var filteredApprovalData = [];
var selectedApprovalIds = new Set();
var approvalLoadState = {
  inFlight: false,
  queued: false,
  queuedPage: 1,
  requestId: 0,
  watchdog: null,
  hasLoaded: false
};
var approvalModeLoaded = false;
var bulkApprovalMode = false;
var verifikasiPembayaranMode = false;
var uploadBuktiModeEnabled = false;
var transactionEditModeEnabled = false;
var featureModeRequestId = 0;
var currentUserBuktiTxId = null;
var userBuktiFileData = null;
var currentVerifikasiTxId = null;
var currentVerifikasiNominal = 0;
var verifCatatanTemp = '';
var verifTtdBase64Temp = '';

// Modal / form state
var currentApprovalNominal = 0;
var currentEditRow = null;
var currentDetailUserRow = null;
var currentApprovalDetailId = null;
var approvalFileData = null;
var chartInstance = null;
var menuItems = [];

// Notifikasi lonceng
var notifList = [];
var notifPollTimer = null;
var notifPage = 1, notifPageSize = 15, notifServerTotal = 0, notifServerPaged = false, notifHasMore = false;
var notifLoadingMore = false;
var menuVisibilityByRole = {};
var settingsHubState = {
  loaded: false,
  features: { allowUserEditTransaction: false, allowUserUploadBukti: false },
  menuVisibility: { SUPER_ADMIN: [], ADMIN: [], USER: [] },
  announcements: [],
  selectedMenuRole: 'SUPER_ADMIN',
  layoutReady: false
};


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

// ============================================================
// 2. UTILITY FUNCTIONS
// ============================================================
function $(id) { return document.getElementById(id); }
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatRupiah(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(Number(n)).toLocaleString('id-ID');
}
function formatDate(d) {
  if (!d) return '-';
  var date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return String(date.getDate()).padStart(2,'0') + '/' + String(date.getMonth()+1).padStart(2,'0') + '/' + date.getFullYear();
}
function formatDateInput(d) {
  var date = d ? new Date(d) : new Date();
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}
function showLoading(show) {
  var el = $('loadingOverlay');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}
function safeStorage(action, key, value) {
  try {
    if (action === 'set') { localStorage.setItem(key, value); return true; }
    if (action === 'get') { return localStorage.getItem(key); }
    if (action === 'remove') { localStorage.removeItem(key); return true; }
  } catch(e) { return action === 'get' ? null : false; }
}

function updateFileLabel(input, labelId) {
  var label = $(labelId);
  if (!label) return;
  if (input.files && input.files[0]) {
    label.innerHTML = '<i class="fas fa-check-circle" style="color:var(--emerald);"></i><span>' + input.files[0].name + '</span>';
  }
}

/* ===== Format Nominal Rupiah Real-time ===== */
function handleNominalInput(input) {
  // Hapus semua karakter bukan digit
  var raw = input.value.replace(/[^0-9]/g, '');
  input.setAttribute('data-raw', raw || '0');
  // Tampilkan dengan titik pemisah ribuan saat mengetik
  if (raw) {
    input.value = Number(raw).toLocaleString('id-ID');
  } else {
    input.value = '';
  }
  // Update konfirmasi
  var confirm = $('addTxNominalConfirm');
  if (confirm) {
    var num = parseInt(raw) || 0;
    confirm.textContent = num > 0 ? 'Nominal: Rp ' + num.toLocaleString('id-ID') : '';
  }
}

function formatNominalOnBlur(input) {
  var raw = input.getAttribute('data-raw') || '0';
  var num = parseInt(raw) || 0;
  if (num > 0) {
    input.value = 'Rp ' + num.toLocaleString('id-ID');
  } else {
    input.value = '';
  }
  var confirm = $('addTxNominalConfirm');
  if (confirm) confirm.textContent = num > 0 ? 'Nominal: Rp ' + num.toLocaleString('id-ID') : '';
}

function getNominalRaw() {
  var input = $('addTxNominal');
  if (!input) return 0;
  var raw = input.getAttribute('data-raw') || '0';
  return parseInt(raw.replace(/[^0-9]/g, '')) || 0;
}

/* ===== Autocomplete transaksi: realtime + keyboard ===== */
function normalizeAutocompleteKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function uniqueAutocompleteValues(groups) {
  var seen = {};
  var values = [];
  (groups || []).forEach(function(group) {
    (group || []).forEach(function(value) {
      var clean = String(value || '').trim();
      var key = normalizeAutocompleteKey(clean);
      if (!clean || clean === '-' || seen[key]) return;
      seen[key] = true;
      values.push(clean);
    });
  });
  return values;
}

function filterAutocompleteValues(values, query, limit) {
  var needle = normalizeAutocompleteKey(query);
  if (!needle) return [];
  return values
    .map(function(value, index) {
      var normalized = normalizeAutocompleteKey(value);
      return { value: value, index: index, starts: normalized.indexOf(needle) === 0, matches: normalized.indexOf(needle) > -1 };
    })
    .filter(function(entry) { return entry.matches; })
    .sort(function(a, b) {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(function(entry) { return entry.value; });
}

function encodedAutocompleteValue(value) {
  try { return encodeURIComponent(String(value || '')); }
  catch (error) { return ''; }
}

function transactionAutocompleteItem(kind, value, labelHtml, extraStyle) {
  return '<div class="autocomplete-item" role="option" aria-selected="false" tabindex="-1" ' +
    'data-autocomplete-kind="' + esc(kind) + '" data-value="' + esc(encodedAutocompleteValue(value)) + '"' +
    (extraStyle ? ' style="' + esc(extraStyle) + '"' : '') +
    ' onclick="selectTransactionAutocomplete(this)">' + labelHtml + '</div>';
}

function setTransactionAutocompleteOpen(dropdown, input, open) {
  if (!dropdown) return;
  dropdown.classList.toggle('active', !!open);
  dropdown.querySelectorAll('.autocomplete-item.keyboard-active').forEach(function(item) {
    item.classList.remove('keyboard-active');
    item.setAttribute('aria-selected', 'false');
  });
  if (input) input.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeTransactionAutocomplete(dropdownId, inputId) {
  setTransactionAutocompleteOpen($(dropdownId), $(inputId), false);
}

function selectTransactionAutocomplete(element) {
  if (!element) return;
  var kind = element.getAttribute('data-autocomplete-kind') || '';
  var encoded = element.getAttribute('data-value') || '';
  var value = '';
  try { value = decodeURIComponent(encoded); } catch (error) { value = encoded; }
  if (kind === 'jenisKategori') selectJenisKat(value);
  else if (kind === 'item') selectItem(value);
  else if (kind === 'catatan') selectCatatan(value);
}

function handleTransactionAutocompleteKeydown(event, dropdownId) {
  var dropdown = $(dropdownId);
  if (!dropdown) return;
  var isOpen = dropdown.classList.contains('active');
  var items = Array.prototype.slice.call(dropdown.querySelectorAll('.autocomplete-item'));
  if (event.key === 'Escape' && isOpen) {
    event.preventDefault();
    event.stopPropagation();
    setTransactionAutocompleteOpen(dropdown, event.currentTarget, false);
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
  if (!isOpen || !items.length) return;
  var activeIndex = items.findIndex(function(item) { return item.classList.contains('keyboard-active'); });
  if (event.key === 'Enter') {
    if (activeIndex < 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectTransactionAutocomplete(items[activeIndex]);
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  activeIndex = event.key === 'ArrowDown'
    ? (activeIndex + 1) % items.length
    : (activeIndex <= 0 ? items.length - 1 : activeIndex - 1);
  items.forEach(function(item, index) {
    var active = index === activeIndex;
    item.classList.toggle('keyboard-active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  items[activeIndex].scrollIntoView({ block: 'nearest' });
}

function refreshActiveTransactionAutocomplete() {
  var active = document.activeElement;
  if (!active) return;
  if (active.id === 'addTxJenisKat') handleJenisKatAutocomplete(active);
  else if (active.id === 'addTxItem') handleItemAutocomplete(active);
  else if (active.id === 'addTxCatatan') handleCatatanAutocomplete(active);
}

function loadTransactionSuggestions(force) {
  if (transactionSuggestionHistory.loading) return;
  if (transactionSuggestionHistory.loaded && !force) return;
  transactionSuggestionHistory.loading = true;
  callApi('getTransactionSuggestions', [], function(result) {
    transactionSuggestionHistory.loading = false;
    if (!result || result.success === false) return;
    transactionSuggestionHistory.loaded = true;
    transactionSuggestionHistory.jenisKategori = Array.isArray(result.jenisKategori) ? result.jenisKategori : [];
    transactionSuggestionHistory.items = Array.isArray(result.items) ? result.items : [];
    transactionSuggestionHistory.catatan = Array.isArray(result.catatan) ? result.catatan : [];
    refreshActiveTransactionAutocomplete();
  }, function() {
    transactionSuggestionHistory.loading = false;
  });
}

function rememberTransactionSuggestions(data) {
  function remember(key, value) {
    var clean = String(value || '').trim();
    if (!clean) return;
    var list = transactionSuggestionHistory[key] || [];
    var normalized = normalizeAutocompleteKey(clean);
    transactionSuggestionHistory[key] = [clean].concat(list.filter(function(item) {
      return normalizeAutocompleteKey(item) !== normalized;
    }));
  }
  remember('jenisKategori', data.jenisKategori);
  remember('items', data.namaItem || data.item);
  remember('catatan', data.catatan);
}

/* ===== Autocomplete Jenis Kategori ===== */
function handleJenisKatAutocomplete(input) {
  var dropdown = $('jenisKatDropdown');
  var val = input.value.trim().toLowerCase();
  var defaults = ['Operasional', 'Belanja Bahan Baku', 'Transportasi', 'Gaji', 'Utilitas', 'Lain-lain', 'Anggaran MBG', 'Dana Pemerintah'];
  var pageHistory = allTransactions.map(function(t) { return t.jenisKategori; });
  var sources = uniqueAutocompleteValues([
    transactionSuggestionHistory.jenisKategori,
    dropdownOptions.txJenisKategori || [],
    pageHistory,
    defaults
  ]);
  if (!val) { setTransactionAutocompleteOpen(dropdown, input, false); return; }
  var matches = filterAutocompleteValues(sources, val, 8);
  if (!matches.length) { setTransactionAutocompleteOpen(dropdown, input, false); return; }
  var html = '';
  matches.forEach(function(m) {
    html += transactionAutocompleteItem('jenisKategori', m, esc(m));
  });
  dropdown.innerHTML = html;
  setTransactionAutocompleteOpen(dropdown, input, true);
}

function selectJenisKat(val) {
  $('addTxJenisKat').value = val;
  closeTransactionAutocomplete('jenisKatDropdown', 'addTxJenisKat');
  // Setelah pilih jenis kategori, update hint di field Nama Item
  updateItemFieldHint();
}

// Update hint dan placeholder field Nama Item sesuai Jenis Kategori
function updateItemFieldHint() {
  var jenisKat = $('addTxJenisKat') ? $('addTxJenisKat').value.trim().toUpperCase() : '';
  var itemInput = $('addTxItem');
  var itemHint  = $('addTxItemHint');
  if (!itemInput) return;

  if (jenisKat === 'BELANJA BAHAN BAKU') {
    itemInput.placeholder = 'Ketik untuk cari, atau klik untuk tampilkan semua bahan baku...';
    if (itemHint) {
      itemHint.innerHTML = '<i class="fas fa-info-circle" style="color:var(--primary);margin-right:4px;"></i>' +
                           'Pilih dari <strong>Master Bahan Baku</strong> — format: Nama - Kode';
    }
    // Kosongkan dan langsung tampilkan dropdown
    itemInput.value = '';
    handleItemAutocomplete(itemInput);
  } else {
    itemInput.placeholder = 'Ketik nama item atau bahan baku...';
    if (itemHint) itemHint.innerHTML = '';
    closeTransactionAutocomplete('itemDropdown', 'addTxItem');
  }
}

/* ===== Autocomplete Nama Item — conditional ref ke Master BB ===== */
function handleItemAutocomplete(input) {
  var dropdown = $('itemDropdown');
  var val = input.value.trim().toLowerCase();
  var jenisKat = $('addTxJenisKat') ? $('addTxJenisKat').value.trim().toUpperCase() : '';
  var isBelanjaBB = (jenisKat === 'BELANJA BAHAN BAKU');
  var selectedSupplier = findTransactionSupplier($('addTxSupplier') ? $('addTxSupplier').value : '');
  var supplierItems = selectedSupplier && Array.isArray(selectedSupplier.items) ? selectedSupplier.items : [];

  // Tampilkan dropdown bahkan saat val kosong jika BELANJA BAHAN BAKU (langsung tampil saat fokus)
  if (!val && !isBelanjaBB) { setTransactionAutocompleteOpen(dropdown, input, false); return; }

  var html = '';

  if (isBelanjaBB) {
    // Mode: ref ke Master Bahan Baku — format "Nama - KodeBahan"
    var bb = dropdownOptions.bahanBaku || [];
    if (supplierItems.length) {
      var supplierItemLookup = supplierItems.map(function(item) { return String(item).trim().toLowerCase(); });
      bb = bb.filter(function(b) {
        var name = String(b.nama || '').trim().toLowerCase();
        return supplierItemLookup.some(function(item) {
          return name === item || name.indexOf(item) > -1 || item.indexOf(name) > -1;
        });
      });
    }
    var matches = val
      ? bb.filter(function(b) {
          var haystack = ((b.nama || '') + ' ' + (b.kode || '') + ' ' + (b.kategori || '')).toLowerCase();
          return haystack.indexOf(val) > -1;
        })
      : bb; // tampilkan semua jika val kosong

    // Tidak dibatasi saat val kosong, dibatasi 50 saat ada pencarian
    if (val) matches = matches.slice(0, 50);

    if (!matches.length) {
      dropdown.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--slate-400);text-align:center;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Data bahan baku belum dimuat. Coba refresh halaman.</div>';
      setTransactionAutocompleteOpen(dropdown, input, true);
      return;
    }

    // Header penanda mode — tampilkan jumlah total
    html += '<div style="padding:6px 14px;font-size:10px;font-weight:700;color:var(--primary);' +
            'background:var(--primary-light);border-bottom:1px solid var(--slate-200);' +
            'display:flex;justify-content:space-between;align-items:center;">' +
            '<span><i class="fas fa-boxes" style="margin-right:4px;"></i>MASTER BAHAN BAKU</span>' +
            '<span style="font-weight:500;color:var(--slate-500);">' + matches.length + ' dari ' + bb.length + ' item</span>' +
            '</div>';

    matches.forEach(function(b) {
      var label = esc(b.nama) + ' <span style="color:var(--slate-400);font-size:11px;">— ' + esc(b.kode) + '</span>';
      var labelKat = b.kategori
        ? '<span style="float:right;font-size:10px;color:var(--slate-400);">' + esc(b.kategori) + '</span>'
        : '';
      // data-value menyimpan format final: "Nama - Kode"
      var dataVal = b.nama + ' - ' + b.kode;
      html += transactionAutocompleteItem(
        'item',
        dataVal,
        '<span>' + label + '</span>' + labelKat,
        'display:flex;justify-content:space-between;align-items:center;'
      );
    });

  } else {
    // Mode: enum bebas dari histori transaksi + saran umum
    if (!val) { setTransactionAutocompleteOpen(dropdown, input, false); return; }
    var pageItems = allTransactions.map(function(t) { return t.item || t.namaItem; });
    var masterItems = (dropdownOptions.bahanBaku || []).map(function(b) { return b.nama; });
    var sources = uniqueAutocompleteValues([
      transactionSuggestionHistory.items,
      supplierItems,
      pageItems,
      masterItems
    ]);
    var matches = filterAutocompleteValues(sources, val, 10);
    if (!matches.length) { setTransactionAutocompleteOpen(dropdown, input, false); return; }

    matches.forEach(function(m) {
      html += transactionAutocompleteItem('item', m, esc(m));
    });
  }

  dropdown.innerHTML = html;
  setTransactionAutocompleteOpen(dropdown, input, true);
}

function selectItem(val) {
  $('addTxItem').value = val;
  closeTransactionAutocomplete('itemDropdown', 'addTxItem');
}

// Trigger autocomplete saat field item difokus (untuk mode BELANJA BAHAN BAKU langsung tampil list)
function onItemFocus() {
  var jenisKat = $('addTxJenisKat') ? $('addTxJenisKat').value.trim().toUpperCase() : '';
  if (jenisKat === 'BELANJA BAHAN BAKU') {
    handleItemAutocomplete($('addTxItem'));
  }
}

function handleCatatanAutocomplete(input) {
  var dropdown = $('catatanDropdown');
  if (!dropdown) return;
  var val = input.value.trim().toLowerCase();
  if (!val) { setTransactionAutocompleteOpen(dropdown, input, false); return; }
  var pageNotes = allTransactions.map(function(t) { return t.catatan; });
  var sources = uniqueAutocompleteValues([transactionSuggestionHistory.catatan, pageNotes]);
  var matches = filterAutocompleteValues(sources, val, 8);
  if (!matches.length) { setTransactionAutocompleteOpen(dropdown, input, false); return; }
  var html = '';
  matches.forEach(function(m) {
    html += transactionAutocompleteItem('catatan', m, esc(m));
  });
  dropdown.innerHTML = html;
  setTransactionAutocompleteOpen(dropdown, input, true);
}

function selectCatatan(val) {
  var el = $('addTxCatatan');
  if (el) el.value = val;
  closeTransactionAutocomplete('catatanDropdown', 'addTxCatatan');
}

/* ===== Konfirmasi nominal live ===== */
function updateNominalConfirm(input, confirmId) {
  var val = parseFloat(input.value) || 0;
  var el = $(confirmId);
  if (el) el.textContent = val > 0 ? 'Konfirmasi: ' + formatRupiah(val) : '';
}

/* ===== SISTEM TTD CANVAS TERPUSAT (Responsif: PC, Tablet, HP) ===== */

var _ttdInstances = {}; // menyimpan state setiap canvas

/**
 * Inisialisasi canvas TTD manapun secara responsif.
 * @param {string} canvasId - ID elemen canvas
 * @param {number} lineWidth - ketebalan garis (default 2)
 */
function initTtdCanvas(canvasId, lineWidth) {
  var canvas = $(canvasId);
  if (!canvas) return;
  lineWidth = lineWidth || 2;

  // Setiap canvas punya state sendiri
  _ttdInstances[canvasId] = { drawing: false, ctx: null, lastX: 0, lastY: 0 };
  var state = _ttdInstances[canvasId];

  // Sesuaikan ukuran canvas ke wrapper agar tidak blur / meleset
  function resizeCanvas() {
    var wrap = canvas.parentElement;
    if (!wrap) return;
    var w = wrap.clientWidth || 300;
    var h = parseInt(window.getComputedStyle(canvas).height) || 160;
    // Simpan gambar yang sudah ada sebelum resize
    var tempImg = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { tempImg = canvas.toDataURL(); } catch(e) {}
    }
    canvas.width  = w;
    canvas.height = h;
    // Setup context ulang
    var ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    state.ctx = ctx;
    // Kembalikan gambar jika ada
    if (tempImg) {
      var img = new Image();
      img.onload = function() { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
      img.src = tempImg;
    }
  }

  resizeCanvas();

  // Re-resize jika ukuran berubah (orientasi HP berputar, dll)
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function() { resizeCanvas(); });
    ro.observe(canvas.parentElement || canvas);
    canvas._ttdResizeObserver = ro;
  } else {
    window.addEventListener('resize', resizeCanvas);
  }

  /**
   * Hitung posisi pointer/jari relatif terhadap canvas,
   * memperhitungkan skala CSS (canvas.width vs getBoundingClientRect).
   */
  function getPos(e) {
    var r   = canvas.getBoundingClientRect();
    var scX = canvas.width  / r.width;
    var scY = canvas.height / r.height;
    var clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - r.left) * scX,
      y: (clientY - r.top)  * scY
    };
  }

  function onStart(e) {
    e.preventDefault();
    e.stopPropagation();
    state.drawing = true;
    var p = getPos(e);
    state.lastX = p.x;
    state.lastY = p.y;
    var ctx = state.ctx;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // Buat titik kecil jika hanya klik/tap tanpa gerak
    ctx.arc(p.x, p.y, ctx.lineWidth / 4, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e) {
    if (!state.drawing) return;
    e.preventDefault();
    e.stopPropagation();
    var p   = getPos(e);
    var ctx = state.ctx;
    if (!ctx) return;
    // Gunakan quadratic curve untuk garis lebih halus
    var midX = (state.lastX + p.x) / 2;
    var midY = (state.lastY + p.y) / 2;
    ctx.quadraticCurveTo(state.lastX, state.lastY, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    state.lastX = p.x;
    state.lastY = p.y;
  }

  function onEnd(e) {
    if (!state.drawing) return;
    e.preventDefault();
    state.drawing = false;
    var ctx = state.ctx;
    if (!ctx) return;
    ctx.stroke();
    ctx.beginPath();
  }

  // Hapus event lama jika ada (mencegah duplikasi saat modal dibuka ulang)
  canvas.removeEventListener('mousedown',  canvas._ttdStart);
  canvas.removeEventListener('mousemove',  canvas._ttdMove);
  canvas.removeEventListener('mouseup',    canvas._ttdEnd);
  canvas.removeEventListener('mouseleave', canvas._ttdEnd);
  canvas.removeEventListener('touchstart', canvas._ttdStart);
  canvas.removeEventListener('touchmove',  canvas._ttdMove);
  canvas.removeEventListener('touchend',   canvas._ttdEnd);

  // Simpan referensi handler agar bisa dihapus nanti
  canvas._ttdStart = onStart;
  canvas._ttdMove  = onMove;
  canvas._ttdEnd   = onEnd;

  // Daftarkan event
  canvas.addEventListener('mousedown',  onStart, { passive: false });
  canvas.addEventListener('mousemove',  onMove,  { passive: false });
  canvas.addEventListener('mouseup',    onEnd,   { passive: false });
  canvas.addEventListener('mouseleave', onEnd,   { passive: false });
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onEnd,   { passive: false });
}

/**
 * Bersihkan canvas TTD manapun.
 * @param {string} canvasId
 */
function clearTtdCanvas(canvasId) {
  var canvas = $(canvasId);
  if (!canvas) return;
  var state = _ttdInstances[canvasId];
  var ctx   = state ? state.ctx : canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Cek apakah canvas TTD kosong (belum ditandatangani).
 * @param {HTMLCanvasElement|string} canvasOrId
 * @returns {boolean}
 */
function isCanvasBlank(canvasOrId) {
  var canvas = (typeof canvasOrId === 'string') ? $(canvasOrId) : canvasOrId;
  if (!canvas) return true;
  try {
    var buf = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buf.some(function(c) { return c !== 0; });
  } catch(e) { return true; }
}

/* ── Alias tipis agar semua onclick="..." lama di HTML tetap berfungsi ──
   Semua fungsi di bawah hanya memanggil initTtdCanvas()/clearTtdCanvas() generik. */
var initAddTxTtd      = function() { initTtdCanvas('addTxTtdCanvas'); };
var clearAddTxTtd      = function() { clearTtdCanvas('addTxTtdCanvas'); };
var initApprovalCanvas = function() { initTtdCanvas('approvalTtdCanvas'); };
var clearApprovalCanvas = function() { clearTtdCanvas('approvalTtdCanvas'); };
var initSupTtdCanvas  = function() { initTtdCanvas('supTtdCanvas'); };
var initStTtdCanvas   = function() { initTtdCanvas('stTtdPenerimaCanvas'); initTtdCanvas('stTtdSupplierCanvas'); };
function clearStTtd(id) { clearTtdCanvas(id); }


// ============================================================
// 3. TOAST NOTIFICATIONS
// ============================================================
function showToast(type, title, message) {
  var container = $('toastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
  toast.innerHTML =
    '<div class="toast-icon"><i class="fas ' + icon + '"></i></div>' +
    '<div class="toast-content"><h4>' + esc(title) + '</h4><p>' + esc(message) + '</p></div>';
  container.appendChild(toast);
  requestAnimationFrame(function() { toast.classList.add('show'); });
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  }, 4000);
}

// ============================================================
// 4. AUTHENTICATION
// ============================================================
function setAuthMode() {
  var login = $('loginForm');
  if (login) login.classList.remove('hidden');
  var overlay = $('authOverlay');
  if (overlay) overlay.dataset.authMode = 'login';
  if (typeof updateAuthHeading === 'function') updateAuthHeading();
}

function showLogin() {
  setAuthMode('login');
  $('loginError').classList.remove('show');
  $('recoveryLinks').classList.remove('show');

  window.requestAnimationFrame(function() {
    var emailInput = $('loginUsername');
    if (emailInput) emailInput.focus();
  });
}

function togglePw(fieldId, btn) {
  var input = $(fieldId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fas fa-eye"></i>';
  }
}
function previewEditFoto(input) {
  var file = input.files[0];
  if (!file) return;
  var label = $('editFotoLabel');
  if (label) label.innerHTML = '<i class="fas fa-check-circle" style="color:var(--emerald);"></i><span>' + esc(file.name) + '</span>';
  var reader = new FileReader();
  reader.onload = function(e) {
    var preview = $('editFotoPreview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    preview.style.cursor = 'pointer';
    preview.onclick = function() { openLightbox(e.target.result); };
  };
  reader.readAsDataURL(file);
}


/* ============================================================
     AUTHENTICATION & SESSION
     ============================================================ */
function doLogin() {
  var username = $('loginUsername').value.trim().toLowerCase();
  var password = $('loginPassword').value;
  var btn = $('btnLogin');

  if (!username || !password) {
    $('loginError').querySelector('span').textContent = 'Email dan password wajib diisi.';
    $('loginError').classList.add('show');
    $('recoveryLinks').classList.add('show');
    return;
  }
  if (!username.includes('@')) {
    $('loginError').querySelector('span').textContent = 'Masukkan alamat email yang valid.';
    $('loginError').classList.add('show');
    $('recoveryLinks').classList.add('show');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Memverifikasi...</span>';

    callApi('loginUser', [
      username,
      password
    ], function(result) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Masuk</span>';
              if (result.success) {
                currentUser = result.user;
                sessionExpiry = result.sessionExpiry;
                safeStorage('set', 'sppg_session', JSON.stringify({ user: currentUser, expiry: sessionExpiry }));
                $('authOverlay').classList.add('hidden');
                $('appContainer').classList.remove('hidden');
                initApp();
                showToast('success', 'Login Berhasil', 'Selamat datang, ' + currentUser.namaLengkap);
              } else {
                $('loginError').querySelector('span').textContent = result.message || 'Login gagal.';
                $('loginError').classList.add('show');
                $('recoveryLinks').classList.add('show');
              }
      },
      function(err) {
        btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Masuk</span>';
              $('loginError').querySelector('span').textContent = 'Terjadi kesalahan sistem.';
              $('loginError').classList.add('show');
              $('recoveryLinks').classList.add('show');
      }
    );
}

function initAuthKeyboardActions() {
  var loginPassword = $('loginPassword');
  var otpInput = $('otpCode');

  if (loginPassword && loginPassword.dataset.enterReady !== '1') {
    loginPassword.dataset.enterReady = '1';
    loginPassword.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') doLogin();
    });
  }

  if (otpInput && otpInput.dataset.otpReady !== '1') {
    otpInput.dataset.otpReady = '1';

    otpInput.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
      $('otpError').classList.remove('show');
    });

    otpInput.addEventListener('paste', function(event) {
      var pasted = (event.clipboardData || window.clipboardData).getData('text');
      var digits = pasted.replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      event.preventDefault();
      this.value = digits;
      this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    otpInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && this.value.length === 6) doVerifyOtp();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthKeyboardActions);
} else {
  initAuthKeyboardActions();
}

// ============================================================
// SPPG AUTOCOMPLETE — dipakai di form Daftar & Edit Profil
// ============================================================
var SPPG_MASTER = [
  'DARMARAJA','CIAMIS','TANJUNG MEDAR','PAKUALAM','KIRISIK','CIBUNAR','CINTA JAYA'
];

// ============================================================
// YAYASAN AUTOCOMPLETE — dipakai pada form profil, user, dan konfigurasi admin.
// Data diambil dari getDropdownOptions() (daftar Nama Yayasan yang sudah pernah diinput).
// ============================================================
var YAYASAN_MASTER = [];

function loadYayasanMaster() {
  callApi('getDropdownOptions', [], function(result) {
      if (result && result.success && Array.isArray(result.yayasanList)) {
        YAYASAN_MASTER = result.yayasanList;
      }
    },
    function(err) { /* diamkan — form tetap bisa diisi manual meski gagal load */ }
  );
}

function showYayasanSuggestions(inputId, listId) {
  var input = $(inputId);
  var list  = $(listId);
  if (!input || !list) return;

  var val = input.value.trim().toLowerCase();
  var matches = YAYASAN_MASTER.filter(function(s) {
    return s.toLowerCase().includes(val);
  });

  if (val === '') matches = YAYASAN_MASTER.slice();

  if (matches.length === 0) {
    list.classList.add('hidden');
    return;
  }

  list.innerHTML = matches.map(function(s) {
    var highlighted = esc(s);
    if (val) {
      var idx = s.toLowerCase().indexOf(val);
      if (idx > -1) {
        highlighted = esc(s.substring(0, idx)) + '<span class="sppg-match">' + esc(s.substring(idx, idx + val.length)) + '</span>' + esc(s.substring(idx + val.length));
      }
    }
    return '<li onmousedown="selectSppg(\'' + inputId + '\',\'' + listId + '\',' + JSON.stringify(s) + ')">'
         + '<i class="fas fa-building"></i>' + highlighted + '</li>';
  }).join('');

  list.classList.remove('hidden');
}

function showSppgSuggestions(inputId, listId) {
  var input = $(inputId);
  var list  = $(listId);
  if (!input || !list) return;

  var val = input.value.trim().toUpperCase();
  var matches = SPPG_MASTER.filter(function(s) {
    return s.includes(val);
  });

  if (matches.length === 0 || val === '') {
    // Tampilkan semua saat kosong
    matches = SPPG_MASTER.slice();
  }

  list.innerHTML = matches.map(function(s) {
    // Highlight bagian yang cocok
    var highlighted = s;
    if (val && s.includes(val)) {
      highlighted = s.replace(val, '<span class="sppg-match">' + val + '</span>');
    }
    return '<li onmousedown="selectSppg(\'' + inputId + '\',\'' + listId + '\',\'' + s + '\')">'
         + '<i class="fas fa-map-marker-alt"></i>' + highlighted + '</li>';
  }).join('');

  list.classList.remove('hidden');
}

function hideSppgSuggestions(listId) {
  // Delay agar onmousedown sempat jalan sebelum blur menyembunyikan list
  setTimeout(function() {
    var list = $(listId);
    if (list) list.classList.add('hidden');
  }, 180);
}

function selectSppg(inputId, listId, value) {
  var input = $(inputId);
  var list  = $(listId);
  if (input) input.value = value;
  if (list)  list.classList.add('hidden');
}







function checkSession() {
  try {
    var stored = safeStorage('get', 'sppg_session');
    if (!stored) return false;
    var session = JSON.parse(stored);
    if (!session || !session.expiry || Date.now() > session.expiry) {
      safeStorage('remove', 'sppg_session');
      return false;
    }
    currentUser = session.user;
    sessionExpiry = session.expiry;
    return true;
    try { window._supabaseToken = safeStorage('get', 'sppg_jwt') || ''; } catch(e) {}
  } catch(e) { return false; }
}

function logout() { $('modalLogout').classList.remove('hidden'); }
function executeLogout(isAutoLogout) {
  safeStorage('remove', 'sppg_session');
  try { localStorage.removeItem('sppg_jwt'); } catch(e) {}
  try { localStorage.removeItem('sppg_refresh_token'); } catch(e) {}
  if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; }
  stopPresenceHeartbeat();
  stopIdleLogoutWatcher();
  currentUser = null;
  $('appContainer').classList.add('hidden');
  $('authOverlay').classList.remove('hidden');
  var appLoadingEl = $('appLoadingOverlay');
  if (appLoadingEl) appLoadingEl.classList.add('hidden');
  showLogin();
  closeModal('modalLogout');
  if (isAutoLogout) {
    showToast('info', 'Sesi Berakhir', 'Anda otomatis keluar karena aplikasi tidak aktif selama 1 jam.');
  } else {
    showToast('success', 'Logout', 'Anda telah keluar.');
  }
}

// ============================================================
// 4b. AUTO LOGOUT KARENA TIDAK ADA AKTIVITAS (IDLE)
// ============================================================
// Aturan: sesi tetap hidup selama aplikasi terlihat atau pengguna beraktivitas.
// Jika aplikasi tidak dibuka/tidak aktif selama 1 jam, sesi otomatis berakhir.
var IDLE_LOGOUT_MS = 60 * 60 * 1000;
var _idleLogoutTimer = null;
var _idleActivityBound = false;
var _idleLastPersistAt = 0;
var _idleLastResetAt = 0;

function persistIdleSession(now, force) {
  if (!currentUser) return 0;
  now = Number(now) || Date.now();
  var expiry = now + IDLE_LOGOUT_MS;
  sessionExpiry = expiry;
  if (force || now - _idleLastPersistAt >= 15000) {
    _idleLastPersistAt = now;
    safeStorage('set', 'sppg_session', JSON.stringify({
      user: currentUser,
      expiry: expiry,
      lastActivity: now
    }));
  }
  return expiry;
}

function storedIdleExpiry() {
  try {
    var raw = safeStorage('get', 'sppg_session');
    var session = raw ? JSON.parse(raw) : null;
    return Number(session && session.expiry) || 0;
  } catch (error) {
    return 0;
  }
}

function scheduleIdleLogout(expiry) {
  if (_idleLogoutTimer) clearTimeout(_idleLogoutTimer);
  var remaining = Math.max(0, Number(expiry) - Date.now());
  if (!remaining) {
    if (currentUser) executeLogout(true);
    return;
  }
  _idleLogoutTimer = setTimeout(function() {
    if (!currentUser) return;
    var currentExpiry = storedIdleExpiry();
    if (!currentExpiry || Date.now() >= currentExpiry) executeLogout(true);
    else scheduleIdleLogout(currentExpiry);
  }, remaining);
}

function resetIdleLogoutTimer() {
  if (!currentUser) return;
  var now = Date.now();
  if (now - _idleLastResetAt < 10000) return;
  _idleLastResetAt = now;
  scheduleIdleLogout(persistIdleSession(now, true));
}

function startIdleLogoutWatcher() {
  if (!_idleActivityBound) {
    ['click', 'touchstart', 'scroll', 'keydown', 'mousemove'].forEach(function(evt) {
      document.addEventListener(evt, resetIdleLogoutTimer, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', function() {
      if (!currentUser) return;
      var expiry = storedIdleExpiry();
      if (!expiry || Date.now() >= expiry) {
        executeLogout(true);
        return;
      }
      if (document.visibilityState === 'visible') resetIdleLogoutTimer();
      else scheduleIdleLogout(expiry);
    });
    _idleActivityBound = true;
  }
  resetIdleLogoutTimer();
}

function stopIdleLogoutWatcher() {
  if (_idleLogoutTimer) { clearTimeout(_idleLogoutTimer); _idleLogoutTimer = null; }
}

function sendPresenceHeartbeat() {
  if (!currentUser || document.visibilityState === 'hidden') return;
  resetIdleLogoutTimer();
  callApi('updatePresence', [], function(result) {
    if (result && result.success && currentUser) {
      currentUser.lastSeenAt = result.lastSeenAt;
      var settingsUsersPanel = $('settingsPanel-users');
      var usersVisible = currentPage === 'users' ||
        (currentPage === 'settings' && settingsUsersPanel && !settingsUsersPanel.classList.contains('hidden'));
      if (usersVisible && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) {
        loadUsers(true, usersPage, false);
      }
    }
  }, function(error) {
    console.warn('Presence heartbeat gagal:', error && error.message ? error.message : error);
  });
}

function startPresenceHeartbeat() {
  stopPresenceHeartbeat();
  sendPresenceHeartbeat();
  // Heartbeat 30 detik memberi status live tanpa membebani API secara berlebihan.
  // Backend memakai ambang 75 detik agar satu heartbeat yang terlambat tidak
  // langsung membuat user berkedip offline.
  presenceHeartbeatTimer = setInterval(sendPresenceHeartbeat, 30000);
}

function stopPresenceHeartbeat() {
  if (presenceHeartbeatTimer) {
    clearInterval(presenceHeartbeatTimer);
    presenceHeartbeatTimer = null;
  }
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && currentUser) sendPresenceHeartbeat();
});

// ============================================================
// 4b. SETTINGS HUB & ANNOUNCEMENTS
// ============================================================
function loadMyMenuVisibility() {
  return new Promise(function(resolve) {
    if (!currentUser) { resolve(); return; }
    callApi('getMyMenuVisibility', [], function(result) {
      if (result && result.success && Array.isArray(result.menus)) {
        menuVisibilityByRole[result.role || currentUser.role] = result.menus;
        if (!isPageAllowedForCurrentUser(currentPage)) currentPage = 'dashboard';
        buildSidebar();
        buildBottomNav();
      }
      resolve(result);
    }, function(error) {
      console.error('Menu visibility gagal dimuat:', error);
      resolve();
    });
  });
}

function initializeSettingsHubLayout() {
  if (settingsHubState.layoutReady || !currentUser || currentUser.role !== 'SUPER_ADMIN') return;
  var usersPage = $('page-users');
  var adminPage = $('page-admin-assignment');
  var usersHost = $('settingsUsersHost');
  var adminHost = $('settingsAdminHost');
  if (usersPage && usersHost) {
    while (usersPage.firstChild) usersHost.appendChild(usersPage.firstChild);
  }
  if (adminPage && adminHost) {
    while (adminPage.firstChild) adminHost.appendChild(adminPage.firstChild);
  }
  settingsHubState.layoutReady = true;
}

function openSettingsTab(tabName, button) {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
  document.querySelectorAll('.settings-panel').forEach(function(panel) {
    panel.classList.toggle('hidden', panel.id !== 'settingsPanel-' + tabName);
  });
  document.querySelectorAll('.settings-tab').forEach(function(tab) {
    var active = tab.getAttribute('data-settings-tab') === tabName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (button) button.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (tabName === 'users') {
    loadUsers(true);
    restoreFilterBarState('usersFilterBar');
  }
  if (tabName === 'admin') {
    loadAdminAssignments(true);
    restoreFilterBarState('adminAssignmentFilterBar');
  }
}

function loadSettingsHub() {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
  initializeSettingsHubLayout();
  callApi('getSettingsHub', [], function(result) {
    if (!result || !result.success) return;
    settingsHubState.loaded = true;
    settingsHubState.features = result.features || settingsHubState.features;
    settingsHubState.menuVisibility = result.menuVisibility || settingsHubState.menuVisibility;
    settingsHubState.announcements = Array.isArray(result.announcements) ? result.announcements : [];
    Object.keys(settingsHubState.menuVisibility).forEach(function(role) {
      menuVisibilityByRole[role] = settingsHubState.menuVisibility[role];
    });
    transactionEditModeEnabled = settingsHubState.features.allowUserEditTransaction === true;
    uploadBuktiModeEnabled = settingsHubState.features.allowUserUploadBukti === true;
    renderSettingsFeatureSwitches();
    renderSettingsMenuGrid();
    renderSettingsAnnouncementList();
    buildSidebar();
    buildBottomNav();
  }, function(error) {
    showToast('error', 'Pengaturan Gagal Dimuat', error.message || 'Terjadi kesalahan.');
  });
}

function renderSettingsFeatureSwitches() {
  var editSwitch = $('settingsTxEditSwitch');
  var uploadSwitch = $('settingsUploadSwitch');
  if (editSwitch) {
    editSwitch.classList.toggle('active', settingsHubState.features.allowUserEditTransaction === true);
    editSwitch.setAttribute('aria-checked', settingsHubState.features.allowUserEditTransaction === true ? 'true' : 'false');
  }
  if (uploadSwitch) {
    uploadSwitch.classList.toggle('active', settingsHubState.features.allowUserUploadBukti === true);
    uploadSwitch.setAttribute('aria-checked', settingsHubState.features.allowUserUploadBukti === true ? 'true' : 'false');
  }
}

function toggleSettingsFeature(type) {
  if (type === 'edit') {
    settingsHubState.features.allowUserEditTransaction = !settingsHubState.features.allowUserEditTransaction;
  } else if (type === 'upload') {
    settingsHubState.features.allowUserUploadBukti = !settingsHubState.features.allowUserUploadBukti;
  }
  renderSettingsFeatureSwitches();
}

function saveFeatureSettings() {
  var button = $('btnSaveFeatureSettings');
  if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...'; }
  callApi('updateFeatureSettings', [settingsHubState.features], function(result) {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Simpan Pengaturan'; }
    transactionEditModeEnabled = settingsHubState.features.allowUserEditTransaction === true;
    uploadBuktiModeEnabled = settingsHubState.features.allowUserUploadBukti === true;
    if (currentPage === 'approval') renderApprovalTable();
    if (currentPage === 'transaksi') renderTransaksiTable();
    showToast('success', 'Pengaturan Tersimpan', result.message || 'Pengaturan transaksi berhasil disimpan.');
  }, function(error) {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Simpan Pengaturan'; }
    showToast('error', 'Gagal Menyimpan', error.message || 'Terjadi kesalahan.');
  });
}

function selectSettingsMenuRole(role, button) {
  settingsHubState.selectedMenuRole = role;
  document.querySelectorAll('.settings-role-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.getAttribute('data-settings-role') === role);
  });
  renderSettingsMenuGrid();
}

function getSettingsMenuOptions(role) {
  var source = MENU_CONFIG[role] || MENU_CONFIG.USER;
  var found = {};
  return source.filter(function(item) {
    if (!item.page || found[item.page]) return false;
    found[item.page] = true;
    return true;
  });
}

function renderSettingsMenuGrid() {
  var grid = $('settingsMenuGrid');
  if (!grid) return;
  var role = settingsHubState.selectedMenuRole;
  var selected = settingsHubState.menuVisibility[role] || [];
  var required = role === 'SUPER_ADMIN' ? ['dashboard', 'profil', 'settings'] : ['dashboard', 'profil'];
  grid.innerHTML = getSettingsMenuOptions(role).map(function(item) {
    var mandatory = required.indexOf(item.page) !== -1;
    var checked = mandatory || selected.indexOf(item.page) !== -1;
    return '<label class="settings-menu-option ' + (mandatory ? 'is-required' : '') + '">' +
      '<input type="checkbox" value="' + esc(item.page) + '" ' + (checked ? 'checked' : '') + ' ' + (mandatory ? 'disabled' : '') + '>' +
      '<i class="fas ' + esc(item.icon || 'fa-circle') + '"></i>' +
      '<span>' + esc(item.label) + (mandatory ? ' <small>(wajib)</small>' : '') + '</span>' +
    '</label>';
  }).join('');
}

function saveMenuVisibility() {
  var role = settingsHubState.selectedMenuRole;
  var menus = [];
  document.querySelectorAll('#settingsMenuGrid input[type="checkbox"]').forEach(function(input) {
    if (input.checked) menus.push(input.value);
  });
  var button = $('btnSaveMenuVisibility');
  if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...'; }
  callApi('updateMenuVisibility', [{ role: role, menus: menus }], function(result) {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Simpan Menu Role'; }
    settingsHubState.menuVisibility[role] = result.menus || menus;
    menuVisibilityByRole[role] = settingsHubState.menuVisibility[role];
    buildSidebar();
    buildBottomNav();
    renderSettingsMenuGrid();
    showToast('success', 'Menu Tersimpan', result.message || 'Visibilitas menu berhasil diperbarui.');
  }, function(error) {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Simpan Menu Role'; }
    showToast('error', 'Gagal Menyimpan', error.message || 'Terjadi kesalahan.');
  });
}

function sendAnnouncement() {
  var title = $('announcementTitle') ? $('announcementTitle').value.trim() : '';
  var body = $('announcementBody') ? $('announcementBody').value.trim() : '';
  var targetRoles = [];
  if ($('announcementRoleAdmin') && $('announcementRoleAdmin').checked) targetRoles.push('ADMIN');
  if ($('announcementRoleUser') && $('announcementRoleUser').checked) targetRoles.push('USER');
  if (!title || !body || !targetRoles.length) {
    showToast('warning', 'Data Belum Lengkap', 'Isi judul, pengumuman, dan pilih minimal satu role.');
    return;
  }
  var button = $('btnSendAnnouncement');
  if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengirim...'; }
  callApi('createAnnouncement', [{
    title: title,
    body: body,
    targetRoles: targetRoles,
    priority: $('announcementPriority') ? $('announcementPriority').value : 'INFORMASI',
    endsAt: $('announcementEndsAt') && $('announcementEndsAt').value ? new Date($('announcementEndsAt').value).toISOString() : null
  }], function(result) {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-paper-plane"></i> Terbitkan &amp; Kirim'; }
    $('announcementTitle').value = '';
    $('announcementBody').value = '';
    $('announcementEndsAt').value = '';
    $('announcementRoleAdmin').checked = false;
    $('announcementRoleUser').checked = false;
    var sent = 0;
    (result.push || []).forEach(function(row) {
      if (row.result) sent += Number(row.result.sent || 0);
    });
    showToast('success', 'Pengumuman Diterbitkan', 'Tampil di Dashboard. Push terkirim ke ' + sent + ' perangkat.');
    loadSettingsHub();
  }, function(error) {
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-paper-plane"></i> Terbitkan &amp; Kirim'; }
    showToast('error', 'Gagal Mengirim', error.message || 'Terjadi kesalahan.');
  });
}

function renderSettingsAnnouncementList() {
  var list = $('settingsAnnouncementList');
  if (!list) return;
  if (!settingsHubState.announcements.length) {
    list.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i><p>Belum ada pengumuman.</p></div>';
    return;
  }
  list.innerHTML = settingsHubState.announcements.map(function(item) {
    var priority = String(item.priority || 'INFORMASI').toLowerCase();
    var roles = Array.isArray(item.target_roles) ? item.target_roles.join(' & ') : '-';
    return '<article class="announcement-item priority-' + esc(priority) + '">' +
      '<div><h4>' + esc(item.title) + '</h4><p>' + esc(item.body) + '</p>' +
      '<div class="announcement-meta"><span>' + esc(roles) + '</span><span>' + esc(formatDate(item.created_at)) + '</span><span>' + (item.is_active ? 'Aktif' : 'Nonaktif') + '</span></div></div>' +
      '<button type="button" class="toggle-switch ' + (item.is_active ? 'active' : '') + '" role="switch" aria-checked="' + (item.is_active ? 'true' : 'false') + '" onclick="toggleAnnouncementActive(\'' + esc(item.id) + '\',' + (!item.is_active) + ')"></button>' +
    '</article>';
  }).join('');
}

function toggleAnnouncementActive(id, isActive) {
  callApi('setAnnouncementActive', [{ id: id, isActive: isActive }], function(result) {
    showToast('success', 'Pengumuman Diperbarui', result.message || 'Status berhasil diperbarui.');
    loadSettingsHub();
  }, function(error) {
    showToast('error', 'Gagal Memperbarui', error.message || 'Terjadi kesalahan.');
  });
}

function loadMyAnnouncements() {
  var container = $('dashboardAnnouncements');
  if (!container || !currentUser) return;
  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'USER') {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  callApi('getMyAnnouncements', [], function(result) {
    var items = result && Array.isArray(result.announcements) ? result.announcements : [];
    if (!items.length) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.innerHTML = items.map(function(item) {
      var priority = String(item.priority || 'INFORMASI').toLowerCase();
      return '<article class="dashboard-announcement priority-' + esc(priority) + '">' +
        '<div class="dashboard-announcement-icon"><i class="fas fa-bullhorn"></i></div>' +
        '<div><h3>' + esc(item.title) + '</h3><p>' + esc(item.body) + '</p></div>' +
      '</article>';
    }).join('');
    container.classList.remove('hidden');
  }, function() {
    container.classList.add('hidden');
  });
}

// ============================================================
// 5. SIDEBAR & NAVIGATION
// ============================================================

var MENU_CONFIG = {
  SUPER_ADMIN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'settings', label: 'Pengaturan', icon: 'fa-sliders-h' },
    { page: 'add-user', label: 'Tambah User', icon: 'fa-user-plus' },
    { page: 'transaksi', label: 'Semua Transaksi', icon: 'fa-exchange-alt' },
    { page: 'chattrx', label: 'ChatTrx', icon: 'fa-comments-dollar' },
    { page: 'mytrx', label: 'MyTrx', icon: 'fa-list-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment', icon: 'fa-hand-holding-usd' },
    { page: 'audit-log', label: 'Riwayat Aktivitas', icon: 'fa-history' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'MENU MBG', isHeader: true },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
    ,{ page: 'laporan', label: 'Laporan', icon: 'fa-file-alt' }
  ],
  ADMIN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'users', label: 'Manajemen Users', icon: 'fa-users' },
    { page: 'transaksi', label: 'Semua Transaksi', icon: 'fa-exchange-alt' },
    { page: 'chattrx', label: 'ChatTrx', icon: 'fa-comments-dollar' },
    { page: 'mytrx', label: 'MyTrx', icon: 'fa-list-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment', icon: 'fa-hand-holding-usd' },
    { page: 'audit-log', label: 'Riwayat Aktivitas', icon: 'fa-history' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'MENU MBG', isHeader: true },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
    ,{ page: 'laporan', label: 'Laporan', icon: 'fa-file-alt' }
  ],
  AKUNTAN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'MENU MBG', isHeader: true },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'AKUN', isHeader: true },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],
  LAPANGAN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'transaksi', label: 'Transaksi Saya', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],

PIC: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'MENU UTAMA', isHeader: true },
    { page: 'transaksi', label: 'Transaksi Saya', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment', icon: 'fa-hand-holding-usd' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],

  WAKIL_LAPANGAN: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],
  AHLI_GIZI: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { page: 'menu-mbg', label: 'Data Menu MBG', icon: 'fa-utensils' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-bahan', label: 'Master Bahan Baku', icon: 'fa-boxes' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ],
  USER: [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { page: 'profil', label: 'Profil', icon: 'fa-user-circle' },
    { label: 'AKTIVITAS SAYA', isHeader: true },
    { page: 'transaksi', label: 'Transaksi Saya', icon: 'fa-exchange-alt' },
    { page: 'approval', label: 'Approval', icon: 'fa-clipboard-check', badge: 'approvalCount' },
    { page: 'pending-payment', label: 'Pending Payment Saya', icon: 'fa-hand-holding-usd' },
    { page: 'survei', label: 'Survei Harga', icon: 'fa-search-dollar' },
    { page: 'serah-terima', label: 'Serah Terima', icon: 'fa-dolly' },
    { label: 'DATA MASTER', isHeader: true },
    { page: 'master-supplier', label: 'Data Supplier', icon: 'fa-truck' },
    { label: 'AKUN', isHeader: true },
    { action: 'logout', label: 'Keluar', icon: 'fa-sign-out-alt' }
  ]
};

function getLastPageStorageKey() {
  var identity = currentUser && (currentUser.email || currentUser.username || currentUser.id);
  return 'sppg_last_page:' + String(identity || 'default').toLowerCase();
}

function isMenuPageVisibleForRole(page, role) {
  if (page === 'add-user') return role === 'SUPER_ADMIN';
  if (page === 'chattrx' || page === 'mytrx') return role === 'SUPER_ADMIN' || role === 'ADMIN';
  var configured = menuVisibilityByRole[role];
  if (!Array.isArray(configured) || !configured.length) return true;
  return configured.indexOf(page) !== -1;
}

function getVisibleMenusForRole(role) {
  var menus = MENU_CONFIG[role] || MENU_CONFIG.USER || [];
  return menus.filter(function(item) {
    return !item.page || isMenuPageVisibleForRole(item.page, role);
  });
}

function isPageAllowedForCurrentUser(page) {
  if (!currentUser || !page) return false;
  var menus = getVisibleMenusForRole(currentUser.role);
  return menus.some(function(item) { return item.page === page; });
}

function getRestorablePage() {
  var saved = safeStorage('get', getLastPageStorageKey()) || 'dashboard';
  return isPageAllowedForCurrentUser(saved) ? saved : 'dashboard';
}

function rememberCurrentPage(page) {
  if (isPageAllowedForCurrentUser(page)) {
    safeStorage('set', getLastPageStorageKey(), page);
  }
}

function buildSidebar() {
  var role = currentUser ? currentUser.role : '';
  var menus = getVisibleMenusForRole(role);
  var bottomNavPages = (BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['USER']).filter(function(page) {
    return isMenuPageVisibleForRole(page, role);
  });

  // Di desktop (>= 768px) tidak ada bottom nav, jadi semua menu tampil di sidebar.
  // Di mobile, item yang sudah ada di bottom nav disembunyikan dari sidebar
  // agar tidak duplikat, lalu header section yang jadi kosong ikut dibuang.
  var isDesktop = window.innerWidth >= 768;
  var filtered = [];
  var pendingHeader = null;
  menus.forEach(function(item) {
    if (item.isHeader) { pendingHeader = item; return; }
    if (item.action === 'logout') {
      if (pendingHeader) { filtered.push(pendingHeader); pendingHeader = null; }
      filtered.push(item);
      return;
    }
    if (!isDesktop && bottomNavPages.indexOf(item.page) !== -1) return; // mobile: skip jika sudah di bottom nav
    if (pendingHeader) { filtered.push(pendingHeader); pendingHeader = null; }
    filtered.push(item);
  });

  var html = '';
  filtered.forEach(function(item) {
    if (item.isHeader) {
      html += '<div class="menu-label">' + esc(item.label) + '</div>';
      return;
    }
    if (item.action === 'logout') {
      html += '<a class="menu-item" onclick="logout()">' +
        '<i class="fas ' + item.icon + '"></i>' +
        '<span class="menu-item-text">' + esc(item.label) + '</span>' +
        '<span class="sidebar-tooltip">' + esc(item.label) + '</span></a>';
      return;
    }
    var isActive = currentPage === item.page ? 'active' : '';
    var badgeHtml = item.badge ? '<span class="menu-badge" id="' + item.badge + 'Sidebar" style="display:none;">0</span>' : '';
    html += '<a class="menu-item ' + isActive + '" onclick="switchPage(\'' + item.page + '\', this)" data-page="' + item.page + '">' +
      '<i class="fas ' + item.icon + '"></i>' +
      '<span class="menu-item-text">' + esc(item.label) + '</span>' +
      badgeHtml +
      '<span class="sidebar-tooltip">' + esc(item.label) + '</span></a>';
  });
  $('sidebarMenu').innerHTML = html;
}

// ============================================================
// BOTTOM NAV, FAB, MORE-SHEET — Mobile Navigation
// ============================================================

// Tab utama per role (4 item permanen: Beranda, Transaksi, Approval/menu utama, Profil)
var BOTTOM_NAV_CONFIG = {
  SUPER_ADMIN:    ['dashboard', 'transaksi', 'approval', 'profil'],
  ADMIN:          ['dashboard', 'transaksi', 'approval', 'profil'],
  AKUNTAN:        ['dashboard', 'transaksi', 'master-bahan', 'profil'],
  LAPANGAN:       ['dashboard', 'transaksi', 'approval', 'profil'],
  WAKIL_LAPANGAN: ['dashboard', 'transaksi', 'serah-terima', 'profil'],
  AHLI_GIZI:      ['dashboard', 'transaksi', 'menu-mbg', 'profil'],
  USER:           ['dashboard', 'transaksi', 'approval', 'profil']
};

var BNAV_ICON_LABEL = {
  'dashboard':       { icon: 'fa-th-large',        label: 'Beranda' },
  'transaksi':        { icon: 'fa-exchange-alt',    label: 'Transaksi' },
  'approval':         { icon: 'fa-clipboard-check', label: 'Approval' },
  'profil':           { icon: 'fa-user-circle',     label: 'Profil' },
  'master-bahan':     { icon: 'fa-boxes',           label: 'Bahan Baku' },
  'survei':           { icon: 'fa-search-dollar',   label: 'Survei' },
  'serah-terima':     { icon: 'fa-dolly',           label: 'Serah Trm' },
  'menu-mbg':         { icon: 'fa-utensils',        label: 'Menu MBG' }
};

function buildBottomNav() {
  if (!currentUser) return;
  var role = currentUser.role;
  var tabs = (BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['LAPANGAN']).filter(function(page) {
    return isMenuPageVisibleForRole(page, role);
  });
  var html = '';

  // 5 item navigation tanpa FAB dan tanpa "Lainnya"
  tabs.forEach(function(page) {
    var meta = BNAV_ICON_LABEL[page] || { icon: 'fa-circle', label: page };
    var isActive = currentPage === page ? 'active' : '';
    var badgeHtml = (page === 'approval') ? '<span class="bnav-badge" id="bnavApprovalBadge" style="display:none;">0</span>' : '';
    html += '<button class="bnav-item ' + isActive + '" data-page="' + page + '" onclick="switchPage(\'' + page + '\')">' +
      badgeHtml +
      '<i class="fas ' + meta.icon + '"></i><span>' + meta.label + '</span></button>';
  });

  $('bottomNavInner').innerHTML = html;
  syncApprovalBadgeToBottomNav();
}

function updateBottomNavActive() {
  document.querySelectorAll('.bnav-item[data-page]').forEach(function(item) {
    item.classList.toggle('active', item.getAttribute('data-page') === currentPage);
  });
}

function syncApprovalBadgeToBottomNav() {
  var src = $('approvalCount');
  var dst = $('bnavApprovalBadge');
  if (!src || !dst) return;
  dst.textContent = src.textContent;
  dst.style.display = (parseInt(src.textContent) > 0) ? 'flex' : 'none';
}

// ── Bottom Sheet "Lainnya" — sisa menu sesuai role yang tidak ada di bottom nav ──
function openMoreSheet() {
  if (!currentUser) return;
  var role = currentUser.role;
  var menus = getVisibleMenusForRole(role);
  var mainTabs = (BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['LAPANGAN']).filter(function(page) {
    return isMenuPageVisibleForRole(page, role);
  });
  var html = '';
  var currentGroup = '';
  menus.forEach(function(item) {
    if (item.isHeader) { currentGroup = item.label; return; }
    if (item.action === 'logout') {
      html += '<div class="more-sheet-title">AKUN</div>';
      html += '<div class="more-sheet-item" onclick="closeMoreSheet();logout();"><i class="fas ' + item.icon + '"></i><span>' + esc(item.label) + '</span></div>';
      return;
    }
    if (mainTabs.indexOf(item.page) > -1) return; // sudah ada di bottom nav, skip
    html += '<div class="more-sheet-item" onclick="closeMoreSheet();switchPage(\'' + item.page + '\');"><i class="fas ' + item.icon + '"></i><span>' + esc(item.label) + '</span></div>';
  });
  $('moreSheetBox').innerHTML = '<div class="more-sheet-title">Menu Lainnya</div>' + html;
  $('moreSheetOverlay').classList.add('active');
}
function closeMoreSheet() { $('moreSheetOverlay').classList.remove('active'); }

// ── FAB "Tambah" — routing per halaman aktif ──
var FAB_ACTION_MAP = {
  'transaksi':     function() { openAddTransaksiModal(); },
  'master-bahan':  function() { openAddMasterBBModal(); },
  'master-supplier': function() { openAddSupplierModal(); },
  'survei':        function() { openAddSurveiModal(); },
  'serah-terima':  function() { openAddSerahTerimaModal(); },
  'menu-mbg':      function() { openAddMenuMBGModal(); },
  'pending-payment': function() { openAddPendingModal(); }
};
function handleFabAdd() {
  var fn = FAB_ACTION_MAP[currentPage];
  if (fn) { fn(); return; }
  // Fallback: jika halaman aktif tidak punya aksi tambah spesifik,
  // arahkan ke Tambah Transaksi sebagai aksi default paling umum.
  openAddTransaksiModal();
}
function updateFabVisibility() {
  // Tombol .fab-add (bulat mengambang lama) - hanya tampil jika ada aksi spesifik
  var fab = $('fabAdd');
  var shouldShow = !!FAB_ACTION_MAP[currentPage];
  if (fab) fab.classList.toggle('show', shouldShow);

  // Tombol .bnav-fab (FAB tengah di bottom nav) - SELALU tampil di semua halaman,
  // karena ini bagian tetap dari struktur navigasi, bukan tombol kontekstual.
  var bnavFabs = document.querySelectorAll('.bnav-fab');
  bnavFabs.forEach(function(bnavFab) {
    bnavFab.style.display = 'flex';
  });
}

// R4: Breadcrumb Navigation — update berdasarkan halaman aktif
function updateBreadcrumb(page, pageLabel) {
  var breadcrumb = $('breadcrumbNav');
  var current = $('breadcrumbCurrent');
  if (!breadcrumb || !current) return;
  // Dashboard = root, tidak perlu breadcrumb
  if (page === 'dashboard') {
    breadcrumb.style.display = 'none';
    return;
  }
  breadcrumb.style.display = 'flex';
  breadcrumb.classList.remove('hidden');
  var html = '<a onclick="switchPage(\'dashboard\')"><i class="fas fa-home" style="font-size:10px;"></i> Dashboard</a><span class="separator">/</span>';
  // Untuk halaman transaksi yang sedang detail, gunakan format spesial
  html += '<span id="breadcrumbCurrent">' + esc(pageLabel) + '</span>';
  breadcrumb.innerHTML = html;
}

// R7: Highlight tombol "Lainnya" saat halaman aktif ada di more-sheet
function syncMoreButtonActive(page) {
  var role = currentUser ? currentUser.role : '';
  var mainTabs = (BOTTOM_NAV_CONFIG[role] || BOTTOM_NAV_CONFIG['LAPANGAN']).filter(function(menuPage) {
    return isMenuPageVisibleForRole(menuPage, role);
  });
  // Jika halaman tidak ada di bottom nav utama, berarti ada di "Lainnya"
  var isInMainTabs = mainTabs.indexOf(page) > -1;
  var moreBtn = document.querySelector('.bnav-item:last-child');
  if (!moreBtn) return;
  // Update dot indicator pada "Lainnya" jika ada approval pending
  var approvalCountVal = parseInt($('approvalCount') ? $('approvalCount').textContent : '0') || 0;
  var approvalInMore = mainTabs.indexOf('approval') === -1 && approvalCountVal > 0;
  moreBtn.classList.toggle('has-dot', approvalInMore);
  // Toggle active state
  moreBtn.classList.toggle('is-more-active', !isInMainTabs);
  
  // Juga update FAB visibility saat halaman berubah
  updateFabVisibility();
}

function goToTransaksiFiltered(kategori) {
  switchPage('transaksi');
  setTimeout(function() {
    if ($('txFilterKategori')) {
      $('txFilterKategori').value = kategori;
      filterTransaksi();
    }
  }, 150);
}

// ============================================================
// FILTER TANGGAL GLOBAL (berlaku ke semua menu: Beranda, Transaksi,
// Approval, Rekap Harian, Rekap SPPG). Disimpan di localStorage agar
// persist antar sesi. null/null = tanpa batas (semua data).
// ============================================================
var globalDateFilter = { start: null, end: null, label: 'Semua Tanggal' };

function loadGlobalDateFilterState() {
  try {
    var saved = safeStorage('get', 'globalDateFilter');
    if (saved) {
      var parsed = JSON.parse(saved);
      globalDateFilter = parsed;
      var startInput = $('globalDateStart');
      var endInput = $('globalDateEnd');
      var labelElement = $('globalDateFilterLabel');
      if (startInput) startInput.value = parsed.start || '';
      if (endInput) endInput.value = parsed.end || '';
      if (labelElement) labelElement.textContent = parsed.label || 'Semua Tanggal';
    }
  } catch (e) { /* biarkan default jika parsing gagal */ }
}

function saveGlobalDateFilterState() {
  safeStorage('set', 'globalDateFilter', JSON.stringify(globalDateFilter));
}

function toggleGlobalDateFilterPanel() {
  var panel = $('globalDateFilterPanel');
  if (panel) panel.classList.toggle('hidden');
}

function closeGlobalDateFilterPanel() {
  var panel = $('globalDateFilterPanel');
  if (panel) panel.classList.add('hidden');
}

function setGlobalDatePreset(preset) {
  var end = new Date();
  var start = new Date();
  var label = 'Semua Tanggal';

  if (preset === 'today') { label = 'Hari Ini'; }
  else if (preset === '7d') { start.setDate(start.getDate() - 6); label = '7 Hari Terakhir'; }
  else if (preset === '30d') { start.setDate(start.getDate() - 29); label = '30 Hari Terakhir'; }
  else if (preset === 'month') { start = new Date(end.getFullYear(), end.getMonth(), 1); label = 'Bulan Ini'; }
  else if (preset === 'all') {
    globalDateFilter = { start: null, end: null, label: 'Semua Tanggal' };
    var allStartInput = $('globalDateStart');
    var allEndInput = $('globalDateEnd');
    var allLabelElement = $('globalDateFilterLabel');
    if (allStartInput) allStartInput.value = '';
    if (allEndInput) allEndInput.value = '';
    if (allLabelElement) allLabelElement.textContent = 'Semua Tanggal';
    saveGlobalDateFilterState();
    closeGlobalDateFilterPanel();
    applyGlobalDateFilter();
    return;
  }

  var startStr = formatDateInput(start);
  var endStr = formatDateInput(end);
  globalDateFilter = { start: startStr, end: endStr, label: label };
  var presetStartInput = $('globalDateStart');
  var presetEndInput = $('globalDateEnd');
  var presetLabelElement = $('globalDateFilterLabel');
  if (presetStartInput) presetStartInput.value = startStr;
  if (presetEndInput) presetEndInput.value = endStr;
  if (presetLabelElement) presetLabelElement.textContent = label;
  saveGlobalDateFilterState();
  closeGlobalDateFilterPanel();
  applyGlobalDateFilter();
}

function applyGlobalDateFilterCustom() {
  var startInput = $('globalDateStart');
  var endInput = $('globalDateEnd');
  var start = startInput ? (startInput.value || null) : null;
  var end = endInput ? (endInput.value || null) : null;
  var label = (start || end) ? (formatTglLabel(start) + ' - ' + formatTglLabel(end)) : 'Semua Tanggal';
  globalDateFilter = { start: start, end: end, label: label };
  var labelElement = $('globalDateFilterLabel');
  if (labelElement) labelElement.textContent = label;
  saveGlobalDateFilterState();
  closeGlobalDateFilterPanel();
  applyGlobalDateFilter();
}

function formatTglLabel(dateStr) {
  if (!dateStr) return '...';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + '/' + parts[1] + '/' + parts[0].slice(2);
}

// Dipanggil setiap kali globalDateFilter berubah — reload data halaman
// yang sedang aktif saja (bukan semua halaman sekaligus, demi performa).
function applyGlobalDateFilter() {
  if (currentPage === 'dashboard') loadDashboardData();
  else if (currentPage === 'transaksi') loadTransactions();
  else if (currentPage === 'approval') loadApprovalData();
}

// Tutup panel jika klik di luar area filter
document.addEventListener('click', function(e) {
  var bar = $('globalDateFilterBar');
  if (bar && !bar.contains(e.target)) closeGlobalDateFilterPanel();
});


/* ============================================================
     APP SHELL & NAVIGATION
     ============================================================ */
function switchPage(page, el) {
  if (!isPageAllowedForCurrentUser(page)) {
    page = 'dashboard';
    el = null;
  }
  // SAFETY NET: pastikan body tidak terkunci sisa dari modal yang gagal
  // ditutup dengan benar (mis. alur Approval->PIN atau Verifikasi->PIN
  // yang terinterupsi). Tanpa ini, overflow:hidden bisa "nyangkut" dan
  // membuat halaman utama (Transaksi, dll) tidak bisa di-scroll via touch.
  _openModalCount = 0;
  document.body.style.overflow = '';

  // Hide all pages
  var pages = document.querySelectorAll('.page-section');
  pages.forEach(function(p) { p.classList.add('hidden'); });
  // Show target page
  var target = $('page-' + page);
    if (target) { target.classList.remove('hidden'); target.style.animation = 'none'; target.offsetHeight; target.style.animation = ''; }
  // Update menu active
  document.querySelectorAll('.menu-item').forEach(function(m) { m.classList.remove('active'); });
  if (el) el.classList.add('active');
  else {
    var menuItem = document.querySelector('.menu-item[data-page="' + page + '"]');
    if (menuItem) menuItem.classList.add('active');
  }
  currentPage = page;
  document.body.classList.toggle('chattrx-fullscreen', page === 'chattrx');
  rememberCurrentPage(page);
  // Update title
  var titles = {
    'dashboard': 'Dashboard', 'profil': 'Profil', 'users': 'Manajemen Users', 'laporan': 'Laporan',
    'transaksi': currentUser && currentUser.role === 'ADMIN' ? 'Semua Transaksi' : 'Transaksi Saya', 'chattrx':'ChatTrx', 'mytrx':'MyTrx',
    'approval': 'Approval',
    'pending-payment': 'Pending Payment', 'master-bahan': 'Master Bahan Baku',
    'master-supplier': 'Data Supplier', 'survei': 'Survei Harga',
    'serah-terima': 'Serah Terima', 'menu-mbg': 'Data Menu MBG',
    'audit-log': 'Riwayat Aktivitas', 'admin-assignment': 'Konfigurasi Admin',
    'settings': 'Pengaturan', 'add-user': 'Tambah User'
  };
  $('pageTitle').textContent = titles[page] || 'Dashboard';
  // R4: Update breadcrumb
  updateBreadcrumb(page, titles[page] || 'Dashboard');
  // R7: Deteksi apakah halaman termasuk menu "Lainnya" di bottom nav
  syncMoreButtonActive(page);
  closeMobileSidebar();
  updateBottomNavActive();
  updateFabVisibility();
  // Page-specific init
  if (page === 'dashboard') { loadDashboardData(true); updateChart(); loadMyAnnouncements(); }
  if (page === 'settings' && currentUser.role === 'SUPER_ADMIN') { initializeSettingsHubLayout(); loadSettingsHub(); }
  if (page === 'users' && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) loadUsers(true);
  if (page === 'transaksi') { loadFeatureModes(true); loadTransactions(undefined, undefined, true); restoreFilterBarState('txFilterBar'); }
  if (page === 'chattrx' && window.initChatTrx) window.initChatTrx();
  if (page === 'mytrx' && window.initMyTrx) window.initMyTrx();
  if (page === 'approval') { loadFeatureModes(true); loadApprovalData(); restoreFilterBarState('apprFilterBar'); }
  if (page === 'users') { restoreFilterBarState('usersFilterBar'); }
  if (page === 'master-bahan') { loadMasterBB(undefined, undefined, true); restoreFilterBarState('bbFilterBar'); }
  if (page === 'master-supplier') { loadSuppliers(true); restoreFilterBarState('supplierFilterBar'); }
  if (page === 'survei') { loadSurvei(undefined, undefined, true); restoreFilterBarState('surveiFilterBar'); }
  if (page === 'serah-terima') { loadSerahTerima(undefined, undefined, true); restoreFilterBarState('stFilterBar'); }
  if (page === 'menu-mbg') loadMenuMBG(undefined, true);
  if (page === 'pending-payment') loadPendingPayment(undefined, true);
  if (page === 'audit-log' && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) { loadAuditLog(undefined, true); restoreFilterBarState('auditFilterBar'); }
  if (page === 'admin-assignment' && currentUser.role === 'SUPER_ADMIN') { loadAdminAssignments(true); restoreFilterBarState('adminAssignmentFilterBar'); }
  if (page === 'laporan') { /* Unified report center is installed by bootstrapRuntime(). */ }
    if (page === 'profil') renderProfil();
  
  // Hide/show local print buttons for non-admin/akuntan
  var isAdminOrAkuntan = currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || currentUser.role === 'AKUNTAN');
  document.querySelectorAll('.admin-print-btn').forEach(function(btn) {
    btn.style.display = isAdminOrAkuntan ? 'inline-flex' : 'none';
  });
}

// ===== DARK MODE =====
function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark-mode');
  var icon = $('themeToggleIcon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  safeStorage('set', 'darkMode', isDark ? '1' : '0');
}
function applyStoredTheme() {
  try {
    if (safeStorage('get', 'darkMode') === '1') {
      document.body.classList.add('dark-mode');
      var icon = $('themeToggleIcon');
      if (icon) icon.className = 'fas fa-sun';
    }
  } catch(e) {}
}

function toggleFilterBar(barId) {
  var bar = $(barId);
  if (!bar) return;
  var collapsed = bar.classList.toggle('collapsed');
  safeStorage('set', 'filterCollapsed_' + barId, collapsed ? '1' : '0');
}

function restoreFilterBarState(barId) {
  var bar = $(barId);
  if (!bar) return;
  var saved = safeStorage('get', 'filterCollapsed_' + barId);
  // Default: filter selalu ciut di semua ukuran layar, kecuali user pernah
  // membuka manual (saved === '0'). Ditutup lagi via toggleFilterBar('...').
  var shouldCollapse = saved === null || saved === '1';
  bar.classList.toggle('collapsed', shouldCollapse);
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  $('mainSidebar').classList.toggle('collapsed', sidebarCollapsed);
  $('mainWrapper').classList.toggle('sidebar-collapsed', sidebarCollapsed);
  safeStorage('set', 'sidebarCollapsed', sidebarCollapsed ? '1' : '0');
}
function openMobileSidebar() {
  $('mainSidebar').classList.add('mobile-open');
  $('sidebarOverlay').classList.add('active');
  var bnav = $('bottomNav');
  if (bnav) bnav.style.display = 'none';
}
function closeMobileSidebar() {
  $('mainSidebar').classList.remove('mobile-open');
  $('sidebarOverlay').classList.remove('active');
  var bnav = $('bottomNav');
  if (bnav) bnav.style.display = '';
}

// Modal helpers
var _openModalCount = 0;
var _savedScrollY = 0;

// Paksa iframe Google Sites melebar penuh saat modal dibuka,
// supaya footer/tombol Simpan tidak terpotong di luar area iframe.
function _forceIframeFullHeight() {
  try {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      window.innerHeight,
      900
    );
    window.parent.postMessage({ type: 'iframeResize', height: h + 100 }, '*');
  } catch(e) {}
}

// Kembalikan tinggi iframe ke ukuran normal (sesuai konten asli) saat modal ditutup.
function _restoreIframeHeight() {
  try {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'iframeResize', height: h }, '*');
  } catch(e) {}
}

function openModal(id) {
  var el = $(id);
  if (!el) { console.error('openModal: elemen #' + id + ' tidak ditemukan'); return; }
  el.classList.remove('hidden');
  _openModalCount++;
  _forceIframeFullHeight();
  // Hanya lock scroll body di desktop — di mobile biarkan natural
  // agar keyboard virtual tidak menggeser posisi tombol footer
  if (window.innerWidth >= 640) {
    _savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
  }
}
function closeModal(id) {
  var el = $(id);
  if (!el) return;
  el.classList.add('hidden');
  _openModalCount = Math.max(0, _openModalCount - 1);
  if (_openModalCount === 0) {
    document.body.style.overflow = '';
    if (window.innerWidth >= 640 && _savedScrollY) {
      window.scrollTo(0, _savedScrollY);
    }
    setTimeout(_restoreIframeHeight, 200);
  }
}

var _waReminderPendingId = null;

function sendWAReminderPending(id) {
  var p = allPending.find(function(x) { return x.id === id; });
  if (!p) { showToast('error', 'Error', 'Data pending tidak ditemukan'); return; }
  _waReminderPendingId = id;

  $('detailBody').innerHTML =
    '<div class="info-card" style="margin-bottom:16px;">' +
      infoRow('Referensi', esc(p.transaksiRef || '-')) +
      infoRow('Deskripsi', esc(p.deskripsi || '-')) +
      infoRow('Tanggal Pending', esc(p.tanggalPending || '-')) +
      infoRow('Rencana Pembayaran', esc(p.tanggalPayment || '-')) +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Nomor WhatsApp Tujuan <span class="req">*</span></label>' +
      '<input type="text" id="waReminderNomor" class="form-input" placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx" inputmode="numeric">' +
      '<p class="form-hint">Nomor diawali 08 akan otomatis dikonversi ke format 628.</p>' +
    '</div>';
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fab fa-whatsapp" style="color:#22c55e;margin-right:8px;"></i>Kirim Reminder WhatsApp';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Masukkan nomor tujuan untuk mengirim pengingat pembayaran';
  $('modalDetail').querySelector('.modal-footer').innerHTML =
    '<button onclick="closeModal(\'modalDetail\')" class="btn btn-outline">Batal</button>' +
    '<button onclick="executeWAReminder()" class="btn btn-success"><i class="fab fa-whatsapp"></i> Buka WhatsApp</button>';
  openModal('modalDetail');
}

function executeWAReminder() {
  var p = allPending.find(function(x) { return x.id === _waReminderPendingId; });
  if (!p) { showToast('error', 'Error', 'Data pending tidak ditemukan'); return; }
  var nomorWA = $('waReminderNomor').value.trim();
  if (!nomorWA) { showToast('error', 'Validasi', 'Nomor WhatsApp wajib diisi'); return; }

  var nomorClean = nomorWA.replace(/[^0-9]/g, '');
  if (nomorClean.indexOf('0') === 0) nomorClean = '62' + nomorClean.substring(1);

  var pesan = 'Halo, ini pengingat pembayaran dari SIM-SPPG.\n\n' +
    'Referensi: ' + (p.transaksiRef || '-') + '\n' +
    'Deskripsi: ' + (p.deskripsi || '-') + '\n' +
    'Tanggal Pending: ' + (p.tanggalPending || '-') + '\n' +
    'Rencana Pembayaran: ' + (p.tanggalPayment || '-') + '\n\n' +
    'Mohon segera diproses. Terima kasih.';

  var waUrl = 'https://wa.me/' + nomorClean + '?text=' + encodeURIComponent(pesan);
  window.open(waUrl, '_blank');
  closeModal('modalDetail');
}

// ============================================================
// 6. APP INITIALIZATION
// ============================================================
/* ============================================================
     APPLICATION INITIALIZATION
     ============================================================ */
function initApp() {
  if (!currentUser) return;

  var appLoadingEl = $('appLoadingOverlay');
  if (appLoadingEl) appLoadingEl.classList.remove('hidden');
  updatePwaRequirementGate();

  loadGlobalDateFilterState();
  currentPage = getRestorablePage();
  if (currentUser.role === 'SUPER_ADMIN') initializeSettingsHubLayout();

  buildSidebar();
  buildBottomNav();
  updateFabVisibility();
  initNotifBell();
  loadFeatureModes();
  loadMyAnnouncements();
  startIdleLogoutWatcher();
  startPresenceHeartbeat();
  if (_swRegistration) initPushNotification();

  // Kembali ke halaman terakhir yang memang tersedia untuk role pengguna.
  // Dashboard tetap menjadi fallback aman jika menu lama sudah tidak diizinkan.
  if (currentPage !== 'dashboard') switchPage(currentPage);

// Load foto profil ke icon menu (sidebar & bottom-nav) sejak awal, bukan hanya saat buka halaman Profil
  if (currentUser.fotoProfil && String(currentUser.fotoProfil).trim() !== '' && currentUser.fotoProfil !== '-') {
    callApi('getFileUrl', ['FOTO_PROFIL', currentUser.fotoProfil], function(res) {
      var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
      if (fotoUrl) updateMenuProfilAvatar(fotoUrl);
    }, null);
  }

  // Rebuild sidebar saat resize agar filter bottom-nav ikut menyesuaikan
  window.addEventListener('resize', function() {
    if (currentUser) buildSidebar();
  });
  // Pre-populate SPPG dengan fallback langsung (tidak tunggu API) agar
  // select sudah ada isinya saat user buka modal tambah transaksi pertama kali
  populateSPPGSelects();

  // Gunakan requestAnimationFrame agar DOM selesai render (termasuk ukuran
  // canvas) sebelum chart dan data dimuat agar KPI dan chart stabil.
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      try { initChart(); } catch(e) { console.error('initChart error:', e); }
      Promise.all([
        loadMyMenuVisibility(),
        loadDashboardData(true),
        loadDropdownOptions(),
        loadUsers(true),
        loadSuppliers(true)
      ]).then(function() {
        try { updateChart(); } catch(e) { console.error('updateChart error:', e); }
        if (appLoadingEl) appLoadingEl.classList.add('hidden');
      }).catch(function(e) {
        console.error('initApp load error:', e);
        if (appLoadingEl) appLoadingEl.classList.add('hidden');
      });
    });
  });

  if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') {
    var selDashSppg = $('dashFilterSPPG');
    if (selDashSppg) {
      selDashSppg.classList.remove('hidden');
      var sppgListInit = CFG_SPPG_FALLBACK;
      var htmlOpt = '<option value="ALL">Semua SPPG</option>';
      sppgListInit.forEach(function(s) { htmlOpt += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
      selDashSppg.innerHTML = htmlOpt;
    }
  }

  // Set default dates
  $('addTxTanggal').value = formatDateInput();
  $('addMenuTanggal').value = formatDateInput();
  $('addPendingTglPending').value = formatDateInput();
}

function loadDropdownOptions() {
  return new Promise(function(resolve) {
    callApi('getDropdownOptions', [], function(result) {
        if (result.success) {
                  dropdownOptions = result;
                  populateSPPGSelects();
                  populateSupplierSelects();
                  populateKategoriFilters();
                  populateMenuMBGSelect();
                }
                resolve();
      },
      function(err) {
        resolve();
      }
    );
  });
}

function populateSPPGSelects() {
  var lists = ['addTxSPPG'];
  var sppgList = dropdownOptions.sppgList && dropdownOptions.sppgList.length
    ? dropdownOptions.sppgList
    : CFG_SPPG_FALLBACK;
  lists.forEach(function(id) {
    var sel = $(id);
    if (!sel) return;
    var currentVal = sel.value; // simpan nilai aktif sebelum rebuild
    var html = '<option value="">Pilih SPPG</option>';
    sppgList.forEach(function(s) { html += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    sel.innerHTML = html;
    if (currentVal) sel.value = currentVal; // restore nilai setelah rebuild
  });
}
function populateSupplierSelects() {
  var suppliers = dropdownOptions.suppliers || [];
  var lists = ['addBBSupplier', 'addSTSupplier'];
  lists.forEach(function(id) {
    var sel = $(id);
    if (!sel) return;
    var html = id === 'addBBSupplier' ? '<option value="">Pilih Supplier</option>' : '<option value="">Pilih Supplier</option>';
    suppliers.forEach(function(s) { html += '<option value="' + esc(s.nama) + '">' + esc(s.nama) + '</option>'; });
    sel.innerHTML = html;
  });
  populateTransactionSupplierDatalist();
}

function transactionSupplierChoices(mode) {
  var sppgInput = mode === 'edit' ? $('editTxSPPG') : $('addTxSPPG');
  var targetSppg = sppgInput ? String(sppgInput.value || '').trim().toLowerCase() : '';
  var suppliers = dropdownOptions.suppliers || [];
  if (!targetSppg) return suppliers;
  return suppliers.filter(function(s) {
    return String(s.sppg || '').trim().toLowerCase() === targetSppg;
  });
}

function populateTransactionSupplierDatalist(mode) {
  var datalist = $('txSupplierDatalist');
  if (datalist) {
    datalist.innerHTML = transactionSupplierChoices(mode).map(function(s) {
      return '<option value="' + esc(s.nama) + '">' + esc((s.items || []).join(', ')) + '</option>';
    }).join('');
  }
}

function findTransactionSupplier(name, mode) {
  var normalized = String(name || '').trim().toLowerCase();
  return transactionSupplierChoices(mode).find(function(s) {
    return String(s.nama || '').trim().toLowerCase() === normalized;
  }) || null;
}

function handleTransactionSupplierInput(mode) {
  var prefix = mode === 'edit' ? 'editTx' : 'addTx';
  var input = $(prefix + 'Supplier');
  var idInput = $(prefix + 'SupplierId');
  var hint = $(prefix + 'SupplierHint');
  if (!input || !idInput) return;
  var supplier = findTransactionSupplier(input.value, mode);
  idInput.value = supplier ? supplier.id : '';
  if (hint) {
    hint.innerHTML = supplier
      ? '<i class="fas fa-check-circle" style="color:var(--emerald)"></i> Supplier master dipilih. Data rekening akan disalin otomatis saat disimpan.'
      : 'Penjual manual. Isi rekening di bawah bila pembayaran melalui transfer.';
  }
  var bankFields = $(prefix + 'ManualBankFields');
  var holderField = $(prefix + 'ManualAccountHolderField');
  if (bankFields) bankFields.style.display = supplier ? 'none' : '';
  if (holderField) holderField.style.display = supplier ? 'none' : '';
  if (supplier && mode === 'add') {
    var itemInput = $('addTxItem');
    if (itemInput && !itemInput.value && supplier.items && supplier.items.length === 1) itemInput.value = supplier.items[0];
  }
}

function populateKategoriFilters() {
  var kat = dropdownOptions.kategori || [];
  var sel = $('bbFilterKategori');
  if (!sel) return;
  var html = '<option value="ALL">Semua Kategori</option>';
  kat.forEach(function(k) { html += '<option value="' + esc(k) + '">' + esc(k) + '</option>'; });
  sel.innerHTML = html;
}
function populateMenuMBGSelect() {
  var bb = dropdownOptions.bahanBaku || [];
  var sel = $('addMenuList');
  if (!sel) return;
  var html = '';
  bb.forEach(function(b) { html += '<option value="' + esc(b.nama) + '">' + esc(b.nama) + ' (' + esc(b.satuan) + ')</option>'; });
  sel.innerHTML = html;
}
function populatePendingTransaksiSelect() {
  var sel = $('addPendingTransaksi');
  if (!sel || !allTransactions.length) return;
  var html = '<option value="">Pilih Transaksi</option>';
  allTransactions.forEach(function(t) {
    html += '<option value="' + esc(t.kode || t.id) + '">' + esc(t.kode || t.id) + ' - ' + esc(t.item || '-') + ' (' + formatRupiah(t.nominal) + ')</option>';
  });
  sel.innerHTML = html;
}

// ============================================================
// 7. DASHBOARD
// ============================================================

/* ============================================================
     DASHBOARD
     ============================================================ */
function loadDashboardData(silent) {
  return new Promise(function(resolve) {
    if (!currentUser) { resolve(); return; }
    // R3: Tampilkan skeleton screen, sembunyikan stat cards sementara
    var skeleton = $('skeletonDashboard');
    var statCards = $('dashboardStats');
    if (!silent && skeleton && statCards) { skeleton.classList.remove('hidden'); statCards.classList.add('hidden'); }
    if (!silent) showLoading(true);
    // KPI utama selalu all-time. Filter tanggal hanya digunakan pada grafik
    // dan daftar data, sehingga pemuatan awal dan tombol refresh konsisten.
    callApi('getDashboardKPI', [], function(result) {
        if (!silent) showLoading(false);
                // R3: Sembunyikan skeleton, tampilkan stat cards
                if (skeleton && statCards) { skeleton.classList.add('hidden'); statCards.classList.remove('hidden'); }
                if (result.success) {
                  $('statSaldo').textContent = formatRupiah(result.saldoBerjalan);
                  $('statPemasukan').textContent = formatRupiah(result.totalPemasukan);
                  $('statPengeluaran').textContent = formatRupiah(result.totalPengeluaran);
                  $('statAntrian').textContent = result.antrianApproval || 0;
                  $('statAntrianNominal').textContent = formatRupiah(result.totalBelumBayar);
                  // Update badge
                  var cnt = result.antrianApproval || 0;
                  var badge = $('approvalCount');
                  if (badge) { badge.textContent = cnt; badge.style.display = cnt > 0 ? 'inline-flex' : 'none'; }
                  var badgeSidebar = $('approvalCountSidebar');
                  if (badgeSidebar) { badgeSidebar.textContent = cnt; badgeSidebar.style.display = cnt > 0 ? 'inline-flex' : 'none'; }
                  syncApprovalBadgeToBottomNav();
                }
                resolve();
      },
      function(err) {
        if (!silent) showLoading(false); resolve();
      }
    );
  });
}

function initChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  var canvasEl = $('cashFlowChart');
  if (!canvasEl) return; // Canvas dashboard tidak ada di halaman ini — hindari crash
  var ctx = canvasEl.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Pemasukan', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 6 },
        { label: 'Pengeluaran', data: [], borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 6 },
        { label: 'Saldo', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.05)', tension: 0.3, fill: false, borderDash: [5,5], pointRadius: 3, pointHoverRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8, callbacks: { label: function(c) { return c.dataset.label + ': ' + formatRupiah(c.raw); } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, callback: function(v) { if (Math.abs(v) >= 1000000) return (v/1000000).toFixed(0)+'jt'; if (Math.abs(v) >= 1000) return (v/1000).toFixed(0)+'rb'; return v; } } }
      }
    }
  });
}

// Helper: konversi string tanggal format DD/MM/YYYY menjadi objek Date,
// dipakai khusus untuk sorting label chart di renderLaporanCharts().
function parseDate(str) {
  if (!str || str === '-') return new Date(0);
  var parts = String(str).split('/');
  if (parts.length !== 3) return new Date(0);
  var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function updateChart() {
  if (!chartInstance || !currentUser) return;
  var periodeSel = $('dashFilterPeriode');
  var days = periodeSel ? parseInt(periodeSel.value) || 30 : 30;
  var end = new Date();
  var start = new Date(); start.setDate(start.getDate() - days);
  var filters = { dateStart: formatDateInput(start), dateEnd: formatDateInput(end) };

  var sppgSel = $('dashFilterSPPG');
  var sppgFilterVal = (sppgSel && sppgSel.value !== 'ALL') ? sppgSel.value : '';

    callApi('getChartData', [
      { sppgFilter: sppgFilterVal },
      filters
    ], function(data) {
        var chartCount = $('chartDataCount');
        if (!data || !data.length) {
          if (chartCount) chartCount.textContent = '0 data';
          chartInstance.data.labels = [];
          chartInstance.data.datasets.forEach(function(ds){ ds.data = []; });
          chartInstance.update();
          return;
        }
        if (chartCount) chartCount.textContent = data.length + ' data';
              chartInstance.data.labels = data.map(function(d) { return d.tanggal; });
              chartInstance.data.datasets[0].data = data.map(function(d) { return d.pemasukan; });
              chartInstance.data.datasets[1].data = data.map(function(d) { return d.pengeluaran; });
              chartInstance.data.datasets[2].data = data.map(function(d) { return d.saldo; });
              chartInstance.update();
      },
      function(err) {
        console.error(err);
      }
    );
}

// ============================================================
// 7b. NOTIFIKASI LONCENG (ADMIN / SUPER_ADMIN)
// ============================================================
function initNotifBell() {
  var wrap = $('notifBellWrap');
  if (!wrap) return;
  if (!currentUser) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  loadNotifications(1, false);
  if (notifPollTimer) clearInterval(notifPollTimer);
  notifPollTimer = setInterval(function(){ loadNotifications(1, false); }, 60000); // refresh tiap 60 detik
}

var _lastUnreadCount = null; // null = belum pernah load (hindari bunyi saat pertama buka app)

function loadNotifications(page, append) {
  if (!currentUser) return;
  page = Math.max(1, Number(page) || 1);
  append = !!append;
  if (append && notifLoadingMore) return;
  if (append) notifLoadingMore = true;
  callApi('getNotifications', [{ page: page, pageSize: notifPageSize }], function(result) {
    notifLoadingMore = false;
    if (result && result.success) {
      var incoming = Array.isArray(result.data) ? result.data : [];
      notifServerPaged = Number(result.page) > 0;
      notifPage = notifServerPaged ? Number(result.page || page) : 1;
      notifServerTotal = notifServerPaged ? Number(result.total || incoming.length) : incoming.length;
      notifHasMore = notifServerPaged ? !!result.hasMore : false;
      if (append) {
        var existing = {};
        notifList.forEach(function(n) { existing[String(n.logId || '')] = true; });
        incoming.forEach(function(n) {
          var key = String(n.logId || '');
          if (!existing[key]) { notifList.push(n); existing[key] = true; }
        });
      } else {
        notifList = incoming;
      }
      var unreadCount = Number(result.unreadCount || 0);
      renderNotifBadge(unreadCount);
      renderNotifPanel();
      if (!append && _lastUnreadCount !== null && unreadCount > _lastUnreadCount) playNotifSound();
      if (!append) _lastUnreadCount = unreadCount;
    }
  }, function() {
    notifLoadingMore = false;
    renderNotifPanel();
  });
}

function renderNotifBadge(count) {
  var badge = $('notifBellBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifPanel() {
  var listEl = $('notifPanelList');
  if (!listEl) return;
  if (!notifList.length) {
    listEl.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Tidak ada notifikasi</p></div>';
    return;
  }
  var html = '';
  notifList.forEach(function(n, idx) {
    var actionClass = n.actionType === 'DELETE' ? 'action-delete' : (n.actionType === 'EDIT' ? 'action-edit' : 'action-add');
    html += '<div class="notif-item ' + (n.isRead ? '' : 'unread') + '" onclick="handleNotifClick(' + idx + ')">' +
      '<div class="notif-item-icon ' + actionClass + '"><i class="fas ' + esc(n.icon || 'fa-bell') + '"></i></div>' +
      '<div class="notif-item-content">' +
        '<div class="notif-item-title">' + esc(n.label || 'Aktivitas Baru') + '</div>' +
        '<div class="notif-item-desc">' + esc(n.deskripsi || '-') + '</div>' +
        '<div class="notif-item-time"><i class="fas fa-clock" style="margin-right:3px;"></i>' + esc(n.waktu || '-') + ' oleh ' + esc(n.pelaku || '-') + '</div>' +
      '</div>' +
    '</div>';
  });
  if (notifServerPaged && notifHasMore) {
    html += '<button type="button" class="notif-load-more" onclick="event.stopPropagation();loadMoreNotifications()" ' + (notifLoadingMore ? 'disabled' : '') + '>' +
      (notifLoadingMore ? '<i class="fas fa-circle-notch fa-spin"></i> Memuat...' : '<i class="fas fa-chevron-down"></i> Muat lebih banyak') +
      '</button>';
  }
  listEl.innerHTML = html;
}

function loadMoreNotifications() {
  if (!notifHasMore || notifLoadingMore) return;
  loadNotifications(notifPage + 1, true);
}

function toggleNotifPanel() {
  var panel = $('notifPanel');
  if (!panel) return;
  var willOpen = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (willOpen) loadNotifications(1, false);
}

function closeNotifPanel() {
  var panel = $('notifPanel');
  if (panel) panel.classList.add('hidden');
}

// Tutup panel notifikasi saat klik di luar area
document.addEventListener('click', function(e) {
  var wrap = $('notifBellWrap');
  if (wrap && !wrap.contains(e.target)) closeNotifPanel();
});

// Peta halaman notifikasi -> fungsi highlight baris terkait setelah pindah halaman
var NOTIF_PAGE_HANDLER = {
  'users': function(recordId) {
    var row = allUsers.find(function(u) { return String(u.id) === String(recordId); });
    highlightRowById('usersTableBody', row ? row._row : null);
  },
  'transaksi': function(recordId) {
    openDetailTransaksi(recordId);
  },
  'master-bahan': function(recordId) {
    highlightRowById('masterBBTableBody', recordId, true);
  },
  'master-supplier': function(recordId) {
    highlightRowById('supplierTableBody', recordId, true);
  },
  'survei': function(recordId) {
    highlightRowById('surveiTableBody', recordId, true);
  },
  'serah-terima': function(recordId) {
    highlightRowById('serahTerimaTableBody', recordId, true);
  },
  'menu-mbg': function(recordId) {
    // Menu MBG tidak render by-id di DOM, cukup buka halamannya
  }
};

// Cari baris tabel berdasarkan ID (baik _row numerik atau ID string) lalu scroll+highlight
function highlightRowById(tbodyId, matchId, isStringId) {
  setTimeout(function() {
    var tbody = $(tbodyId);
    if (!tbody || matchId === null || matchId === undefined) return;
    var rows = tbody.querySelectorAll('tr');
    var target = null;
    if (isStringId) {
      // Cocokkan lewat tombol aksi yang memuat ID di onclick (delete/edit) sebagai fallback pencarian teks
      rows.forEach(function(tr) {
        if (!target && tr.innerHTML.indexOf(matchId) > -1) target = tr;
      });
    } else {
      rows.forEach(function(tr) {
        var editBtn = tr.querySelector('[onclick*="openEditUserModal(' + matchId + ')"]');
        if (editBtn) target = tr;
      });
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.transition = 'background 0.3s';
      target.style.background = '#fef3c7';
      setTimeout(function() { target.style.background = ''; }, 2500);
    }
  }, 400);
}

function handleNotifClick(idx) {
  var n = notifList[idx];
  if (!n) return;
  closeNotifPanel();

  // Tandai sudah dibaca (optimistic update di UI + kirim ke server)
  if (!n.isRead) {
    n.isRead = true;
    renderNotifPanel();
    renderNotifBadge(notifList.filter(function(x) { return !x.isRead; }).length);
    callApi('markNotificationRead', [n.logId], null, null);
  }

  // Navigasi ke halaman terkait
  switchPage(n.page);
  var handler = NOTIF_PAGE_HANDLER[n.page];
  if (handler) {
    setTimeout(function() { handler(n.recordId); }, 350);
  }
}

function markAllNotifRead() {
  if (!notifList.some(function(n) { return !n.isRead; })) return;
  notifList.forEach(function(n) { n.isRead = true; });
  renderNotifPanel();
  renderNotifBadge(0);
  callApi('markAllNotificationsRead', [], function(result) {
      if (!result || !result.success) loadNotifications(1, false); // fallback: reload jika gagal
    }, function(err) {
      loadNotifications(1, false);
    });
}

// ============================================================
// 8. PROFIL
// ============================================================

// Mengganti icon fa-user-circle di sidebar & bottom-nav dengan foto profil user (jika ada)
function updateMenuProfilAvatar(url) {
  var sidebarIcon = document.querySelector('#sidebarMenu .menu-item[data-page="profil"] i.fas');
  var bnavIcon = document.querySelector('#bottomNavInner .bnav-item[data-page="profil"] i.fas');
  [sidebarIcon, bnavIcon].forEach(function(icon) {
    if (!icon) return;
    var parent = icon.parentElement;
    if (!parent) return;
    var existingImg = parent.querySelector('img.menu-avatar-img');
    if (url) {
      if (existingImg) {
        existingImg.src = url;
      } else {
        var img = document.createElement('img');
        img.className = 'menu-avatar-img';
        img.src = url;
        img.alt = 'Profil';
        img.style.cssText = 'width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;';
        icon.style.display = 'none';
        parent.insertBefore(img, icon);
      }
    } else {
      if (existingImg) existingImg.remove();
      icon.style.display = '';
    }
  });
}


/* ============================================================
     PROFILE
     ============================================================ */
function renderProfil() {
  if (!currentUser) return;
  $('profilNama').textContent = currentUser.namaLengkap || currentUser.username;
  $('profilEmail').textContent = currentUser.email || '-';
  $('profilJabatanBadge').textContent = currentUser.jabatan || '-';
  $('profilSPPGBadge').textContent = currentUser.sppg || '-';
  $('profilRoleBadge').textContent = currentUser.role || '-';

  $('profilNamaLengkap').textContent = currentUser.namaLengkap || '-';
  $('profilEmailVal').textContent = currentUser.email || '-';
  $('profilJabatan').textContent = currentUser.jabatan || '-';
  $('profilSPPG').textContent = currentUser.sppg || '-';
  $('profilRole').textContent = currentUser.role || '-';
  $('profilUsername').textContent = currentUser.username || '-';
  $('profilYayasan').textContent = currentUser.namaYayasan || '-';
  $('profilTimestamp').textContent = currentUser.timestamp ? formatDate(currentUser.timestamp) : '-';

  var fotoPath = currentUser.fotoProfil;
  var fallbackAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.namaLengkap || currentUser.username) + '&background=1e6f9c&color=fff&size=200&rounded=true';
  $('profilAvatar').src = fallbackAvatarUrl;
  $('profilAvatar').onerror = function() { this.src = fallbackAvatarUrl; };
  if (fotoPath && String(fotoPath).trim() !== '' && fotoPath !== '-') {
    callApi('getFileUrl', [
      'FOTO_PROFIL',
      fotoPath
    ], function(res) {
        var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
        if (fotoUrl) {
          $('profilAvatar').src = fotoUrl;
          updateMenuProfilAvatar(fotoUrl);
        }
      }, null);
  } else {
    updateMenuProfilAvatar('');
  }
}

function openEditProfilModal() {
  if (!currentUser) return;
  $('editNama').value    = currentUser.namaLengkap || '';
  $('editJabatan').value = currentUser.jabatan || '';
  $('editSPPG').value    = currentUser.sppg || '';
  $('editYayasan').value = currentUser.namaYayasan || '';
  $('editFotoPreview').classList.add('hidden');
  // Sembunyikan dropdown list kalau masih terbuka
  var editList = $('editSppgList');
  if (editList) editList.classList.add('hidden');
  var editYayasanListEl = $('editYayasanList');
  if (editYayasanListEl) editYayasanListEl.classList.add('hidden');
  if (!YAYASAN_MASTER.length) loadYayasanMaster();
  openModal('modalEditProfil');
}
function saveEditProfil() {
  var nama    = $('editNama').value.trim();
  var jabatan = $('editJabatan').value;
  var sppg    = $('editSPPG').value.trim().toUpperCase();
  var yayasan = $('editYayasan').value.trim();
  if (!nama) { showToast('error', 'Error', 'Nama tidak boleh kosong'); return; }
  var updateData = { 'NAMA LENGKAP': nama };
  if (jabatan) updateData['JABATAN'] = jabatan;
  if (sppg)    updateData['SPPG'] = sppg;
  updateData['NAMA YAYASAN'] = yayasan;
  if (jabatan) updateData['JABATAN'] = jabatan;
  if (sppg) updateData['SPPG'] = sppg;
  updateData['NAMA YAYASAN'] = yayasan;
  var fotoFile = $('editFoto').files[0];
  if (fotoFile) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      showLoading(true);
    callApi('uploadFotoProfil', [
      currentUser.username,
      base64,
      fotoFile.type,
      fotoFile.name
    ], function(up) {
        showLoading(false);
                  if (up.success) {
                    // Simpan fileId ke currentUser dan updateData
                    updateData['FOTO PROFIL'] = up.fileId;
                    currentUser.fotoProfil = up.fileId;
                    doUpdateProfil(updateData);
                  } else {
                    showToast('error', 'Gagal Upload', up.message || 'Upload foto gagal');
                  }
      },
      function(err) {
        showLoading(false);
                  showToast('error', 'Gagal', 'Terjadi kesalahan saat upload foto');
      }
    );
    };
    reader.readAsDataURL(fotoFile);
  } else {
    doUpdateProfil(updateData);
  }
}

function doUpdateProfil(updateData) {
  showLoading(true);
    callApi('updateUserProfile', [
      currentUser.username,
      updateData
    ], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Sukses', result.message);
                currentUser.namaLengkap = updateData['NAMA LENGKAP'] || currentUser.namaLengkap;
                if (updateData['FOTO PROFIL']) currentUser.fotoProfil = updateData['FOTO PROFIL'];
                if (updateData['JABATAN']) currentUser.jabatan = updateData['JABATAN'];
                if (updateData['SPPG']) currentUser.sppg = updateData['SPPG'];
                if (updateData['NAMA YAYASAN'] !== undefined) currentUser.namaYayasan = updateData['NAMA YAYASAN'];
                safeStorage('set', 'sppg_session', JSON.stringify({ user: currentUser, expiry: sessionExpiry }));
                renderProfil();
                closeModal('modalEditProfil');
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false);
              showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// SUPER ADMIN — TAMBAH USER
// ============================================================
function setAdminAddUserResult(success, message) {
  var box = $('adminAddUserResult');
  if (!box) return;
  box.classList.remove('hidden');
  box.style.background = success ? '#ecfdf5' : '#fff1f2';
  box.style.border = success ? '1px solid #a7f3d0' : '1px solid #fecdd3';
  box.style.color = success ? '#047857' : '#be123c';
  box.textContent = message || '';
}

function submitAdminAddUser() {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    showToast('error', 'Akses Ditolak', 'Hanya Super Admin yang dapat menambah user.');
    return;
  }

  var emailInput = $('adminAddUserEmail');
  var passwordInput = $('adminAddUserPassword');
  var button = $('btnAdminAddUser');
  var email = String(emailInput && emailInput.value || '').trim().toLowerCase();
  var password = String(passwordInput && passwordInput.value || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAdminAddUserResult(false, 'Alamat email tidak valid.');
    return;
  }
  if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
    setAdminAddUserResult(false, 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span> Membuat akun...</span>';
  setAdminAddUserResult(true, 'Sedang membuat akun dan mengirim email konfirmasi...');

  callApi('createUserBySuperAdmin', [{ email: email, password: password }], function(result) {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>';
    if (result && result.success) {
      setAdminAddUserResult(true, result.message || 'Akun berhasil dibuat dan email konfirmasi telah dikirim.');
      showToast('success', 'User Berhasil Ditambahkan', result.message || 'Email konfirmasi telah dikirim.');
      emailInput.value = '';
      passwordInput.value = '';
      if (typeof loadUsers === 'function') loadUsers(true);
      return;
    }
    var message = result && result.message || 'Pembuatan akun gagal.';
    setAdminAddUserResult(false, message);
    showToast('error', 'Gagal', message);
  }, function(error) {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-user-plus"></i><span> Tambahkan User</span>';
    var message = error && error.message ? error.message : 'Pembuatan akun gagal.';
    setAdminAddUserResult(false, message);
    showToast('error', 'Gagal', message);
  });
}

// ============================================================
// 9. USERS (ADMIN)
// ============================================================

// Cache URL foto profil per sesi browser — mencegah download ulang foto
// (~1 MB/user) setiap kali tabel di-render ulang oleh heartbeat presence 30 detik.
// Key: fotoProfil id (fileId), Value: signed URL yang sudah didapat.
var _avatarUrlCache = {};

function loadUsers(silent, page, forceAll) {
  return new Promise(function(resolve) {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) { resolve(); return; }
    page = Math.max(1, Number(page) || usersPage || 1);
    forceAll = !!forceAll;
    if (!silent) showLoading(true);
    var params = forceAll ? [] : [{ page: page, pageSize: ITEMS_PER_PAGE }];
    callApi('getAllUsers', params, function(result) {
      if (!silent) showLoading(false);
      if (result && result.success) {
        var rows = Array.isArray(result.data) ? result.data : [];
        usersServerPaged = !forceAll && Number(result.page) > 0;
        usersServerTotal = usersServerPaged ? Number(result.total || 0) : rows.length;
        usersPage = usersServerPaged ? Number(result.page || page) : 1;
        allUsers = rows;
        applyUsersFiltersLocal();
        populateUsersFilterOptions();
        renderUsersTable();
      }
      resolve();
    }, function(err) {
      if (!silent) { showLoading(false); showToast('error', 'Gagal', 'Tidak dapat memuat data users'); }
      allUsers=[]; filteredUsers=[]; usersServerTotal=0; usersServerPaged=false;
      renderUsersTable();
      resolve();
    });
  });
}
function renderUsersTable() {
  var tbody = $('usersTableBody');
  if (!filteredUsers.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-users"></i></div><h4>Tidak Ada Users</h4></div></td></tr>';
    renderPagination('usersPagination', 1, 0, 'goUsersPage');
    return;
  }
  var totalPages = Math.ceil((usersServerPaged ? usersServerTotal : filteredUsers.length) / ITEMS_PER_PAGE);
  if (usersPage > totalPages) usersPage = totalPages;
  var start = (usersPage - 1) * ITEMS_PER_PAGE;
  var pageData = usersServerPaged ? filteredUsers : filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(u, i) {
    var avatarFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.namaLengkap || u.username) + '&background=1e6f9c&color=fff&size=60&rounded=true';
    var avatarImgId = 'userAvatar_' + esc(u.username);
    var userKey = getManagedUserKey(u);
    var rowLabel = 'Lihat detail user ' + (u.namaLengkap || u.username || '');
    var isOnline = !!u.isOnline || (!!u.lastSeenAt && Date.now() - new Date(u.lastSeenAt).getTime() < 75000);
    var presenceColor = isOnline ? '#16a34a' : '#94a3b8';
    var presenceBg = isOnline ? '#dcfce7' : '#f1f5f9';
    var presenceText = isOnline ? 'Online' : formatUserLastSeen(u.lastSeenAt);
    html += '<tr class="user-row-clickable" tabindex="0" role="button" data-user-key="' + esc(userKey) + '" aria-label="' + esc(rowLabel) + '" onclick="openUserDetailModal(this.dataset.userKey)" onkeydown="handleUserRowKeydown(event,this.dataset.userKey)">' +
      '<td style="text-align:center;color:var(--slate-400);font-weight:600;">' + (start + i + 1) + '</td>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<img id="' + avatarImgId + '" src="' + esc(avatarFallback) + '" style="width:36px;height:36px;border-radius:10px;object-fit:cover;border:2px solid var(--slate-200);flex-shrink:0;" alt="' + esc(u.namaLengkap) + '" onerror="this.src=\'' + avatarFallback + '\'">' +
          '<div><div style="font-weight:600;color:var(--slate-800);">' + esc(u.namaLengkap) + '</div><div style="font-size:11px;color:var(--slate-400);">@' + esc(u.username) + '</div></div>' +
        '</div></td>' +
      '<td>' + esc(u.email || '-') + '</td>' +
      '<td><span class="badge badge-blue">' + esc(u.jabatan || '-') + '</span></td>' +
      '<td><span class="badge badge-outline">' + esc(u.sppg || '-') + '</span></td>' +
      '<td><span title="' + esc(u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('id-ID') : 'Belum ada aktivitas') + '" style="display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:' + presenceBg + ';color:' + presenceColor + ';font-size:11px;font-weight:700;white-space:nowrap;"><span style="width:8px;height:8px;border-radius:50%;background:' + presenceColor + ';box-shadow:' + (isOnline ? '0 0 0 3px rgba(22,163,74,.14)' : 'none') + ';"></span>' + esc(presenceText) + '</span></td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
  renderPagination('usersPagination', usersPage, totalPages, 'goUsersPage');

  pageData.forEach(function(u) {
    if (u.fotoProfil && String(u.fotoProfil).trim() !== '' && u.fotoProfil !== '-') {
      var cachedUrl = _avatarUrlCache[u.fotoProfil];
      if (cachedUrl) {
        var imgCached = document.getElementById('userAvatar_' + u.username);
        if (imgCached) imgCached.src = cachedUrl;
        return;
      }
      callApi('getFileUrl', ['FOTO_PROFIL', u.fotoProfil], function(res) {
        var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
        if (fotoUrl) {
          _avatarUrlCache[u.fotoProfil] = fotoUrl;
          var img = document.getElementById('userAvatar_' + u.username);
          if (img) img.src = fotoUrl;
        }
      }, null);
    }
  });
}

function formatUserLastSeen(value) {
  if (!value) return 'Belum pernah online';
  var date = new Date(value);
  if (isNaN(date.getTime())) return 'Tidak diketahui';
  var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Baru saja';
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' menit lalu';
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' jam lalu';
  var days = Math.floor(hours / 24);
  if (days < 7) return days + ' hari lalu';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function applyUsersFiltersLocal() {
  var search = $('usersSearchInput') ? $('usersSearchInput').value.toLowerCase().trim() : '';
  var sppg = $('usersFilterSppg') ? $('usersFilterSppg').value : 'ALL';
  var role = $('usersFilterRole') ? $('usersFilterRole').value : 'ALL';
  filteredUsers = allUsers.filter(function(u) {
    var teks = (u.namaLengkap || '') + ' ' + (u.username || '') + ' ' + (u.email || '');
    if (search && teks.toLowerCase().indexOf(search) === -1) return false;
    if (sppg !== 'ALL' && u.sppg !== sppg) return false;
    if (role !== 'ALL' && u.role !== role) return false;
    return true;
  });
}
function filterUsers() {
  var search = $('usersSearchInput') ? $('usersSearchInput').value.trim() : '';
  var sppg = $('usersFilterSppg') ? $('usersFilterSppg').value : 'ALL';
  var role = $('usersFilterRole') ? $('usersFilterRole').value : 'ALL';
  var needsFullDataset = !!search || sppg !== 'ALL' || role !== 'ALL';
  clearTimeout(usersFilterTimer);
  usersFilterTimer=setTimeout(function(){ usersPage=1; loadUsers(false,1,needsFullDataset); },300);
}
function populateUsersFilterOptions() {
  var sppgSel = $('usersFilterSppg'), roleSel = $('usersFilterRole');
  if (!sppgSel || !roleSel) return;
  var selectedSppg=sppgSel.value||'ALL', selectedRole=roleSel.value||'ALL';
  var sppgSet = {}, roleSet = {};
  allUsers.forEach(function(u) { if (u.sppg) sppgSet[u.sppg] = true; if (u.role) roleSet[u.role] = true; });
  sppgSel.innerHTML = '<option value="ALL">Semua SPPG</option>' + Object.keys(sppgSet).sort().map(function(s){ return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  roleSel.innerHTML = '<option value="ALL">Semua Role</option>' + Object.keys(roleSet).sort().map(function(r){ return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('');
  if(selectedSppg!=='ALL'&&!sppgSet[selectedSppg])sppgSel.insertAdjacentHTML('beforeend','<option value="'+esc(selectedSppg)+'">'+esc(selectedSppg)+'</option>');
  if(selectedRole!=='ALL'&&!roleSet[selectedRole])roleSel.insertAdjacentHTML('beforeend','<option value="'+esc(selectedRole)+'">'+esc(selectedRole)+'</option>');
  sppgSel.value=selectedSppg; roleSel.value=selectedRole;
}

function goUsersPage(p) { if(usersServerPaged) loadUsers(false,p,false); else { usersPage=p; renderUsersTable(); } }
function getManagedUserKey(user) {
  return String(user && (user.id || user.username || user._row) || '');
}

function findManagedUser(userKey) {
  var key = String(userKey || '');
  return allUsers.find(function(u) { return getManagedUserKey(u) === key; });
}

function handleUserRowKeydown(event, userKey) {
  if (!event) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openUserDetailModal(userKey);
  }
}

function openUserDetailModal(userKey) {
  var user = findManagedUser(userKey);
  if (!user) {
    showToast('error', 'Error', 'Data user tidak ditemukan');
    return;
  }
  currentDetailUserRow = getManagedUserKey(user);

  var fullName = user.namaLengkap || user.username || '-';
  var username = user.username || '-';
  var fallbackAvatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=1e6f9c&color=fff&size=240&rounded=true';
  var avatar = $('userDetailAvatar');
  if (avatar) {
    avatar.src = fallbackAvatarUrl;
    avatar.alt = 'Foto profil ' + fullName;
    avatar.onerror = function() { this.src = fallbackAvatarUrl; };
  }

  $('userDetailName').textContent = fullName;
  $('userDetailUsername').textContent = '@' + username;
  $('userDetailEmail').textContent = user.email || '-';
  $('userDetailJabatan').textContent = user.jabatan || '-';
  $('userDetailSppg').textContent = user.sppg || '-';
  $('userDetailYayasan').textContent = user.namaYayasan || '-';
  $('userDetailRole').textContent = user.role || '-';
  $('userDetailRegistered').textContent = user.timestamp ? formatDate(user.timestamp) : '-';

  var roleBadge = $('userDetailRoleBadge');
  if (roleBadge) {
    roleBadge.textContent = user.role || '-';
    roleBadge.className = 'badge ' + (user.role === 'SUPER_ADMIN' ? 'badge-purple' : (user.role === 'ADMIN' ? 'badge-blue' : 'badge-outline'));
  }
  var sppgBadge = $('userDetailSppgBadge');
  if (sppgBadge) sppgBadge.textContent = user.sppg || '-';

  openModal('modalUserDetail');

  if (user.fotoProfil && String(user.fotoProfil).trim() !== '' && user.fotoProfil !== '-') {
    var cachedDetailUrl = _avatarUrlCache[user.fotoProfil];
    if (cachedDetailUrl) {
      if (avatar) avatar.src = cachedDetailUrl;
    } else {
      callApi('getFileUrl', ['FOTO_PROFIL', user.fotoProfil], function(res) {
        var fotoUrl = (res && res.data && res.data.url) ? res.data.url : (res && res.url ? res.url : '');
        if (fotoUrl) {
          _avatarUrlCache[user.fotoProfil] = fotoUrl;
          if (fotoUrl && currentDetailUserRow === getManagedUserKey(user) && avatar) avatar.src = fotoUrl;
        }
      }, null);
    }
  }
}

function editUserFromDetail() {
  var userKey = currentDetailUserRow;
  if (!userKey) return;
  closeModal('modalUserDetail');
  openEditUserModal(userKey);
}

function deleteUserFromDetail() {
  var user = findManagedUser(currentDetailUserRow);
  if (!user) return;
  closeModal('modalUserDetail');
  confirmHapus('user', 0, user.username, 'user ' + String(user.namaLengkap || '').substring(0, 20));
}

function openEditUserModal(userKey) {
  var user = findManagedUser(userKey);
  if (!user) return;
  currentEditRow = getManagedUserKey(user);
  $('editUserRow').value = currentEditRow;
  $('editUserNama').value = user.namaLengkap || '';
  $('editUserEmail').value = user.email || '';
  $('editUserJabatan').value = user.jabatan || '';
  $('editUserSPPG').value = user.sppg || '';
  $('editUserYayasan').value = user.namaYayasan || '';
  var roleWrap = $('editUserRoleWrap');
  if (currentUser && currentUser.role === 'SUPER_ADMIN') {
    if (roleWrap) roleWrap.classList.remove('hidden');
    $('editUserRole').value = user.role || 'LAPANGAN';
  } else {
    if (roleWrap) roleWrap.classList.add('hidden');
  }
  if (!YAYASAN_MASTER.length) loadYayasanMaster();
  openModal('modalEditUser');
}
function saveEditUser() {
  var sppgVal = $('editUserSPPG').value.trim().toUpperCase();
  var fields = {
    'NAMA LENGKAP': $('editUserNama').value.trim(),
    'EMAIL': $('editUserEmail').value.trim(),
    'JABATAN': $('editUserJabatan').value,
    'SPPG': sppgVal,
    'NAMA YAYASAN': $('editUserYayasan').value.trim(),
    _isAdmin: true
  };
  if (sppgVal && SPPG_MASTER.indexOf(sppgVal) === -1) SPPG_MASTER.push(sppgVal);
  if (currentUser && currentUser.role === 'SUPER_ADMIN') {
    fields['ROLE'] = $('editUserRole').value;
  }
    var managedUser = findManagedUser(currentEditRow);
    if (!managedUser || !managedUser.username) {
      showToast('error', 'Gagal', 'Data user tidak ditemukan');
      return;
    }
    callApi('updateUserProfile', [
      managedUser.username,
      fields
    ], function(result) {
        if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalEditUser'); loadUsers(); }
              else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 10. TRANSAKSI
// ============================================================

/* ============================================================
     TRANSACTIONS
     ============================================================ */
function loadTransactions(page, forceAll, silent) {
  if (!currentUser) return;
  page = Math.max(1, Number(page) || txPage || 1);
  forceAll = !!forceAll;
  if (!silent) showLoading(true);
  var tbody = $('transaksiTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton-screen" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>'.repeat(5) +
      '</div></td></tr>';
  }

  var isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  var isAdmin = currentUser.role === 'ADMIN';
  var filters = {};
  var sppgEl=$('txFilterSPPG'), kategoriEl=$('txFilterKategori');
  if (sppgEl && sppgEl.value && sppgEl.value !== 'ALL') filters.sppg=sppgEl.value;
  if (kategoriEl && kategoriEl.value && kategoriEl.value !== 'ALL') filters.kategori=kategoriEl.value;
  var localDateStart = $('txFilterTglStart') ? $('txFilterTglStart').value : '';
  var localDateEnd = $('txFilterTglEnd') ? $('txFilterTglEnd').value : '';
  if (localDateStart || localDateEnd) {
    if (localDateStart) filters.dateStart = localDateStart;
    if (localDateEnd) filters.dateEnd = localDateEnd;
  } else {
    if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
    if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;
  }
  if (!forceAll) { filters.page=page; filters.pageSize=ITEMS_PER_PAGE; }
  loadTransactionKpis(filters);

  callApi('getTransactions', [filters], function(result) {
    if (!silent) showLoading(false);
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
    if (!silent) showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat memuat transaksi: ' + (err.message || ''));
    allTransactions=[]; filteredTransactions=[]; txServerTotal=0; txServerPaged=false; renderTransaksiTable();
  });
}

function setTransactionKpiLoading(loading) {
  ['txKpiPemasukan', 'txKpiPengeluaran'].forEach(function(id) {
    var el = $(id);
    if (!el) return;
    el.classList.toggle('is-loading', !!loading);
    if (loading) el.textContent = 'Memuat...';
  });
}

function loadTransactionKpis(baseFilters) {
  if (!currentUser) return;
  var filters = Object.assign({}, baseFilters || {});
  delete filters.page;
  delete filters.pageSize;
  var search = $('txSearchInput') ? $('txSearchInput').value.trim() : '';
  var status = $('txFilterStatus') ? $('txFilterStatus').value : 'ALL';
  if (search) filters.search = search;
  if (status && status !== 'ALL') filters.status = status;

  var requestId = ++txKpiRequestId;
  setTransactionKpiLoading(true);
  callApi('getTransactionSummary', [filters], function(result) {
    if (requestId !== txKpiRequestId) return;
    var pemasukan = $('txKpiPemasukan');
    var pengeluaran = $('txKpiPengeluaran');
    if (pemasukan) {
      pemasukan.classList.remove('is-loading');
      pemasukan.textContent = formatRupiah(Number(result && result.totalPemasukan) || 0);
    }
    if (pengeluaran) {
      pengeluaran.classList.remove('is-loading');
      pengeluaran.textContent = formatRupiah(Number(result && result.totalPengeluaran) || 0);
    }
  }, function() {
    if (requestId !== txKpiRequestId) return;
    ['txKpiPemasukan', 'txKpiPengeluaran'].forEach(function(id) {
      var el = $(id);
      if (el) {
        el.classList.remove('is-loading');
        el.textContent = 'Tidak tersedia';
      }
    });
  });
}

function populateSPPGFilter() {
  var sel = $('txFilterSPPG');
  if (!sel) return;
  var selected = sel.value || 'ALL';
  var sppgSet = {};
  allTransactions.forEach(function(t) { if (t.sppg) sppgSet[t.sppg] = true; });
  var html = '<option value="ALL">Semua SPPG</option>';
  Object.keys(sppgSet).sort().forEach(function(s) { html += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  sel.innerHTML = html;
  if (selected !== 'ALL' && !sppgSet[selected]) {
    sel.insertAdjacentHTML('beforeend', '<option value="' + esc(selected) + '">' + esc(selected) + '</option>');
  }
  sel.value = selected;
}

function renderTransaksiTable() {
  var tbody = $('transaksiTableBody');
  var count = filteredTransactions.length;
  if (!count) {
    var canAdd = currentUser && currentUser.role; // semua role yang punya akses halaman ini boleh tambah
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-inbox"></i></div><h4>Tidak Ada Transaksi</h4><p>Belum ada transaksi yang tercatat di sini.</p>' +
      (canAdd ? '<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openAddTransaksiModal()"><i class="fas fa-plus"></i> Tambah Transaksi Pertama</button>' : '') +
      '</div></td></tr>';
    $('txPagination').innerHTML = ''; return;
  }
  var totalPages = Math.ceil((txServerPaged ? txServerTotal : count) / ITEMS_PER_PAGE);
  if (txPage > totalPages) txPage = totalPages;
  var start = (txPage - 1) * ITEMS_PER_PAGE;
  var pageData = txServerPaged ? filteredTransactions : filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(tx, idx) {
    var no = start + idx + 1;
    var metode = String(tx.metodeTransaksi || '').trim().toUpperCase();
    var isPaid = metode === 'SUDAH_DIBAYAR';
    var rowClass = isPaid ? 'row-paid' : '';
    var catatan = String(tx.catatan || '').trim();
    var hasCatatan = !!catatan && catatan !== '-';
    var rowLabel = 'Lihat detail transaksi ' + (tx.kode || tx.item || tx.id || '');
    html += '<tr class="transaction-row-clickable ' + rowClass + '" data-id="' + esc(tx.id) + '" tabindex="0" role="button" aria-label="' + esc(rowLabel) + '" onclick="handleTransactionRowClick(event,this.dataset.id)" onkeydown="handleTransactionRowKeydown(event,this.dataset.id)">' +
      '<td style="text-align:center;color:var(--slate-400);font-weight:600;">' + no + '</td>' +
      '<td><strong style="color:var(--slate-800);font-size:12px;">' + esc(tx.kode || '-') + '</strong></td>' +
      '<td>' + esc(tx.tanggal || '-') + '</td>' +
      '<td><span class="badge ' + (tx.kategori === 'PENGELUARAN' ? 'badge-red' : 'badge-green') + '">' + esc(tx.kategori || '-') + '</span></td>' +
      '<td><span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span></td>' +
      '<td><strong style="color:var(--slate-700);">' + esc(tx.item || '-') + '</strong></td>' +
      '<td><span style="font-weight:600;">' + esc(tx.supplierName || '-') + '</span></td>' +
      '<td><strong style="color:var(--slate-800);">' + formatRupiah(tx.nominal) + '</strong></td>' +
      '<td>' + getMetodeBadge(tx.metodeTransaksi) + '</td>' +
      '<td class="transaction-note-cell' + (hasCatatan ? '' : ' is-empty') + '">' +
        (hasCatatan
          ? '<span class="transaction-note-content" title="' + esc(catatan) + '"><i class="fas fa-comment-alt" aria-hidden="true"></i><span>' + esc(catatan) + '</span></span>'
          : '<span class="transaction-note-empty">-</span>') +
      '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
  renderPagination('txPagination', txPage, totalPages, 'goTxPage');
}
function goTxPage(p) { if (txServerPaged) loadTransactions(p, false); else { txPage = p; renderTransaksiTable(); } }

function applyTransactionFiltersLocal() {
  var search = $('txSearchInput') ? $('txSearchInput').value.toLowerCase().trim() : '';
  var sppg = $('txFilterSPPG') ? $('txFilterSPPG').value : 'ALL';
  var kategori = $('txFilterKategori') ? $('txFilterKategori').value : 'ALL';
  var status = $('txFilterStatus') ? $('txFilterStatus').value : 'ALL';
  var localDateStart = $('txFilterTglStart') ? $('txFilterTglStart').value : '';
  var localDateEnd = $('txFilterTglEnd') ? $('txFilterTglEnd').value : '';
  var hasLocalDateRange = !!(localDateStart || localDateEnd);
  var dateStart = hasLocalDateRange ? localDateStart : (globalDateFilter.start || '');
  var dateEnd = hasLocalDateRange ? localDateEnd : (globalDateFilter.end || '');
  filteredTransactions = allTransactions.filter(function(tx) {
    if (search) {
      var text = ((tx.kode || '') + ' ' + (tx.item || '') + ' ' + (tx.supplierName || '') + ' ' + (tx.user || '') + ' ' + (tx.sppg || '') + ' ' + (tx.catatan || '')).toLowerCase();
      if (text.indexOf(search) === -1) return false;
    }
    if (sppg !== 'ALL' && tx.sppg !== sppg) return false;
    if (kategori !== 'ALL' && tx.kategori !== kategori) return false;
    var metode = String(tx.metodeTransaksi || '').trim().toUpperCase();
    if (status === 'PENDING' && metode === 'SUDAH_DIBAYAR') return false;
    if (status === 'SUDAH_DIBAYAR' && metode !== 'SUDAH_DIBAYAR') return false;
    var txDate = normalizeTransactionDateKey(tx.tanggal);
    if (dateStart && (!txDate || txDate < dateStart)) return false;
    if (dateEnd && (!txDate || txDate > dateEnd)) return false;
    return true;
  });
}

function normalizeTransactionDateKey(value) {
  var raw = String(value || '').trim();
  var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var id = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (id) return id[3] + '-' + id[2] + '-' + id[1];
  return '';
}

function filterTransaksi() {
  var search = $('txSearchInput') ? $('txSearchInput').value.trim() : '';
  var status = $('txFilterStatus') ? $('txFilterStatus').value : 'ALL';
  var dateStart = $('txFilterTglStart') ? $('txFilterTglStart').value : '';
  var dateEnd = $('txFilterTglEnd') ? $('txFilterTglEnd').value : '';
  if (dateStart && dateEnd && dateStart > dateEnd) {
    showToast('warning', 'Rentang Tanggal', 'Tanggal mulai tidak boleh melewati tanggal akhir.');
    return;
  }
  var needsFullDataset = !!search || status !== 'ALL';
  clearTimeout(txFilterTimer);
  txFilterTimer=setTimeout(function(){
    txPage=1;
    loadTransactions(1, needsFullDataset);
  }, 300);
}

var editTxExistingFiles = { uploadFoto: '', notaPembelian: '', ttdUser: '' };

function openEditTransaksi(id) {
  if (currentUser && currentUser.role === 'USER' && !transactionEditModeEnabled) {
    showToast('warning', 'Edit Dinonaktifkan', 'ADMIN sedang menonaktifkan fitur edit transaksi untuk USER.');
    return;
  }
  var isAdminUser = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN');
  showLoading(true);
  callApi('getTransactionDetail', [id], function(tx) {
      showLoading(false);
      if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
      $('editTxId').value = tx.id;
      $('editTxTanggal').value = tx.tanggal ? tx.tanggal.split('/').reverse().join('-') : '';
      $('editTxKategori').value = tx.kategori || 'PENGELUARAN';
      $('editTxJenisKat').value = tx.jenisKategori || '';
      $('editTxSPPG').value = tx.sppg || '';
      $('editTxItem').value = tx.item || '';
      $('editTxNominal').value = tx.nominal || '';
      $('editTxCatatan').value = tx.catatan || '';
      $('editTxMetode').value = tx.metodeTransaksi || 'BELUM_BAYAR';
      $('editTxSupplier').value = tx.supplierName || '';
      $('editTxSupplierId').value = tx.supplierId || '';
      $('editTxSupplierBank').value = tx.supplierBankName || '';
      $('editTxSupplierAccount').value = tx.supplierAccountNumber || '';
      $('editTxSupplierAccountHolder').value = tx.supplierAccountHolder || '';
      populateTransactionSupplierDatalist('edit');
      handleTransactionSupplierInput('edit');
      updateEditTxSupplierVisibility();

      editTxExistingFiles = {
        uploadFoto: tx.uploadFoto || '',
        notaPembelian: tx.notaPembelian || '',
        ttdUser: tx.ttdUser || ''
      };
      if ($('editTxFoto')) $('editTxFoto').value = '';
      if ($('editTxNota')) $('editTxNota').value = '';
      var lblFoto = $('editTxLabelFoto'); if (lblFoto) lblFoto.innerHTML = '<i class="fas fa-camera"></i><span>Kamera / Galeri / File</span>';
      var lblNota = $('editTxLabelNota'); if (lblNota) lblNota.innerHTML = '<i class="fas fa-receipt"></i><span>Pilih nota pembelian</span>';
      var previewBox = $('editTxFilePreview');
      if (previewBox) {
        previewBox.innerHTML =
          renderFilePreview(tx.fileBuktiFoto || tx.fileBukti, 'Foto Bukti Transaksi Saat Ini', 'fa-camera') +
          renderFilePreview(tx.fileBuktiFile, 'File Bukti Transaksi Saat Ini', 'fa-file') +
          renderFilePreview(tx.fileBuktiApproval, 'Bukti Pembayaran Admin Saat Ini', 'fa-money-check-alt') +
          renderFilePreview(tx.fileNota, 'Nota Pembelian Saat Ini', 'fa-receipt') +
          renderFilePreview(tx.fileTtdUser, 'TTD User Saat Ini', 'fa-signature');
      }

      var metodeSel = $('editTxMetode');
      if (metodeSel) metodeSel.disabled = !isAdminUser;
      var ttdSection = $('editTxTtdSection');
      if (ttdSection) ttdSection.style.display = '';

      openModal('modalEditTransaksi');
      setTimeout(function() { initTtdCanvas('editTxTtdCanvas'); }, 100);
    },
    function(err) {
      showLoading(false); showToast('error', 'Error', 'Gagal memuat data');
    }
  );
}

function saveEditTransaksi() {
  var id = $('editTxId').value;
  var fields = {
    'Tanggal': $('editTxTanggal').value,
    'Kategori': $('editTxKategori').value,
    'Jenis Kategori': $('editTxJenisKat').value,
    'SPPG': $('editTxSPPG').value,
    'Nama Item/Bahan Baku': $('editTxItem').value,
    'Nominal': parseFloat($('editTxNominal').value) || 0,
    'Catatan': $('editTxCatatan').value,
    'Metode Transaksi': $('editTxMetode').value
  };
  if (fields.Kategori === 'PENGELUARAN') {
    fields['Supplier ID'] = $('editTxSupplierId').value;
    fields['Nama Supplier'] = $('editTxSupplier').value.trim();
    fields['Nama Bank Supplier'] = $('editTxSupplierBank').value.trim();
    fields['No Rekening Supplier'] = $('editTxSupplierAccount').value.trim();
    fields['Atas Nama Rekening Supplier'] = $('editTxSupplierAccountHolder').value.trim();
    if (!fields['Nama Supplier']) {
      showToast('error', 'Validasi', 'Supplier atau penjual wajib diisi untuk transaksi pengeluaran.');
      return;
    }
  }
  showLoading(true);

  var fotoFile = $('editTxFoto') ? $('editTxFoto').files[0] : null;
  var notaFile = $('editTxNota') ? $('editTxNota').files[0] : null;
  var ttdCanvas = $('editTxTtdCanvas');
  var uploadsPending = 0;
  var uploadErrors = [];

  function finishEditUpload(label, up, applyResult) {
    if (up && up.success && up.fileName) applyResult(up);
    else uploadErrors.push(label + ' gagal diunggah');
    uploadsPending--;
    if (!uploadsPending) {
      if (uploadErrors.length) {
        showLoading(false);
        showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Perubahan tidak disimpan.');
        return;
      }
      doSubmit();
    }
  }

  function failEditUpload(label, err) {
    uploadErrors.push(label + ' gagal diunggah' + (err && err.message ? ': ' + err.message : ''));
    uploadsPending--;
    if (!uploadsPending) {
      showLoading(false);
      showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Perubahan tidak disimpan.');
    }
  }

  function doSubmit() {
    callApi('editTransaction', [id, fields], function(result) {
        showLoading(false);
        if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalEditTransaksi'); loadTransactions(); loadDashboardData(); }
        else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
  }

  if (fotoFile) {
    uploadsPending++;
    var r = new FileReader();
    r.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
      callApi('uploadTxFile', [b64, fotoFile.type, fotoFile.name, 'foto'], function(up) {
        finishEditUpload('Foto bukti transaksi', up, function(result) { fields['Upload Foto'] = result.fileName; });
      }, function(err) { failEditUpload('Foto bukti transaksi', err); });
    };
    r.readAsDataURL(fotoFile);
  }

  if (notaFile) {
    uploadsPending++;
    var r2 = new FileReader();
    r2.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
      callApi('uploadTxFile', [b64, notaFile.type, notaFile.name, 'nota'], function(up) {
        finishEditUpload('Nota pembelian', up, function(result) { fields['Nota Pembelian'] = result.fileName; });
      }, function(err) { failEditUpload('Nota pembelian', err); });
    };
    r2.readAsDataURL(notaFile);
  }

  if (ttdCanvas && !isCanvasBlank('editTxTtdCanvas')) {
    var ttdBase64 = ttdCanvas.toDataURL('image/png').split(',')[1];
    uploadsPending++;
    callApi('uploadTxFile', [ttdBase64, 'image/png', 'TTD_USER_' + Date.now() + '.png', 'ttdUser'], function(up) {
      finishEditUpload('TTD user', up, function(result) { fields['TTD User'] = result.fileName; });
    }, function(err) { failEditUpload('TTD user', err); });
  }

  if (!uploadsPending) doSubmit();
}

function getMetodeBadge(m) {
  var metode = String(m || '').trim().toUpperCase();
  if (!metode || metode === '-') return '<span class="badge badge-slate">-</span>';
  if (metode === 'SUDAH_DIBAYAR') return '<span class="badge badge-green"><i class="fas fa-check-double" style="font-size:10px"></i> Sudah Dibayar</span>';
  if (metode === 'MENUNGGU_VERIFIKASI') return '<span class="badge badge-orange"><i class="fas fa-stamp" style="font-size:10px"></i> Menunggu TTD Verifikator</span>';
  if (metode === 'BELUM_LUNAS') return '<span class="badge badge-amber"><i class="fas fa-exclamation-circle" style="font-size:10px"></i> Belum Lunas</span>';
  if (metode === 'TRANSFER') return '<span class="badge badge-blue">Transfer</span>';
  if (metode === 'CASH') return '<span class="badge badge-green">Cash</span>';
  if (metode === 'BELUM_BAYAR') return '<span class="badge badge-red">Belum Bayar</span>';
  return '<span class="badge badge-slate">' + esc(m) + '</span>';
}

function openAddTransaksiModal() {
  $('addTxTanggal').value = formatDateInput();
  populateTransactionSupplierDatalist('add');
  loadTransactionSuggestions();

  // Pastikan data bahan baku sudah dimuat sebelum modal dibuka
  if (!dropdownOptions.bahanBaku || dropdownOptions.bahanBaku.length === 0) {
    showLoading(true);
    callApi('getDropdownOptions', [], function(result) {
        showLoading(false);
                if (result.success) {
                  dropdownOptions = result;
                  populateSPPGSelects();
                  populateSupplierSelects();
                  populateKategoriFilters();
                  populateMenuMBGSelect();
                }
      },
      function(err) {
        showLoading(false);
      }
    );
  }

  $('addTxKategori').value = 'PENGELUARAN';
  updateAddTxKategoriStyle();
  $('addTxJenisKat').value = '';
  // Set SPPG default dari user, setelah datalist dipastikan terisi
  (function() {
    var sppgVal = currentUser ? (currentUser.sppg || '') : '';
    var sppgInput = $('addTxSPPG');
    if (!sppgInput) return;
    if (dropdownOptions.sppgList && dropdownOptions.sppgList.length) {
      sppgInput.value = sppgVal;
    } else {
      // Datalist belum terisi — tunggu loadDropdownOptions selesai
      sppgInput.value = sppgVal;
      // Fallback: isi datalist dengan CFG_SPPG_FALLBACK sekarang
      var dl = $('sppgDatalist');
      if (dl && !dl.children.length) {
        dl.innerHTML = CFG_SPPG_FALLBACK.map(function(s) { return '<option value="' + esc(s) + '">'; }).join('');
      }
    }
  })();
  populateTransactionSupplierDatalist('add');
  $('addTxItem').value = '';
  $('addTxSupplier').value = '';
  $('addTxSupplierId').value = '';
  $('addTxSupplierBank').value = '';
  $('addTxSupplierAccount').value = '';
  $('addTxSupplierAccountHolder').value = '';
  handleTransactionSupplierInput('add');
  $('addTxCatatan').value = '';
  $('addTxMetodeTransaksi').value = 'BELUM_BAYAR';
  updateAddTxMetodeStyle();
  $('addTxNominal').value = '';
  $('addTxNominal').setAttribute('data-raw', '0');
  var nomConf = $('addTxNominalConfirm'); if (nomConf) nomConf.textContent = '';
  var itemHint = $('addTxItemHint'); if (itemHint) itemHint.innerHTML = '';
  $('addTxFoto').value = '';
  var lf = $('labelFoto'); if (lf) lf.innerHTML = '<i class="fas fa-camera"></i><span>Kamera / Galeri / File</span>';
  $('addTxNota').value = '';
  openModal('modalAddTransaksi');
  setTimeout(initAddTxTtd, 100);
}

function updateAddTxKategoriStyle() {
  var select = $('addTxKategori');
  if (!select) return;
  var isPemasukan = select.value === 'PEMASUKAN';
  select.classList.toggle('category-income', isPemasukan);
  select.classList.toggle('category-expense', !isPemasukan);
  select.setAttribute('aria-label', isPemasukan ? 'Kategori Pemasukan' : 'Kategori Pengeluaran');
  var supplierSection = $('addTxSupplierSection');
  if (supplierSection) supplierSection.style.display = isPemasukan ? 'none' : '';
}

function updateEditTxSupplierVisibility() {
  var category = $('editTxKategori');
  var section = $('editTxSupplierSection');
  if (section) section.style.display = category && category.value === 'PEMASUKAN' ? 'none' : '';
}

function updateAddTxMetodeStyle() {
  var sel = $('addTxMetodeTransaksi');
  var warn = $('addTxSudahDibayarWarning');
  var requiredMark = $('addTxBuktiRequired');
  var proofInput = $('addTxFoto');
  var proofHint = $('addTxBuktiHint');
  if (!sel) return;
  var isSudahDibayar = sel.value === 'SUDAH_DIBAYAR';
  var proofRequired = sel.value !== 'BELUM_BAYAR';
  sel.style.color = isSudahDibayar ? '#16a34a' : '';
  sel.style.fontWeight = isSudahDibayar ? '700' : '';
  if (warn) warn.style.display = isSudahDibayar ? 'block' : 'none';
  if (requiredMark) requiredMark.style.display = proofRequired ? 'inline' : 'none';
  if (proofInput) {
    proofInput.required = proofRequired;
    proofInput.setAttribute('aria-required', proofRequired ? 'true' : 'false');
  }
  if (proofHint) {
    proofHint.innerHTML = proofRequired
      ? '<i class="fas fa-asterisk" style="font-size:8px;"></i> Bukti transaksi wajib untuk metode yang dipilih.'
      : '<i class="fas fa-info-circle"></i> Bukti transaksi belum wajib untuk metode BELUM BAYAR.';
  }
}

function saveAddTransaksi() {
  var data = {
    tanggal: $('addTxTanggal').value,
    kategori: $('addTxKategori').value,
    jenisKategori: $('addTxJenisKat').value,
    sppg: $('addTxSPPG').value,
    namaItem: $('addTxItem').value,
    nominal: getNominalRaw(),
    catatan: $('addTxCatatan').value,
    metodeTransaksi: $('addTxMetodeTransaksi').value,
    };
  if (data.kategori === 'PENGELUARAN') {
    data.supplierId = $('addTxSupplierId').value;
    data.supplierName = $('addTxSupplier').value.trim();
    data.supplierBankName = $('addTxSupplierBank').value.trim();
    data.supplierAccountNumber = $('addTxSupplierAccount').value.trim();
    data.supplierAccountHolder = $('addTxSupplierAccountHolder').value.trim();
  }
  if (!data.tanggal || !data.sppg || !data.namaItem || !data.nominal) {
    showToast('error', 'Validasi', 'Tanggal, SPPG, Nama Item, dan Nominal wajib diisi'); return;
  }
  if (data.kategori === 'PENGELUARAN' && !data.supplierName) {
    showToast('error', 'Supplier Wajib', 'Pilih supplier dari saran atau ketik nama penjual secara manual.');
    return;
  }
  var fotoFile = $('addTxFoto').files[0];
  var notaFile = $('addTxNota') ? $('addTxNota').files[0] : null;
  var proofRequired = data.metodeTransaksi !== 'BELUM_BAYAR';
  if (proofRequired && !fotoFile) {
    showToast('error', 'Bukti Transaksi Wajib', 'Upload foto atau file bukti transaksi untuk metode pembayaran yang dipilih.');
    return;
  }
  if (!notaFile) {
    showToast('error', 'Nota Wajib', 'Upload nota pembelian sebelum menyimpan transaksi.');
    return;
  }
  var ttdCanvas = $('addTxTtdCanvas');
  if (!ttdCanvas || isCanvasBlank('addTxTtdCanvas')) {
    showToast('error', 'Tanda Tangan Wajib', 'Tanda tangan digital (TTD) wajib diisi sebelum menyimpan transaksi.');
    return;
  }
  showLoading(true);
  var uploadsPending = 0;
  var uploadErrors = [];

  function finishRequiredUpload(label, up, applyResult) {
    if (up && up.success && up.fileName) applyResult(up);
    else uploadErrors.push(label + ' gagal diunggah');
    uploadsPending--;
    if (!uploadsPending) {
      if (uploadErrors.length) {
        showLoading(false);
        showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Transaksi tidak disimpan.');
        return;
      }
      doSubmit();
    }
  }

  function failRequiredUpload(label, err) {
    uploadErrors.push(label + ' gagal diunggah' + (err && err.message ? ': ' + err.message : ''));
    uploadsPending--;
    if (!uploadsPending) {
      showLoading(false);
      showToast('error', 'Upload Gagal', uploadErrors.join(', ') + '. Transaksi tidak disimpan.');
    }
  }

  var _submitAttempt = 0;
  function doSubmit() {
    _submitAttempt++;
    var attemptNum = _submitAttempt;

    // Tampilkan pesan loading kontekstual
    var loadingMsg = attemptNum > 1
      ? 'Mencoba ulang (' + attemptNum + '/3)...'
      : 'Menyimpan transaksi...';
    showToast('warning', 'Mohon Tunggu', loadingMsg);

    // Timeout manual: jika 45 detik tidak ada response, anggap gagal
    var timeoutHandle = setTimeout(function() {
      showLoading(false);
      if (_submitAttempt === attemptNum) {
        // Belum ada response — tawarkan retry
        showToast('error', 'Koneksi Lambat',
          'Server tidak merespons. Coba klik Simpan lagi atau periksa koneksi.');
        // Re-enable tombol save
        var btnSave = document.querySelector('#modalAddTransaksi .btn-primary');
        if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Transaksi'; }
      }
    }, 45000);

    // Nonaktifkan tombol save agar tidak double submit
    var btnSave = document.querySelector('#modalAddTransaksi .btn-primary');
    if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...'; }

    callApi('addTransaction', [data], function(result) {
        clearTimeout(timeoutHandle);
                showLoading(false);
                // Re-enable tombol
                if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Transaksi'; }
        
                if (result && result.success) {
                  rememberTransactionSuggestions(data);
                  showToast('success', 'Tersimpan!', result.message || 'Transaksi berhasil ditambahkan.');
                  closeModal('modalAddTransaksi');
                  // Reset semua filter
                  if ($('txSearchInput')) $('txSearchInput').value = '';
                  if ($('txFilterSPPG')) $('txFilterSPPG').value = 'ALL';
                  if ($('txFilterKategori')) $('txFilterKategori').value = 'ALL';
                  if ($('txFilterStatus')) $('txFilterStatus').value = 'ALL';
                  if ($('txFilterTglStart')) $('txFilterTglStart').value = '';
                  if ($('txFilterTglEnd')) $('txFilterTglEnd').value = '';
                  txPage = 1;
                  // Optimistic update: langsung muat ulang tanpa mengosongkan tabel dulu,
                  // jadi user tidak melihat tabel "kosong sesaat" lalu terisi lagi 6 detik kemudian.
                  loadTransactions();
                  loadDashboardData();
                  updateChart();
                } else {
                  var errMsg = (result && result.message) ? result.message : 'Terjadi kesalahan tidak diketahui.';
                  showToast('error', 'Gagal Menyimpan', errMsg);
                }
      },
      function(err) {
        clearTimeout(timeoutHandle);
                showLoading(false);
                if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Transaksi'; }
                var isNetworkIssue = !err || !err.message || /timeout|failed to fetch|network|abort/i.test(err.message);
                if (isNetworkIssue) {
                  showToast('error', 'Koneksi Gagal', (err && err.message ? err.message : 'Periksa koneksi internet Anda.') + ' — Coba tekan Simpan lagi.');
                } else {
                  showToast('error', 'Gagal Menyimpan', err.message);
                }
      }
    );
  }

  if (fotoFile) {
    uploadsPending++;
    var r = new FileReader();
    r.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
      var proofKind = String(fotoFile.type || '').toLowerCase().indexOf('image/') === 0 ? 'foto' : 'file';
    callApi('uploadTxFile', [
      b64,
      fotoFile.type,
      fotoFile.name,
      proofKind
    ], function(up) {
        finishRequiredUpload('Bukti transaksi', up, function(result) {
          if (proofKind === 'foto') data.uploadFoto = result.fileName;
          else data.uploadFile = result.fileName;
        });
      }, function(err) { failRequiredUpload('Bukti transaksi', err); });
    };
    r.readAsDataURL(fotoFile);
  }

  if (notaFile) {
    uploadsPending++;
    var r3 = new FileReader();
    r3.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
    callApi('uploadTxFile', [
      b64,
      notaFile.type,
      notaFile.name,
      'nota'
    ], function(up) {
        finishRequiredUpload('Nota pembelian', up, function(result) { data.notaPembelian = result.fileName; });
      }, function(err) { failRequiredUpload('Nota pembelian', err); });
    };
    r3.readAsDataURL(notaFile);
  }
  if (!isCanvasBlank('addTxTtdCanvas')) {
    var ttdDataUrl = ttdCanvas.toDataURL('image/png');
    var ttdBase64 = ttdDataUrl.split(',')[1];
    uploadsPending++;
    callApi('uploadTxFile', [
      ttdBase64,
      'image/png',
      'TTD_USER_' + Date.now() + '.png',
      'ttdUser'
    ], function(up) {
        finishRequiredUpload('TTD user', up, function(result) { data.ttdUser = result.fileName; });
      }, function(err) { failRequiredUpload('TTD user', err); });
  }
  if (!uploadsPending) doSubmit();
}

function handleTransactionRowClick(event, id) {
  if (event && event.target && event.target.closest && event.target.closest('input,button,a,select,textarea,label')) return;
  openDetailTransaksi(id);
}

function handleTransactionRowKeydown(event, id) {
  if (!event || (event.target && event.target.closest && event.target.closest('input,button,a,select,textarea,label'))) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openDetailTransaksi(id);
  }
}

function openDetailTransaksi(id) {
  showLoading(true);
    callApi('getTransactionDetail', [id], function(tx) {
        showLoading(false);
              if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
              renderDetailTransaksi(tx);
              configureTransactionDetailActions(tx);
              var modal = $('modalDetail');
              if (modal) modal.classList.add('transaction-detail-mode');
              openModal('modalDetail');
      },
      function(err) {
        showLoading(false); showToast('error', 'Error', 'Gagal memuat detail');
      }
    );
}

function configureTransactionDetailActions(tx) {
  var actions = $('detailHeaderActions');
  if (!actions) return;
  var isAdmin = !!(currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN'));
  var isUser = !!(currentUser && currentUser.role === 'USER');
  var currentKeys = currentUser ? [currentUser.email, currentUser.username].map(function(v) {
    return String(v || '').trim().toLowerCase();
  }) : [];
  var isOwner = currentKeys.indexOf(String(tx.user || '').trim().toLowerCase()) > -1;
  var canEdit = isAdmin || (!isUser ? true : (transactionEditModeEnabled && isOwner));
  var html = '';

  if (canEdit) {
    html += '<button type="button" class="btn btn-primary btn-sm" onclick="runTransactionDetailAction(\'edit\')"><i class="fas fa-edit"></i><span>Edit</span></button>';
  }
  if (isAdmin) {
    html += '<button type="button" class="btn btn-danger btn-sm" onclick="runTransactionDetailAction(\'delete\')"><i class="fas fa-trash"></i><span>Hapus</span></button>';
  }

  window.currentTransactionDetail = tx;
  actions.innerHTML = html;
  actions.classList.toggle('hidden', !html);
}

function runTransactionDetailAction(action) {
  var tx = window.currentTransactionDetail;
  if (!tx || !tx.id) return;
  closeModal('modalDetail');
  if (action === 'edit') openEditTransaksi(tx.id);
  else if (action === 'delete') confirmHapus('transaksi', 0, tx.id, 'transaksi ' + String(tx.kode || '').substring(0, 15));
}

function openDetailSupplier(rowNum) {
  var s = allSuppliers.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  resetDetailModalFooter();
  var nama    = s['NAMA SUPPLIER']  || s['Nama Supplier'] || '-';
  var wa      = s['NO WHATSAPP']    || s['No WhatsApp']   || '-';
  var email   = s['EMAIL']          || s['Email']         || '-';
  var alamat  = s['ALAMAT TOKO']    || s['Alamat']        || '-';
  var status  = s['STATUS']         || s['Status']        || '-';
  var bank    = s['NAMA BANK']      || '-';
  var noRek   = s['NO REKENING']    || '-';
  var atasNama= s['ATAS NAMA REKENING'] || '-';
  var items   = Array.isArray(s['ITEM YANG DIJUAL']) ? s['ITEM YANG DIJUAL'] : [];
  var statusBadge = status === 'Aktif' ? 'badge-green' : status === 'Suspend' ? 'badge-red' : 'badge-amber';
  var html =
    '<div class="info-card">' +
      infoRow('Nama Supplier', '<strong style="font-size:15px;color:var(--slate-800);">' + esc(nama) + '</strong>') +
      infoRow('No WhatsApp', wa !== '-'
        ? '<a href="https://wa.me/' + esc(wa.replace(/[^0-9]/g,'')) + '" target="_blank" style="color:var(--emerald);font-weight:600;"><i class="fab fa-whatsapp"></i> ' + esc(wa) + '</a>'
        : '-') +
      infoRow('Email', esc(email)) +
      infoRow('Alamat Toko', esc(alamat)) +
      infoRow('Bank', esc(bank)) +
      infoRow('Nomor Rekening', '<span style="font-family:monospace;">' + esc(noRek) + '</span>') +
      infoRow('Atas Nama Rekening', esc(atasNama)) +
      infoRow('Item yang Dijual', items.length ? items.map(function(item) {
        return '<span class="badge badge-outline" style="margin:2px;">' + esc(item) + '</span>';
      }).join('') : '-') +
      infoRow('Status', '<span class="badge ' + statusBadge + '">' + esc(status) + '</span>') +
    '</div>';
  $('detailBody').innerHTML = '<div style="margin-bottom:8px;"><div class="detail-section-title"><i class="fas fa-truck" style="margin-right:6px;"></i>Informasi Supplier</div></div>' + html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-truck" style="color:var(--primary);margin-right:8px;"></i>Detail Supplier';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data supplier';
  openModal('modalDetail');
}

function renderDetailTransaksi(tx, options) {
  resetDetailModalFooter();
  options = options || {};
  var hideMissingDocs = options.hideMissingDocs !== false;
  var isLengkap = tx.statusDokumen && tx.statusDokumen.indexOf('Lengkap') > -1 && tx.statusDokumen.indexOf('Tidak') === -1;
  var docsHtml = '';
  docsHtml += renderFilePreview(tx.fileBuktiFoto || tx.fileBukti, 'Foto Bukti Transaksi', 'fa-camera', hideMissingDocs);
  docsHtml += renderFilePreview(tx.fileBuktiFile, 'File Bukti Transaksi', 'fa-file', hideMissingDocs);
  docsHtml += renderFilePreview(tx.fileBuktiApproval, 'Bukti Pelunasan', 'fa-money-check-alt', hideMissingDocs);
  docsHtml += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt', hideMissingDocs);
  docsHtml += renderFilePreview(tx.fileTtdUser, 'TTD User', 'fa-signature', hideMissingDocs);
  docsHtml += renderFilePreview(tx.fileTtdVerif, 'TTD Verifikator', 'fa-shield-alt', hideMissingDocs);
  var paymentProofsHtml = Array.isArray(tx.paymentProofs) && tx.paymentProofs.length
    ? '<div style="margin-bottom:16px;">' + renderPaymentProofHistory(tx) + '</div>'
    : '';

  $('detailBody').innerHTML =
    '<div style="margin-bottom:20px;">' +
      '<div class="detail-section-title"><i class="fas fa-info-circle" style="margin-right:6px;"></i>Informasi Umum</div>' +
      '<div class="info-card">' +
        infoRow('ID', '<span style="font-family:monospace;font-size:11px;">' + esc(tx.id) + '</span>') +
        infoRow('Kode', esc(tx.kode || '-')) +
        infoRow('Tanggal', esc(tx.tanggal || '-')) +
        infoRow('Kategori', '<span class="badge ' + (tx.kategori === 'PENGELUARAN' ? 'badge-red' : 'badge-green') + '">' + esc(tx.kategori) + '</span>') +
        infoRow('Jenis', esc(tx.jenisKategori || '-')) +
        infoRow('SPPG', '<span class="badge badge-outline">' + esc(tx.sppg || '-') + '</span>') +
        infoRow('Item', '<strong style="font-size:14px;color:var(--slate-800);">' + esc(tx.item || '-') + '</strong>') +
        (tx.kategori === 'PENGELUARAN' ? infoRow('Supplier / Penjual', '<strong>' + esc(tx.supplierName || 'Belum tercatat') + '</strong>') : '') +
        infoRow('Nominal', '<strong style="font-size:18px;">' + formatRupiah(tx.nominal) + '</strong>') +
        infoRow('Metode', getMetodeBadge(tx.metodeTransaksi)) +
        (tx.catatan && tx.catatan !== '-' ? infoRow('Catatan', '<span style="color:var(--slate-600);font-style:italic;">' + esc(tx.catatan) + '</span>') : '') +
      '</div></div>' +
    (tx.kategori === 'PENGELUARAN' ? '<div style="margin-bottom:20px;">' +
      '<div class="detail-section-title"><i class="fas fa-university" style="margin-right:6px;"></i>Tujuan Pembayaran</div>' +
      '<div class="info-card">' +
        infoRow('Nama Supplier', esc(tx.supplierName || 'Belum tercatat')) +
        infoRow('Bank', esc(tx.supplierBankName || '-')) +
        infoRow('Nomor Rekening', '<span style="font-family:monospace;">' + esc(tx.supplierAccountNumber || '-') + '</span>') +
        infoRow('Atas Nama', esc(tx.supplierAccountHolder || '-')) +
        infoRow('Sumber Data', esc(tx.supplierSource === 'MASTER' ? 'Master Supplier' : tx.supplierSource === 'MANUAL' ? 'Input Manual' : 'Data Lama')) +
      '</div></div>' : '') +
    '<div style="margin-bottom:20px;">' +
      '<div class="detail-section-title"><i class="fas fa-clipboard-check" style="margin-right:6px;"></i>Status Dokumen</div>' +
      '<div class="detail-doc-item ' + (isLengkap ? 'doc-ok' : 'doc-missing') + '">' +
        '<div class="detail-doc-icon"><i class="fas ' + (isLengkap ? 'fa-check' : 'fa-exclamation-triangle') + '"></i></div>' +
        '<div><div class="detail-doc-label">Status</div><div class="detail-doc-status">' + esc(tx.statusDokumen || 'Belum dicek') + '</div></div>' +
      '</div></div>' +
    docsHtml + paymentProofsHtml +
    '<div style="margin-bottom:10px;">' +
      '<div class="detail-section-title"><i class="fas fa-user" style="margin-right:6px;"></i>Penginput & Approval</div>' +
      '<div class="info-card" style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border-color:#bae6fd;">' +
        infoRow('Penginput', esc(tx.user || '-')) +
        infoRow('Approved By', esc(tx.approvedBy || '-')) +
        infoRow('Waktu Approve', esc(tx.waktuApprove || '-')) +
        (tx.catatanApproval ? infoRow('Catatan Approval', '<span style="color:var(--amber);font-weight:600;">' + esc(tx.catatanApproval) + '</span>') : '') +
      '</div></div>';
}

function infoRow(label, value) {
  return '<div class="info-row"><span class="info-label">' + esc(label) + '</span><span class="info-value">' + value + '</span></div>';
}

// Kembalikan footer modalDetail ke kondisi default (tombol "Tutup" saja).
// Dipanggil oleh setiap fungsi openDetailXxx() sebelum mengisi konten baru,
// supaya footer custom dari alur lain (mis. WA Reminder) tidak nyangkut.
function resetDetailModalFooter() {
  var modal = $('modalDetail');
  if (!modal) return;
  currentApprovalDetailId = null;
  modal.classList.remove('approval-detail-mode');
  modal.classList.remove('transaction-detail-mode');
  window.currentTransactionDetail = null;
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
}

function renderFilePreview(fileInfo, title, iconClass, hideMissing) {
  if (!fileInfo) {
    if (hideMissing) return '';
    return '<div style="margin-bottom:16px;">' +
      '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
      '<div class="detail-doc-item doc-missing">' +
        '<div class="detail-doc-icon"><i class="fas fa-times"></i></div>' +
        '<div><div class="detail-doc-label">' + esc(title) + '</div><div class="detail-doc-status">Belum diupload</div></div>' +
      '</div></div>';
  }
  var url = fileInfo.signedUrl || fileInfo.previewUrl || fileInfo.viewUrl || '';
  if (!url) {
    if (hideMissing) return '';
    return '<div style="margin-bottom:16px;">' +
      '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
      '<div class="detail-doc-item doc-missing">' +
        '<div class="detail-doc-icon"><i class="fas fa-times"></i></div>' +
        '<div><div class="detail-doc-label">' + esc(title) + '</div><div class="detail-doc-status">Belum diupload</div></div>' +
      '</div></div>';
  }
  var thumbUrl = fileInfo.signedThumbnailUrl || url;
  var isImage = fileInfo.mimeType && fileInfo.mimeType.indexOf('image') > -1;
  var isPdf = fileInfo.mimeType === 'application/pdf';

  if (isImage && url) {
    var safeUrl = esc(url);
    var safeThumb = esc(thumbUrl);
    return '<div style="margin-bottom:16px;">' +
      '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
      '<img src="' + safeThumb + '" class="img-preview" style="cursor:pointer;max-height:200px;border-radius:8px;object-fit:cover;" onclick="openLightbox(\'' + safeUrl + '\')" alt="' + esc(title) + '" loading="lazy">' +
      '</div>';
  }

  // Non-gambar (PDF, dsb): tampilkan sebagai kartu file yang bisa diklik,
  // bukan link teks polos — tetap terlihat jelas jenis filenya.
  var fileIcon = isPdf ? 'fa-file-pdf' : 'fa-file';
  var fileLabel = isPdf ? 'Dokumen PDF' : (fileInfo.name || 'File');
  var clickAction = isPdf
    ? 'openLightbox(\'' + esc(url) + '\')'
    : 'window.open(\'' + esc(url) + '\', \'_blank\')';
  return '<div style="margin-bottom:16px;">' +
    '<div class="detail-section-title"><i class="fas ' + iconClass + '" style="margin-right:6px;"></i>' + esc(title) + '</div>' +
    '<div class="detail-doc-item" style="cursor:pointer;" onclick="' + clickAction + '">' +
      '<div class="detail-doc-icon"><i class="fas ' + fileIcon + '"></i></div>' +
      '<div><div class="detail-doc-label">' + esc(fileLabel) + '</div><div class="detail-doc-status" style="color:var(--primary);">' + esc(fileInfo.name || '') + '</div></div>' +
    '</div></div>';
}

// ============================================================
// 11. APPROVAL
// ============================================================

/* ============================================================
     APPROVAL & PAYMENT VERIFICATION
     ============================================================ */
function normalizeApprovalApiResponse(result) {
  var current = result;
  for (var depth = 0; depth < 4; depth++) {
    if (Array.isArray(current)) return {
      valid: true, rows: current, page: 1, pageSize: current.length,
      total: current.length, summary: null, filterOptions: null,
      supplierGroups: []
    };
    if (!current || typeof current !== 'object') break;
    if (Array.isArray(current.data)) return {
      valid: true, rows: current.data,
      page: Number(current.page) || 1,
      pageSize: Number(current.pageSize) || current.data.length,
      total: Number(current.total) >= 0 ? Number(current.total) : current.data.length,
      summary: current.summary || null,
      filterOptions: current.filterOptions || null,
      supplierGroups: Array.isArray(current.supplierGroups) ? current.supplierGroups : []
    };
    if (Array.isArray(current.rows)) return {
      valid: true, rows: current.rows,
      page: Number(current.page) || 1,
      pageSize: Number(current.pageSize) || current.rows.length,
      total: Number(current.total) >= 0 ? Number(current.total) : current.rows.length,
      summary: current.summary || null,
      filterOptions: current.filterOptions || null,
      supplierGroups: Array.isArray(current.supplierGroups) ? current.supplierGroups : []
    };
    if (Object.prototype.hasOwnProperty.call(current, 'result')) {
      current = current.result;
      continue;
    }
    break;
  }
  return { valid: false, rows: [] };
}

function approvalRequestFilters(page, exportAll) {
  var filters = {
    kategori: 'PENGELUARAN',
    approvalOnly: true,
    page: Math.max(1, Number(page) || 1),
    pageSize: exportAll ? 100 : ITEMS_PER_PAGE
  };
  var search = $('apprSearchInput') ? $('apprSearchInput').value.trim() : '';
  var sppg = $('apprFilterSPPG') ? $('apprFilterSPPG').value : 'ALL';
  var jenisKat = $('apprFilterJenisKat') ? $('apprFilterJenisKat').value : 'ALL';
  var supplier = $('apprFilterSupplier') ? $('apprFilterSupplier').value : 'ALL';
  var kelengkapan = $('apprFilterKelengkapan') ? $('apprFilterKelengkapan').value : 'ALL';
  var localStart = $('apprFilterTglStart') ? $('apprFilterTglStart').value : '';
  var localEnd = $('apprFilterTglEnd') ? $('apprFilterTglEnd').value : '';
  if (search) filters.search = search;
  if (sppg && sppg !== 'ALL') filters.sppg = sppg;
  if (jenisKat && jenisKat !== 'ALL') filters.jenisKategori = jenisKat;
  if (supplier && supplier !== 'ALL') filters.supplier = supplier;
  if (kelengkapan && kelengkapan !== 'ALL') filters.kelengkapan = kelengkapan;
  if (localStart || globalDateFilter.start) filters.dateStart = localStart || globalDateFilter.start;
  if (localEnd || globalDateFilter.end) filters.dateEnd = localEnd || globalDateFilter.end;
  if (exportAll) filters.exportAll = true;
  return filters;
}

function normalizeApprovalTransaction(tx) {
  if (!tx || typeof tx !== 'object') return null;
  var normalized = Object.assign({}, tx);
  normalized.id = String(tx.id || tx.ID || '').trim();
  normalized.kode = tx.kode || tx['Kode Pemasukan'] || normalized.id;
  normalized.tanggal = tx.tanggal || tx.Tanggal || '';
  normalized.kategori = String(tx.kategori || tx.Kategori || '').trim().toUpperCase();
  normalized.jenisKategori = tx.jenisKategori || tx['Jenis Kategori'] || '';
  normalized.sppg = tx.sppg || tx.SPPG || '';
  normalized.yayasan = tx.yayasan || tx.YAYASAN || '';
  normalized.nominal = Number(tx.nominal !== undefined ? tx.nominal : tx.Nominal) || 0;
  normalized.user = tx.user || tx.User || '';
  normalized.userEmail = tx.userEmail || tx.emailPenginput || normalized.user;
  normalized.userName = tx.userName || tx.namaPenginput || normalized.userEmail || '-';
  normalized.item = tx.item || tx.namaItem || tx['Nama Item/ Bahan Baku'] || '';
  normalized.supplierId = tx.supplierId || tx['SUPPLIER ID'] || '';
  normalized.supplierName = tx.supplierName || tx['NAMA SUPPLIER'] || '';
  normalized.supplierBankName = tx.supplierBankName || tx['NAMA BANK SUPPLIER'] || '';
  normalized.supplierAccountNumber = tx.supplierAccountNumber || tx['NO REKENING SUPPLIER'] || '';
  normalized.supplierAccountHolder = tx.supplierAccountHolder || tx['ATAS NAMA REKENING SUPPLIER'] || '';
  normalized.supplierSource = tx.supplierSource || tx['SUMBER SUPPLIER'] || '';
  normalized.uploadFoto = tx.uploadFoto || tx['UPLOUD FOTO'] || '';
  normalized.uploadFile = tx.uploadFile || tx['UPLOUD FILE'] || '';
  normalized.notaPembelian = tx.notaPembelian || tx['NOTA PEMBELIAN'] || '';
  normalized.ttdUser = tx.ttdUser || tx['TTD USER'] || '';
  normalized.metodeTransaksi = String(tx.metodeTransaksi || tx['Metode Transaksi'] || 'BELUM_BAYAR')
    .trim().toUpperCase().replace(/\s+/g, '_');
  return normalized.id ? normalized : null;
}

function isApprovalQueueTransaction(tx) {
  if (!tx) return false;
  var kategori = String(tx.kategori || '').trim().toUpperCase();
  var status = String(tx.metodeTransaksi || '').trim().toUpperCase().replace(/\s+/g, '_');
  return kategori === 'PENGELUARAN' && status !== 'SUDAH_DIBAYAR' && status !== 'LUNAS';
}

function renderApprovalLoadError(message) {
  var safeMessage = esc(message || 'Data Approval gagal dimuat. Silakan muat ulang halaman.');
  var html = '<div class="empty-state approval-load-error"><div class="empty-illustration"><i class="fas fa-exclamation-triangle"></i></div><h4>Data Approval Gagal Dimuat</h4><p>' + safeMessage + '</p><button type="button" class="btn btn-primary btn-sm" onclick="loadApprovalData()"><i class="fas fa-sync-alt"></i> Muat Ulang</button></div>';
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  var pagination = $('approvalPagination');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8">' + html + '</td></tr>';
  if (mobileList) mobileList.innerHTML = html;
  if (pagination) pagination.innerHTML = '';
  filteredApprovalData = [];
  approvalSupplierGroups = [];
  if ($('approvalSupplierSummary')) $('approvalSupplierSummary').innerHTML = '';
  selectedApprovalIds.clear();
  updateApprovalBulkBar();
}

function renderApprovalLoadingState() {
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton-screen approval-desktop-skeleton" style="padding:20px;">' +
      '<div class="skeleton-row"><div class="skeleton-row-cell w-40"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div></div>'.repeat(5) +
      '</div></td></tr>';
  }
  if (mobileList) {
    mobileList.innerHTML = '<div class="approval-mobile-skeleton">' +
      '<div class="approval-card-skeleton"><div class="skeleton-row-cell w-80"></div><div class="skeleton-row-cell"></div><div class="skeleton-row-cell w-40"></div></div>'.repeat(4) +
      '</div>';
  }
}

function setApprovalRefreshing(refreshing) {
  var page = $('page-approval');
  if (page) page.classList.toggle('approval-refreshing', !!refreshing);
}

function clearApprovalWatchdog() {
  if (approvalLoadState.watchdog) {
    clearTimeout(approvalLoadState.watchdog);
    approvalLoadState.watchdog = null;
  }
}

function loadApprovalData(page) {
  if (!currentUser) return;
  page = Math.max(1, Number(page) || approvalPage || 1);
  if (approvalLoadState.inFlight) {
    approvalLoadState.queued = true;
    approvalLoadState.queuedPage = page;
    return;
  }

  approvalLoadState.inFlight = true;
  approvalLoadState.queued = false;
  var requestId = ++approvalLoadState.requestId;

  selectedApprovalIds.clear();
  if (!approvalLoadState.hasLoaded) renderApprovalLoadingState();
  else setApprovalRefreshing(true);

  // Approval uses the paged backend contract. Only the current page receives
  // full transaction/document/proof data; KPI and filter metadata stay narrow.
  var filters = approvalRequestFilters(page, false);

  clearApprovalWatchdog();
  approvalLoadState.watchdog = setTimeout(function() {
    if (!approvalLoadState.inFlight || requestId !== approvalLoadState.requestId) return;
    approvalLoadState.requestId++;
    approvalLoadState.inFlight = false;
    approvalLoadState.queued = false;
    setApprovalRefreshing(false);
    renderApprovalLoadError('Server terlalu lama merespons. Tekan Muat Ulang untuk mencoba kembali.');
  }, 20000);

  callApi('getTransactions', [filters], function(result) {
    if (requestId !== approvalLoadState.requestId) {
      approvalLoadState.inFlight = false;
      return;
    }
    clearApprovalWatchdog();
    approvalLoadState.inFlight = false;
    var queuedPage = approvalLoadState.queued ? approvalLoadState.queuedPage : 0;
    approvalLoadState.queued = false;
    setApprovalRefreshing(false);

    try {
      var normalizedResponse = normalizeApprovalApiResponse(result);
      if (!normalizedResponse.valid) throw new Error('Format respons transaksi tidak dikenali.');

      allTransactions = normalizedResponse.rows
        .map(normalizeApprovalTransaction)
        .filter(function(tx) { return tx && isApprovalQueueTransaction(tx); });
      filteredApprovalData = allTransactions.slice();
      approvalServerPaged = Number(normalizedResponse.page) > 0;
      approvalServerTotal = approvalServerPaged ? Number(normalizedResponse.total || 0) : allTransactions.length;
      approvalPage = approvalServerPaged ? Number(normalizedResponse.page || page) : 1;
      approvalServerNominal = normalizedResponse.summary
        ? Number(normalizedResponse.summary.nominal || 0)
        : filteredApprovalData.reduce(function(sum, tx) { return sum + (Number(tx.nominal) || 0); }, 0);
      if (normalizedResponse.filterOptions) approvalFilterOptions = normalizedResponse.filterOptions;
      approvalSupplierGroups = normalizedResponse.supplierGroups || [];

      approvalLoadState.hasLoaded = true;
      populateApprovalFilters(approvalFilterOptions);
      renderApprovalTable();
      if (queuedPage) setTimeout(function() { loadApprovalData(queuedPage); }, 0);
    } catch (renderError) {
      console.error('Approval render failure:', renderError, result);
      renderApprovalLoadError(renderError && renderError.message ? renderError.message : 'Data Approval gagal ditampilkan.');
      showToast('error', 'Gagal', 'Data diterima tetapi gagal ditampilkan.');
    }
  }, function(err) {
    if (requestId !== approvalLoadState.requestId) {
      approvalLoadState.inFlight = false;
      return;
    }
    clearApprovalWatchdog(); 
    approvalLoadState.inFlight = false;
    approvalLoadState.queued = false;
    setApprovalRefreshing(false);
    var message = err && err.message ? err.message : 'Tidak dapat memuat data Approval.';
    console.error('Gagal memuat Approval:', err);
    renderApprovalLoadError(message);
    showToast('error', 'Gagal', message);
  });
}

function renderApprovalTable() {
  var approvalData = filteredApprovalData;
  renderApprovalKpi();
  renderApprovalSupplierSummary();
  var tbody = $('approvalTableBody');
  var mobileList = $('approvalMobileList');
  var pagination = $('approvalPagination');
  var isAdmin = !!(currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN'));
  var canSelect = isAdmin || !!(currentUser && currentUser.role === 'USER' && uploadBuktiModeEnabled);

  if (!approvalData.length) {
    var emptyHtml = '<div class="empty-state"><div class="empty-illustration"><i class="fas fa-check-circle"></i></div><h4>Semua Lunas!</h4><p>Tidak ada transaksi yang menunggu approval.</p></div>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="8">' + emptyHtml + '</td></tr>';
    if (mobileList) mobileList.innerHTML = emptyHtml;
    if (pagination) pagination.innerHTML = '';
    syncApprovalSelectionControls(approvalData, canSelect);
    updateApprovalBulkBar();
    return;
  }

  var totalRows = approvalServerPaged ? approvalServerTotal : approvalData.length;
  var totalPages = Math.max(1, Math.ceil(totalRows / ITEMS_PER_PAGE));
  if (approvalPage > totalPages) approvalPage = totalPages;
  var start = approvalServerPaged ? (approvalPage - 1) * ITEMS_PER_PAGE : 0;
  var pageData = approvalServerPaged ? approvalData : approvalData.slice(start, start + ITEMS_PER_PAGE);

  if (tbody) tbody.innerHTML = renderApprovalDesktopRows(pageData, start, canSelect);
  if (mobileList) mobileList.innerHTML = renderApprovalMobileCards(pageData, start, canSelect);
  renderPagination('approvalPagination', approvalPage, totalPages, 'goApprovalPage');
  syncApprovalSelectionControls(approvalData, canSelect);
  updateApprovalBulkBar();
}

function renderApprovalSupplierSummary() {
  var container = $('approvalSupplierSummary');
  if (!container) return;
  var groups = approvalSupplierGroups || [];
  if (!groups.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML =
    '<div class="detail-section-title"><i class="fas fa-university" style="margin-right:6px;"></i>Ringkasan Pembayaran per Supplier</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:10px;">' +
    groups.map(function(group) {
      var txLabels = (group.transactions || []).map(function(tx) {
        return esc(tx.kode || tx.id || '-') + ' · ' + esc(tx.item || '-') + ' · ' + formatRupiah(tx.nominal);
      }).join('<br>') + (group.hasMoreTransactions ? '<br><em>Klik untuk melihat seluruh transaksi supplier ini.</em>' : '');
      return '<button type="button" class="info-card" data-supplier="' + esc(group.supplierName || '') + '" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--slate-200);" onclick="filterApprovalBySupplier(this.dataset.supplier)">' +
        '<strong style="display:block;margin-bottom:5px;">' + esc(group.supplierName || 'Supplier belum tercatat') + '</strong>' +
        '<span style="display:block;font-size:12px;color:var(--slate-500);">' +
          esc(group.supplierBankName || 'Bank belum diisi') + ' · ' +
          esc(group.supplierAccountNumber || 'No. rekening belum diisi') + '</span>' +
        '<span style="display:block;font-size:12px;color:var(--slate-500);">a.n. ' + esc(group.supplierAccountHolder || '-') + '</span>' +
        '<strong style="display:block;margin-top:7px;color:var(--primary);">' + formatRupiah(group.nominal) + ' · ' + Number(group.transactionCount || 0) + ' transaksi</strong>' +
        '<span style="display:block;font-size:11px;line-height:1.5;margin-top:6px;color:var(--slate-500);">' + txLabels + '</span>' +
      '</button>';
    }).join('') + '</div>';
}

function filterApprovalBySupplier(name) {
  var select = $('apprFilterSupplier');
  if (!select) return;
  var value = String(name || '');
  if (![...select.options].some(function(option) { return option.value === value; })) {
    select.insertAdjacentHTML('beforeend', '<option value="' + esc(value) + '">' + esc(value) + '</option>');
  }
  select.value = value;
  filterApproval();
}

function renderApprovalKpi() {
  var total = approvalServerPaged
    ? approvalServerNominal
    : (filteredApprovalData || []).reduce(function(sum, tx) {
      return sum + (Number(tx && tx.nominal) || 0);
    }, 0);
  var totalRows = approvalServerPaged ? approvalServerTotal : (filteredApprovalData || []).length;
  var value = $('approvalKpiTotal');
  var count = $('approvalKpiCount');
  if (value) value.textContent = formatRupiah(total);
  if (count) count.textContent = totalRows + ' transaksi sesuai filter';
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
  var badgeClass = doc.status === 'Lengkap' ? 'badge-green' : (doc.status === 'Tidak Lengkap' ? 'badge-red' : 'badge-amber');
  return '<span class="badge ' + badgeClass + '"><i class="fas ' + (doc.status === 'Lengkap' ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i> ' + esc(doc.status) + '</span>';
}

function isApprovalBulkSelectable(tx) {
  if (!currentUser) return false;
  if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') {
    return String(tx && tx.metodeTransaksi || '').toUpperCase() !== 'SUDAH_DIBAYAR';
  }
  var status = String(tx && tx.metodeTransaksi || '').toUpperCase();
  return currentUser.role === 'USER' && uploadBuktiModeEnabled &&
    status !== 'SUDAH_DIBAYAR' && status !== 'MENUNGGU_VERIFIKASI';
}

function renderApprovalDesktopRows(pageData, start, canSelect) {
  return pageData.map(function(tx, idx) {
    var checked = selectedApprovalIds.has(tx.id);
    var statusClass = getApprovalStatusRowClass(tx.metodeTransaksi);
    var rowLabel = 'Lihat detail approval ' + (tx.kode || tx.item || tx.id || '');
    return '<tr data-id="' + esc(tx.id) + '" class="approval-row-clickable ' + esc(statusClass) + '" tabindex="0" role="button" aria-label="' + esc(rowLabel) + '" onclick="handleApprovalRowClick(event,this.dataset.id)" onkeydown="handleApprovalRowKeydown(event,this.dataset.id)">' +
      '<td class="approval-select-col hidden" style="text-align:center;">' +
        (canSelect && isApprovalBulkSelectable(tx) ? '<input type="checkbox" class="appr-checkbox" data-id="' + esc(tx.id) + '" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onchange="toggleApprovalSelect(this)" ' + (checked ? 'checked' : '') + ' aria-label="Pilih transaksi ' + esc(tx.kode || tx.id) + '">' : '') +
      '</td>' +
      '<td class="approval-number-cell">' + (start + idx + 1) + '</td>' +
      '<td class="approval-transaction-cell"><strong>' + esc(tx.item || '-') + '</strong><span>' + esc(tx.kode || tx.id || '-') + ' &bull; ' + esc(tx.tanggal || '-') + '</span><span><i class="fas fa-truck"></i> ' + esc(tx.supplierName || 'Supplier belum tercatat') + '</span></td>' +
      '<td><span class="approval-sppg-label"><i class="fas fa-building"></i>' + esc(tx.sppg || '-') + '</span></td>' +
      '<td class="approval-nominal-cell">' + formatRupiah(tx.nominal) + '</td>' +
      '<td>' + getMetodeBadge(tx.metodeTransaksi) + '</td>' +
      '<td>' + getApprovalDocumentBadge(tx) + '</td>' +
      '<td class="approval-user-cell"><i class="fas fa-user-circle"></i><span>' + esc(tx.user || '-') + '</span></td>' +
      '</tr>';
  }).join('');
}

function renderApprovalMobileCards(pageData, start, canSelect) {
  return pageData.map(function(tx, idx) {
    var checked = selectedApprovalIds.has(tx.id);
    var statusClass = getApprovalStatusRowClass(tx.metodeTransaksi);
    var rowLabel = 'Lihat detail approval ' + (tx.kode || tx.item || tx.id || '');
    var selection = canSelect && isApprovalBulkSelectable(tx)
      ? '<label class="approval-card-select" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()"><input type="checkbox" class="appr-checkbox" data-id="' + esc(tx.id) + '" onchange="toggleApprovalSelect(this)" ' + (checked ? 'checked' : '') + ' aria-label="Pilih transaksi ' + esc(tx.kode || tx.id) + '"><span></span></label>'
      : '';
    var note = tx.catatan && tx.catatan !== '-' ? '<p class="approval-card-note"><i class="fas fa-comment-alt"></i>' + esc(tx.catatan) + '</p>' : '';
    return '<article class="approval-mobile-card ' + esc(statusClass) + '" data-id="' + esc(tx.id) + '" tabindex="0" role="button" aria-label="' + esc(rowLabel) + '" onclick="handleApprovalRowClick(event,this.dataset.id)" onkeydown="handleApprovalRowKeydown(event,this.dataset.id)">' +
      '<div class="approval-card-top">' + selection + '<span class="approval-card-number">#' + (start + idx + 1) + '</span><div class="approval-card-status">' + getMetodeBadge(tx.metodeTransaksi) + '</div><i class="fas fa-chevron-right approval-card-chevron"></i></div>' +
      '<div class="approval-card-main"><div class="approval-card-title-wrap"><span class="approval-card-code">' + esc(tx.kode || tx.id || '-') + '</span><h3>' + esc(tx.item || '-') + '</h3><span class="approval-card-date"><i class="far fa-calendar-alt"></i>' + esc(tx.tanggal || '-') + '</span></div><div class="approval-card-amount"><span>Nominal</span><strong>' + formatRupiah(tx.nominal) + '</strong></div></div>' +
      '<div class="approval-card-meta"><span><i class="fas fa-building"></i>' + esc(tx.sppg || '-') + '</span><span><i class="fas fa-truck"></i>' + esc(tx.supplierName || 'Supplier belum tercatat') + '</span><span><i class="fas fa-user"></i>' + esc(tx.user || '-') + '</span></div>' +
      '<div class="approval-card-docs">' + getApprovalDocumentBadge(tx) + '</div>' + note +
      '<div class="approval-card-open"><span>Ketuk untuk melihat detail</span><i class="fas fa-arrow-right"></i></div>' +
      '</article>';
  }).join('');
}

function syncApprovalSelectionControls(approvalData, canSelect) {
  var selectableData = approvalData.filter(isApprovalBulkSelectable);
  var allSelected = selectableData.length > 0 && selectableData.every(function(tx) { return selectedApprovalIds.has(tx.id); });
  ['apprSelectAll', 'apprSelectAllMobile'].forEach(function(id) {
    var checkbox = $(id);
    if (checkbox) {
      checkbox.checked = allSelected;
      checkbox.disabled = !canSelect || !selectableData.length;
    }
  });
  var mobileToolbar = $('approvalMobileToolbar');
  if (mobileToolbar) mobileToolbar.classList.toggle('hidden', !canSelect);
  var mobileCount = $('approvalMobileCount');
  if (mobileCount) mobileCount.textContent = approvalData.length + ' transaksi';
  document.querySelectorAll('#page-approval .approval-select-col').forEach(function(cell) {
    cell.classList.toggle('hidden', !canSelect);
  });
  document.querySelectorAll('#page-approval .appr-checkbox').forEach(function(checkbox) {
    checkbox.checked = selectedApprovalIds.has(checkbox.getAttribute('data-id'));
  });
}

function goApprovalPage(p) {
  approvalPage = Math.max(1, Number(p) || 1);
  loadApprovalData(approvalPage);
}


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
    renderDetailTransaksi(tx, { hideMissingDocs: true });
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
    if (modal) modal.classList.add('approval-detail-mode');
    openModal('modalDetail');
  }, function() {
    showLoading(false);
    showToast('error', 'Error', 'Gagal memuat detail approval');
  });
}

function renderApprovalDetailHero(tx) {
  var doc = _approvalDocStatus(tx);
  var docBadge = doc.status === 'Lengkap' ? 'badge-green' : (doc.status === 'Tidak Lengkap' ? 'badge-red' : 'badge-amber');
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

// ===== CEKLIS / BULK ACTION APPROVAL =====
function toggleApprovalSelect(checkbox) {
  var id = checkbox.getAttribute('data-id');
  if (checkbox.checked) selectedApprovalIds.add(id);
  else selectedApprovalIds.delete(id);
  var canSelect = !!(currentUser && ((currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') || (currentUser.role === 'USER' && uploadBuktiModeEnabled)));
  syncApprovalSelectionControls(filteredApprovalData, canSelect);
  updateApprovalBulkBar();
}

function toggleSelectAllApproval(checkbox) {
  if (checkbox.checked) {
    filteredApprovalData.filter(isApprovalBulkSelectable).forEach(function(tx) { selectedApprovalIds.add(tx.id); });
  } else {
    filteredApprovalData.forEach(function(tx) { selectedApprovalIds.delete(tx.id); });
  }
  renderApprovalTable();
}

function clearApprovalSelection() {
  selectedApprovalIds.clear();
  renderApprovalTable();
}

function updateApprovalBulkBar() {
  var bar = $('apprBulkBar');
  if (!bar) return;
  var count = selectedApprovalIds.size;
  if (count > 0) {
    bar.classList.remove('hidden');
    var countEl = $('apprBulkCount');
    if (countEl) countEl.textContent = count;
    var actionEl = $('apprBulkPrimaryLabel');
    if (actionEl) actionEl.textContent = currentUser && currentUser.role === 'USER' ? 'Kirim Bukti Bersama' : 'Approve Terpilih';
  } else {
    bar.classList.add('hidden');
  }
}

function openBulkApprovalPin() {
  if (!selectedApprovalIds.size) { showToast('warning', 'Perhatian', 'Pilih minimal satu transaksi.'); return; }
  bulkApprovalMode = true;
  var ids = Array.from(selectedApprovalIds);
  var total = 0;
  filteredApprovalData.forEach(function(tx) {
    if (ids.indexOf(tx.id) > -1) total += parseFloat(tx.nominal) || 0;
  });
  pendingConfirmNominal = total;
  $('nominalConfirmTitle').textContent = 'Total Nominal (' + ids.length + ' transaksi)';
  $('nominalConfirmDisplay').textContent = formatRupiah(total);
  $('nominalConfirmLabel').textContent = 'Ketik ulang TOTAL nominal untuk konfirmasi bulk approve';
  $('nominalConfirmInput').value = '';
  $('pinError').style.display = 'none';
  openModal('modalPin');
}

function submitBulkApproval() {
  var ids = Array.from(selectedApprovalIds);
  if (!ids.length) return;
  showLoading(true);
  var total = ids.length;
  var done = 0, success = 0, failed = 0;
  var approvedByName = currentUser ? (currentUser.namaLengkap || currentUser.username) : 'Admin';

  function next() {
    if (done >= total) {
      showLoading(false);
      selectedApprovalIds.clear();
      showToast(failed ? 'warning' : 'success', 'Bulk Approve Selesai',
        success + ' berhasil, ' + failed + ' gagal dari ' + total + ' transaksi.');
      loadTransactions();
      loadDashboardData();
      loadApprovalData();
      return;
    }
    var id = ids[done];
    callApi('approveTransaction', [
      { id: id, approvedBy: approvedByName, ttdBase64: '', catatanApproval: '' }
    ], function(result) {
        if (result && result.success) {
                  success++;
                } else {
                  failed++;
                }
                done++;
                next();
      },
      function(err) {
        failed++; done++; next();
      }
    );
  }
  next();
}

function printSelectedApprovalData() {
  if (!selectedApprovalIds.size) { showToast('warning', 'Perhatian', 'Pilih minimal satu transaksi untuk dicetak.'); return; }
  var data = filteredApprovalData.filter(function(tx) { return selectedApprovalIds.has(tx.id); });
  if (!data.length) { showToast('warning', 'Perhatian', 'Tidak ada data terpilih.'); return; }

  var metodeSummary = {};
  var grandTotal = 0;
  var grandCount = 0;
  data.forEach(function(tx) {
    var m = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var label = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    if (!metodeSummary[label]) metodeSummary[label] = { count: 0, total: 0 };
    metodeSummary[label].count++;
    metodeSummary[label].total += parseFloat(tx.nominal) || 0;
    grandTotal += parseFloat(tx.nominal) || 0;
    grandCount++;
  });

  exportApprovalReportPDF(data, 'Approval Transaksi Terpilih');
}

function populateApprovalFilters(options) {
  options = options || approvalFilterOptions || {};
  var sppgValues = Array.isArray(options.sppg) ? options.sppg : [];
  var jenisValues = Array.isArray(options.jenisKategori) ? options.jenisKategori : [];
  var supplierValues = Array.isArray(options.supplier) ? options.supplier : [];
  var selSppg = $('apprFilterSPPG');
  if (selSppg) {
    var prevSppg = selSppg.value || 'ALL';
    var html = '<option value="ALL">Semua SPPG</option>';
    sppgValues.forEach(function(s) { html += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    selSppg.innerHTML = html;
    if (sppgValues.indexOf(prevSppg) > -1 || prevSppg === 'ALL') selSppg.value = prevSppg;
  }
  var selJenis = $('apprFilterJenisKat');
  if (selJenis) {
    var prevJenis = selJenis.value || 'ALL';
    var html2 = '<option value="ALL">Semua Jenis Kategori</option>';
    jenisValues.forEach(function(s) { html2 += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    selJenis.innerHTML = html2;
    if (jenisValues.indexOf(prevJenis) > -1 || prevJenis === 'ALL') selJenis.value = prevJenis;
  }
  var selSupplier = $('apprFilterSupplier');
  if (selSupplier) {
    var prevSupplier = selSupplier.value || 'ALL';
    var html3 = '<option value="ALL">Semua Supplier</option>';
    supplierValues.forEach(function(s) { html3 += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
    selSupplier.innerHTML = html3;
    if (supplierValues.indexOf(prevSupplier) > -1 || prevSupplier === 'ALL') selSupplier.value = prevSupplier;
  }
}

function filterApproval() {
  approvalPage = 1;
  selectedApprovalIds.clear();
  if (approvalFilterTimer) clearTimeout(approvalFilterTimer);
  // Debounce both search and dropdown/date filters to coalesce rapid UI events
  // into one paged Edge Function request.
  approvalFilterTimer = setTimeout(function() {
    approvalFilterTimer = null;
    if (approvalLoadState.inFlight) {
      approvalLoadState.queued = true;
      approvalLoadState.queuedPage = 1;
      return;
    }
    loadApprovalData(1);
  }, 250);
}

function resetApprovalFilter() {
  if ($('apprSearchInput')) $('apprSearchInput').value = '';
  if ($('apprFilterSPPG')) $('apprFilterSPPG').value = 'ALL';
  if ($('apprFilterJenisKat')) $('apprFilterJenisKat').value = 'ALL';
  if ($('apprFilterSupplier')) $('apprFilterSupplier').value = 'ALL';
  if ($('apprFilterKelengkapan')) $('apprFilterKelengkapan').value = 'ALL';
  if ($('apprFilterTglStart')) $('apprFilterTglStart').value = '';
  if ($('apprFilterTglEnd')) $('apprFilterTglEnd').value = '';
  filterApproval();
}

// ============================================================
// EXPORT APPROVAL — PDF, CSV, XLSX & ODS
// ============================================================
function exportApproval(format) {
  closeApprovalDownloadMenu();
  showLoading(true);
  // Full data is fetched only for an explicit export. Normal Approval browsing
  // remains server-paged and transfers details for the visible page only.
  callApi('getTransactions', [approvalRequestFilters(1, true)], function(result) {
    showLoading(false);
    var normalized = normalizeApprovalApiResponse(result);
    var approvalData = normalized.valid
      ? normalized.rows.map(normalizeApprovalTransaction).filter(function(tx) {
        return tx && isApprovalQueueTransaction(tx);
      })
      : [];
    if (!approvalData.length) {
      showToast('warning', 'Tidak Ada Data', 'Tidak ada transaksi yang menunggu approval.');
      return;
    }
    if (format === 'csv') {
      exportApprovalReportCSV(approvalData);
    } else if (format === 'pdf') {
      exportApprovalReportPDF(approvalData);
    } else if (format === 'xlsx' || format === 'ods') {
      exportApprovalSpreadsheet(approvalData, format);
    } else {
      showToast('warning', 'Format Tidak Dikenal', 'Silakan pilih format file yang tersedia.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', err && err.message ? err.message : 'Data export Approval tidak dapat dimuat.');
  });
}

function toggleApprovalDownloadMenu(event) {
  if (event) event.stopPropagation();
  var menu = $('approvalDownloadMenu');
  var trigger = $('approvalDownloadTrigger');
  if (!menu) return;
  var willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  if (trigger) trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function closeApprovalDownloadMenu() {
  var menu = $('approvalDownloadMenu');
  var trigger = $('approvalDownloadTrigger');
  if (menu) menu.classList.add('hidden');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', function(event) {
  var wrap = $('approvalDownloadWrap');
  if (wrap && !wrap.contains(event.target)) closeApprovalDownloadMenu();
  var transactionWrap = $('transactionDownloadWrap');
  if (transactionWrap && !transactionWrap.contains(event.target)) closeTransactionDownloadMenu();
});

// ============================================================
// EXPORT TRANSAKSI — data bisnis terpilih, tanpa field internal
// ============================================================
function toggleTransactionDownloadMenu(event) {
  if (event) event.stopPropagation();
  var menu = $('transactionDownloadMenu');
  var trigger = $('transactionDownloadTrigger');
  if (!menu) return;
  var willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  if (trigger) trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function closeTransactionDownloadMenu() {
  var menu = $('transactionDownloadMenu');
  var trigger = $('transactionDownloadTrigger');
  if (menu) menu.classList.add('hidden');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function _transactionReportFilters() {
  var filters = {};
  var sppg = $('txFilterSPPG') ? $('txFilterSPPG').value : 'ALL';
  var kategori = $('txFilterKategori') ? $('txFilterKategori').value : 'ALL';
  var start = $('txFilterTglStart') ? $('txFilterTglStart').value : '';
  var end = $('txFilterTglEnd') ? $('txFilterTglEnd').value : '';
  if (sppg && sppg !== 'ALL') filters.sppg = sppg;
  if (kategori && kategori !== 'ALL') filters.kategori = kategori;
  if (start) filters.dateStart = start;
  else if (globalDateFilter.start) filters.dateStart = globalDateFilter.start;
  if (end) filters.dateEnd = end;
  else if (globalDateFilter.end) filters.dateEnd = globalDateFilter.end;
  return filters;
}

function _fetchTransactionReportRows() {
  var filters = _transactionReportFilters();
  var rows = [];
  var page = 1;
  var pageSize = 100;

  return new Promise(function(resolve, reject) {
    function next() {
      var request = Object.assign({}, filters, { page: page, pageSize: pageSize });
      callApi('getTransactions', [request], function(result) {
        var batch = Array.isArray(result) ? result : (result && Array.isArray(result.data) ? result.data : null);
        if (!batch) {
          reject(new Error('Format data transaksi tidak valid.'));
          return;
        }
        rows = rows.concat(batch);
        var total = Number(result && result.total) || rows.length;
        var hasMore = !!(result && result.hasMore) || rows.length < total;
        if (hasMore && batch.length && page < 100) {
          page++;
          next();
          return;
        }
        var search = $('txSearchInput') ? String($('txSearchInput').value || '').trim().toLowerCase() : '';
        var status = $('txFilterStatus') ? $('txFilterStatus').value : 'ALL';
        rows = rows.filter(function(tx) {
          if (search) {
            var haystack = [tx.kode, tx.item, tx.user, tx.userEmail, tx.userName, tx.sppg, tx.catatan]
              .join(' ').toLowerCase();
            if (haystack.indexOf(search) === -1) return false;
          }
          var metode = String(tx.metodeTransaksi || '').trim().toUpperCase();
          if (status === 'PENDING' && metode === 'SUDAH_DIBAYAR') return false;
          if (status === 'SUDAH_DIBAYAR' && metode !== 'SUDAH_DIBAYAR') return false;
          return true;
        });
        resolve(rows);
      }, function(error) {
        reject(error || new Error('Data transaksi gagal dimuat.'));
      });
    }
    next();
  });
}

function _transactionDocumentStatus(tx) {
  var present = function(value) {
    if (value === true) return true;
    if (!value || value === false) return false;
    if (typeof value === 'object') {
      return !!(value.signedUrl || value.previewUrl || value.viewUrl || value.path || value.name);
    }
    var text = String(value).trim();
    return !!text && text !== '-' && !/^(FOTO|FILE)$/i.test(text);
  };
  var proof = tx.hasBuktiTransaksi === true ||
    present(tx.uploadFoto) || present(tx.uploadFile) ||
    present(tx.fileBuktiFoto) || present(tx.fileBuktiFile) ||
    present(tx.fileBuktiApproval) ||
    Number(tx.jumlahBuktiPembayaran || tx.paymentProofCount || 0) > 0 ||
    (Array.isArray(tx.paymentProofs) && tx.paymentProofs.length > 0);
  var note = tx.hasNotaPembelian === true ||
    present(tx.notaPembelian) || present(tx.fileNota);
  if (proof && note) return 'Lengkap';
  if (proof && !note) return 'Tidak ada Nota';
  if (!proof && note) return 'Tidak ada bukti';
  return 'Tidak Lengkap';
}

function _transactionApprovalStatus(tx) {
  var approved = tx.isApproved === true || tx.approved === true ||
    (tx.approvedBy && String(tx.approvedBy).trim() !== '-') ||
    (tx.waktuApprove && String(tx.waktuApprove).trim() !== '-');
  return approved ? 'Sudah Diapprove' : 'Belum Diapprove';
}

function _transactionReportModel(data) {
  var rows = (data || []).map(function(tx, index) {
    var rawUser = String(tx.user || '').trim();
    var email = String(tx.userEmail || tx.emailPenginput || (rawUser.indexOf('@') > -1 ? rawUser : '') || '-');
    var name = String(tx.userName || tx.namaPenginput || tx.namaUser ||
      (rawUser && rawUser.indexOf('@') === -1 ? rawUser : '') || '-');
    return {
      no: index + 1,
      tanggal: String(tx.tanggal || '-'),
      kode: String(tx.kode || '-'),
      sppg: String(tx.sppg || '-'),
      penginput: name,
      email: email,
      kategori: String(tx.kategori || '-'),
      jenis: String(tx.jenisKategori || '-'),
      item: String(tx.item || tx.namaItem || '-'),
      supplier: String(tx.supplierName || '-'),
      catatan: String(tx.catatan || '-'),
      nominal: Number(tx.nominal) || 0,
      approval: _transactionApprovalStatus(tx),
      dokumen: _transactionDocumentStatus(tx)
    };
  });
  var dates = rows.map(function(row) {
    var match = row.tanggal.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? match[3] + '-' + match[2] + '-' + match[1] : row.tanggal.slice(0, 10);
  }).filter(function(value) { return value && value !== '-'; }).sort();
  var filters = _transactionReportFilters();
  var periodStart = filters.dateStart || dates[0] || '-';
  var periodEnd = filters.dateEnd || dates[dates.length - 1] || '-';
  return {
    rows: rows,
    count: rows.length,
    total: rows.reduce(function(sum, row) { return sum + row.nominal; }, 0),
    period: periodStart === periodEnd ? periodStart : periodStart + ' s.d. ' + periodEnd,
    filter: getActiveFilterInfo() || 'Semua transaksi'
  };
}

function _transactionReportHeaders() {
  return ['No', 'Tanggal Transaksi', 'Kode Transaksi', 'SPPG', 'Nama Penginput', 'Email Penginput',
    'Kategori', 'Jenis Kategori', 'Item', 'Supplier / Penjual', 'Catatan', 'Nominal (Rp)', 'Status Approval', 'Status Bukti'];
}

function _transactionReportValues(row) {
  return [row.no, row.tanggal, row.kode, row.sppg, row.penginput, row.email, row.kategori,
    row.jenis, row.item, row.supplier, row.catatan, Math.round(row.nominal), row.approval, row.dokumen];
}

function _downloadTransactionCSV(report) {
  var lines = [];
  var add = function(values) { lines.push(values.map(_approvalCsvCell).join(',')); };
  add(['LAPORAN TRANSAKSI SIM-SPPG']);
  add(['Periode', report.period]);
  add(['Filter aktif', report.filter]);
  add(['Jumlah transaksi', report.count]);
  add(['Total nominal (Rp)', Math.round(report.total)]);
  lines.push('');
  add(_transactionReportHeaders());
  report.rows.forEach(function(row) { add(_transactionReportValues(row)); });
  var blob = new Blob(['\uFEFFsep=,\r\n' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'Laporan_Transaksi_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 500);
}

function _downloadTransactionSpreadsheet(report, format) {
  return _loadApprovalSpreadsheetLibrary().then(function() {
    var workbook = window.XLSX.utils.book_new();
    var rows = [
      ['LAPORAN TRANSAKSI SIM-SPPG'],
      ['Periode', report.period],
      ['Filter aktif', report.filter],
      ['Jumlah transaksi', report.count],
      ['Total nominal (Rp)', Math.round(report.total)],
      [],
      _transactionReportHeaders()
    ];
    report.rows.forEach(function(row) { rows.push(_transactionReportValues(row)); });
    _appendApprovalSheet(workbook, 'Transaksi', rows,
      [6, 16, 20, 18, 23, 30, 15, 22, 30, 26, 38, 18, 20, 22], 7);
    var extension = format === 'ods' ? 'ods' : 'xlsx';
    window.XLSX.writeFile(workbook,
      'Laporan_Transaksi_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.' + extension,
      { bookType: extension, compression: true });
  });
}

function _transactionReportHTML(report) {
  var createdBy = currentUser ? (currentUser.namaLengkap || currentUser.email || '-') : '-';
  var printHeaders = ['No', 'Tanggal', 'Kode', 'SPPG', 'Penginput', 'Kategori',
    'Jenis Kategori', 'Item', 'Supplier', 'Catatan', 'Nominal', 'Status Approval', 'Status Bukti'];
  var bodyRows = report.rows.map(function(row) {
    var statusClass = row.dokumen === 'Lengkap' ? 'ok' : (row.dokumen === 'Tidak Lengkap' ? 'bad' : 'warn');
    var approvalClass = row.approval === 'Sudah Diapprove' ? 'ok' : 'warn';
    return '<tr>' +
      '<td class="center">' + row.no + '</td><td>' + esc(row.tanggal) + '</td>' +
      '<td class="code">' + esc(row.kode) + '</td><td>' + esc(row.sppg) + '</td>' +
      '<td><strong>' + esc(row.penginput) + '</strong><small>' + esc(row.email) + '</small></td>' +
      '<td>' + esc(row.kategori) + '</td><td>' + esc(row.jenis) + '</td>' +
      '<td>' + esc(row.item) + '</td><td>' + esc(row.supplier) + '</td><td>' + esc(row.catatan) + '</td>' +
      '<td class="money">Rp ' + Math.round(row.nominal).toLocaleString('id-ID') + '</td>' +
      '<td><span class="status ' + approvalClass + '">' + esc(row.approval) + '</span></td>' +
      '<td><span class="status ' + statusClass + '">' + esc(row.dokumen) + '</span></td></tr>';
  }).join('');
  return '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Transaksi SIM-SPPG</title><style>' +
    '@page{size:A4 landscape;margin:9mm 7mm 11mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:7.4px/1.35 Arial,sans-serif}' +
    'header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;padding-bottom:8px;margin-bottom:8px;border-bottom:3px solid #15577a}' +
    '.brand{color:#1e6f9c;font-weight:800;letter-spacing:1.4px}.title{margin:2px 0;font-size:19px}.muted{color:#64748b}.right{text-align:right}' +
    '.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}.meta div{padding:6px 8px;border:1px solid #dbe5ee;border-radius:6px;background:#f8fafc}.meta span{display:block;color:#64748b;font-size:6.5px;text-transform:uppercase;font-weight:700}.meta strong{display:block;margin-top:2px;font-size:8.5px}' +
    'table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{padding:5px 4px;color:#fff;background:#15577a;text-align:left;font-size:6.6px}td{padding:4px;border:1px solid #dbe5ee;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f8fafc}tr{break-inside:avoid}' +
    'th:nth-child(1){width:3%}th:nth-child(2){width:7%}th:nth-child(3){width:7%}th:nth-child(4){width:8%}th:nth-child(5){width:11%}th:nth-child(6){width:7%}th:nth-child(7){width:9%}th:nth-child(8){width:11%}th:nth-child(9){width:12%}th:nth-child(10){width:8%}th:nth-child(11){width:8%}th:nth-child(12){width:9%}' +
    '.center{text-align:center}.money{text-align:right;white-space:nowrap;font-weight:700}.code{font-family:monospace}small{display:block;margin-top:2px;color:#64748b}.status{display:inline-block;padding:2px 4px;border-radius:9px;font-weight:700}.ok{background:#dcfce7;color:#047857}.warn{background:#fef3c7;color:#92400e}.bad{background:#ffe4e6;color:#be123c}' +
    '</style></head><body><header><div><div class="brand">SIM-SPPG</div><h1 class="title">Laporan Transaksi</h1><div class="muted">Data transaksi sesuai filter aktif.</div></div>' +
    '<div class="right"><strong>' + esc(new Date().toLocaleString('id-ID')) + '</strong><div class="muted">Dibuat oleh ' + esc(createdBy) + '</div></div></header>' +
    '<div class="meta"><div><span>Periode</span><strong>' + esc(report.period) + '</strong></div><div><span>Filter</span><strong>' + esc(report.filter) + '</strong></div><div><span>Jumlah</span><strong>' + report.count + ' transaksi</strong></div><div><span>Total Nominal</span><strong>Rp ' + Math.round(report.total).toLocaleString('id-ID') + '</strong></div></div>' +
    '<table><thead><tr>' + printHeaders.map(function(header) { return '<th>' + esc(header) + '</th>'; }).join('') +
    '</tr></thead><tbody>' + bodyRows + '</tbody></table>' +
    '<script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script></body></html>';
}

function exportTransactions(format) {
  closeTransactionDownloadMenu();
  var printWindow = null;
  if (format === 'pdf') {
    printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('error', 'Pop-up Diblokir', 'Izinkan pop-up browser untuk mencetak atau menyimpan PDF.');
      return;
    }
    printWindow.document.write('<!doctype html><title>Menyiapkan laporan...</title><p style="font-family:Arial;padding:24px">Menyiapkan laporan transaksi...</p>');
    printWindow.document.close();
  }
  showLoading(true);
  _fetchTransactionReportRows().then(function(data) {
    if (!data.length) throw new Error('Tidak ada transaksi sesuai filter aktif.');
    var report = _transactionReportModel(data);
    if (format === 'pdf') {
      printWindow.document.open();
      printWindow.document.write(_transactionReportHTML(report));
      printWindow.document.close();
    } else if (format === 'csv') {
      _downloadTransactionCSV(report);
    } else if (format === 'xlsx' || format === 'ods') {
      return _downloadTransactionSpreadsheet(report, format);
    } else {
      throw new Error('Format download tidak didukung.');
    }
    return null;
  }).then(function() {
    showToast('success', 'Laporan Siap', 'Data transaksi berhasil disiapkan dengan kolom ringkas.');
  }).catch(function(error) {
    if (printWindow && !printWindow.closed) printWindow.close();
    showToast('error', 'Laporan Gagal', error && error.message ? error.message : 'Laporan tidak dapat dibuat.');
  }).then(function() {
    showLoading(false);
  });
}

function _approvalDocStatus(tx) {
  var ada = function(v) {
    var s = v ? String(v).trim() : '';
    if (s === '' || s === '-') return false;
    // Data lama migrasi kadang berisi placeholder "FOTO"/"FILE" tanpa file asli.
    if (/^(FOTO|FILE)$/i.test(s)) return false;
    return true;
  };
  var bukti = ada(tx.uploadFoto) || ada(tx.uploadFile) ||
    Number(tx.jumlahBuktiPembayaran || tx.paymentProofCount || 0) > 0 ||
    tx.hasPendingPaymentProof === true;
  var nota  = ada(tx.notaPembelian);
  var ttd   = ada(tx.ttdUser);
  // Status laporan mengikuti dua dokumen pendukung utama. TTD tetap dicatat
  // sebagai informasi audit, tetapi tidak mengubah status kelengkapan.
  var status;
  if (bukti && nota) status = 'Lengkap';
  else if (bukti && !nota) status = 'Tidak ada Nota';
  else if (!bukti && nota) status = 'Tidak ada bukti Pembayaran';
  else status = 'Tidak Lengkap';
  return {
    bukti:  bukti ? 'Ada' : 'Tidak Ada',
    nota:   nota  ? 'Ada' : 'Tidak Ada',
    ttd:    ttd   ? 'Ada' : 'Tidak Ada',
    status: status
  };
}

function exportApprovalCSV(data, metodeSummary, grandTotal, grandCount) {
  var sep = ';';
  var csv = '\uFEFF';
  csv += ['"No"','"Kode Transaksi"','"Tanggal"','"SPPG"','"Item/Bahan Baku"','"Nominal (Rp)"',
          '"Metode Transaksi"','"Penginput"',
          '"Ada Bukti Transaksi"','"Ada Nota Pembelian"','"Ada TTD User"','"Status Kelengkapan"']
         .join(sep) + '\r\n';
  data.forEach(function(tx, i) {
    var doc = _approvalDocStatus(tx);
    var m   = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var mLabel = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    csv += [
      i + 1,
      '"' + esc(tx.kode || '-') + '"',
      '"' + esc(tx.tanggal || '-') + '"',
      '"' + esc(tx.sppg || '-') + '"',
      '"' + esc(tx.item || '-') + '"',
      Math.round(tx.nominal || 0),
      '"' + mLabel + '"',
      '"' + esc(tx.user || '-') + '"',
      '"' + doc.bukti + '"',
      '"' + doc.nota + '"',
      '"' + doc.ttd + '"',
      '"' + doc.status + '"'
    ].join(sep) + '\r\n';
  });
  // Hitung rekap kelengkapan
  var totalLengkap = 0, totalTdkLengkap = 0;
  var totalTanpaBukti = 0, totalTanpaNota = 0;
  var nominalLengkap = 0, nominalTdkLengkap = 0;
  var nominalTanpaBukti = 0, nominalTanpaNota = 0;
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    if (doc.status === 'Lengkap') {
      totalLengkap++; nominalLengkap += nom;
    } else {
      totalTdkLengkap++; nominalTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { totalTanpaBukti++; nominalTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { totalTanpaNota++;  nominalTanpaNota  += nom; }
    }
  });

  // Hitung rekap per SPPG
  var sppgSummary = {};
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    var sppg = String(tx.sppg || '-').trim();
    if (!sppgSummary[sppg]) sppgSummary[sppg] = { count: 0, total: 0, lengkap: 0, tdkLengkap: 0, tanpaBukti: 0, tanpaNota: 0, nomLengkap: 0, nomTdkLengkap: 0, nomTanpaBukti: 0, nomTanpaNota: 0 };
    sppgSummary[sppg].count++;
    sppgSummary[sppg].total += nom;
    if (doc.status === 'Lengkap') {
      sppgSummary[sppg].lengkap++;
      sppgSummary[sppg].nomLengkap += nom;
    } else {
      sppgSummary[sppg].tdkLengkap++;
      sppgSummary[sppg].nomTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { sppgSummary[sppg].tanpaBukti++; sppgSummary[sppg].nomTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { sppgSummary[sppg].tanpaNota++;  sppgSummary[sppg].nomTanpaNota  += nom; }
    }
  });

  csv += '\r\n';
  csv += '"=== RINGKASAN 1: KUMULATIF PER METODE TRANSAKSI ==="' + sep + sep + sep + '\r\n';
  csv += '"Metode Transaksi"' + sep + '"Jumlah Transaksi"' + sep + '"Total Nominal (Rp)"' + '\r\n';
  Object.keys(metodeSummary).forEach(function(label) {
    var s = metodeSummary[label];
    csv += '"' + label + '"' + sep + s.count + sep + Math.round(s.total) + '\r\n';
  });
  csv += '"TOTAL KESELURUHAN"' + sep + grandCount + sep + Math.round(grandTotal) + '\r\n';

  csv += '\r\n';
  csv += '"=== RINGKASAN 2: STATUS KELENGKAPAN DOKUMEN ==="' + sep + sep + sep + '\r\n';
  csv += '"Status Kelengkapan"' + sep + '"Jumlah Transaksi"' + sep + '"Total Nominal (Rp)"' + sep + '"Keterangan"' + '\r\n';
  csv += '"Dokumen Lengkap"'                + sep + totalLengkap    + sep + Math.round(nominalLengkap)    + sep + '"Bukti + Nota + TTD semua ada"' + '\r\n';
  csv += '"Dokumen Tidak Lengkap"'          + sep + totalTdkLengkap + sep + Math.round(nominalTdkLengkap) + sep + '"Ada dokumen yang kurang"' + '\r\n';
  csv += '"  \u2514 Tanpa Bukti Transaksi"' + sep + totalTanpaBukti + sep + Math.round(nominalTanpaBukti) + sep + '"Belum upload foto/file bukti"' + '\r\n';
  csv += '"  \u2514 Tanpa Nota Pembelian"'  + sep + totalTanpaNota  + sep + Math.round(nominalTanpaNota)  + sep + '"Belum upload nota pembelian"' + '\r\n';
  csv += '"TOTAL KESELURUHAN"'              + sep + grandCount      + sep + Math.round(grandTotal)        + sep + '"All approval pending"' + '\r\n';

  csv += '\r\n';
  csv += '"=== RINGKASAN 3: KUMULATIF PER SPPG ==="' + sep + sep + sep + sep + sep + sep + '\r\n';
  csv += '"SPPG"' + sep + '"Jumlah Transaksi"' + sep + '"Total Nominal (Rp)"' + sep + '"Dok. Lengkap"' + sep + '"Nominal Lengkap"' + sep + '"Dok. Tidak Lengkap"' + sep + '"Nominal Tdk Lengkap"' + sep + '"Tanpa Bukti"' + sep + '"Nominal Tanpa Bukti"' + sep + '"Tanpa Nota"' + sep + '"Nominal Tanpa Nota"' + '\r\n';
  Object.keys(sppgSummary).sort().forEach(function(sppg) {
    var s = sppgSummary[sppg];
    csv += '"' + sppg + '"' + sep +
      s.count + sep +
      Math.round(s.total) + sep +
      s.lengkap + sep +
      Math.round(s.nomLengkap) + sep +
      s.tdkLengkap + sep +
      Math.round(s.nomTdkLengkap) + sep +
      s.tanpaBukti + sep +
      Math.round(s.nomTanpaBukti) + sep +
      s.tanpaNota + sep +
      Math.round(s.nomTanpaNota) + '\r\n';
  });
  csv += '"TOTAL"' + sep + grandCount + sep + Math.round(grandTotal) + sep + totalLengkap + sep + Math.round(nominalLengkap) + sep + totalTdkLengkap + sep + Math.round(nominalTdkLengkap) + sep + totalTanpaBukti + sep + Math.round(nominalTanpaBukti) + sep + totalTanpaNota + sep + Math.round(nominalTanpaNota) + '\r\n';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = 'Approval_Transaksi_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('success', 'Export CSV', 'File berhasil diunduh.');
}

function exportApprovalPDF(data, metodeSummary, grandTotal, grandCount, pageLabel) {
  var now = new Date();
  var tgl = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  var jam = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  var printedBy = currentUser ? (currentUser.namaLengkap + ' (' + currentUser.role + ')') : '-';
  var pageTitle = pageLabel || 'Approval Transaksi';
  var rowsHtml = '';
  data.forEach(function(tx, i) {
    var doc = _approvalDocStatus(tx);
    var m   = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var mLabel = m === 'BELUM_BAYAR' ? 'Belum Bayar' : m === 'TRANSFER' ? 'Transfer' : m === 'CASH' ? 'Cash' : m;
    var mColor = m === 'BELUM_BAYAR' ? '#be123c' : m === 'TRANSFER' ? '#1e40af' : m === 'CASH' ? '#047857' : '#334155';
    var statusColor = doc.status === 'Lengkap' ? '#047857'
      : (doc.status === 'Hanya Bukti' || doc.status === 'Hanya Nota') ? '#b45309'
      : '#be123c';
    var buktiColor  = doc.bukti === 'Ada' ? '#047857' : '#be123c';
    var notaColor   = doc.nota  === 'Ada' ? '#047857' : '#be123c';
    var ttdColor    = doc.ttd   === 'Ada' ? '#047857' : '#be123c';
    rowsHtml +=
      '<tr>' +
      '<td style="text-align:center;">' + (i+1) + '</td>' +
      '<td><strong>' + esc(tx.kode||'-') + '</strong></td>' +
      '<td>' + esc(tx.tanggal||'-') + '</td>' +
      '<td>' + esc(tx.sppg||'-') + '</td>' +
      '<td>' + esc(tx.item||'-') + '</td>' +
      '<td style="text-align:right;font-weight:600;">Rp ' + Math.round(tx.nominal||0).toLocaleString('id-ID') + '</td>' +
      '<td style="color:' + mColor + ';font-weight:600;">' + mLabel + '</td>' +
      '<td>' + esc(tx.user||'-') + '</td>' +
      '<td style="text-align:center;color:' + buktiColor + ';font-weight:600;">' + doc.bukti + '</td>' +
      '<td style="text-align:center;color:' + notaColor  + ';font-weight:600;">' + doc.nota  + '</td>' +
      '<td style="text-align:center;color:' + ttdColor   + ';font-weight:600;">' + doc.ttd   + '</td>' +
      '<td style="text-align:center;color:' + statusColor + ';font-weight:600;">' + doc.status + '</td>' +
      '</tr>';
  });
  // Hitung rekap kelengkapan
  var totalLengkap = 0, totalTdkLengkap = 0;
  var totalTanpaBukti = 0, totalTanpaNota = 0;
  var nominalLengkap = 0, nominalTdkLengkap = 0;
  var nominalTanpaBukti = 0, nominalTanpaNota = 0;
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    if (doc.status === 'Lengkap') {
      totalLengkap++; nominalLengkap += nom;
    } else {
      totalTdkLengkap++; nominalTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { totalTanpaBukti++; nominalTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { totalTanpaNota++;  nominalTanpaNota  += nom; }
    }
  });

  // Hitung rekap per SPPG
  var sppgSummary = {};
  data.forEach(function(tx) {
    var doc = _approvalDocStatus(tx);
    var nom = parseFloat(tx.nominal) || 0;
    var sppg = String(tx.sppg || '-').trim();
    if (!sppgSummary[sppg]) sppgSummary[sppg] = { count: 0, total: 0, lengkap: 0, tdkLengkap: 0, tanpaBukti: 0, tanpaNota: 0, nomLengkap: 0, nomTdkLengkap: 0, nomTanpaBukti: 0, nomTanpaNota: 0 };
    sppgSummary[sppg].count++;
    sppgSummary[sppg].total += nom;
    if (doc.status === 'Lengkap') {
      sppgSummary[sppg].lengkap++;
      sppgSummary[sppg].nomLengkap += nom;
    } else {
      sppgSummary[sppg].tdkLengkap++;
      sppgSummary[sppg].nomTdkLengkap += nom;
      if (doc.bukti === 'Tidak Ada') { sppgSummary[sppg].tanpaBukti++; sppgSummary[sppg].nomTanpaBukti += nom; }
      if (doc.nota  === 'Tidak Ada') { sppgSummary[sppg].tanpaNota++;  sppgSummary[sppg].nomTanpaNota  += nom; }
    }
  });

  // Baris tabel rekap SPPG
  var sppgRows = '';
  var sppgKeys = Object.keys(sppgSummary).sort();
  sppgKeys.forEach(function(sppg, idx) {
    var s = sppgSummary[sppg];
    var bg = idx % 2 === 0 ? '' : 'background:#fafafa;';
    sppgRows +=
      '<tr style="' + bg + '">' +
      '<td style="font-weight:600;">' + esc(sppg) + '</td>' +
      '<td style="text-align:center;">' + s.count + '</td>' +
      '<td style="text-align:right;font-weight:600;">Rp ' + Math.round(s.total).toLocaleString('id-ID') + '</td>' +
      '<td style="text-align:center;color:#047857;">' + s.lengkap + '</td>' +
      '<td style="text-align:right;color:#047857;">Rp ' + Math.round(s.nomLengkap).toLocaleString('id-ID') + '</td>' +
      '<td style="text-align:center;color:#be123c;">' + s.tdkLengkap + '</td>' +
      '<td style="text-align:right;color:#be123c;">Rp ' + Math.round(s.nomTdkLengkap).toLocaleString('id-ID') + '</td>' +
      '<td style="text-align:center;color:#92400e;">' + s.tanpaBukti + '</td>' +
      '<td style="text-align:center;color:#92400e;">' + s.tanpaNota + '</td>' +
      '</tr>';
  });
  sppgRows +=
    '<tr style="background:#f1f5f9;font-weight:700;">' +
    '<td>TOTAL</td>' +
    '<td style="text-align:center;">' + grandCount + '</td>' +
    '<td style="text-align:right;">Rp ' + Math.round(grandTotal).toLocaleString('id-ID') + '</td>' +
    '<td style="text-align:center;color:#047857;">' + totalLengkap + '</td>' +
    '<td style="text-align:right;color:#047857;">Rp ' + Math.round(nominalLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="text-align:center;color:#be123c;">' + totalTdkLengkap + '</td>' +
    '<td style="text-align:right;color:#be123c;">Rp ' + Math.round(nominalTdkLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="text-align:center;color:#92400e;">' + totalTanpaBukti + '</td>' +
    '<td style="text-align:center;color:#92400e;">' + totalTanpaNota + '</td>' +
    '</tr>';

  var summaryRows = '';
  Object.keys(metodeSummary).forEach(function(label) {
    var s = metodeSummary[label];
    summaryRows +=
      '<tr>' +
      '<td>' + label + '</td>' +
      '<td style="text-align:center;">' + s.count + '</td>' +
      '<td style="text-align:right;color:#be123c;font-weight:600;">Rp ' + Math.round(s.total).toLocaleString('id-ID') + '</td>' +
      '</tr>';
  });
  summaryRows +=
    '<tr style="background:#f1f5f9;font-weight:700;">' +
    '<td>TOTAL KESELURUHAN</td>' +
    '<td style="text-align:center;">' + grandCount + '</td>' +
    '<td style="text-align:right;color:#0f172a;">Rp ' + Math.round(grandTotal).toLocaleString('id-ID') + '</td>' +
    '</tr>';

  var kelengkapanRows =
    '<tr style="background:#f0fdf4;">' +
    '<td style="color:#047857;font-weight:600;">Dokumen Lengkap</td>' +
    '<td style="text-align:center;color:#047857;font-weight:600;">' + totalLengkap + '</td>' +
    '<td style="text-align:right;color:#047857;font-weight:600;">Rp ' + Math.round(nominalLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#64748b;font-size:10px;">Bukti + Nota + TTD semua ada</td>' +
    '</tr>' +
    '<tr style="background:#fff1f2;">' +
    '<td style="color:#be123c;font-weight:600;">Dokumen Tidak Lengkap</td>' +
    '<td style="text-align:center;color:#be123c;font-weight:600;">' + totalTdkLengkap + '</td>' +
    '<td style="text-align:right;color:#be123c;font-weight:600;">Rp ' + Math.round(nominalTdkLengkap).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#64748b;font-size:10px;">Ada dokumen yang kurang</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding-left:20px;color:#64748b;">&nbsp;&nbsp;&#x2514; Tanpa Bukti Transaksi</td>' +
    '<td style="text-align:center;color:#64748b;">' + totalTanpaBukti + '</td>' +
    '<td style="text-align:right;color:#64748b;">Rp ' + Math.round(nominalTanpaBukti).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#94a3b8;font-size:10px;">Belum upload foto/file bukti</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding-left:20px;color:#64748b;">&nbsp;&nbsp;&#x2514; Tanpa Nota Pembelian</td>' +
    '<td style="text-align:center;color:#64748b;">' + totalTanpaNota + '</td>' +
    '<td style="text-align:right;color:#64748b;">Rp ' + Math.round(nominalTanpaNota).toLocaleString('id-ID') + '</td>' +
    '<td style="color:#94a3b8;font-size:10px;">Belum upload nota pembelian</td>' +
    '</tr>' +
    '<tr style="background:#f1f5f9;font-weight:700;">' +
    '<td>TOTAL KESELURUHAN</td>' +
    '<td style="text-align:center;">' + grandCount + '</td>' +
    '<td style="text-align:right;color:#0f172a;">Rp ' + Math.round(grandTotal).toLocaleString('id-ID') + '</td>' +
    '<td></td>' +
    '</tr>';
  var html =
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
    '<title>Approval Transaksi</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:10px;color:#0f172a;margin:0;padding:16px;}' +
    'h2{font-size:15px;margin:0 0 2px 0;text-align:center;}' +
    '.meta{font-size:10px;color:#64748b;text-align:center;margin-bottom:14px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:18px;}' +
    'thead th{background:#f1f5f9;padding:6px 8px;text-align:left;border:1px solid #cbd5e1;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;}' +
    'tbody td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:middle;}' +
    'tbody tr:nth-child(even){background:#fafafa;}' +
    '.section-title{font-size:11px;font-weight:700;margin:0 0 6px 0;color:#334155;border-left:3px solid #10b981;padding-left:8px;}' +
    '@media print{@page{size:A4 landscape;margin:10mm;}}' +
    '</style></head><body>' +
    '<h2>Laporan ' + pageTitle + '</h2>' +
    '<div class="meta">Dicetak oleh: ' + printedBy + ' &nbsp;|&nbsp; Tanggal: ' + tgl + ' ' + jam + ' &nbsp;|&nbsp; Total: ' + grandCount + ' transaksi</div>' +
    '<table>' +
    '<thead><tr>' +
    '<th style="width:22px;">No</th>' +
    '<th>Kode</th>' +
    '<th>Tanggal</th>' +
    '<th>SPPG</th>' +
    '<th>Item / Bahan Baku</th>' +
    '<th style="text-align:right;">Nominal</th>' +
    '<th>Metode</th>' +
    '<th>Penginput</th>' +
    '<th style="text-align:center;">Bukti</th>' +
    '<th style="text-align:center;">Nota</th>' +
    '<th style="text-align:center;">TTD</th>' +
    '<th style="text-align:center;">Kelengkapan</th>' +
    '</tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody>' +
    '</table>' +
    '<p class="section-title">Ringkasan 1 — Kumulatif per Metode Transaksi</p>' +
    '<table style="max-width:440px;">' +
    '<thead><tr>' +
    '<th>Metode Transaksi</th>' +
    '<th style="text-align:center;">Jumlah Transaksi</th>' +
    '<th style="text-align:right;">Total Nominal (Rp)</th>' +
    '</tr></thead>' +
    '<tbody>' + summaryRows + '</tbody>' +
    '</table>' +
    '<p class="section-title">Ringkasan 2 — Status Kelengkapan Dokumen</p>' +
    '<p style="font-size:10px;color:#64748b;margin:0 0 6px 0;">&#9432; Dokumen lengkap wajib memiliki bukti transaksi, nota pembelian, dan TTD User</p>' +
    '<table style="max-width:640px;">' +
    '<thead><tr>' +
    '<th>Status Kelengkapan</th>' +
    '<th style="text-align:center;">Jumlah</th>' +
    '<th style="text-align:right;">Total Nominal (Rp)</th>' +
    '<th>Keterangan</th>' +
    '</tr></thead>' +
    '<tbody>' + kelengkapanRows + '</tbody>' +
    '</table>' +
    '<p class="section-title">Ringkasan 3 — Kumulatif per SPPG</p>' +
    '<table style="width:100%;">' +
    '<thead><tr>' +
    '<th>SPPG</th>' +
    '<th style="text-align:center;">Total Trx</th>' +
    '<th style="text-align:right;">Total Nominal</th>' +
    '<th style="text-align:center;color:#047857;">Dok. Lengkap</th>' +
    '<th style="text-align:right;color:#047857;">Nominal Lengkap</th>' +
    '<th style="text-align:center;color:#be123c;">Dok. Tdk Lengkap</th>' +
    '<th style="text-align:right;color:#be123c;">Nominal Tdk Lengkap</th>' +
    '<th style="text-align:center;color:#92400e;">Tanpa Bukti</th>' +
    '<th style="text-align:center;color:#92400e;">Tanpa Nota</th>' +
    '</tr></thead>' +
    '<tbody>' + sppgRows + '</tbody>' +
    '</table>' +
    '</body></html>';
  var win = window.open('', '_blank');
  if (!win) {
    showToast('error', 'Gagal', 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = function() { win.print(); };
  showToast('success', 'Export PDF', 'Jendela cetak/simpan PDF telah dibuka.');
}

function _approvalReportModel(data) {
  var rows = (data || []).map(function(tx, index) {
    var doc = _approvalDocStatus(tx);
    var email = String(tx.userEmail || tx.user || '-').trim() || '-';
    var name = String(tx.userName || tx.namaPenginput || '').trim();
    if (!name || name.toLowerCase() === email.toLowerCase()) name = '-';
    var method = String(tx.metodeTransaksi || 'BELUM_BAYAR').trim().toUpperCase();
    var methodLabel = method === 'BELUM_BAYAR' ? 'Belum Bayar'
      : method === 'BELUM_LUNAS' ? 'Belum Lunas'
      : method === 'MENUNGGU_VERIFIKASI' ? 'Menunggu Verifikasi'
      : method === 'SUDAH_DIBAYAR' ? 'Sudah Dibayar'
      : method === 'TRANSFER' ? 'Transfer'
      : method === 'CASH' ? 'Cash'
      : method.replace(/_/g, ' ');
    return {
      no: index + 1,
      tanggal: String(tx.tanggal || '-'),
      kode: String(tx.kode || tx.id || '-'),
      sppg: String(tx.sppg || '-'),
      nama: name,
      email: email,
      jenis: String(tx.jenisKategori || 'Lainnya'),
      item: String(tx.item || '-'),
      supplier: String(tx.supplierName || 'Belum tercatat'),
      bank: String(tx.supplierBankName || '-'),
      rekening: String(tx.supplierAccountNumber || '-'),
      atasNama: String(tx.supplierAccountHolder || '-'),
      rekeningPenerima: String((tx.supplierBankName || '-') + ' - ' + (tx.supplierAccountNumber || '-') + ' a.n ' + (tx.supplierAccountHolder || '-')),
      nominal: Number(tx.nominal) || 0,
      metode: methodLabel,
      kelengkapan: doc.status,
      indikator: doc.status === 'Lengkap' ? 'HIJAU'
        : doc.status === 'Tidak Lengkap' ? 'MERAH' : 'KUNING',
      bukti: doc.bukti,
      nota: doc.nota,
      ttd: doc.ttd
    };
  });

  var category = {}, sppg = {}, completeness = {};
  var total = 0;
  rows.forEach(function(row) {
    total += row.nominal;
    if (!category[row.jenis]) category[row.jenis] = { count: 0, total: 0 };
    category[row.jenis].count++;
    category[row.jenis].total += row.nominal;

    var sppgKey = [row.sppg, row.nama, row.email].join('\u0001');
    if (!sppg[sppgKey]) sppg[sppgKey] = {
      sppg: row.sppg, nama: row.nama, email: row.email,
      count: 0, total: 0, lengkap: 0, tidakLengkap: 0
    };
    sppg[sppgKey].count++;
    sppg[sppgKey].total += row.nominal;
    if (row.kelengkapan === 'Lengkap') sppg[sppgKey].lengkap++;
    else sppg[sppgKey].tidakLengkap++;

    if (!completeness[row.kelengkapan]) completeness[row.kelengkapan] = { count: 0, total: 0 };
    completeness[row.kelengkapan].count++;
    completeness[row.kelengkapan].total += row.nominal;
  });

  var dates = rows.map(function(row) {
    var value = row.tanggal;
    var match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? match[3] + '-' + match[2] + '-' + match[1] : value.slice(0, 10);
  }).filter(Boolean).sort();
  var startFilter = $('apprFilterTglStart') ? $('apprFilterTglStart').value : '';
  var endFilter = $('apprFilterTglEnd') ? $('apprFilterTglEnd').value : '';
  var periodStart = startFilter || dates[0] || '-';
  var periodEnd = endFilter || dates[dates.length - 1] || '-';
  var filters = getActiveFilterInfo();

  return {
    rows: rows,
    categories: Object.keys(category).sort().map(function(key) {
      return { label: key, count: category[key].count, total: category[key].total };
    }),
    sppg: Object.keys(sppg).sort().map(function(key) { return sppg[key]; }),
    completeness: ['Lengkap', 'Tidak ada Nota', 'Tidak ada bukti Pembayaran', 'Tidak Lengkap']
      .filter(function(key) { return completeness[key]; })
      .map(function(key) { return { label: key, count: completeness[key].count, total: completeness[key].total }; }),
    count: rows.length,
    total: total,
    period: periodStart === periodEnd ? periodStart : periodStart + ' s.d. ' + periodEnd,
    filters: filters || 'Semua data Approval'
  };
}

function _approvalCsvCell(value) {
  var text = String(value === null || value === undefined ? '' : value)
    .replace(/\r?\n/g, ' ');
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportApprovalReportCSV(data) {
  var report = _approvalReportModel(data);
  var sep = ',';
  var lines = [];
  var add = function(values) { lines.push(values.map(_approvalCsvCell).join(sep)); };
  add(['LAPORAN APPROVAL TRANSAKSI SIM-SPPG']);
  add(['Periode', report.period]);
  add(['Filter aktif', report.filters]);
  add(['Dibuat pada', new Date().toLocaleString('id-ID')]);
  add(['Dibuat oleh', currentUser ? (currentUser.namaLengkap || currentUser.email || '-') : '-']);
  add(['Jumlah transaksi', report.count]);
  add(['Total nominal', Math.round(report.total)]);
  lines.push('');

  add(['DETAIL TRANSAKSI']);
  add(['No', 'Tanggal Transaksi', 'Kode Transaksi', 'SPPG', 'Nama Penginput', 'Email Penginput',
    'Jenis Kategori', 'Nama Item', 'Supplier / Penjual', 'Rekening Penerima', 'Bank', 'Nomor Rekening', 'Atas Nama Rekening',
    'Nominal (Rp)', 'Status Approval/Pembayaran',
    'Status Kelengkapan', 'Indikator Warna', 'Bukti Pembayaran', 'Nota', 'TTD User']);
  report.rows.forEach(function(row) {
    add([row.no, row.tanggal, row.kode, row.sppg, row.nama, row.email, row.jenis, row.item,
      row.supplier, row.rekeningPenerima, row.bank, row.rekening, row.atasNama,
      Math.round(row.nominal), row.metode, row.kelengkapan, row.indikator, row.bukti, row.nota, row.ttd]);
  });
  lines.push('');

  add(['RINGKASAN PER JENIS KATEGORI']);
  add(['Jenis Kategori', 'Jumlah Transaksi', 'Total Nominal (Rp)', 'Kontribusi']);
  report.categories.forEach(function(row) {
    add([row.label, row.count, Math.round(row.total),
      report.total ? (row.total / report.total * 100).toFixed(1) + '%' : '0%']);
  });
  add(['TOTAL', report.count, Math.round(report.total), '100%']);
  lines.push('');

  add(['RINGKASAN PER SPPG DAN PENGINPUT']);
  add(['SPPG', 'Nama Penginput', 'Email Penginput', 'Jumlah Transaksi', 'Dokumen Lengkap',
    'Dokumen Belum Lengkap', 'Total Nominal (Rp)']);
  report.sppg.forEach(function(row) {
    add([row.sppg, row.nama, row.email, row.count, row.lengkap, row.tidakLengkap, Math.round(row.total)]);
  });
  lines.push('');

  add(['RINGKASAN STATUS KELENGKAPAN']);
  add(['Status', 'Jumlah Transaksi', 'Total Nominal (Rp)']);
  report.completeness.forEach(function(row) { add([row.label, row.count, Math.round(row.total)]); });
  lines.push('');
  add(['CATATAN']);
  add(['Status kelengkapan dinilai dari ketersediaan bukti pembayaran/transaksi dan nota. TTD User dicantumkan sebagai informasi audit.']);
  add(['CSV tidak mendukung warna sel secara konsisten. Kolom Indikator Warna mempertahankan makna HIJAU/KUNING/MERAH di Excel, Google Sheets, dan aplikasi lain.']);

  // sep=, memaksa Excel membaca koma sebagai pemisah kolom di semua locale.
  var blob = new Blob(['\uFEFFsep=,\r\n' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('success', 'CSV Siap', 'Kolom CSV sudah dipisahkan dengan format standar Excel.');
}

function _loadApprovalSpreadsheetLibrary() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    var existing = document.querySelector('script[data-approval-xlsx]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', function() { reject(new Error('Library spreadsheet gagal dimuat.')); }, { once: true });
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.dataset.approvalXlsx = '1';
    script.onload = resolve;
    script.onerror = function() { reject(new Error('Library spreadsheet gagal dimuat.')); };
    document.head.appendChild(script);
  });
}

function _appendApprovalSheet(workbook, name, rows, widths, autoFilterRow) {
  var sheet = window.XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = (widths || []).map(function(width) { return { wch: width }; });
  if (autoFilterRow && rows.length > autoFilterRow) {
    var lastColumn = window.XLSX.utils.encode_col(Math.max(0, rows[autoFilterRow - 1].length - 1));
    sheet['!autofilter'] = { ref: 'A' + autoFilterRow + ':' + lastColumn + rows.length };
  }
  window.XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function exportApprovalSpreadsheet(data, format) {
  var report = _approvalReportModel(data);
  var extension = format === 'ods' ? 'ods' : 'xlsx';
  var formatLabel = format === 'ods' ? 'Spreadsheet ODS' : 'Excel';
  showLoading(true);
  _loadApprovalSpreadsheetLibrary().then(function() {
    var workbook = window.XLSX.utils.book_new();
    var createdBy = currentUser ? (currentUser.namaLengkap || currentUser.email || '-') : '-';
    var summaryRows = [
      ['LAPORAN APPROVAL TRANSAKSI SIM-SPPG'],
      ['Periode', report.period],
      ['Filter aktif', report.filters],
      ['Dibuat pada', new Date().toLocaleString('id-ID')],
      ['Dibuat oleh', createdBy],
      ['Jumlah transaksi', report.count],
      ['Total nominal (Rp)', Math.round(report.total)],
      [],
      ['RINGKASAN PER JENIS KATEGORI'],
      ['Jenis Kategori', 'Jumlah Transaksi', 'Total Nominal (Rp)', 'Kontribusi']
    ];
    report.categories.forEach(function(row) {
      summaryRows.push([row.label, row.count, Math.round(row.total),
        report.total ? row.total / report.total : 0]);
    });
    summaryRows.push(['TOTAL', report.count, Math.round(report.total), 1]);

    var detailRows = [[
      'No', 'Tanggal Transaksi', 'Kode Transaksi', 'SPPG', 'Nama Penginput',
      'Email Penginput', 'Jenis Kategori', 'Nama Item', 'Nominal (Rp)',
      'Status Approval/Pembayaran', 'Status Kelengkapan', 'Indikator Warna',
      'Bukti Pembayaran', 'Nota', 'TTD User'
    ]];
    report.rows.forEach(function(row) {
      detailRows.push([
        row.no, row.tanggal, row.kode, row.sppg, row.nama, row.email, row.jenis,
        row.item, Math.round(row.nominal), row.metode, row.kelengkapan,
        row.indikator, row.bukti, row.nota, row.ttd
      ]);
    });

    var sppgRows = [[
      'SPPG', 'Nama Penginput', 'Email Penginput', 'Jumlah Transaksi',
      'Dokumen Lengkap', 'Dokumen Belum Lengkap', 'Total Nominal (Rp)'
    ]];
    report.sppg.forEach(function(row) {
      sppgRows.push([row.sppg, row.nama, row.email, row.count, row.lengkap,
        row.tidakLengkap, Math.round(row.total)]);
    });

    var completenessRows = [['Status Kelengkapan', 'Jumlah Transaksi', 'Total Nominal (Rp)']];
    report.completeness.forEach(function(row) {
      completenessRows.push([row.label, row.count, Math.round(row.total)]);
    });

    _appendApprovalSheet(workbook, 'Ringkasan', summaryRows, [30, 20, 22, 16]);
    _appendApprovalSheet(workbook, 'Detail Approval', detailRows,
      [6, 16, 22, 16, 22, 30, 24, 36, 18, 25, 27, 18, 20, 14, 14], 1);
    _appendApprovalSheet(workbook, 'SPPG dan Penginput', sppgRows,
      [18, 24, 30, 18, 18, 24, 20], 1);
    _appendApprovalSheet(workbook, 'Kelengkapan', completenessRows, [30, 20, 22], 1);

    window.XLSX.writeFile(
      workbook,
      'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.' + extension,
      { bookType: extension, compression: true }
    );
    showToast('success', formatLabel + ' Siap', 'Laporan bertab dan berkolom rapi berhasil diunduh.');
  }).catch(function(error) {
    showToast('error', 'Download Gagal', error && error.message ? error.message : 'File spreadsheet tidak dapat dibuat.');
  }).then(function() {
    showLoading(false);
  });
}

function _approvalStatusClass(status) {
  if (status === 'Lengkap') return 'status-complete';
  if (status === 'Tidak Lengkap') return 'status-missing';
  return 'status-warning';
}

function exportApprovalReportPDF(data, pageLabel) {
  var report = _approvalReportModel(data);
  var now = new Date();
  var printedBy = currentUser
    ? ((currentUser.namaLengkap || currentUser.email || '-') + ' (' + (currentUser.role || '-') + ')')
    : '-';
  var title = pageLabel || 'Laporan Approval Transaksi';
  var detailRows = report.rows.map(function(row) {
    return '<tr>' +
      '<td class="center">' + row.no + '</td>' +
      '<td>' + esc(row.tanggal) + '</td>' +
      '<td class="code">' + esc(row.kode) + '</td>' +
      '<td>' + esc(row.sppg) + '</td>' +
      '<td><strong>' + esc(row.nama) + '</strong><small>' + esc(row.email) + '</small></td>' +
      '<td>' + esc(row.jenis) + '</td>' +
      '<td>' + esc(row.item) + '</td>' +
      '<td class="money">Rp ' + Math.round(row.nominal).toLocaleString('id-ID') + '</td>' +
      '<td>' + esc(row.metode) + '</td>' +
      '<td class="center"><span class="status ' + _approvalStatusClass(row.kelengkapan) + '">' +
        esc(row.kelengkapan) + '</span></td>' +
      '</tr>';
  }).join('');
  var categoryRows = report.categories.map(function(row) {
    return '<tr><td>' + esc(row.label) + '</td><td class="center">' + row.count +
      '</td><td class="money">Rp ' + Math.round(row.total).toLocaleString('id-ID') +
      '</td><td class="center">' + (report.total ? (row.total / report.total * 100).toFixed(1) : '0') + '%</td></tr>';
  }).join('');
  var sppgRows = report.sppg.map(function(row) {
    return '<tr><td>' + esc(row.sppg) + '</td><td><strong>' + esc(row.nama) + '</strong><small>' +
      esc(row.email) + '</small></td><td class="center">' + row.count + '</td><td class="center good">' +
      row.lengkap + '</td><td class="center bad">' + row.tidakLengkap +
      '</td><td class="money">Rp ' + Math.round(row.total).toLocaleString('id-ID') + '</td></tr>';
  }).join('');
  var statusRows = report.completeness.map(function(row) {
    return '<div class="status-card ' + _approvalStatusClass(row.label) + '"><span>' + esc(row.label) +
      '</span><strong>' + row.count + ' transaksi</strong><small>Rp ' +
      Math.round(row.total).toLocaleString('id-ID') + '</small></div>';
  }).join('');

  var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<style>' +
    '@page{size:A4 landscape;margin:10mm 8mm 12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;font-size:8.2px;line-height:1.35}' +
    '.header{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end;border-bottom:3px solid #15577a;padding:0 0 8px;margin-bottom:10px}.brand{font-size:10px;font-weight:800;color:#1e6f9c;letter-spacing:1.5px}.header h1{font-size:20px;margin:2px 0}.subtitle{color:#64748b}.report-id{text-align:right;color:#475569}.report-id strong{display:block;color:#172033;font-size:10px}' +
    '.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}.meta div,.kpi{border:1px solid #dbe5ee;border-radius:6px;padding:6px 8px;background:#f8fafc}.meta span,.kpi span{display:block;color:#64748b;font-size:7px;text-transform:uppercase;font-weight:700}.meta strong,.kpi strong{display:block;margin-top:2px;font-size:9px}' +
    '.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}.kpi.total{border-left:4px solid #15577a}.kpi.complete{border-left:4px solid #059669}.kpi.attention{border-left:4px solid #d97706}' +
    '.section{break-before:page;margin-top:2px}.section.first{break-before:auto}.section-head{display:flex;justify-content:space-between;align-items:end;margin:0 0 5px}.section-head h2{font-size:11px;margin:0;color:#15577a}.section-head p{margin:0;color:#64748b}' +
    'table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:10px}thead{display:table-header-group}th{background:#15577a;color:#fff;text-align:left;padding:5px 4px;font-size:7px;letter-spacing:.15px}td{border:1px solid #dbe5ee;padding:4px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f8fafc}tr{break-inside:avoid}.center{text-align:center}.money{text-align:right;white-space:nowrap;font-weight:700}.code{font-family:monospace;font-size:7px}td small{display:block;color:#64748b;margin-top:2px}.status{display:inline-block;padding:2px 5px;border-radius:10px;font-size:6.8px;font-weight:800;line-height:1.25}.status-complete{background:#dcfce7;color:#047857}.status-warning{background:#fef3c7;color:#92400e}.status-missing{background:#ffe4e6;color:#be123c}.good{color:#047857;font-weight:800}.bad{color:#be123c;font-weight:800}' +
    '.detail th:nth-child(1){width:3%}.detail th:nth-child(2){width:7%}.detail th:nth-child(3){width:8%}.detail th:nth-child(4){width:9%}.detail th:nth-child(5){width:14%}.detail th:nth-child(6){width:10%}.detail th:nth-child(7){width:17%}.detail th:nth-child(8){width:10%}.detail th:nth-child(9){width:10%}.detail th:nth-child(10){width:12%}' +
    '.two-col{display:grid;grid-template-columns:.82fr 1.18fr;gap:10px;align-items:start}.status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px}.status-card{border:1px solid #dbe5ee;border-left:4px solid #d97706;border-radius:6px;padding:6px 8px}.status-card.status-complete{border-left-color:#059669}.status-card.status-missing{border-left-color:#e11d48}.status-card span,.status-card strong,.status-card small{display:block;background:none}.status-card strong{font-size:10px;margin-top:3px}.status-card small{color:#64748b}' +
    '.note{border:1px solid #bae6fd;background:#f0f9ff;border-radius:6px;padding:7px 9px;color:#334155}.note strong{color:#15577a}.legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:5px}.legend span{padding:2px 6px;border-radius:10px;font-weight:700}.footer{position:fixed;bottom:-7mm;left:0;right:0;border-top:1px solid #dbe5ee;padding-top:3px;color:#64748b;font-size:7px;display:flex;justify-content:space-between}' +
    '</style></head><body>' +
    '<header class="header"><div><div class="brand">SIM-SPPG</div><h1>' + esc(title) + '</h1><div class="subtitle">Dokumen pengendalian transaksi untuk proses pemeriksaan dan persetujuan.</div></div>' +
    '<div class="report-id"><span>Dibuat</span><strong>' + esc(now.toLocaleString('id-ID')) + '</strong><span>Oleh: ' + esc(printedBy) + '</span></div></header>' +
    '<div class="meta"><div><span>Periode transaksi</span><strong>' + esc(report.period) + '</strong></div><div><span>Filter aktif</span><strong>' + esc(report.filters) + '</strong></div><div><span>Jumlah data</span><strong>' + report.count + ' transaksi</strong></div><div><span>Total nominal</span><strong>Rp ' + Math.round(report.total).toLocaleString('id-ID') + '</strong></div></div>' +
    '<div class="summary-grid"><div class="kpi total"><span>Total diajukan</span><strong>Rp ' + Math.round(report.total).toLocaleString('id-ID') + '</strong></div><div class="kpi complete"><span>Dokumen lengkap</span><strong>' +
      (report.completeness.find(function(x){return x.label === 'Lengkap';}) || {count:0}).count + ' transaksi</strong></div><div class="kpi attention"><span>Perlu tindak lanjut</span><strong>' +
      (report.count - (report.completeness.find(function(x){return x.label === 'Lengkap';}) || {count:0}).count) + ' transaksi</strong></div></div>' +
    '<section class="section first"><div class="section-head"><h2>1. Detail Transaksi Approval</h2><p>Urut sesuai data hasil filter aktif</p></div>' +
    '<table class="detail"><thead><tr><th>No</th><th>Tanggal</th><th>Kode</th><th>SPPG</th><th>Penginput</th><th>Jenis Kategori</th><th>Nama Item</th><th>Nominal</th><th>Status Approval</th><th>Kelengkapan</th></tr></thead><tbody>' + detailRows + '</tbody></table></section>' +
    '<section class="section"><div class="section-head"><h2>2. Ringkasan dan Pengendalian</h2><p>Dasar pemeriksaan sebelum persetujuan</p></div><div class="two-col"><div>' +
    '<h3>Per Jenis Kategori</h3><table><thead><tr><th>Jenis Kategori</th><th>Trx</th><th>Total Nominal</th><th>%</th></tr></thead><tbody>' + categoryRows +
    '<tr><td><strong>TOTAL</strong></td><td class="center"><strong>' + report.count + '</strong></td><td class="money">Rp ' + Math.round(report.total).toLocaleString('id-ID') + '</td><td class="center">100%</td></tr></tbody></table>' +
    '<h3>Status Kelengkapan</h3><div class="status-grid">' + statusRows + '</div>' +
    '<div class="note"><strong>Definisi status</strong><div class="legend"><span class="status-complete">Lengkap</span><span class="status-warning">Tidak ada Nota / Bukti Pembayaran</span><span class="status-missing">Tidak Lengkap</span></div><p>“Tidak Lengkap” berarti bukti pembayaran/transaksi dan nota sama-sama tidak tersedia. TTD User dicatat sebagai informasi audit dan tidak mengubah status ini.</p></div></div><div>' +
    '<h3>Per SPPG dan Penginput</h3><table><thead><tr><th>SPPG</th><th>Nama &amp; Email Penginput</th><th>Trx</th><th>Lengkap</th><th>Belum Lengkap</th><th>Total Nominal</th></tr></thead><tbody>' +
    sppgRows + '</tbody></table><div class="note"><strong>Catatan pengendalian</strong><p>Prioritaskan pemeriksaan transaksi berstatus merah, nominal besar, dokumen tanpa nota, dan transaksi yang lama menunggu persetujuan. Cocokkan juga periode, filter, identitas penginput, serta total kategori sebelum menyetujui pembayaran.</p></div></div></div></section>' +
    '<div class="footer"><span>SIM-SPPG • Laporan Approval • Dokumen Internal</span><span>' + esc(report.period) + '</span></div>' +
    '<script>window.onload=function(){window.print()}<\/script></body></html>';

  var win = window.open('', '_blank');
  if (!win) {
    showToast('error', 'Gagal', 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.');
    return;
  }
  win.document.write(html);
  win.document.close();
  showToast('success', 'PDF Siap', 'Layout laporan siap dicetak atau disimpan sebagai PDF.');
}

function openApprovalModal(id) {
  currentTrxId = id;
  approvalFileData = null;
  showLoading(true);
    callApi('getTransactionDetail', [id], function(tx) {
        showLoading(false);
              if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
              currentApprovalNominal = parseFloat(tx.nominal) || 0;
              renderApprovalForm(tx);
              openModal('modalApproval');
              setTimeout(initApprovalCanvas, 100);
      },
      function(err) {
        showLoading(false); showToast('error', 'Error', 'Gagal memuat data');
      }
    );
}

function renderApprovalForm(tx) {
  var docsPreview = '';
  docsPreview += renderFilePreview(tx.fileBukti, 'Bukti Transaksi', 'fa-camera');
  docsPreview += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt');
  docsPreview += renderFilePreview(tx.fileTtdUser, 'TTD User', 'fa-signature');

  $('approvalBody').innerHTML =
    '<div class="info-card" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-color:#86efac;">' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Transaksi</span><span class="info-value">' + esc(tx.kode || '-') + '</span></div>' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Item</span><span class="info-value" style="font-size:14px;">' + esc(tx.item || '-') + '</span></div>' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Nominal</span><span class="info-value" style="font-size:18px;color:#047857;">' + formatRupiah(tx.nominal) + '</span></div>' +
      '<div class="info-row" style="border-color:#86efac;"><span class="info-label">Status Dokumen</span><span>' + getStatusDokumenBadge(tx.statusDokumen) + '</span></div>' +
    '</div>' +
    '<div style="margin-bottom:20px;">' + docsPreview + '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Nominal yang Harus Dibayar</label>' +
      '<input type="text" class="form-input" value="' + esc(formatRupiah(tx.nominal)) + '" readonly>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Upload Bukti Pembayaran (Foto / File)</label>' +
      '<input type="file" id="approvalFileInput" class="form-input" accept="image/*,.pdf" capture="environment" onchange="handleApprovalFile(this)">' +
      '<p class="form-hint"><i class="fas fa-info-circle"></i> Di HP akan langsung membuka kamera. Di desktop akan membuka file browser.</p>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Catatan Approval (Opsional)</label>' +
      '<textarea id="approvalCatatan" class="form-input" placeholder="Catatan untuk user..."></textarea>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Tanda Tangan Digital Verifikator</label>' +
      '<div class="canvas-container" id="approvalTtdWrap"><canvas id="approvalTtdCanvas"></canvas></div>' +
      '<div class="canvas-actions">' +
        '<button type="button" onclick="clearApprovalCanvas()"><i class="fas fa-eraser"></i> Hapus</button>' +
      '</div>' +
    '</div>';
}

function getStatusDokumenBadge(status) {
  if (!status) return '<span class="badge badge-slate">-</span>';
  if (status.indexOf('Lengkap') > -1 && status.indexOf('Tidak') === -1)
    return '<span class="badge badge-green"><i class="fas fa-check" style="font-size:10px"></i> Lengkap</span>';
  return '<span class="badge badge-red"><i class="fas fa-times" style="font-size:10px"></i> Tidak Lengkap</span>';
}

// initApprovalCanvas & clearApprovalCanvas sudah didefinisikan
// di sistem TTD terpusat di atas — tidak perlu duplikasi di sini.

function handleApprovalFile(input) {
  var file = input.files[0];
  if (file) {
    var r = new FileReader();
    r.onload = function(e) { approvalFileData = { base64: e.target.result.split(',')[1], mimeType: file.type, fileName: file.name }; };
    r.readAsDataURL(file);
  }
}

function preSubmitApproval() {
  pendingConfirmNominal = currentApprovalNominal || 0;
  $('nominalConfirmTitle').textContent = 'Nominal Transaksi';
  $('nominalConfirmDisplay').textContent = formatRupiah(pendingConfirmNominal);
  $('nominalConfirmLabel').textContent = 'Ketik ulang nominal untuk konfirmasi approve';
  $('nominalConfirmInput').value = '';
  $('pinError').style.display = 'none';
  openModal('modalPin');
}

function submitApprovalWithPin() {
  var inputEl = $('nominalConfirmInput');
  var pinErrorEl = $('pinError');
  var pinErrorText = $('pinErrorText');
  var typed = String(inputEl ? inputEl.value : '').trim();

  if (!typed) {
    pinErrorText.textContent = 'Nominal konfirmasi wajib diisi.';
    pinErrorEl.style.display = 'block';
    return;
  }
  if (!/^\d+$/.test(typed)) {
    pinErrorText.textContent = 'Masukkan angka saja, tanpa titik, koma, atau Rp.';
    pinErrorEl.style.display = 'block';
    return;
  }
  if (parseInt(typed, 10) !== Math.round(pendingConfirmNominal)) {
    pinErrorText.textContent = 'Nominal yang Anda ketik tidak cocok dengan nominal transaksi.';
    pinErrorEl.style.display = 'block';
    return;
  }

  var verificationRequested = verifikasiPembayaranMode;
  closeModal('modalPin');

  if (verificationRequested) {
    verifikasiPembayaranMode = false;
    doSubmitVerifikasiPembayaran();
    return;
  }

  if (bulkApprovalMode) {
    bulkApprovalMode = false;
    submitBulkApproval();
    return;
  }

  closeModal('modalApproval');
  showLoading(true);

  var ttdCanvas = $('approvalTtdCanvas');
  var ttdBase64 = (ttdCanvas && !isCanvasBlank('approvalTtdCanvas'))
    ? ttdCanvas.toDataURL('image/png').split(',')[1]
    : '';

  var data = {
    id: currentTrxId,
    approvedBy: currentUser ? currentUser.namaLengkap || currentUser.username : 'Admin',
    ttdBase64: ttdBase64,
    catatanApproval: $('approvalCatatan') ? $('approvalCatatan').value : ''
  };
  if (approvalFileData) {
    data.buktiBase64 = approvalFileData.base64;
    data.buktiMimeType = approvalFileData.mimeType;
    data.buktiFileName = approvalFileData.fileName;
  }

    callApi('approveTransaction', [data], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Sukses', result.message);
                loadTransactions();
                loadDashboardData();
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ===== MODE UPLOAD BUKTI MANDIRI (ON/OFF) =====
function loadFeatureModes(force) {
  if (approvalModeLoaded && !force) {
    return;
  }
  var requestId = ++featureModeRequestId;
  var pending = 2;
  function finish() {
    pending--;
    if (pending > 0 || requestId !== featureModeRequestId) return;
    approvalModeLoaded = true;
    if (currentPage === 'approval' && approvalLoadState.hasLoaded && !approvalLoadState.inFlight) renderApprovalTable();
    if (currentPage === 'transaksi' && Array.isArray(filteredTransactions)) renderTransaksiTable();
  }
  callApi('getUploadBuktiMode', [], function(result) {
    if (requestId !== featureModeRequestId) return;
    uploadBuktiModeEnabled = !!(result && result.enabled);
    finish();
  }, function() {
    if (requestId !== featureModeRequestId) return;
    uploadBuktiModeEnabled = false;
    finish();
  });
  callApi('getTransactionEditMode', [], function(result) {
    if (requestId !== featureModeRequestId) return;
    transactionEditModeEnabled = !!(result && result.enabled);
    finish();
  }, function() {
    if (requestId !== featureModeRequestId) return;
    transactionEditModeEnabled = false;
    finish();
  });
}

// ===== USER KIRIM BUKTI PEMBAYARAN MANDIRI =====
function openUserBuktiModal(id) {
  var tx = allTransactions.find(function(t) { return t.id === id; }) ||
           filteredApprovalData.find(function(t) { return t.id === id; });
  if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
  currentUserBuktiTxId = id;
  userBuktiFileData = null;
  var sudahDibayar = parseFloat(tx.nominalDibayar) || 0;
  var sisaBayar = Math.max(0, (parseFloat(tx.nominal) || 0) - sudahDibayar);
  $('userBuktiBody').innerHTML =
    '<div class="info-card" style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border-color:#bae6fd;">' +
      infoRow('Transaksi', esc(tx.kode || '-')) +
      infoRow('Item', esc(tx.item || '-')) +
      infoRow('Nominal Total', '<strong style="font-size:16px;">' + formatRupiah(tx.nominal) + '</strong>') +
      (sudahDibayar > 0 ? infoRow('Sudah Dibayar Sebelumnya', formatRupiah(sudahDibayar)) : '') +
      infoRow('Sisa yang Harus Dibayar', '<strong style="color:var(--rose);font-size:16px;">' + formatRupiah(sisaBayar) + '</strong>') +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Nominal yang Dibayarkan <span class="req">*</span></label>' +
      '<input type="number" id="userBuktiNominal" class="form-input" placeholder="0" value="' + sisaBayar + '">' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="$(\'userBuktiNominal\').value=' + sisaBayar + ';">' +
          '<i class="fas fa-coins"></i> Bayar Penuh (' + formatRupiah(sisaBayar) + ')' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Upload Bukti Pembayaran <span class="req">*</span></label>' +
      '<div class="file-input-wrap">' +
        '<input type="file" id="userBuktiFile" accept="image/*,.pdf" onchange="handleUserBuktiFile(this)">' +
        '<div class="file-input-label" id="labelUserBukti"><i class="fas fa-receipt"></i><span>Pilih bukti pembayaran</span></div>' +
      '</div>' +
    '</div>';
  openModal('modalUserBukti');
}

function handleUserBuktiFile(input) {
  var file = input.files[0];
  if (!file) return;
  var label = $('labelUserBukti');
  if (label) label.innerHTML = '<i class="fas fa-check-circle" style="color:var(--emerald);"></i><span>' + esc(file.name) + '</span>';
  var r = new FileReader();
  r.onload = function(e) {
    userBuktiFileData = { base64: e.target.result.split(',')[1], mimeType: file.type, fileName: file.name };
  };
  r.readAsDataURL(file);
}

function submitUserBukti() {
  var nominal = parseFloat($('userBuktiNominal').value) || 0;
  if (!nominal || nominal <= 0) { showToast('error', 'Validasi', 'Nominal yang dibayarkan wajib diisi'); return; }
  if (!userBuktiFileData) { showToast('error', 'Validasi', 'Bukti pembayaran wajib diupload'); return; }

  showLoading(true);
    callApi('submitUserBuktiPembayaran', [
      {       txId: currentUserBuktiTxId,       nominalDibayar: nominal,       buktiBase64: userBuktiFileData.base64,       buktiMimeType: userBuktiFileData.mimeType,       buktiFileName: userBuktiFileData.fileName     }
    ], function(result) {
        showLoading(false);
              if (result.success) {
                showToast('success', 'Terkirim', result.message);
                closeModal('modalUserBukti');
                loadApprovalData();
                loadTransactions();
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ===== ADMIN VERIFIKASI PEMBAYARAN MANDIRI USER =====
function openVerifikasiModal(id) {
  currentVerifikasiTxId = id;
  showLoading(true);
    callApi('getTransactionDetail', [id], function(tx) {
        showLoading(false);
              if (!tx) { showToast('error', 'Error', 'Transaksi tidak ditemukan'); return; }
              currentVerifikasiNominal = parseFloat(tx.nominal) || 0;
              renderVerifikasiForm(tx);
              openModal('modalVerifikasiPembayaran');
              setTimeout(function() { initTtdCanvas('verifTtdCanvas'); }, 100);
      },
      function(err) {
        showLoading(false); showToast('error', 'Error', 'Gagal memuat data');
      }
    );
}

function renderVerifikasiForm(tx) {
  var buktiPreviewHtml = renderFilePreview(tx.fileBuktiUser, 'Bukti Pembayaran dari User', 'fa-receipt');

  $('verifikasiBody').innerHTML =
    '<div class="info-card" style="background:linear-gradient(135deg,#fefce8 0%,#fef9c3 100%);border-color:#fde68a;">' +
      infoRow('Transaksi', esc(tx.kode || '-')) +
      infoRow('Item', esc(tx.item || '-')) +
      infoRow('Nominal Total', '<strong>' + formatRupiah(tx.nominal) + '</strong>') +
      infoRow('Nominal Dibayarkan User', '<strong style="color:var(--emerald);">' + formatRupiah(tx.nominalDibayar) + '</strong>') +
      infoRow('Dikirim oleh', esc(tx.submittedByUser || tx.user || '-')) +
      infoRow('Waktu Kirim', esc(tx.submittedAt || '-')) +
    '</div>' +
    buktiPreviewHtml +
    '<div class="form-group">' +
      '<label class="form-label">Catatan (Opsional)</label>' +
      '<textarea id="verifCatatan" class="form-input" placeholder="Catatan verifikasi..."></textarea>' +
    '</div>' +
    '<div class="form-group">' +
      '<label class="form-label">Tanda Tangan Digital Verifikator <span class="req">*</span></label>' +
      '<div class="canvas-container" id="verifTtdWrap"><canvas id="verifTtdCanvas"></canvas></div>' +
      '<div class="canvas-actions">' +
        '<button type="button" onclick="clearTtdCanvas(\'verifTtdCanvas\')"><i class="fas fa-eraser"></i> Hapus</button>' +
      '</div>' +
    '</div>';
}

var pendingConfirmNominal = 0;

function submitVerifikasiPembayaran() {
  var ttdCanvas = $('verifTtdCanvas');
  if (!ttdCanvas || isCanvasBlank('verifTtdCanvas')) {
    showToast('error', 'Validasi', 'Tanda tangan verifikator wajib diisi'); return;
  }
  // Snapshot TTD sebelum membuka modal konfirmasi. Canvas dapat kehilangan state
  // ketika modal bertumpuk/berpindah, terutama pada browser mobile.
  verifTtdBase64Temp = ttdCanvas.toDataURL('image/png').split(',')[1];
  verifCatatanTemp = $('verifCatatan') ? $('verifCatatan').value : '';
  verifikasiPembayaranMode = true;
  pendingConfirmNominal = currentVerifikasiNominal || 0;
  $('nominalConfirmTitle').textContent = 'Nominal Transaksi';
  $('nominalConfirmDisplay').textContent = formatRupiah(pendingConfirmNominal);
  $('nominalConfirmLabel').textContent = 'Ketik ulang nominal untuk konfirmasi verifikasi';
  $('nominalConfirmInput').value = '';
  $('pinError').style.display = 'none';
  openModal('modalPin');
}

function doSubmitVerifikasiPembayaran() {
  var ttdBase64 = verifTtdBase64Temp || '';
  if (!ttdBase64) {
    showToast('error', 'Validasi', 'Snapshot tanda tangan verifikator tidak tersedia. Silakan tanda tangan ulang.'); return;
  }
  closeModal('modalVerifikasiPembayaran');
  showLoading(true);
    callApi('verifyUserPayment', [
      {       txId: currentVerifikasiTxId,       ttdBase64: ttdBase64,       catatanApproval: verifCatatanTemp,       approvedBy: currentUser ? (currentUser.namaLengkap || currentUser.username) : 'Admin'     }
    ], function(result) {
        showLoading(false);
              if (result.success) {
                verifTtdBase64Temp = '';
                showToast('success', 'Sukses', result.message);
                loadApprovalData();
                loadTransactions();
                loadDashboardData();
              } else {
                showToast('error', 'Gagal', result.message);
              }
      },
      function(err) {
        showLoading(false);
        showToast('error', 'Gagal', (err && err.message) ? err.message : 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 12. MASTER BAHAN BAKU
// ============================================================

/* ============================================================
     MASTER DATA - BAHAN BAKU
     ============================================================ */
function loadMasterBB(page, forceAll, silent) {
  page=Math.max(1,Number(page)||bbPage||1); forceAll=!!forceAll;
  if (!silent) showLoading(true);
  callApi('getMasterBahanBaku', forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}], function(result) {
    if (!silent) showLoading(false);
    if(result&&result.success){
      var rows=Array.isArray(result.data)?result.data:[];
      bbServerPaged=!forceAll&&Number(result.page)>0;
      bbServerTotal=bbServerPaged?Number(result.total||0):rows.length;
      bbPage=bbServerPaged?Number(result.page||page):1;
      allMasterBB=rows; applyMasterBBFiltersLocal(); renderMasterBBTable();
    }
  }, function(err){if(!silent)showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allMasterBB=[];filteredMasterBB=[];bbServerTotal=0;bbServerPaged=false;renderMasterBBTable();});
}
function renderMasterBBTable() {
  var tbody = $('masterBBTableBody');
  if (!filteredMasterBB.length) {
    var canAddBB = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'AKUNTAN');
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-boxes"></i></div><h4>Tidak Ada Data</h4><p>Belum ada bahan baku yang terdaftar.</p>' +
      (canAddBB ? '<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openAddMasterBBModal()"><i class="fas fa-plus"></i> Tambah Bahan Baku Pertama</button>' : '') +
      '</div></td></tr>';
    $('bbPagination').innerHTML = ''; return;
  }
  var totalPages = Math.ceil((bbServerPaged ? bbServerTotal : filteredMasterBB.length) / ITEMS_PER_PAGE);
  if (bbPage > totalPages) bbPage = totalPages;
  var start = (bbPage - 1) * ITEMS_PER_PAGE;
  var pageData = bbServerPaged ? filteredMasterBB : filteredMasterBB.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  var canEdit = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'AKUNTAN');
  pageData.forEach(function(b, idx) {
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(b['KODE BAHAN'] || b['Kode Bahan'] || '-') + '</strong></td>' +
      '<td><span class="badge badge-outline">' + esc(b['KATEGORI BAHAN BAKU'] || b['Kategori'] || '-') + '</span></td>' +
      '<td>' + esc(b['NAMA  BAHAN BAKU'] || b['NAMA BAHAN BAKU'] || b['Nama Bahan Baku'] || '-') + '</td>' +
      '<td><strong>' + formatRupiah(b['HARGA BAHAN BAKU'] || b['Harga'] || 0) + '</strong></td>' +
      '<td>' + esc(b['SATUAN'] || b['Satuan'] || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          (canEdit ? '<button class="action-btn edit" onclick="openEditMasterBB(' + b._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn delete" onclick="confirmHapus(\'masterBB\',' + b._row + ',\'\',\'bahan baku ' + esc((b['NAMA  BAHAN BAKU']||b['NAMA BAHAN BAKU']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('bbPagination', bbPage, totalPages, 'goBBPage');
}
function goBBPage(p) { if(bbServerPaged)loadMasterBB(p,false);else{bbPage=p;renderMasterBBTable();} }
function applyMasterBBFiltersLocal() {
  var search=$('bbSearchInput')?$('bbSearchInput').value.toLowerCase().trim():'';
  var kat=$('bbFilterKategori')?$('bbFilterKategori').value:'ALL';
  filteredMasterBB=allMasterBB.filter(function(b){
    var nama=b['NAMA  BAHAN BAKU']||b['NAMA BAHAN BAKU']||b['Nama Bahan Baku']||'';
    var kode=b['KODE BAHAN']||b['Kode Bahan']||'';
    if(search&&(nama+' '+kode).toLowerCase().indexOf(search)===-1)return false;
    if(kat!=='ALL'&&(b['KATEGORI BAHAN BAKU']||b['Kategori'])!==kat)return false;
    return true;
  });
}
function filterMasterBB(){
  var search=$('bbSearchInput')?$('bbSearchInput').value.trim():'';
  var kat=$('bbFilterKategori')?$('bbFilterKategori').value:'ALL';
  var full=!!search||kat!=='ALL';clearTimeout(bbFilterTimer);
  bbFilterTimer=setTimeout(function(){bbPage=1;loadMasterBB(1,full);},300);
}
function openAddMasterBBModal() { $('addBBKode').value = ''; $('addBBKategori').value = ''; $('addBBNama').value = ''; $('addBBHarga').value = ''; $('addBBSatuan').value = 'Kg'; openModal('modalAddMasterBB'); }
function saveAddMasterBB() {
  var data = {
    KODE_BAHAN: $('addBBKode').value.trim(),
    KATEGORI_BAHAN_BAKU: $('addBBKategori').value.trim(),
    NAMA_BAHAN_BAKU: $('addBBNama').value.trim(),
    HARGA_BAHAN_BAKU: parseFloat($('addBBHarga').value) || 0,
    SATUAN: $('addBBSatuan').value,
    SUPPLIER: $('addBBSupplier').value
  };
  if (!data.KODE_BAHAN || !data.NAMA_BAHAN_BAKU) { showToast('error', 'Validasi', 'Kode dan Nama wajib diisi'); return; }
  showLoading(true);
    callApi('addMasterBahanBaku', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddMasterBB'); loadMasterBB(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}
// ===== HAPUS UNIVERSAL =====
var hapusTarget = { type: '', rowNum: 0, id: '' };

function confirmHapus(type, rowNum, id, desc) {
  hapusTarget = { type: type, rowNum: rowNum, id: id };
  // Transaksi yang sudah SUDAH_DIBAYAR butuh konfirmasi lebih ketat (ketik "HAPUS")
  // karena data finansial yang sudah final lebih berisiko kalau terhapus tidak sengaja.
  var tx = (type === 'transaksi') ? allTransactions.find(function(t) { return t.id === id; }) : null;
  var isApprovedTx = tx && String(tx.metodeTransaksi || '').toUpperCase() === 'SUDAH_DIBAYAR';

  if (isApprovedTx) {
    $('hapusDesc').innerHTML = 'Transaksi <strong>' + esc(tx.kode || id) + '</strong> ini sudah <strong style="color:var(--emerald);">LUNAS/disetujui</strong>. ' +
      'Menghapusnya akan menghilangkan jejak transaksi finansial. Ketik <strong>HAPUS</strong> untuk konfirmasi:' +
      '<input type="text" id="hapusConfirmText" class="form-input" style="margin-top:10px;text-align:center;font-weight:700;letter-spacing:2px;" placeholder="Ketik HAPUS" oninput="document.getElementById(\'btnExecuteHapus\').disabled = (this.value.trim().toUpperCase() !== \'HAPUS\');">';
    $('btnExecuteHapus').disabled = true;
  } else {
    $('hapusDesc').textContent = 'Yakin hapus ' + (desc || 'data ini') + '?';
    $('btnExecuteHapus').disabled = false;
  }
  openModal('modalHapus');
}

function executeHapus() {
  closeModal('modalHapus');
  showLoading(true);
  var caller = { role: currentUser.role, user: currentUser.email };
  if (hapusTarget.type === 'masterBB') {
    callApi('deleteMasterBahanBaku', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadMasterBB();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'supplier') {
    callApi('deleteSupplier', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadSuppliers();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'survei') {
    callApi('deleteSurvei', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadSurvei();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'serahTerima') {
    callApi('deleteSerahTerima', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadSerahTerima();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'menuMBG') {
    callApi('deleteMenuMBG', [
      hapusTarget.rowNum,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadMenuMBG();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'transaksi') {
    callApi('deleteTransaction', [
      hapusTarget.id,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadTransactions();loadDashboardData();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'pending') {
    callApi('deletePendingPayment', [
      hapusTarget.id,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadPendingPayment();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else if (hapusTarget.type === 'user') {
    callApi('deleteUser', [
      hapusTarget.id,
      caller
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);loadUsers();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
  } else {
    showLoading(false);
  }
}

// ===== EDIT MASTER BB =====
function openEditMasterBB(rowNum) {
  var b = allMasterBB.find(function(x){ return x._row === rowNum; });
  if (!b) return;
  $('editBBRow').value = rowNum;
  $('editBBKode').value     = b['KODE BAHAN'] || b['Kode Bahan'] || '';
  $('editBBKategori').value = b['KATEGORI BAHAN BAKU'] || b['Kategori'] || '';
  $('editBBNama').value     = b['NAMA  BAHAN BAKU'] || b['NAMA BAHAN BAKU'] || b['Nama Bahan Baku'] || '';
  $('editBBHarga').value    = b['HARGA BAHAN BAKU'] || b['Harga'] || 0;
  $('editBBSatuan').value   = b['SATUAN'] || b['Satuan'] || 'Kg';
  $('editBBSupplier').value = b['SUPPLIER'] || b['Supplier'] || '';
  openModal('modalEditMasterBB');
}
function saveEditMasterBB() {
  var rowNum = parseInt($('editBBRow').value);
  var fields = {
    'KODE BAHAN': $('editBBKode').value.trim(),
    'KATEGORI BAHAN BAKU': $('editBBKategori').value.trim(),
    'NAMA  BAHAN BAKU': $('editBBNama').value.trim(),
    'HARGA BAHAN BAKU': parseFloat($('editBBHarga').value) || 0,
    'SATUAN': $('editBBSatuan').value,
    'SUPPLIER': $('editBBSupplier').value.trim()
  };
  if (!fields['NAMA  BAHAN BAKU']) { showToast('error','Validasi','Nama wajib diisi'); return; }
  showLoading(true);
    callApi('updateMasterBahanBaku', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditMasterBB');loadMasterBB();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT SUPPLIER =====
function openEditSupplierModal(rowNum) {
  var s = allSuppliers.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  $('editSupRow').value = rowNum;
  $('editSupNama').value      = s['NAMA SUPPLIER'] || s['Nama Supplier'] || '';
  $('editSupWAEdit').value    = s['NO WHATSAPP'] || s['No WhatsApp'] || '';
  $('editSupEmailEdit').value = s['EMAIL'] || s['Email'] || '';
  $('editSupStatusEdit').value= s['STATUS'] || s['Status'] || 'Aktif';
  $('editSupAlamatEdit').value= s['ALAMAT TOKO'] || s['Alamat'] || '';
  $('editSupBank').value      = s['NAMA BANK'] || '';
  $('editSupNoRek').value     = s['NO REKENING'] || '';
  $('editSupAtasNama').value  = s['ATAS NAMA REKENING'] || '';
  $('editSupItems').value     = Array.isArray(s['ITEM YANG DIJUAL']) ? s['ITEM YANG DIJUAL'].join(', ') : '';
  openModal('modalEditSupplier');
}
function saveEditSupplier() {
  var rowNum = parseInt($('editSupRow').value);
  var fields = {
    'NAMA SUPPLIER': $('editSupNama').value.trim(),
    'NO WHATSAPP':   $('editSupWAEdit').value.trim(),
    'EMAIL':         $('editSupEmailEdit').value.trim(),
    'STATUS':        $('editSupStatusEdit').value,
    'ALAMAT TOKO':   $('editSupAlamatEdit').value.trim(),
    'NAMA BANK':     $('editSupBank').value.trim(),
    'NO REKENING':   $('editSupNoRek').value.trim(),
    'ATAS NAMA REKENING': $('editSupAtasNama').value.trim(),
    'ITEM YANG DIJUAL': $('editSupItems').value.split(/[\n,;]/).map(function(v){return v.trim();}).filter(Boolean)
  };
  if (!fields['NAMA SUPPLIER']) { showToast('error','Validasi','Nama Supplier wajib diisi'); return; }
  showLoading(true);
    callApi('updateMasterSupplier', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditSupplier');loadSuppliers();loadDropdownOptions();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT SURVEI =====
function openEditSurveiModal(rowNum) {
  var s = allSurvei.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  $('editSurveiRow').value = rowNum;
  $('editSurveiKode').value        = s['KODE BAHAN BAKU'] || s['Kode Bahan Baku'] || '';
  $('editSurveiNamaBB').value      = s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '';
  $('editSurveiHargaPasar').value  = s['HARGA PASAR'] || s['Harga Pasar'] || 0;
  $('editSurveiAlamatEdit').value  = s['ALAMAT SURVEI'] || s['Alamat Survei'] || '';
  openModal('modalEditSurvei');
}
function saveEditSurvei() {
  var rowNum = parseInt($('editSurveiRow').value);
  var fields = {
    'HARGA PASAR': parseFloat($('editSurveiHargaPasar').value) || 0,
    'ALAMAT SURVEI': $('editSurveiAlamatEdit').value.trim()
  };
  showLoading(true);
    callApi('updateSurvei', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditSurvei');loadSurvei();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT SERAH TERIMA =====
function openEditSerahTerimaModal(rowNum) {
  var s = allSerahTerima.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  $('editSTRow').value = rowNum;
  $('editSTPenerima').value = s['PENERIMA'] || s['Penerima'] || '';
  $('editSTKondisi').value  = s['KONDISI BAHAN BAKU'] || s['Kondisi'] || 'Baik';
  $('editSTCatatn').value   = s['CATATAN'] || s['Catatan'] || '';
  openModal('modalEditSerahTerima');
}
function saveEditSerahTerima() {
  var rowNum = parseInt($('editSTRow').value);
  var fields = {
    'PENERIMA': $('editSTPenerima').value.trim(),
    'KONDISI BAHAN BAKU': $('editSTKondisi').value,
    'CATATAN': $('editSTCatatn').value
  };
  if (!fields['PENERIMA']) { showToast('error','Validasi','Penerima wajib diisi'); return; }
  showLoading(true);
    callApi('updateSerahTerima', [
      rowNum,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditSerahTerima');loadSerahTerima();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

// ===== EDIT MENU MBG =====
function openEditMenuMBGModal(arrayIdx) {
  var m = allMenuMBG[arrayIdx];
  if (!m) return;
  $('editMenuRow').value = arrayIdx;
  $('editMenuTanggal').value = m.tanggal ? m.tanggal.split('/').reverse().join('-') : '';
  $('editMenuKPMEdit').value = m.jumlahKpm || 0;
  $('editMenuNama').value    = m.menu || '';
  openModal('modalEditMenuMBG');
}
function saveEditMenuMBG() {
  var arrayIdx = parseInt($('editMenuRow').value);
  var m = allMenuMBG[arrayIdx];
  if (!m) return;
  var fields = {
    'JUMLAH KPM': parseInt($('editMenuKPMEdit').value) || 0,
    'MENU': $('editMenuNama').value.trim()
  };
  if (!fields['MENU']) { showToast('error', 'Validasi', 'Menu tidak boleh kosong'); return; }
  showLoading(true);
    callApi('updateMenuMBG', [
      m._row,
      fields
    ], function(r) {
        showLoading(false); if(r.success){showToast('success','Sukses',r.message);closeModal('modalEditMenuMBG');loadMenuMBG();}else{showToast('error','Gagal',r.message);}
      },
      function(err) {
        showLoading(false); showToast('error','Gagal','Terjadi kesalahan');
      }
    );
}

function exportMasterBB(format) {
  if (format === 'csv') {
    downloadCSV(filteredMasterBB || [], [
      {key:'KODE BAHAN', label:'Kode Bahan'},
      {key:'KATEGORI BAHAN BAKU', label:'Kategori'},
      {key:'NAMA  BAHAN BAKU', label:'Nama Bahan Baku'},
      {key:'HARGA BAHAN BAKU', label:'Harga'},
      {key:'SATUAN', label:'Satuan'},
      {key:'SUPPLIER', label:'Supplier'}
    ], 'Master_Bahan_Baku');
  } else {
    printCurrentPage();
  }
}

// ============================================================
// 13. SUPPLIER
// ============================================================

/* ============================================================
     MASTER DATA - SUPPLIER
     ============================================================ */
function loadSuppliers(silent,page,forceAll) {
  return new Promise(function(resolve){
    if(!currentUser){resolve();return;} page=Math.max(1,Number(page)||supplierPage||1);forceAll=!!forceAll;
    if(!silent)showLoading(true);
    callApi('getMasterSupplier',forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){
      if(!silent)showLoading(false);
      if(result&&result.success){var rows=Array.isArray(result.data)?result.data:[];supplierServerPaged=!forceAll&&Number(result.page)>0;supplierServerTotal=supplierServerPaged?Number(result.total||0):rows.length;supplierPage=supplierServerPaged?Number(result.page||page):1;allSuppliers=rows;applySupplierFiltersLocal();renderSupplierTable();}
      resolve();
    },function(err){if(!silent){showLoading(false);showToast('error','Gagal','Tidak dapat memuat data supplier');}allSuppliers=[];filteredSuppliers=[];supplierServerTotal=0;supplierServerPaged=false;renderSupplierTable();resolve();});
  });
}
function renderSupplierTable() {
  var tbody = $('supplierTableBody');
  var btnAddSupplier = $('btnAddSupplier');
  if (btnAddSupplier) btnAddSupplier.style.display = (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '' : 'none';
  if (!filteredSuppliers.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-truck"></i></div><h4>Tidak Ada Supplier</h4></div></td></tr>'; $('supplierPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil((supplierServerPaged ? supplierServerTotal : filteredSuppliers.length) / ITEMS_PER_PAGE);
  if (supplierPage > totalPages) supplierPage = totalPages;
  var start = (supplierPage - 1) * ITEMS_PER_PAGE;
  var pageData = supplierServerPaged ? filteredSuppliers : filteredSuppliers.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(s, idx) {
    var statusBadge = s.STATUS === 'Aktif' ? 'badge-green' : s.STATUS === 'Suspend' ? 'badge-red' : 'badge-amber';
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(s['NAMA SUPPLIER'] || s['Nama Supplier'] || '-') + '</strong></td>' +
      '<td>' + esc(s['NO WHATSAPP'] || s['No WhatsApp'] || '-') + '</td>' +
      '<td>' + esc(s['EMAIL'] || s['Email'] || '-') + '</td>' +
      '<td>' + esc(s['ALAMAT TOKO'] || s['Alamat'] || '-') + '</td>' +
      '<td><span class="badge ' + statusBadge + '">' + esc(s['STATUS'] || s['Status'] || '-') + '</span></td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailSupplier(' + (s._row || idx) + ')" title="Detail"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn edit" onclick="openEditSupplierModal(' + (s._row || idx) + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn delete" onclick="confirmHapus(\'supplier\',' + (s._row || idx) + ',\'\',\'supplier ' + esc((s['NAMA SUPPLIER']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('supplierPagination', supplierPage, totalPages, 'goSupplierPage');
}

function applySupplierFiltersLocal(){
  var search=$('supplierSearchInput')?$('supplierSearchInput').value.toLowerCase().trim():'';
  var status=$('supplierFilterStatus')?$('supplierFilterStatus').value:'ALL';
  filteredSuppliers=allSuppliers.filter(function(x){var teks=(x['NAMA SUPPLIER']||x['Nama Supplier']||'')+' '+(x['NO WHATSAPP']||x['No WhatsApp']||'')+' '+(x['EMAIL']||x['Email']||'')+' '+(x['NAMA BANK']||'')+' '+(x['NO REKENING']||'')+' '+(Array.isArray(x['ITEM YANG DIJUAL'])?x['ITEM YANG DIJUAL'].join(' '):'');if(search&&teks.toLowerCase().indexOf(search)===-1)return false;if(status!=='ALL'&&(x['STATUS']||x['Status'])!==status)return false;return true;});
}
function filterSupplier(){var search=$('supplierSearchInput')?$('supplierSearchInput').value.trim():'';var status=$('supplierFilterStatus')?$('supplierFilterStatus').value:'ALL';var full=!!search||status!=='ALL';clearTimeout(supplierFilterTimer);supplierFilterTimer=setTimeout(function(){supplierPage=1;loadSuppliers(false,1,full);},300);}

function goSupplierPage(p){if(supplierServerPaged)loadSuppliers(false,p,false);else{supplierPage=p;renderSupplierTable();}}
function openDetailSurvei(rowNum) {
  var s = allSurvei.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  resetDetailModalFooter();
  var kode      = s['KODE BAHAN BAKU']    || s['Kode Bahan Baku']    || '-';
  var waktu     = s['WAKTU SURVEI']       || s['Waktu Survei']       || '-';
  var kat       = s['KATEGORI BAHAN BAKU']|| s['Kategori']           || '-';
  var nama      = s['NAMA BAHAN BAKU']    || s['Nama Bahan Baku']    || '-';
  var hargaRAB  = s['HARGA RAB']          || s['Harga RAB']          || 0;
  var hargaPasar= s['HARGA PASAR']        || s['Harga Pasar']        || 0;
  var lokasi    = s['LOKASI SURVEI']      || s['Lokasi Survei']      || '-';
  var alamat    = s['ALAMAT SURVEI']      || s['Alamat Survei']      || '-';
  var user      = s['USER']               || s['User']               || '-';
  var selisih   = parseFloat(hargaPasar) - parseFloat(hargaRAB);
  var selisihColor = selisih > 0 ? 'var(--rose)' : 'var(--emerald)';
  var selisihText  = selisih > 0 ? '▲ ' : '▼ ';
  var mapsHtml = lokasi !== '-'
    ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lokasi) + '" target="_blank" class="detail-link"><i class="fas fa-map-marker-alt"></i> ' + esc(lokasi) + '</a>'
    : '-';
  var html =
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-boxes" style="margin-right:6px;"></i>Data Bahan Baku</div>' +
    '<div class="info-card">' +
      infoRow('Kode Bahan', '<strong style="font-family:monospace;">' + esc(kode) + '</strong>') +
      infoRow('Kategori', '<span class="badge badge-outline">' + esc(kat) + '</span>') +
      infoRow('Nama Bahan', '<strong style="font-size:14px;">' + esc(nama) + '</strong>') +
    '</div></div>' +
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-search-dollar" style="margin-right:6px;"></i>Data Survei Harga</div>' +
    '<div class="info-card">' +
      infoRow('Waktu Survei', esc(waktu)) +
      infoRow('Harga RAB (Referensi)', '<span style="font-weight:600;">' + formatRupiah(hargaRAB) + '</span>') +
      infoRow('Harga Pasar', '<strong style="font-size:16px;color:var(--rose);">' + formatRupiah(hargaPasar) + '</strong>') +
      infoRow('Selisih', '<strong style="color:' + selisihColor + ';">' + selisihText + formatRupiah(Math.abs(selisih)) + '</strong>') +
      infoRow('Alamat Survei', esc(alamat)) +
      infoRow('Lokasi GPS', mapsHtml) +
      infoRow('Surveyor', esc(user)) +
    '</div></div>';
  $('detailBody').innerHTML = html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-search-dollar" style="color:var(--primary);margin-right:8px;"></i>Detail Survei Harga';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data survei harga bahan baku';
  openModal('modalDetail');
}

function openDetailSerahTerima(rowNum) {
  var s = allSerahTerima.find(function(x){ return x._row === rowNum; });
  if (!s) return;
  resetDetailModalFooter();
  var kode    = s['KODE BAHAN BAKU']    || s['Kode Bahan']        || '-';
  var nama    = s['NAMA BAHAN BAKU']    || s['Nama Bahan Baku']   || '-';
  var kat     = s['KATEGORI BAHAN BAKU']|| s['Kategori']          || '-';
  var penerima= s['PENERIMA']           || s['Penerima']          || '-';
  var supplier= s['SUPPLIER']           || s['Supplier']          || '-';
  var kondisi = s['KONDISI BAHAN BAKU'] || s['Kondisi']           || '-';
  var lokasi  = s['LOKASI']             || s['Lokasi']            || '-';
  var catatan = s['CATATAN']            || s['Catatan']           || '-';
  var user    = s['USER']               || s['User']              || '-';
  var kondisiColor = kondisi === 'Baik' ? 'badge-green' : kondisi === 'Cukup Baik' ? 'badge-blue' : kondisi === 'Rusak Ringan' ? 'badge-amber' : 'badge-red';
  var mapsHtml = lokasi !== '-'
    ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lokasi) + '" target="_blank" class="detail-link"><i class="fas fa-map-marker-alt"></i> ' + esc(lokasi) + '</a>'
    : '-';
  var html =
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-boxes" style="margin-right:6px;"></i>Data Bahan Baku</div>' +
    '<div class="info-card">' +
      infoRow('Kode Bahan', '<strong style="font-family:monospace;">' + esc(kode) + '</strong>') +
      infoRow('Kategori', '<span class="badge badge-outline">' + esc(kat) + '</span>') +
      infoRow('Nama Bahan', '<strong style="font-size:14px;">' + esc(nama) + '</strong>') +
      infoRow('Kondisi', '<span class="badge ' + kondisiColor + '">' + esc(kondisi) + '</span>') +
    '</div></div>' +
    '<div style="margin-bottom:16px;"><div class="detail-section-title"><i class="fas fa-handshake" style="margin-right:6px;"></i>Informasi Serah Terima</div>' +
    '<div class="info-card">' +
      infoRow('Penerima', '<strong>' + esc(penerima) + '</strong>') +
      infoRow('Supplier', esc(supplier)) +
      infoRow('Lokasi', mapsHtml) +
      infoRow('Catatan', esc(catatan)) +
      infoRow('Input oleh', esc(user)) +
    '</div></div>';
  $('detailBody').innerHTML = html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-dolly" style="color:var(--primary);margin-right:8px;"></i>Detail Serah Terima';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data serah terima bahan baku';
  openModal('modalDetail');
}

function openDetailPending(id) {
  var p = allPending.find(function(x){ return x.id === id; });
  if (!p) return;
  resetDetailModalFooter();
  var statusBadge = p.status === 'LUNAS' ? 'badge-green' : 'badge-red';
  var html =
    '<div class="detail-section-title"><i class="fas fa-hand-holding-usd" style="margin-right:6px;"></i>Informasi Pending Payment</div>' +
    '<div class="info-card">' +
      infoRow('ID', '<span style="font-family:monospace;font-size:11px;">' + esc(p.id) + '</span>') +
      infoRow('Referensi Transaksi', esc(p.transaksiRef || '-')) +
      infoRow('Deskripsi', esc(p.deskripsi || '-')) +
      infoRow('Tanggal Pending', esc(p.tanggalPending || '-')) +
      infoRow('Rencana Pembayaran', esc(p.tanggalPayment || '-')) +
      infoRow('Status', '<span class="badge ' + statusBadge + '">' + esc(p.status || 'HUTANG') + '</span>') +
      infoRow('Tanggal Lunas', esc(p.tanggalLunas || '-')) +
      infoRow('Catatan', esc(p.catatan || '-')) +
      infoRow('Input oleh', esc(p.user || '-')) +
    '</div>';
  $('detailBody').innerHTML = html;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-hand-holding-usd" style="color:var(--amber);margin-right:8px;"></i>Detail Pending Payment';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Informasi lengkap data pending payment';
  openModal('modalDetail');
}
function exportSupplier(format) {
  if (format === 'csv') {
    downloadCSV(allSuppliers || [], [
      {key:'NAMA SUPPLIER', label:'Nama Supplier'},
      {key:'NO WHATSAPP', label:'No WhatsApp'},
      {key:'EMAIL', label:'Email'},
      {key:'ALAMAT TOKO', label:'Alamat Toko'},
      {key:'NAMA BANK', label:'Nama Bank'},
      {key:'NO REKENING', label:'Nomor Rekening'},
      {key:'ATAS NAMA REKENING', label:'Atas Nama Rekening'},
      {key:'ITEM YANG DIJUAL', label:'Item yang Dijual'},
      {key:'STATUS', label:'Status'}
    ], 'Master_Supplier');
  } else {
    printCurrentPage();
  }
}

function openAddSupplierModal() {
  openModal('modalAddSupplier');
  setTimeout(function() { initSupTtdCanvas(); }, 120);
}

function saveAddSupplier() {
  var data = {
    NAMA_SUPPLIER: $('addSupNama').value.trim(),
    NO_WHATSAPP: $('addSupWA').value.trim(),
    EMAIL: $('addSupEmail').value.trim(),
    ALAMAT_TOKO: $('addSupAlamat').value.trim(),
    STATUS: $('addSupStatus').value,
    NAMA_BANK: $('addSupBank').value.trim(),
    NO_REKENING: $('addSupNoRek').value.trim(),
    ATAS_NAMA_REKENING: $('addSupAtasNama').value.trim(),
    ITEM_YANG_DIJUAL: $('addSupItems').value.split(/[\n,;]/).map(function(v){return v.trim();}).filter(Boolean)
  };
  if (!data.NAMA_SUPPLIER || !data.ALAMAT_TOKO) { showToast('error', 'Validasi', 'Nama dan Alamat wajib diisi'); return; }
  // Handle foto, MOU, TTD uploads
  showLoading(true);
    callApi('addMasterSupplier', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddSupplier'); loadSuppliers(); loadDropdownOptions(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

function getGeocodeForSupplier() {
  var alamat = $('addSupAlamat').value.trim();
  if (!alamat) { showToast('warning', 'Perhatian', 'Isi alamat terlebih dahulu'); return; }
  showLoading(true);
    callApi('geocodeAlamat', [alamat], function(result) {
        showLoading(false);
              if (result.success) {
                $('supGeoResult').classList.remove('hidden');
                $('supGeoText').innerHTML = '<a href="' + esc(result.mapsLink) + '" target="_blank" style="color:var(--primary);">' + esc(result.formattedAddress) + ' <i class="fas fa-external-link-alt"></i></a>';
              } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Geocoding gagal');
      }
    );
}

function clearSupTtd() { clearTtdCanvas('supTtdCanvas'); }

// ============================================================
// 14. SURVEI HARGA
// ============================================================

/* ============================================================
     SURVEY
     ============================================================ */
function loadSurvei(page, forceAll, silent) {
  page=Math.max(1,Number(page)||surveiPage||1); forceAll=!!forceAll; if(!silent)showLoading(true);
  callApi('getSurveiBahanBaku',forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){
    if(!silent)showLoading(false);
    if(result&&result.success){var rows=Array.isArray(result.data)?result.data:[];surveiServerPaged=!forceAll&&Number(result.page)>0;surveiServerTotal=surveiServerPaged?Number(result.total||0):rows.length;surveiPage=surveiServerPaged?Number(result.page||page):1;allSurvei=rows;applySurveiFiltersLocal();populateSurveiFilterOptions();renderSurveiTable();}
  },function(err){if(!silent)showLoading(false);showToast('error','Gagal','Tidak dapat memuat data survei');allSurvei=[];filteredSurvei=[];surveiServerTotal=0;surveiServerPaged=false;renderSurveiTable();});
}
function renderSurveiTable() {
  var tbody = $('surveiTableBody');
  if (!filteredSurvei.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-search-dollar"></i></div><h4>Tidak Ada Data Survei</h4></div></td></tr>'; $('surveiPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil((surveiServerPaged ? surveiServerTotal : filteredSurvei.length) / ITEMS_PER_PAGE);
  if (surveiPage > totalPages) surveiPage = totalPages;
  var start = (surveiPage - 1) * ITEMS_PER_PAGE;
  var pageData = surveiServerPaged ? filteredSurvei : filteredSurvei.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(s, idx) {
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(s['KODE BAHAN BAKU'] || s['Kode Bahan Baku'] || '-') + '</strong></td>' +
      '<td>' + esc(s['WAKTU SURVEI'] || s['Waktu Survei'] || '-') + '</td>' +
      '<td>' + esc(s['KATEGORI BAHAN BAKU'] || s['Kategori'] || '-') + '</td>' +
      '<td>' + esc(s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '-') + '</td>' +
      '<td>' + formatRupiah(s['HARGA RAB'] || s['Harga RAB'] || 0) + '</td>' +
      '<td><strong style="color:var(--rose);">' + formatRupiah(s['HARGA PASAR'] || s['Harga Pasar'] || 0) + '</strong></td>' +
      '<td>' + esc(s['LOKASI SURVEI'] || s['Lokasi Survei'] || '-') + '</td>' +
      '<td>' + esc(s['USER'] || s['User'] || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailSurvei(' + s._row + ')" title="Detail"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn edit" onclick="openEditSurveiModal(' + s._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn delete" onclick="confirmHapus(\'survei\',' + s._row + ',\'\',\'survei ' + esc((s['NAMA BAHAN BAKU']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('surveiPagination', surveiPage, totalPages, 'goSurveiPage');
}

function applySurveiFiltersLocal(){var search=$('surveiSearchInput')?$('surveiSearchInput').value.toLowerCase().trim():'';var kat=$('surveiFilterKategori')?$('surveiFilterKategori').value:'ALL';filteredSurvei=allSurvei.filter(function(x){var teks=(x['NAMA BAHAN BAKU']||x['Nama Bahan Baku']||'')+' '+(x['KODE BAHAN BAKU']||x['Kode Bahan Baku']||'');if(search&&teks.toLowerCase().indexOf(search)===-1)return false;if(kat!=='ALL'&&(x['KATEGORI BAHAN BAKU']||x['Kategori'])!==kat)return false;return true;});}
function filterSurvei(){var search=$('surveiSearchInput')?$('surveiSearchInput').value.trim():'';var kat=$('surveiFilterKategori')?$('surveiFilterKategori').value:'ALL';var full=!!search||kat!=='ALL';clearTimeout(surveiFilterTimer);surveiFilterTimer=setTimeout(function(){surveiPage=1;loadSurvei(1,full);},300);}
function populateSurveiFilterOptions() {
  var katSel = $('surveiFilterKategori');
  var selectedKat=katSel?katSel.value||'ALL':'ALL';
  var katSet = {};
  allSurvei.forEach(function(s) { var k = s['KATEGORI BAHAN BAKU'] || s['Kategori']; if (k) katSet[k] = true; });
  katSel.innerHTML = '<option value="ALL">Semua Kategori</option>' + Object.keys(katSet).sort().map(function(k){ return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
  if(selectedKat!=='ALL'&&!katSet[selectedKat])katSel.insertAdjacentHTML('beforeend','<option value="'+esc(selectedKat)+'">'+esc(selectedKat)+'</option>');
  katSel.value=selectedKat;
}

function goSurveiPage(p){if(surveiServerPaged)loadSurvei(p,false);else{surveiPage=p;renderSurveiTable();}}
function exportSurvei(format) {
  if (format === 'csv') {
    downloadCSV(allSurvei || [], [
      {key:'KODE BAHAN BAKU', label:'Kode Bahan'},
      {key:'WAKTU SURVEI', label:'Waktu Survei'},
      {key:'KATEGORI BAHAN BAKU', label:'Kategori'},
      {key:'NAMA BAHAN BAKU', label:'Nama Bahan'},
      {key:'HARGA RAB', label:'Harga RAB'},
      {key:'HARGA PASAR', label:'Harga Pasar'},
      {key:'LOKASI SURVEI', label:'Lokasi'},
      {key:'USER', label:'User'}
    ], 'Survei_Harga');
  } else {
    printCurrentPage();
  }
}

function openAddSurveiModal() {
  $('addSurveiKode').value = '';
  $('addSurveiNama').value = '';
  $('addSurveiKategori').value = '';
  $('addSurveiHargaRAB').value = '';
  $('addSurveiHargaPasar').value = '';
  $('addSurveiAlamat').value = '';
  var geoBox = $('surveiGeoBox');
  geoBox.innerHTML = '<i class="fas fa-location-arrow"></i><span>Klik tombol untuk mendapatkan lokasi GPS</span>';
  geoBox.removeAttribute('data-lat');
  geoBox.removeAttribute('data-lng');
  geoBox.removeAttribute('data-coord');
  $('addSurveiFoto').value = '';
  $('bbAutocompleteDropdown').classList.remove('active');
  var btn = document.querySelector('[onclick="getGPSForSurvei()"]');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
  openModal('modalAddSurvei');
}

function handleBahanBakuAutocomplete(input) {
  var dropdown = $('bbAutocompleteDropdown');
  var val = input.value.trim().toLowerCase();
  var bb = dropdownOptions.bahanBaku || [];

  if (!bb.length) { dropdown.classList.remove('active'); return; }

  var matches = val
    ? bb.filter(function(b) {
        var haystack = ((b.kode || '') + ' ' + (b.nama || '') + ' ' + (b.kategori || '')).toLowerCase();
        return haystack.indexOf(val) > -1;
      })
    : bb;

  if (!matches.length) { dropdown.classList.remove('active'); return; }

  var html = '<div style="padding:6px 14px;font-size:10px;font-weight:700;color:var(--primary);' +
    'background:var(--primary-light);border-bottom:1px solid var(--slate-200);' +
    'display:flex;justify-content:space-between;">' +
    '<span><i class="fas fa-boxes" style="margin-right:4px;"></i>MASTER BAHAN BAKU</span>' +
    '<span style="font-weight:500;color:var(--slate-500);">' + matches.length + ' item</span></div>';

  matches.forEach(function(b) {
    html += '<div class="autocomplete-item" style="display:flex;justify-content:space-between;align-items:center;"' +
      ' onclick="selectSurveiBB(\'' + esc(b.kode) + '\',\'' + esc(b.nama) + '\',\'' + esc(b.kategori) + '\',' + (b.harga || 0) + ')">' +
      '<span><strong>' + esc(b.kode) + '</strong> — ' + esc(b.nama) + '</span>' +
      '<span style="font-size:10px;color:var(--slate-400);">' + esc(b.kategori) + '</span>' +
      '</div>';
  });

  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectSurveiBB(kode, nama, kat, harga) {
  $('addSurveiKode').value = kode;
  $('addSurveiNama').value = nama;
  $('addSurveiKategori').value = kat;
  $('addSurveiHargaRAB').value = formatRupiah(harga);
  $('bbAutocompleteDropdown').classList.remove('active');
}

function getGPSForSurvei() {
  if (!navigator.geolocation) {
    showToast('error', 'Error', 'Browser tidak mendukung GPS. Gunakan browser modern atau aktifkan lokasi.');
    return;
  }
  var btn = document.querySelector('[onclick="getGPSForSurvei()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengambil lokasi...'; }
  $('surveiGeoBox').innerHTML = '<i class="fas fa-location-arrow" style="animation:spin 1s linear infinite;"></i><span>Sedang mengambil koordinat GPS...</span>';

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var acc = Math.round(pos.coords.accuracy);
      var mapsLink = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      var coordText = lat.toFixed(6) + ', ' + lng.toFixed(6);

      $('surveiGeoBox').innerHTML =
        '<i class="fas fa-map-marker-alt" style="color:var(--emerald);"></i>' +
        '<span>' + coordText + ' <span style="color:var(--slate-400);font-size:11px;">(±' + acc + 'm)</span>' +
        ' <a href="' + mapsLink + '" target="_blank" style="color:var(--primary);font-weight:600;margin-left:8px;">' +
        '<i class="fas fa-external-link-alt"></i> Lihat Maps</a></span>';

      // Simpan nilai bersih di attribute untuk diambil saat save
      $('surveiGeoBox').setAttribute('data-lat', lat);
      $('surveiGeoBox').setAttribute('data-lng', lng);
      $('surveiGeoBox').setAttribute('data-coord', coordText);

      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Perbarui Lokasi GPS'; }
      showToast('success', 'GPS Berhasil', 'Koordinat: ' + coordText);
    },
    function(err) {
      var msg = 'Tidak dapat mendapatkan lokasi.';
      if (err.code === 1) msg = 'Akses lokasi ditolak. Izinkan lokasi di pengaturan browser.';
      else if (err.code === 2) msg = 'Lokasi tidak tersedia. Pastikan GPS aktif.';
      else if (err.code === 3) msg = 'Waktu habis. Coba lagi di tempat terbuka.';
      $('surveiGeoBox').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--rose);"></i><span style="color:var(--rose);">' + msg + '</span>';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
      showToast('error', 'GPS Gagal', msg);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function saveAddSurvei() {
  var geoBox = $('surveiGeoBox');
  var coordSaved = geoBox.getAttribute('data-coord') || '';
  var lokasiSurvei = coordSaved
    ? 'Lat: ' + geoBox.getAttribute('data-lat') + ', Lng: ' + geoBox.getAttribute('data-lng')
    : '';
  var data = {
    KODE_BAHAN_BAKU: $('addSurveiKode').value,
    NAMA_BAHAN_BAKU: $('addSurveiNama').value,
    KATEGORI_BAHAN_BAKU: $('addSurveiKategori').value,
    HARGA_RAB: $('addSurveiHargaRAB').value.replace(/[^0-9]/g, '') || 0,
    HARGA_PASAR: parseFloat($('addSurveiHargaPasar').value) || 0,
    ALAMAT_SURVEI: $('addSurveiAlamat').value,
    LOKASI_SURVEI: lokasiSurvei
  };

  if (!data.KODE_BAHAN_BAKU || !data.HARGA_PASAR || !data.ALAMAT_SURVEI) { showToast('error', 'Validasi', 'Kode Bahan, Harga Pasar, dan Alamat wajib diisi'); return; }
  showLoading(true);

  var fotoFile = $('addSurveiFoto').files[0];
  if (fotoFile) {
    var r = new FileReader();
    r.onload = function(e) {
      var b64 = e.target.result.split(',')[1];
    callApi('uploadFotoSurvei', [
      b64,
      fotoFile.type,
      fotoFile.name
    ], function(up) {
        if (up.success) data.FOTO_BAHAN_BAKU = up.fileName;
                  submitSurveiData(data);
      }, null);
    };
    r.readAsDataURL(fotoFile);
  } else {
    submitSurveiData(data);
  }
}
function submitSurveiData(data) {
    callApi('addSurveiBahanBaku', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddSurvei'); loadSurvei(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 15. SERAH TERIMA
// ============================================================

/* ============================================================
     SERAH TERIMA
     ============================================================ */
function loadSerahTerima(page,forceAll,silent){page=Math.max(1,Number(page)||stPage||1);forceAll=!!forceAll;if(!silent)showLoading(true);callApi('getSerahTerima',forceAll?[]:[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){if(!silent)showLoading(false);if(result&&result.success){var rows=Array.isArray(result.data)?result.data:[];stServerPaged=!forceAll&&Number(result.page)>0;stServerTotal=stServerPaged?Number(result.total||0):rows.length;stPage=stServerPaged?Number(result.page||page):1;allSerahTerima=rows;applySerahTerimaFiltersLocal();renderSerahTerimaTable();}},function(err){if(!silent)showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allSerahTerima=[];filteredSerahTerima=[];stServerTotal=0;stServerPaged=false;renderSerahTerimaTable();});}
function renderSerahTerimaTable() {
  var tbody = $('serahTerimaTableBody');
  if (!filteredSerahTerima.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-dolly"></i></div><h4>Tidak Ada Data</h4></div></td></tr>'; $('serahTerimaPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil((stServerPaged ? stServerTotal : filteredSerahTerima.length) / ITEMS_PER_PAGE);
  if (stPage > totalPages) stPage = totalPages;
  var start = (stPage - 1) * ITEMS_PER_PAGE;
  var pageData = stServerPaged ? filteredSerahTerima : filteredSerahTerima.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(s, idx) {
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(s['KODE BAHAN BAKU'] || s['Kode Bahan'] || '-') + '</strong></td>' +
      '<td>' + esc(s['NAMA BAHAN BAKU'] || s['Nama Bahan Baku'] || '-') + '</td>' +
      '<td>' + esc(s['PENERIMA'] || s['Penerima'] || '-') + '</td>' +
      '<td>' + esc(s['SUPPLIER'] || s['Supplier'] || '-') + '</td>' +
      '<td><span class="badge ' + ((s['KONDISI BAHAN BAKU'] || s['Kondisi']) === 'Baik' ? 'badge-green' : 'badge-amber') + '">' + esc(s['KONDISI BAHAN BAKU'] || s['Kondisi'] || '-') + '</span></td>' +
      '<td>' + esc(s['LOKASI'] || s['Lokasi'] || '-') + '</td>' +
      '<td>' + esc(s['USER'] || s['User'] || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailSerahTerima(' + s._row + ')" title="Detail"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn edit" onclick="openEditSerahTerimaModal(' + s._row + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          ((currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN')) ? '<button class="action-btn delete" onclick="confirmHapus(\'serahTerima\',' + s._row + ',\'\',\'serah terima ' + esc((s['NAMA BAHAN BAKU']||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('serahTerimaPagination', stPage, totalPages, 'goSTPage');
}

function applySerahTerimaFiltersLocal(){var search=$('stSearchInput')?$('stSearchInput').value.toLowerCase().trim():'';var kondisi=$('stFilterKondisi')?$('stFilterKondisi').value:'ALL';filteredSerahTerima=allSerahTerima.filter(function(x){var teks=(x['NAMA BAHAN BAKU']||x['Nama Bahan Baku']||'')+' '+(x['PENERIMA']||x['Penerima']||'')+' '+(x['SUPPLIER']||x['Supplier']||'');if(search&&teks.toLowerCase().indexOf(search)===-1)return false;if(kondisi!=='ALL'&&(x['KONDISI BAHAN BAKU']||x['Kondisi'])!==kondisi)return false;return true;});}
function filterSerahTerima(){var search=$('stSearchInput')?$('stSearchInput').value.trim():'';var kondisi=$('stFilterKondisi')?$('stFilterKondisi').value:'ALL';var full=!!search||kondisi!=='ALL';clearTimeout(stFilterTimer);stFilterTimer=setTimeout(function(){stPage=1;loadSerahTerima(1,full);},300);}

function goSTPage(p){if(stServerPaged)loadSerahTerima(p,false);else{stPage=p;renderSerahTerimaTable();}}
function exportSerahTerima(format) {
  if (format === 'csv') {
    downloadCSV(allSerahTerima || [], [
      {key:'KODE BAHAN BAKU', label:'Kode Bahan'},
      {key:'NAMA BAHAN BAKU', label:'Nama Bahan'},
      {key:'PENERIMA', label:'Penerima'},
      {key:'SUPPLIER', label:'Supplier'},
      {key:'KONDISI BAHAN BAKU', label:'Kondisi'},
      {key:'LOKASI', label:'Lokasi'},
      {key:'USER', label:'User'}
    ], 'Serah_Terima');
  } else {
    printCurrentPage();
  }
}

function openAddSerahTerimaModal() {
  $('addSTKodeInput').value = '';
  $('addSTKode').value = '';
  $('addSTNama').value = '';
  $('addSTKategori').value = '';
  $('stBBAutocompleteDropdown').classList.remove('active');
  var stGeo = $('stGeoBox');
  stGeo.innerHTML = '<i class="fas fa-location-arrow"></i><span>Klik tombol untuk mendapatkan lokasi GPS</span>';
  stGeo.removeAttribute('data-lat');
  stGeo.removeAttribute('data-lng');
  stGeo.removeAttribute('data-coord');
  var btn = document.querySelector('[onclick="getGPSForST()"]');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
  openModal('modalAddSerahTerima');
  setTimeout(function() { initStTtdCanvas(); }, 120);
}

function handleSTBahanBakuAutocomplete(input) {
  var dropdown = $('stBBAutocompleteDropdown');
  var val = input.value.trim().toLowerCase();
  var bb = dropdownOptions.bahanBaku || [];

  if (!bb.length) { dropdown.classList.remove('active'); return; }

  var matches = val
    ? bb.filter(function(b) {
        var haystack = ((b.kode || '') + ' ' + (b.nama || '') + ' ' + (b.kategori || '')).toLowerCase();
        return haystack.indexOf(val) > -1;
      })
    : bb;

  if (!matches.length) { dropdown.classList.remove('active'); return; }

  var html = '<div style="padding:6px 14px;font-size:10px;font-weight:700;color:var(--primary);' +
    'background:var(--primary-light);border-bottom:1px solid var(--slate-200);' +
    'display:flex;justify-content:space-between;">' +
    '<span><i class="fas fa-boxes" style="margin-right:4px;"></i>MASTER BAHAN BAKU</span>' +
    '<span style="font-weight:500;color:var(--slate-500);">' + matches.length + ' item</span></div>';

  matches.forEach(function(b) {
    html += '<div class="autocomplete-item" style="display:flex;justify-content:space-between;align-items:center;"' +
      ' onclick="selectSTBB(\'' + esc(b.kode) + '\',\'' + esc(b.nama) + '\',\'' + esc(b.kategori) + '\')">' +
      '<span><strong>' + esc(b.kode) + '</strong> — ' + esc(b.nama) + '</span>' +
      '<span style="font-size:10px;color:var(--slate-400);">' + esc(b.kategori) + '</span>' +
      '</div>';
  });

  dropdown.innerHTML = html;
  dropdown.classList.add('active');
}

function selectSTBB(kode, nama, kat) {
  $('addSTKodeInput').value = kode + ' — ' + nama;
  $('addSTKode').value = kode + '|' + nama + '|' + kat;
  $('addSTNama').value = nama;
  $('addSTKategori').value = kat;
  $('stBBAutocompleteDropdown').classList.remove('active');
}
function getGPSForST() {
  if (!navigator.geolocation) {
    showToast('error', 'Error', 'Browser tidak mendukung GPS. Gunakan browser modern atau aktifkan lokasi.');
    return;
  }
  var btn = document.querySelector('[onclick="getGPSForST()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengambil lokasi...'; }
  $('stGeoBox').innerHTML = '<i class="fas fa-location-arrow" style="animation:spin 1s linear infinite;"></i><span>Sedang mengambil koordinat GPS...</span>';

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var acc = Math.round(pos.coords.accuracy);
      var mapsLink = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      var coordText = lat.toFixed(6) + ', ' + lng.toFixed(6);

      $('stGeoBox').innerHTML =
        '<i class="fas fa-map-marker-alt" style="color:var(--emerald);"></i>' +
        '<span>' + coordText + ' <span style="color:var(--slate-400);font-size:11px;">(±' + acc + 'm)</span>' +
        ' <a href="' + mapsLink + '" target="_blank" style="color:var(--primary);font-weight:600;margin-left:8px;">' +
        '<i class="fas fa-external-link-alt"></i> Lihat Maps</a></span>';

      $('stGeoBox').setAttribute('data-lat', lat);
      $('stGeoBox').setAttribute('data-lng', lng);
      $('stGeoBox').setAttribute('data-coord', coordText);

      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Perbarui Lokasi GPS'; }
      showToast('success', 'GPS Berhasil', 'Koordinat: ' + coordText);
    },
    function(err) {
      var msg = 'Tidak dapat mendapatkan lokasi.';
      if (err.code === 1) msg = 'Akses lokasi ditolak. Izinkan lokasi di pengaturan browser.';
      else if (err.code === 2) msg = 'Lokasi tidak tersedia. Pastikan GPS aktif.';
      else if (err.code === 3) msg = 'Waktu habis. Coba lagi di tempat terbuka.';
      $('stGeoBox').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--rose);"></i><span style="color:var(--rose);">' + msg + '</span>';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs"></i> Ambil Lokasi GPS'; }
      showToast('error', 'GPS Gagal', msg);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function saveAddSerahTerima() {
  var kodeVal = $('addSTKode').value;
  var kodeParts = kodeVal ? kodeVal.split('|') : ['', '', ''];
  var data = {
    KODE_BAHAN_BAKU: kodeParts[0],
    NAMA_BAHAN_BAKU: $('addSTNama').value,
    KATEGORI_BAHAN_BAKU: $('addSTKategori').value,
    KONDISI_BAHAN_BAKU: $('addSTKondisi').value,
    PENERIMA: $('addSTPenerima').value.trim(),
    SUPPLIER: $('addSTSupplier').value,
    CATATAN: $('addSTCatatan').value,
    LOKASI: $('stGeoBox').getAttribute('data-coord')
      ? 'Lat: ' + $('stGeoBox').getAttribute('data-lat') + ', Lng: ' + $('stGeoBox').getAttribute('data-lng')
      : ''
  };
  if (!data.PENERIMA || !data.KODE_BAHAN_BAKU) { showToast('error', 'Validasi', 'Penerima dan Bahan Baku wajib diisi'); return; }
  showLoading(true);
    callApi('addSerahTerima', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddSerahTerima'); loadSerahTerima(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}
// ============================================================
// 16. MENU MBG (AHLI GIZI)
// ============================================================

/* ============================================================
     MENU MBG
     ============================================================ */
function loadMenuMBG(page,silent){page=Math.max(1,Number(page)||menuMBGPage||1);if(!silent)showLoading(true);callApi('getMenuHarian',[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){if(!silent)showLoading(false);if(result&&result.success){allMenuMBG=Array.isArray(result.data)?result.data:[];menuServerPaged=Number(result.page)>0;menuServerTotal=menuServerPaged?Number(result.total||0):allMenuMBG.length;menuMBGPage=menuServerPaged?Number(result.page||page):1;renderMenuMBGTable();}},function(err){if(!silent)showLoading(false);showToast('error','Gagal','Tidak dapat memuat data menu');allMenuMBG=[];menuServerTotal=0;menuServerPaged=false;renderMenuMBGTable();});}
function renderMenuMBGTable() {
  var tbody = $('menuMBGTableBody');
  if (!allMenuMBG.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-utensils"></i></div><h4>Tidak Ada Data Menu</h4></div></td></tr>'; $('menuMBGPagination').innerHTML = ''; return; }
  var totalPages = Math.ceil((menuServerPaged ? menuServerTotal : allMenuMBG.length) / ITEMS_PER_PAGE);
  if (menuMBGPage > totalPages) menuMBGPage = totalPages;
  var start = (menuMBGPage - 1) * ITEMS_PER_PAGE;
  var pageData = menuServerPaged ? allMenuMBG : allMenuMBG.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(m, idx) {
    var detailText = '';
    if (m.detail && m.detail.length) {
      detailText = m.detail.map(function(d) { return esc(d.namaItem) + ' (' + d.jumlah + ' ' + esc(d.satuan) + ')'; }).join(', ');
    }
    var canEditMenu = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'AHLI_GIZI');
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(m.tanggal) + '</strong></td>' +
      '<td>' + (m.jumlahKpm || 0) + ' orang</td>' +
      '<td>' + esc(m.menu) + '</td>' +
      '<td>' + (detailText || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" title="Detail" onclick="showMenuDetail(' + (menuServerPaged ? idx : start + idx) + ')"><i class="fas fa-eye"></i><span class="tooltip">Detail</span></button>' +
          (canEditMenu ? '<button class="action-btn edit" onclick="openEditMenuMBGModal(' + (menuServerPaged ? idx : start + idx) + ')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (canEditMenu ? '<button class="action-btn delete" onclick="confirmHapus(\'menuMBG\',' + (m._row || (start+idx+2)) + ',\'\',\'menu ' + esc((m.menu||'').substring(0,20)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('menuMBGPagination', menuMBGPage, totalPages, 'goMenuMBGPage');
}
function goMenuMBGPage(p){if(menuServerPaged)loadMenuMBG(p);else{menuMBGPage=p;renderMenuMBGTable();}}
function exportMenuRows(rows) {
  var flat=[];
  (rows||[]).forEach(function(m){if(m.detail&&m.detail.length){m.detail.forEach(function(d){flat.push({tanggal:m.tanggal,jumlahKpm:m.jumlahKpm,menu:m.menu,namaItem:d.namaItem,jumlah:d.jumlah,satuan:d.satuan,hargaSatuan:d.hargaSatuan,totalHarga:d.totalHarga});});}else{flat.push({tanggal:m.tanggal,jumlahKpm:m.jumlahKpm,menu:m.menu,namaItem:'',jumlah:'',satuan:'',hargaSatuan:'',totalHarga:''});}});
  downloadCSV(flat,[{key:'tanggal',label:'Tanggal'},{key:'jumlahKpm',label:'Jumlah KPM'},{key:'menu',label:'Menu'},{key:'namaItem',label:'Nama Item'},{key:'jumlah',label:'Jumlah'},{key:'satuan',label:'Satuan'},{key:'hargaSatuan',label:'Harga Satuan'},{key:'totalHarga',label:'Total Harga'}],'Menu_MBG');
}
function exportMenuMBG(format) {
  if(format!=='csv'){printCurrentPage();return;}
  showLoading(true);
  callApi('getMenuHarian',[{}],function(result){showLoading(false);exportMenuRows(normalizeApiRows(result));},function(){showLoading(false);showToast('error','Gagal','Tidak dapat mengambil seluruh data menu');});
}
function showMenuDetail(idx) {
  var m = allMenuMBG[idx];
  if (!m) return;
  resetDetailModalFooter();
  var detailHtml = '';
  if (m.detail && m.detail.length) {
    m.detail.forEach(function(d) {
      detailHtml += '<div class="detail-doc-item doc-ok">' +
        '<div class="detail-doc-icon"><i class="fas fa-utensils"></i></div>' +
        '<div><div class="detail-doc-label">' + esc(d.namaItem) + '</div>' +
        '<div class="detail-doc-status">' + d.jumlah + ' ' + esc(d.satuan) + ' — ' + formatRupiah(d.totalHarga) + '</div></div>' +
        '</div>';
    });
  } else {
    detailHtml = '<p style="color:var(--slate-400);font-size:13px;">Tidak ada detail item.</p>';
  }
  $('detailBody').innerHTML =
    '<div class="info-card">' +
      infoRow('Tanggal', esc(m.tanggal)) +
      infoRow('Jumlah KPM', (m.jumlahKpm || 0) + ' orang') +
      infoRow('Menu', esc(m.menu)) +
    '</div>' +
    '<div class="detail-section-title"><i class="fas fa-list" style="margin-right:6px;"></i>Detail Item</div>' +
    detailHtml;
  $('modalDetail').querySelector('.modal-header h3').innerHTML = '<i class="fas fa-utensils" style="color:var(--primary);margin-right:8px;"></i>Detail Menu MBG';
  $('modalDetail').querySelector('.modal-header p').textContent = 'Detail bahan baku dan item menu';
  openModal('modalDetail');
}

function openAddMenuMBGModal() {
  $('addMenuTanggal').value = formatDateInput();
  $('addMenuKPM').value = '';
  populateMenuMBGSelect();
  menuItems = [];
  renderMenuItems();
  openModal('modalAddMenuMBG');
}
function addMenuItemRow() {
  menuItems.push({ namaItem: '', jumlah: 1, satuan: 'Kg', hargaSatuan: 0 });
  renderMenuItems();
}
function removeMenuItem(i) { menuItems.splice(i, 1); renderMenuItems(); }
function renderMenuItems() {
  var container = $('menuItemsList');
  if (!menuItems.length) { container.innerHTML = '<p style="color:var(--slate-400);font-size:12px;">Belum ada item. Klik "Tambah Item".</p>'; return; }
  var bb = dropdownOptions.bahanBaku || [];
  var html = '';
  menuItems.forEach(function(item, i) {
    var options = bb.map(function(b) { return '<option value="' + esc(b.nama) + '" ' + (b.nama === item.namaItem ? 'selected' : '') + '>' + esc(b.nama) + ' (' + esc(b.satuan) + ')</option>'; }).join('');
    html += '<div class="form-row" style="margin-bottom:8px;align-items:end;">' +
      '<div class="form-group" style="margin-bottom:0;">' +
        '<select class="form-input" onchange="updateMenuItem(' + i + ', \'namaItem\', this.value)">' +
          '<option value="">Pilih Bahan</option>' + options + '</select></div>' +
      '<div class="form-group" style="margin-bottom:0;flex:0 0 80px;">' +
        '<input type="number" class="form-input" value="' + item.jumlah + '" min="1" onchange="updateMenuItem(' + i + ', \'jumlah\', this.value)" placeholder="Qty"></div>' +
      '<div class="form-group" style="margin-bottom:0;flex:0 0 100px;">' +
        '<input type="text" class="form-input" value="' + esc(item.satuan) + '" onchange="updateMenuItem(' + i + ', \'satuan\', this.value)" placeholder="Satuan"></div>' +
      '<div class="form-group" style="margin-bottom:0;flex:0 0 140px;">' +
        '<input type="number" class="form-input" value="' + item.hargaSatuan + '" onchange="updateMenuItem(' + i + ', \'hargaSatuan\', this.value)" placeholder="Harga"></div>' +
      '<button type="button" class="action-btn delete" onclick="removeMenuItem(' + i + ')" style="margin-bottom:4px;"><i class="fas fa-trash"></i></button>' +
      '</div>';
  });
  container.innerHTML = html;
}
function updateMenuItem(i, field, val) {
  if (field === 'namaItem') {
    menuItems[i].namaItem = val;
    // Auto-fill satuan from dropdown options
    var bb = dropdownOptions.bahanBaku || [];
    var found = bb.find(function(b) { return b.nama === val; });
    if (found) { menuItems[i].satuan = found.satuan || 'Kg'; menuItems[i].hargaSatuan = found.harga || 0; }
  } else if (field === 'jumlah') menuItems[i].jumlah = parseInt(val) || 1;
  else if (field === 'satuan') menuItems[i].satuan = val;
  else if (field === 'hargaSatuan') menuItems[i].hargaSatuan = parseFloat(val) || 0;
  renderMenuItems();
}
function saveAddMenuMBG() {
  var menuSel = $('addMenuList');
  var selectedMenus = Array.from(menuSel.selectedOptions).map(function(o) { return o.value; }).join(', ');
  var data = {
    tanggal: $('addMenuTanggal').value,
    jumlahKpm: parseInt($('addMenuKPM').value) || 0,
    menu: selectedMenus,
    items: menuItems.filter(function(i) { return i.namaItem; })
  };
  if (!data.tanggal || !data.jumlahKpm || !data.menu) { showToast('error', 'Validasi', 'Tanggal, Jumlah KPM, dan Menu wajib diisi'); return; }
  showLoading(true);
    callApi('addMenuHarian', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddMenuMBG'); loadMenuMBG(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}

// ============================================================
// 17. PENDING PAYMENT
// ============================================================

/* ============================================================
     PENDING PAYMENT
     ============================================================ */
function loadPendingPayment(page,silent){page=Math.max(1,Number(page)||pendingPage||1);if(!silent)showLoading(true);callApi('getPendingPayments',[{page:page,pageSize:ITEMS_PER_PAGE}],function(result){if(!silent)showLoading(false);if(Array.isArray(result)){allPending=result;pendingServerPaged=false;pendingServerTotal=result.length;pendingPage=1;}else if(result&&result.success){allPending=Array.isArray(result.data)?result.data:[];pendingServerPaged=Number(result.page)>0;pendingServerTotal=pendingServerPaged?Number(result.total||0):allPending.length;pendingPage=pendingServerPaged?Number(result.page||page):1;}else{allPending=[];pendingServerTotal=0;pendingServerPaged=false;}renderPendingTable();},function(err){if(!silent)showLoading(false);showToast('error','Gagal','Tidak dapat memuat data');allPending=[];pendingServerTotal=0;pendingServerPaged=false;renderPendingTable();});}


function renderPendingTable() {
  var tbody = $('pendingTableBody');
  if (!allPending.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-hand-holding-usd"></i></div><h4>Tidak Ada Pending Payment</h4></div></td></tr>'; $('pendingPagination').innerHTML = ''; return; }
  var isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN');
  var totalPages = Math.ceil((pendingServerPaged ? pendingServerTotal : allPending.length) / ITEMS_PER_PAGE);
  if (pendingPage > totalPages) pendingPage = totalPages;
  var start = (pendingPage - 1) * ITEMS_PER_PAGE;
  var pageData = pendingServerPaged ? allPending : allPending.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(p, idx) {
    var statusBadge = p.status === 'LUNAS' ? 'badge-green' : 'badge-red';
    html += '<tr>' +
      '<td>' + (start + idx + 1) + '</td>' +
      '<td><strong>' + esc(p.id) + '</strong></td>' +
      '<td>' + esc(p.transaksiRef || '-') + '</td>' +
      '<td>' + esc(p.deskripsi || '-') + '</td>' +
      '<td>' + esc(p.tanggalPending || '-') + '</td>' +
      '<td>' + esc(p.tanggalPayment || '-') + '</td>' +
      '<td><span class="badge ' + statusBadge + '">' + esc(p.status || 'HUTANG') + '</span></td>' +
      '<td>' + esc(p.tanggalLunas || '-') + '</td>' +
      '<td>' + esc(p.catatan || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div class="action-group" style="opacity:1;">' +
          '<button class="action-btn view" onclick="openDetailPending(\'' + esc(p.id) + '\')" title="Detail"><i class="fas fa-eye"></i></button>' +
          (isAdmin && p.status !== 'LUNAS' ? '<button class="action-btn" style="color:#22c55e;border:1px solid #bbf7d0;" onclick="sendWAReminderPending(\'' + esc(p.id) + '\')" title="Kirim Reminder WA"><i class="fab fa-whatsapp"></i><span class="tooltip">Reminder WA</span></button>' : '') +
          (isAdmin ? '<button class="action-btn edit" onclick="openEditPendingModal(\'' + esc(p.id) + '\')" title="Edit"><i class="fas fa-edit"></i><span class="tooltip">Edit</span></button>' : '') +
          (isAdmin ? '<button class="action-btn delete" onclick="confirmHapus(\'pending\',0,\'' + esc(p.id) + '\',\'pending ' + esc((p.id||'').substring(0,10)) + '\')" title="Hapus"><i class="fas fa-trash"></i><span class="tooltip">Hapus</span></button>' : '') +
        '</div></td></tr>';
  });
  tbody.innerHTML = html;
  renderPagination('pendingPagination', pendingPage, totalPages, 'goPendingPage');
}
function goPendingPage(p){if(pendingServerPaged)loadPendingPayment(p);else{pendingPage=p;renderPendingTable();}}

function openAddPendingModal() {
  populatePendingTransaksiSelect();
  openModal('modalAddPending');
}
function saveAddPending() {
  var data = {
    transaksiRef: $('addPendingTransaksi').value,
    deskripsi: $('addPendingDeskripsi').value.trim(),
    tanggalPending: $('addPendingTglPending').value,
    tanggalPayment: $('addPendingTglPayment').value
  };
  if (!data.deskripsi || !data.tanggalPending) { showToast('error', 'Validasi', 'Deskripsi dan Tanggal Pending wajib diisi'); return; }
  showLoading(true);
    callApi('addPendingPayment', [data], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalAddPending'); loadPendingPayment(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}
function openEditPendingModal(id) {
  var p = allPending.find(function(x) { return x.id === id; });
  if (!p) return;
  $('editPendingId').value = id;
  $('editPendingStatus').value = p.status || 'HUTANG';
  $('editPendingTglLunas').value = p.tanggalLunas ? formatDateInput(p.tanggalLunas) : '';
  $('editPendingCatatan').value = p.catatan || '';
  openModal('modalEditPending');
}

function toggleTglLunas() {
  var status = $('editPendingStatus').value;
  var tglEl = $('editPendingTglLunas');
  if (status === 'LUNAS') {
    tglEl.value = tglEl.value || formatDateInput();
  }
}

function saveEditPending() {
  var id = $('editPendingId').value;
  var updateData = {
    status: $('editPendingStatus').value,
    tanggalLunas: $('editPendingTglLunas').value,
    catatan: $('editPendingCatatan').value
  };
  showLoading(true);
    callApi('updatePendingPayment', [
      id,
      updateData
    ], function(result) {
        showLoading(false); if (result.success) { showToast('success', 'Sukses', result.message); closeModal('modalEditPending'); loadPendingPayment(); } else { showToast('error', 'Gagal', result.message); }
      },
      function(err) {
        showLoading(false); showToast('error', 'Gagal', 'Terjadi kesalahan');
      }
    );
}


// ============================================================
// 17b. AUDIT LOG (RIWAYAT AKTIVITAS) — ADMIN
// ============================================================
var allAuditLog = [];
var filteredAuditLog = [];
var auditLogPage = 1;


/* ============================================================
     AUDIT LOG & NOTIFICATIONS
     ============================================================ */
function loadAuditLog(page,silent){if(!currentUser||['ADMIN','SUPER_ADMIN'].indexOf(currentUser.role)===-1)return;page=Math.max(1,Number(page)||auditLogPage||1);if(!silent)showLoading(true);var f={page:page,pageSize:ITEMS_PER_PAGE};if($('auditSearchInput')&&$('auditSearchInput').value.trim())f.search=$('auditSearchInput').value.trim();if($('auditFilterAction')&&$('auditFilterAction').value!=='ALL')f.actionType=$('auditFilterAction').value;if($('auditFilterTglStart')&&$('auditFilterTglStart').value)f.dateStart=$('auditFilterTglStart').value;if($('auditFilterTglEnd')&&$('auditFilterTglEnd').value)f.dateEnd=$('auditFilterTglEnd').value;callApi('getAuditLog',[f],function(result){if(!silent)showLoading(false);if(result&&result.success){allAuditLog=Array.isArray(result.data)?result.data:[];filteredAuditLog=allAuditLog.slice();auditServerPaged=Number(result.page)>0;auditServerTotal=auditServerPaged?Number(result.total||0):allAuditLog.length;auditLogPage=auditServerPaged?Number(result.page||page):1;populateAuditActionFilter();renderAuditLogTable();}else{showToast('error','Gagal',result&&result.message||'Tidak dapat memuat riwayat aktivitas');}},function(err){if(!silent)showLoading(false);showToast('error','Gagal','Tidak dapat memuat riwayat aktivitas');allAuditLog=[];filteredAuditLog=[];auditServerTotal=0;auditServerPaged=false;renderAuditLogTable();});}


function populateAuditActionFilter() {
  var sel = $('auditFilterAction');
  if (!sel) return;
  var selectedAction = sel.value || 'ALL';
  var actions = {};
  allAuditLog.forEach(function(a) { if (a.actionType) actions[a.actionType] = true; });
  var html = '<option value="ALL">Semua Aksi</option>';
  Object.keys(actions).sort().forEach(function(a) { html += '<option value="' + esc(a) + '">' + esc(a) + '</option>'; });
  sel.innerHTML = html;
  if (selectedAction !== 'ALL' && !actions[selectedAction]) sel.insertAdjacentHTML('beforeend', '<option value="' + esc(selectedAction) + '">' + esc(selectedAction) + '</option>');
  sel.value = selectedAction;
}


function renderAuditLogTable() {
  var tbody = $('auditLogTableBody');
  if (!filteredAuditLog.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-history"></i></div><h4>Belum Ada Riwayat</h4></div></td></tr>';
    $('auditLogPagination').innerHTML = '';
    return;
  }
  var totalPages = Math.ceil((auditServerPaged ? auditServerTotal : filteredAuditLog.length) / ITEMS_PER_PAGE);
  if (auditLogPage > totalPages) auditLogPage = totalPages;
  var start = (auditLogPage - 1) * ITEMS_PER_PAGE;
  var pageData = auditServerPaged ? filteredAuditLog : filteredAuditLog.slice(start, start + ITEMS_PER_PAGE);
  var html = '';
  pageData.forEach(function(a, idx) {
    var actionColor = 'badge-slate';
    if (a.actionType.indexOf('DELETE') > -1) actionColor = 'badge-red';
    else if (a.actionType.indexOf('APPROVE') > -1 || a.actionType.indexOf('VERIFY') > -1) actionColor = 'badge-green';
    else if (a.actionType.indexOf('ADD') > -1) actionColor = 'badge-blue';
    else if (a.actionType.indexOf('EDIT') > -1 || a.actionType.indexOf('UPDATE') > -1) actionColor = 'badge-amber';
    else if (a.actionType.indexOf('FAILED') > -1) actionColor = 'badge-red';
    html += '<tr>' +
      '<td style="text-align:center;color:var(--slate-400);">' + (start + idx + 1) + '</td>' +
      '<td style="white-space:nowrap;font-size:11px;">' + esc(a.waktu) + '</td>' +
      '<td>' + esc(a.pelaku) + '</td>' +
      '<td><span class="badge ' + actionColor + '">' + esc(a.actionType) + '</span></td>' +
      '<td>' + esc(a.tableName) + '</td>' +
      '<td style="font-family:monospace;font-size:11px;">' + esc(a.recordId) + '</td>' +
      '<td>' + esc(a.fieldChanged) + '</td>' +
      '<td style="font-size:11px;color:var(--slate-500);">' + esc(a.deskripsi) + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
  renderPagination('auditLogPagination', auditLogPage, totalPages, 'goAuditLogPage');
}
function goAuditLogPage(p){if(auditServerPaged)loadAuditLog(p);else{auditLogPage=p;renderAuditLogTable();}}

function filterAuditLog(){clearTimeout(auditFilterTimer);auditFilterTimer=setTimeout(function(){auditLogPage=1;loadAuditLog(1);},300);}


function resetAuditFilter() {
  $('auditSearchInput').value = '';
  $('auditFilterAction').value = 'ALL';
  $('auditFilterTglStart').value = '';
  $('auditFilterTglEnd').value = '';
  filterAuditLog();
}

// ============================================================
// 17b. ADMIN ASSIGNMENT (SUPER_ADMIN) — konfigurasi cakupan ADMIN
// ============================================================
var allAdminAssignments = [];
var _aaEmailDebounce = null;

function loadAdminAssignments(silent) {
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
  var targetEmail = ($('adminAssignmentEmailInput') && $('adminAssignmentEmailInput').value.trim()) || '';
  if (!silent) showLoading(true);
  callApi('getAdminAssignments', [targetEmail], function(result) {
    if (!silent) showLoading(false);
    if (result.success) {
      allAdminAssignments = result.data || [];
      renderAdminAssignmentTable();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat memuat data assignment');
    }
  }, function(err) {
    if (!silent) showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat memuat data assignment: ' + (err.message || ''));
  });
}

function handleAdminAssignmentEmailInput() {
  if (_aaEmailDebounce) clearTimeout(_aaEmailDebounce);
  _aaEmailDebounce = setTimeout(function() { loadAdminAssignments(); }, 400);
}

function renderAdminAssignmentTable() {
  var tbody = $('adminAssignmentTableBody');
  if (!tbody) return;
  if (!allAdminAssignments.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-illustration"><i class="fas fa-user-shield"></i></div><h4>Belum Ada Assignment</h4><p>Cari email admin di atas atau tambahkan assignment baru.</p></div></td></tr>';
    return;
  }
  var html = '';
  allAdminAssignments.forEach(function(a, idx) {
    html += '<tr class="admin-assignment-row">' +
      '<td class="aa-index" style="text-align:center;color:var(--slate-400);">' + (idx + 1) + '</td>' +
      '<td class="aa-email">' + esc(a.admin_email) + '</td>' +
      '<td class="aa-sppg">' + esc(a.sppg) + '</td>' +
      '<td class="aa-yayasan">' + esc(a.yayasan) + '</td>' +
      '<td class="aa-date" style="white-space:nowrap;font-size:11px;">' + esc(a.created_at ? String(a.created_at).substring(0, 10) : '-') + '</td>' +
      '<td class="aa-actions-cell">' +
        '<div class="admin-assignment-actions">' +
        '<button class="btn btn-icon" onclick="openEditAdminAssignmentModal(\'' + a.id + '\',\'' + esc(a.admin_email) + '\',\'' + esc(a.sppg) + '\',\'' + esc(a.yayasan) + '\')" title="Edit">' +
          '<i class="fas fa-edit"></i>' +
        '</button>' +
        '<button class="btn btn-icon btn-danger-outline" onclick="deleteAdminAssignmentRow(\'' + a.id + '\')" title="Hapus">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
        '</div>' +
      '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

function openEditAdminAssignmentModal(id, adminEmail, sppg, yayasan) {
  $('editAaId').value = id;
  $('editAaEmailDisplay').value = adminEmail;
  var sppgSel = $('editAaSppgInput');
  var sppgList = (dropdownOptions.sppgList && dropdownOptions.sppgList.length) ? dropdownOptions.sppgList : [];
  var opts = '<option value="">-- Pilih SPPG --</option>';
  sppgList.forEach(function(s) { opts += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  sppgSel.innerHTML = opts;
  sppgSel.value = sppg;
  $('editAaYayasanInput').value = yayasan;
  if (!YAYASAN_MASTER.length) loadYayasanMaster();
  openModal('modalEditAdminAssignment');
}

function submitEditAdminAssignment() {
  var id = $('editAaId').value;
  var sppg = $('editAaSppgInput').value;
  var yayasan = $('editAaYayasanInput').value.trim();
  if (!sppg || !yayasan) {
    showToast('error', 'Gagal', 'SPPG dan Yayasan wajib diisi.');
    return;
  }
  showLoading(true);
  callApi('updateAdminAssignment', [id, sppg, yayasan], function(result) {
    showLoading(false);
    if (result.success) {
      showToast('success', 'Berhasil', result.message || 'Assignment berhasil diperbarui.');
      closeModal('modalEditAdminAssignment');
      loadAdminAssignments();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat memperbarui assignment.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat memperbarui assignment: ' + (err.message || ''));
  });
}

function openAddAdminAssignmentModal() {
  $('aaEmailInput').value = '';
  $('aaYayasanInput').value = '';
  var sppgSel = $('aaSppgInput');
  var sppgList = (dropdownOptions.sppgList && dropdownOptions.sppgList.length) ? dropdownOptions.sppgList : [];
  var opts = '<option value="">-- Pilih SPPG --</option>';
  sppgList.forEach(function(s) { opts += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  sppgSel.innerHTML = opts;
  if (!YAYASAN_MASTER.length) loadYayasanMaster();
  openModal('modalAddAdminAssignment');
}

function submitAddAdminAssignment() {
  var email = $('aaEmailInput').value.trim();
  var sppg = $('aaSppgInput').value;
  var yayasan = $('aaYayasanInput').value.trim();
  if (!email || !sppg || !yayasan) {
    showToast('error', 'Gagal', 'Email admin, SPPG, dan Yayasan wajib diisi.');
    return;
  }
  showLoading(true);
  callApi('addAdminAssignment', [email, sppg, yayasan], function(result) {
    showLoading(false);
    if (result.success) {
      showToast('success', 'Berhasil', result.message || 'Assignment berhasil ditambahkan.');
      closeModal('modalAddAdminAssignment');
      $('adminAssignmentEmailInput').value = email;
      loadAdminAssignments();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat menambahkan assignment.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat menambahkan assignment: ' + (err.message || ''));
  });
}

function deleteAdminAssignmentRow(assignmentId) {
  if (!confirm('Hapus assignment ini? Admin terkait tidak akan bisa lagi mengakses data SPPG/Yayasan ini.')) return;
  showLoading(true);
  callApi('deleteAdminAssignment', [assignmentId], function(result) {
    showLoading(false);
    if (result.success) {
      showToast('success', 'Berhasil', result.message || 'Assignment berhasil dihapus.');
      loadAdminAssignments();
    } else {
      showToast('error', 'Gagal', result.message || 'Tidak dapat menghapus assignment.');
    }
  }, function(err) {
    showLoading(false);
    showToast('error', 'Gagal', 'Tidak dapat menghapus assignment: ' + (err.message || ''));
  });
}

// ============================================================
// 18. REKAP
// ============================================================
function openLightbox(src) {
  var isPdf = src && src.toLowerCase().indexOf('.pdf') > -1;
  var imgEl = $('lightboxImage');
  var pdfEl = $('lightboxPdf');
  if (isPdf) {
    pdfEl.src = src;
    pdfEl.classList.remove('hidden');
    imgEl.classList.add('hidden');
    imgEl.src = '';
  } else {
    imgEl.src = src;
    imgEl.classList.remove('hidden');
    pdfEl.classList.add('hidden');
    pdfEl.src = '';
  }
  $('modalLightbox').classList.remove('hidden');
}
function closeLightbox() {
  $('modalLightbox').classList.add('hidden');
  $('lightboxImage').src = '';
  $('lightboxPdf').src = '';
}

function refreshData() {
  var icon = $('refreshIcon');
  var btn  = $('refreshBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  icon.classList.add('fa-spin');

  var done = 0;
  var total = 1;

  function checkDone() {
    done++;
    if (done >= total) {
      icon.classList.remove('fa-spin');
      btn.disabled = false;
      showToast('success', 'Refresh', 'Data diperbarui');
    }
  }

  if (currentPage === 'dashboard') {
    callApi('getDashboardKPI', [], function(result) {
        if (result.success) {
                  $('statSaldo').textContent = formatRupiah(result.saldoBerjalan);
                  $('statPemasukan').textContent = formatRupiah(result.totalPemasukan);
                  $('statPengeluaran').textContent = formatRupiah(result.totalPengeluaran);
                  $('statAntrian').textContent = result.antrianApproval || 0;
                  $('statAntrianNominal').textContent = formatRupiah(result.totalBelumBayar);
                  var cnt2 = result.antrianApproval || 0;
                  var badge = $('approvalCount');
                  if (badge) { badge.textContent = cnt2; badge.style.display = cnt2 > 0 ? 'inline-flex' : 'none'; }
                  var badgeSidebar = $('approvalCountSidebar');
                  if (badgeSidebar) { badgeSidebar.textContent = cnt2; badgeSidebar.style.display = cnt2 > 0 ? 'inline-flex' : 'none'; }
                  syncApprovalBadgeToBottomNav();
                }
                updateChart();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'transaksi') {
    var filters = {};
    callApi('getTransactions', [filters], function(data) {
        allTransactions = data || [];
                filteredTransactions = allTransactions.slice();
                txPage = 1;
                populateSPPGFilter();
                renderTransaksiTable();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'approval') {
    selectedApprovalIds.clear();
    loadApprovalData(1);
    checkDone();

  } else if (currentPage === 'master-bahan') {
    callApi('getMasterBahanBaku', [], function(result) {
        if (result.success) {
                  allMasterBB = result.data || [];
                  filteredMasterBB = allMasterBB.slice();
                  bbPage = 1;
                  renderMasterBBTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'master-supplier') {
    callApi('getMasterSupplier', [], function(result) {
        if (result.success) {
                  allSuppliers = result.data || [];
                  supplierPage = 1;
                  renderSupplierTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'survei') {
    callApi('getSurveiBahanBaku', [], function(result) {
        if (result.success) {
                  allSurvei = result.data || [];
                  filteredSurvei = allSurvei.slice();
                populateSurveiFilterOptions();
                  surveiPage = 1;
                  renderSurveiTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'serah-terima') {
    callApi('getSerahTerima', [], function(result) {
        if (result.success) {
                  allSerahTerima = result.data || [];
                  filteredSerahTerima = allSerahTerima.slice();
                  stPage = 1;
                  renderSerahTerimaTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'menu-mbg') {
    callApi('getMenuHarian', [{}], function(result) {
        if (result.success) {
                  allMenuMBG = result.data || [];
                  menuMBGPage = 1;
                  renderMenuMBGTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'pending-payment') {
    callApi('getPendingPayments', [], function(data) {
        allPending = data || [];
                pendingPage = 1;
                renderPendingTable();
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else if (currentPage === 'users') {
    callApi('getAllUsers', [currentUser.role], function(result) {
        if (result.success) {
                  allUsers = result.data || [];
                  usersPage = 1;
                  renderUsersTable();
                }
                checkDone();
      },
      function(err) {
        checkDone();
      }
    );

  } else {
    checkDone();
  }
}

function downloadCSV(rows, headers, filename) {
  if (!rows || !rows.length) { showToast('warning', 'Perhatian', 'Tidak ada data untuk diexport'); return; }
  var csv = '\uFEFF';
  csv += headers.map(function(h){ return '"' + String(h.label).replace(/"/g, '""') + '"'; }).join(';') + '\r\n';
  rows.forEach(function(row){
    csv += headers.map(function(h){
      var val = row[h.key];
      if (val === null || val === undefined) val = '';
      return '"' + String(val).replace(/"/g, '""') + '"';
    }).join(';') + '\r\n';
  });
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  var url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename + '_' + new Date().toISOString().slice(0,10) + '.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('success', 'Export CSV', 'File berhasil diunduh');
}

var _printDatasetOverride = null;

function normalizeApiRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function filterPrintRows(page, rows) {
  rows = Array.isArray(rows) ? rows.slice() : [];
  function val(id) { var el=$(id); return el ? String(el.value||'').trim() : ''; }
  function low(v) { return String(v==null?'':v).toLowerCase(); }
  if (page === 'transaksi') {
    var status=val('txFilterStatus'), search=low(val('txSearchInput'));
    return rows.filter(function(x){
      if (status && status !== 'ALL' && String(x.statusPembayaran||x.status||'') !== status) return false;
      if (search && low((x.kode||'')+' '+(x.item||'')+' '+(x.supplierName||'')+' '+(x.user||'')+' '+(x.sppg||'')).indexOf(search)<0) return false;
      return true;
    });
  }
  if (page === 'master-bahan') {
    var kat=val('bbFilterKategori'), q=low(val('bbSearchInput'));
    return rows.filter(function(x){var k=x['KATEGORI BAHAN BAKU']||x.Kategori||'',t=(x['KODE BAHAN']||'')+' '+(x['NAMA  BAHAN BAKU']||x['NAMA BAHAN BAKU']||'');return(!kat||kat==='ALL'||String(k)===kat)&&(!q||low(t).indexOf(q)>=0);});
  }
  if (page === 'master-supplier') {
    var st=val('supplierFilterStatus'), qs=low(val('supplierSearchInput'));
    return rows.filter(function(x){var status=x.STATUS||x.Status||'',t=(x['NAMA SUPPLIER']||'')+' '+(x['NO WHATSAPP']||'')+' '+(x.EMAIL||'');return(!st||st==='ALL'||String(status)===st)&&(!qs||low(t).indexOf(qs)>=0);});
  }
  if (page === 'survei') {
    var sk=val('surveiFilterKategori'), sq=low(val('surveiSearchInput'));
    return rows.filter(function(x){var k=x['KATEGORI BAHAN BAKU']||x.Kategori||'',t=(x['KODE BAHAN BAKU']||'')+' '+(x['NAMA BAHAN BAKU']||'');return(!sk||sk==='ALL'||String(k)===sk)&&(!sq||low(t).indexOf(sq)>=0);});
  }
  if (page === 'serah-terima') {
    var cond=val('stFilterKondisi'), ss=low(val('stSearchInput'));
    return rows.filter(function(x){var c=x['KONDISI BAHAN BAKU']||x.Kondisi||'',t=(x['NAMA BAHAN BAKU']||'')+' '+(x.PENERIMA||'')+' '+(x.SUPPLIER||'');return(!cond||cond==='ALL'||String(c)===cond)&&(!ss||low(t).indexOf(ss)>=0);});
  }
  if (page === 'users') {
    var ur=val('usersFilterRole'), us=val('usersFilterSPPG'), uq=low(val('usersSearchInput'));
    return rows.filter(function(x){var t=(x.namaLengkap||'')+' '+(x.username||'')+' '+(x.email||'');return(!ur||ur==='ALL'||String(x.role||'')===ur)&&(!us||us==='ALL'||String(x.sppg||'')===us)&&(!uq||low(t).indexOf(uq)>=0);});
  }
  return rows;
}

function preparePrintDataset(done) {
  var map={
    'approval':['getTransactions',[{approvalOnly:true,exportAll:true,search:$('apprSearchInput')?$('apprSearchInput').value.trim():'',sppg:($('apprFilterSPPG')&&$('apprFilterSPPG').value!=='ALL')?$('apprFilterSPPG').value:'',jenisKategori:($('apprFilterJenisKat')&&$('apprFilterJenisKat').value!=='ALL')?$('apprFilterJenisKat').value:'',supplier:($('apprFilterSupplier')&&$('apprFilterSupplier').value!=='ALL')?$('apprFilterSupplier').value:'',kelengkapan:($('apprFilterKelengkapan')&&$('apprFilterKelengkapan').value!=='ALL')?$('apprFilterKelengkapan').value:'',dateStart:$('apprFilterTglStart')?$('apprFilterTglStart').value:'',dateEnd:$('apprFilterTglEnd')?$('apprFilterTglEnd').value:''}]],
    'transaksi':['getTransactions',[{sppgFilter:($('txFilterSPPG')&&$('txFilterSPPG').value!=='ALL')?$('txFilterSPPG').value:'',kategoriFilter:($('txFilterKategori')&&$('txFilterKategori').value!=='ALL')?$('txFilterKategori').value:'',dateStart:$('txFilterTglStart')?$('txFilterTglStart').value:'',dateEnd:$('txFilterTglEnd')?$('txFilterTglEnd').value:''}]],
    'master-bahan':['getMasterBahanBaku',[]],
    'master-supplier':['getMasterSupplier',[]],
    'survei':['getSurveiBahanBaku',[]],
    'serah-terima':['getSerahTerima',[]],
    'menu-mbg':['getMenuHarian',[{}]],
    'pending-payment':['getPendingPayments',[]],
    'users':['getAllUsers',[]]
  };
  var spec=map[currentPage];
  if(!spec){done(null);return;}
  showLoading(true);
  callApi(spec[0],spec[1],function(result){showLoading(false);done(filterPrintRows(currentPage,normalizeApiRows(result)));},function(){showLoading(false);showToast('error','Gagal','Tidak dapat mengambil seluruh data untuk dicetak');done(null);});
}

function printData(defaultRows) {
  return Array.isArray(_printDatasetOverride) ? _printDatasetOverride : (defaultRows || []);
}

function printCurrentPage() {
  if (!currentPage) return;
  if (currentPage === 'transaksi') {
    exportTransactions('pdf');
    return;
  }
  if (currentPage === 'approval') {
    preparePrintDataset(function(rows) {
      if (rows === null) return;
      exportApprovalReportPDF(rows, 'Laporan Approval Transaksi');
    });
    return;
  }
  var runPrint = function() {
  if (!currentPage) return;
  var originalTitle = document.title;
  var pageTitleText = $('pageTitle').textContent || 'SPPG';
  document.title = pageTitleText + ' - ' + (currentUser ? currentUser.namaLengkap : 'Print');

  // Dashboard & Profil: pakai print normal (cetak konten halaman apa adanya)
  var normalPrintPages = ['dashboard', 'profil'];
  if (normalPrintPages.indexOf(currentPage) > -1) {
    setTimeout(function() {
      window.print();
      document.title = originalTitle;
    }, 250);
    return;
  }

  // Print SEMUA data hasil filter (bukan hanya halaman aktif)
  var printBody = $('printAllBody');
  var printAllMeta = $('printAllMeta');
  if (!printBody) { window.print(); document.title = originalTitle; return; }

  var now = new Date();
  var dateStr = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  var timeStr = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  var filterInfo = getActiveFilterInfo();
  printAllMeta.textContent = 'Dicetak oleh: ' +
    (currentUser ? currentUser.namaLengkap + ' (' + currentUser.role + ')' : '-') +
    ' | Tanggal: ' + dateStr + ' ' + timeStr + ' | Halaman: ' + pageTitleText +
    (filterInfo ? ' | Filter: ' + filterInfo : '');

  var pm = $('printMeta');
  if (pm) pm.textContent = printAllMeta.textContent;

  printBody.innerHTML = buildPrintAllTable();

  document.body.classList.add('printing-all');
  setTimeout(function() {
    window.print();
    document.body.classList.remove('printing-all');
    document.title = originalTitle;
  }, 300);
  };
  var normalPrintPages = ['dashboard','profil'];
  if (normalPrintPages.indexOf(currentPage) > -1) { runPrint(); return; }
  preparePrintDataset(function(rows) {
    if (rows === null) return;
    _printDatasetOverride = rows;
    try { runPrint(); }
    finally { setTimeout(function(){ _printDatasetOverride = null; }, 1200); }
  });
}

function getActiveFilterInfo() {
  var info = [];
  if (currentPage === 'transaksi') {
    if ($('txFilterSPPG').value !== 'ALL') info.push('SPPG=' + $('txFilterSPPG').value);
    if ($('txFilterKategori').value !== 'ALL') info.push('Kat=' + $('txFilterKategori').value);
    if ($('txFilterStatus').value !== 'ALL') info.push('Status=' + $('txFilterStatus').value);
    if ($('txFilterTglStart') && $('txFilterTglStart').value) info.push('Dari=' + $('txFilterTglStart').value);
    if ($('txFilterTglEnd') && $('txFilterTglEnd').value) info.push('Sampai=' + $('txFilterTglEnd').value);
    if ($('txSearchInput').value.trim()) info.push('Cari=' + $('txSearchInput').value.trim());
  }
  if (currentPage === 'master-bahan') {
    if ($('bbFilterKategori').value !== 'ALL') info.push('Kat=' + $('bbFilterKategori').value);
    if ($('bbSearchInput').value.trim()) info.push('Cari=' + $('bbSearchInput').value.trim());
  }
  if (currentPage === 'approval') {
    if ($('apprFilterSPPG') && $('apprFilterSPPG').value !== 'ALL') info.push('SPPG=' + $('apprFilterSPPG').value);
    if ($('apprFilterJenisKat') && $('apprFilterJenisKat').value !== 'ALL') info.push('Jenis Kategori=' + $('apprFilterJenisKat').value);
    if ($('apprFilterSupplier') && $('apprFilterSupplier').value !== 'ALL') info.push('Supplier=' + $('apprFilterSupplier').value);
    if ($('apprFilterKelengkapan') && $('apprFilterKelengkapan').value !== 'ALL') info.push('Kelengkapan=' + $('apprFilterKelengkapan').value);
    if ($('apprFilterTglStart') && $('apprFilterTglStart').value) info.push('Dari=' + $('apprFilterTglStart').value);
    if ($('apprFilterTglEnd') && $('apprFilterTglEnd').value) info.push('Sampai=' + $('apprFilterTglEnd').value);
    if ($('apprSearchInput') && $('apprSearchInput').value.trim()) info.push('Cari=' + $('apprSearchInput').value.trim());
  }
  return info.length ? info.join(', ') : '';
}

function buildPrintAllTable() {
  var html = '';
  if (currentPage === 'transaksi') {
    var data = printData(filteredTransactions);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' transaksi</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Tanggal</th><th>Kategori</th><th>SPPG</th><th>Item</th><th>Supplier / Penjual</th><th>Rekening Penerima</th><th>Nominal</th><th>Metode</th><th>Penginput</th></tr></thead><tbody>';
    data.forEach(function(tx, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(tx.kode||'-') + '</td><td>' + esc(tx.tanggal||'-') + '</td><td>' + esc(tx.kategori||'-') + '</td><td>' + esc(tx.sppg||'-') + '</td><td>' + esc(tx.item||'-') + '</td><td>' + esc(tx.supplierName||'-') + '</td><td>' + esc(((tx.supplierBankName||'-') + ' - ' + (tx.supplierAccountNumber||'-') + ' a.n ' + (tx.supplierAccountHolder||'-'))) + '</td><td>' + formatRupiah(tx.nominal) + '</td><td>' + esc(tx.metodeTransaksi||'-') + '</td><td>' + esc(tx.user||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'master-bahan') {
    var data = printData(filteredMasterBB);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' bahan baku</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Kategori</th><th>Nama</th><th>Harga</th><th>Satuan</th><th>Supplier</th></tr></thead><tbody>';
    data.forEach(function(b, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(b['KODE BAHAN']||b['Kode Bahan']||'-') + '</td><td>' + esc(b['KATEGORI BAHAN BAKU']||b['Kategori']||'-') + '</td><td>' + esc(b['NAMA  BAHAN BAKU']||b['NAMA BAHAN BAKU']||b['Nama Bahan Baku']||'-') + '</td><td>' + formatRupiah(b['HARGA BAHAN BAKU']||b['Harga']||0) + '</td><td>' + esc(b['SATUAN']||b['Satuan']||'-') + '</td><td>' + esc(b['SUPPLIER']||b['Supplier']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'master-supplier') {
    var data = printData(allSuppliers);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' supplier</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Nama</th><th>WA</th><th>Email</th><th>Alamat</th><th>Bank</th><th>No. Rekening</th><th>Atas Nama</th><th>Item</th><th>Status</th></tr></thead><tbody>';
    data.forEach(function(s, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(s['NAMA SUPPLIER']||s['Nama Supplier']||'-') + '</td><td>' + esc(s['NO WHATSAPP']||s['No WhatsApp']||'-') + '</td><td>' + esc(s['EMAIL']||s['Email']||'-') + '</td><td>' + esc(s['ALAMAT TOKO']||s['Alamat']||'-') + '</td><td>' + esc(s['NAMA BANK']||'-') + '</td><td>' + esc(s['NO REKENING']||'-') + '</td><td>' + esc(s['ATAS NAMA REKENING']||'-') + '</td><td>' + esc(Array.isArray(s['ITEM YANG DIJUAL'])?s['ITEM YANG DIJUAL'].join(', '):'-') + '</td><td>' + esc(s['STATUS']||s['Status']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'survei') {
    var data = printData(allSurvei);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' survei</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Waktu</th><th>Kategori</th><th>Nama</th><th>Harga RAB</th><th>Harga Pasar</th><th>Lokasi</th><th>User</th></tr></thead><tbody>';
    data.forEach(function(s, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(s['KODE BAHAN BAKU']||s['Kode Bahan Baku']||'-') + '</td><td>' + esc(s['WAKTU SURVEI']||s['Waktu Survei']||'-') + '</td><td>' + esc(s['KATEGORI BAHAN BAKU']||s['Kategori']||'-') + '</td><td>' + esc(s['NAMA BAHAN BAKU']||s['Nama Bahan Baku']||'-') + '</td><td>' + formatRupiah(s['HARGA RAB']||s['Harga RAB']||0) + '</td><td>' + formatRupiah(s['HARGA PASAR']||s['Harga Pasar']||0) + '</td><td>' + esc(s['LOKASI SURVEI']||s['Lokasi Survei']||'-') + '</td><td>' + esc(s['USER']||s['User']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'serah-terima') {
    var data = printData(allSerahTerima);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' serah terima</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Nama Bahan</th><th>Penerima</th><th>Supplier</th><th>Kondisi</th><th>Lokasi</th><th>User</th></tr></thead><tbody>';
    data.forEach(function(s, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(s['KODE BAHAN BAKU']||s['Kode Bahan']||'-') + '</td><td>' + esc(s['NAMA BAHAN BAKU']||s['Nama Bahan Baku']||'-') + '</td><td>' + esc(s['PENERIMA']||s['Penerima']||'-') + '</td><td>' + esc(s['SUPPLIER']||s['Supplier']||'-') + '</td><td>' + esc(s['KONDISI BAHAN BAKU']||s['Kondisi']||'-') + '</td><td>' + esc(s['LOKASI']||s['Lokasi']||'-') + '</td><td>' + esc(s['USER']||s['User']||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'menu-mbg') {
    var data = printData(allMenuMBG);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' menu</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Tanggal</th><th>Jumlah KPM</th><th>Menu</th><th>Detail Item</th></tr></thead><tbody>';
    data.forEach(function(m, i) {
      var detail = (m.detail && m.detail.length) ? m.detail.map(function(d){ return esc(d.namaItem) + ' (' + d.jumlah + ' ' + esc(d.satuan) + ')'; }).join(', ') : '-';
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(m.tanggal) + '</td><td>' + (m.jumlahKpm||0) + '</td><td>' + esc(m.menu) + '</td><td>' + detail + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'pending-payment') {
    var data = printData(allPending);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' pending</strong></div>';
    html += '<table><thead><tr><th>No</th><th>ID</th><th>Transaksi</th><th>Deskripsi</th><th>Tgl Pending</th><th>Status</th><th>Tgl Lunas</th></tr></thead><tbody>';
    data.forEach(function(p, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(p.id) + '</td><td>' + esc(p.transaksiRef||'-') + '</td><td>' + esc(p.deskripsi||'-') + '</td><td>' + esc(p.tanggalPending||'-') + '</td><td>' + esc(p.status||'HUTANG') + '</td><td>' + esc(p.tanggalLunas||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'users') {
    var data = printData(allUsers);
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' users</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Nama</th><th>Email</th><th>Jabatan</th><th>SPPG</th><th>Username</th></tr></thead><tbody>';
    data.forEach(function(u, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(u.namaLengkap||'-') + '</td><td>' + esc(u.email||'-') + '</td><td>' + esc(u.jabatan||'-') + '</td><td>' + esc(u.sppg||'-') + '</td><td>' + esc(u.username||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  else if (currentPage === 'approval') {
    var data = filteredApprovalData || [];
    html += '<div style="margin-bottom:12px;font-size:11px;"><strong>Total Data: ' + data.length + ' menunggu approval</strong></div>';
    html += '<table><thead><tr><th>No</th><th>Kode</th><th>Tanggal</th><th>SPPG</th><th>Item</th><th>Supplier / Penjual</th><th>Rekening Penerima</th><th>Nominal</th><th>Metode</th><th>Penginput</th></tr></thead><tbody>';
    data.forEach(function(tx, i) {
      html += '<tr><td>' + (i+1) + '</td><td>' + esc(tx.kode||'-') + '</td><td>' + esc(tx.tanggal||'-') + '</td><td>' + esc(tx.sppg||'-') + '</td><td>' + esc(tx.item||'-') + '</td><td>' + esc(tx.supplierName||'-') + '</td><td>' + esc(((tx.supplierBankName||'-') + ' - ' + (tx.supplierAccountNumber||'-') + ' a.n ' + (tx.supplierAccountHolder||'-'))) + '</td><td>' + formatRupiah(tx.nominal) + '</td><td>' + esc(tx.metodeTransaksi||'-') + '</td><td>' + esc(tx.user||'-') + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  return html || '<p style="text-align:center;padding:40px;">Tidak ada data.</p>';
}

// ============================================================
// 20. PAGINATION HELPER
// ============================================================
function renderPagination(containerId, currentPageNum, totalPages, callbackName) {
  var container = $(containerId);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  var html = '';
  html += '<button class="page-btn" onclick="' + callbackName + '(' + (currentPageNum - 1) + ')" ' + (currentPageNum === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
  var maxVis = 5, startP = Math.max(1, currentPageNum - Math.floor(maxVis / 2)), endP = Math.min(totalPages, startP + maxVis - 1);
  if (endP - startP + 1 < maxVis) startP = Math.max(1, endP - maxVis + 1);
  if (startP > 1) html += '<button class="page-btn" onclick="' + callbackName + '(1)">1</button><span style="color:var(--slate-400);padding:0 4px;">...</span>';
  for (var i = startP; i <= endP; i++) html += '<button class="page-btn ' + (i === currentPageNum ? 'active' : '') + '" onclick="' + callbackName + '(' + i + ')">' + i + '</button>';
  if (endP < totalPages) html += '<span style="color:var(--slate-400);padding:0 4px;">...</span><button class="page-btn" onclick="' + callbackName + '(' + totalPages + ')">' + totalPages + '</button>';
  html += '<button class="page-btn" onclick="' + callbackName + '(' + (currentPageNum + 1) + ')" ' + (currentPageNum === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
  container.innerHTML = html;
}


// ============================================================
// RECOVERY (LUPA PASSWORD / USERNAME / TOKEN)
// ============================================================
var currentRecoveryType = '';

function showRecoveryModal(type) {
  currentRecoveryType = type;
  var title = '';
  var html = '';

  if (type === 'password') {
    title = 'Lupa Kata Sandi';
    html = '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">Masukkan username Anda. Link reset kata sandi akan dikirim ke email yang terdaftar.</p>' +
      '<div class="form-group"><label class="form-label">Username <span class="req">*</span></label><input type="text" id="recUsername" class="form-input" placeholder="Username"></div>';
  } else if (type === 'username') {
    title = 'Lupa Username';
    html = '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">Masukkan email terdaftar Anda. Username dan link reset kata sandi akan dikirim ke email tersebut.</p>' +
      '<div class="form-group"><label class="form-label">Email <span class="req">*</span></label><input type="email" id="recEmail" class="form-input" placeholder="...@gmail.com"></div>';
  } else if (type === 'token') {
    title = 'Fitur Tidak Tersedia';
    html = '<p style="font-size:13px;color:var(--slate-500);margin-bottom:16px;">Fitur token login sudah tidak digunakan pada sistem saat ini. Silakan gunakan menu "Lupa Password" untuk reset kata sandi via email.</p>';
  }

  document.getElementById('recoveryTitle').textContent = title;
  document.getElementById('recoveryBody').innerHTML = html + '<div id="recoveryError" class="form-error" style="margin-top:10px;"><i class="fas fa-exclamation-circle"></i><span></span></div>';
  var submitBtn = document.getElementById('btnRecoverySubmit');
  if (submitBtn) submitBtn.style.display = (type === 'token') ? 'none' : '';
  openModal('modalRecovery');
}

function submitRecovery() {
  var errorEl = $('recoveryError');
  errorEl.classList.remove('show');

  // "token" mode sudah tidak fungsional di backend — tombol Verifikasi disembunyikan untuk mode ini.
  if (currentRecoveryType === 'token') {
    return;
  }

  var btn = $('btnRecoverySubmit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Memverifikasi...';

  var data = {};

  if (currentRecoveryType === 'password') {
    data = { username: $('recUsername').value.trim() };
    if (!data.username) {
      errorEl.querySelector('span').textContent = 'Username wajib diisi.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.innerHTML = 'Verifikasi';
      return;
    }
  } else if (currentRecoveryType === 'username') {
    data = { email: $('recEmail').value.trim() };
    if (!data.email) {
      errorEl.querySelector('span').textContent = 'Email wajib diisi.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.innerHTML = 'Verifikasi';
      return;
    }
  }

  var backendFn = currentRecoveryType === 'password' ? 'recoverPassword' : 'recoverUsername';

    callApi(backendFn, [data], function(result) {
        btn.disabled = false;
              btn.innerHTML = 'Verifikasi';
              if (result.success) {
                closeModal('modalRecovery');
                showToast('success', 'Berhasil', result.message || 'Silakan cek email Anda.');
              } else {
                errorEl.querySelector('span').textContent = result.message || 'Verifikasi gagal.';
                errorEl.classList.add('show');
              }
      },
      function(err) {
        btn.disabled = false;
              btn.innerHTML = 'Verifikasi';
              errorEl.querySelector('span').textContent = 'Terjadi kesalahan sistem.';
              errorEl.classList.add('show');
      }
    );
}

// ============================================================
// MOBILE UX: Swipe Sidebar, Back Button Android, iframe Resize
// ============================================================
(function() {
  // --- iframe ResizeObserver: kirim tinggi konten ke parent (Google Sites) ---
  function sendHeight() {
    var h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    try { window.parent.postMessage({ type: 'iframeResize', height: h }, '*'); } catch(e) {}
  }
  if (window.ResizeObserver) {
    new ResizeObserver(sendHeight).observe(document.body);
  } else {
    window.addEventListener('resize', sendHeight);
    setInterval(sendHeight, 1000);
  }
  sendHeight();

  // --- Swipe gesture untuk buka/tutup sidebar di mobile ---
  var _swipeStartX = 0, _swipeStartY = 0, _swipeActive = false;
  var SWIPE_THRESHOLD = 60, SWIPE_EDGE = 24;

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
    _swipeActive = true;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!_swipeActive) return;
    _swipeActive = false;
    var dx = e.changedTouches[0].clientX - _swipeStartX;
    var dy = e.changedTouches[0].clientY - _swipeStartY;
    if (Math.abs(dy) > Math.abs(dx) * 1.5) return; // vertikal dominan, skip
    var sidebar = document.getElementById('mainSidebar');
    if (!sidebar) return;
    var isOpen = sidebar.classList.contains('mobile-open');
    // Swipe kanan dari edge kiri: buka sidebar
    if (!isOpen && _swipeStartX < SWIPE_EDGE && dx > SWIPE_THRESHOLD) {
      if (window.innerWidth < 768) openMobileSidebar();
    }
    // Swipe kiri saat sidebar terbuka: tutup
    if (isOpen && dx < -SWIPE_THRESHOLD) {
      closeMobileSidebar();
    }
  }, { passive: true });

  // --- Android back button: tutup modal/sidebar yang terbuka ---
  window.addEventListener('popstate', function() {
    // Tutup modal yang terbuka
    var openModal = document.querySelector('.modal-overlay:not(.hidden)');
    if (openModal) {
      var modalWrap = openModal.closest('[id]');
      if (modalWrap) { closeModal(modalWrap.id); history.pushState(null, '', location.href); return; }
    }
    // Tutup lightbox
    if (!document.getElementById('modalLightbox').classList.contains('hidden')) {
      closeLightbox(); history.pushState(null, '', location.href); return;
    }
    // Tutup sidebar mobile
    var sb = document.getElementById('mainSidebar');
    if (sb && sb.classList.contains('mobile-open')) {
      closeMobileSidebar(); history.pushState(null, '', location.href); return;
    }
  });
  // Push state awal agar back button bisa ditangkap
  history.pushState(null, '', location.href);
})();

// ============================================================
// 20b. MOBILE KEYBOARD UX — Auto-scroll field ke atas keyboard
// ============================================================
(function() {
  // Saat input/select/textarea difokus di dalam modal, scroll agar tidak tertutup keyboard
  function onFocusInModal(e) {
    var target = e.target;
    if (!target) return;
    var tagName = target.tagName.toLowerCase();
    if (!['input', 'textarea', 'select'].includes(tagName)) return;

    // Cek apakah di dalam modal
    var modalBody = target.closest('.modal-body');
    if (!modalBody) return;

    // Delay kecil agar keyboard sudah muncul
    setTimeout(function() {
      // Scroll element agar terlihat, dengan offset ekstra untuk footer
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch(e) {
        target.scrollIntoView(false);
      }
    }, 350);
  }

  // Visual Viewport API — hanya scroll field aktif ke tengah, tidak ubah layout
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      // Scroll field yang sedang aktif ke posisi terlihat
      var focused = document.activeElement;
      if (!focused) return;
      var tag = focused.tagName.toLowerCase();
      if (!['input','textarea','select'].includes(tag)) return;
      var modalBody = focused.closest('.modal-body');
      if (!modalBody) return;
      setTimeout(function() {
        try { focused.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      }, 100);
    });
  }

  // Tambahkan listener fokus ke semua modal
  document.addEventListener('focusin', onFocusInModal, true);
})();

  // ============================================================
  // PWA — Install Prompt & Service Worker Registration
  // ============================================================
  var _pwaInstallEvent = null;
  var _pwaInstalled = false;
  var _pushSubscriptionSynced = false;
  var _pwaGateBusy = false;

  function isStandalonePWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0;
  }

  function getInstallHelpText() {
    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isAndroid = /android/i.test(ua);
    if (isIOS) return 'iPhone/iPad: buka lewat Safari, ketuk Bagikan (⬆), pilih “Tambahkan ke Layar Utama”, lalu buka SIM-SPPG dari ikon baru.';
    if (isAndroid) return 'Android: ketuk Instal Aplikasi. Jika prompt tidak muncul, buka menu ⋮ Chrome lalu pilih “Instal aplikasi”.';
    return 'Komputer: klik Instal Aplikasi. Jika prompt tidak muncul, gunakan ikon instal di sisi kanan address bar Chrome/Edge.';
  }

  function getNotificationHelpText() {
    if (!('Notification' in window) || !('PushManager' in window)) {
      return 'Perangkat atau browser ini tidak mendukung Web Push. Gunakan Chrome/Edge terbaru atau Safari melalui PWA di iPhone/iPad.';
    }
    if (Notification.permission === 'denied') {
      return 'Izin notifikasi sudah diblokir. Buka pengaturan aplikasi/browser SIM-SPPG, ubah Notifikasi menjadi Izinkan, lalu tekan Periksa Lagi.';
    }
    return 'Ketuk Aktifkan Notifikasi lalu pilih Izinkan pada dialog resmi perangkat.';
  }

  function updatePwaRequirementGate() {
    var gate = document.getElementById('pwaRequirementGate');
    if (!gate || !currentUser) {
      if (gate) gate.classList.add('hidden');
      return;
    }
    var installed = isStandalonePWA();
    var notificationSupported = 'Notification' in window && 'PushManager' in window;
    var notificationGranted = notificationSupported && Notification.permission === 'granted';
    // Izin browser adalah sumber kebenaran untuk UI. Sinkronisasi subscription
    // dilanjutkan diam-diam ke backend dan tidak boleh memblokir refresh.
    var ready = installed && notificationGranted;
    gate.classList.toggle('hidden', ready);

    var installStep = document.getElementById('pwaInstallStep');
    var notifStep = document.getElementById('pwaNotificationStep');
    var installStatus = document.getElementById('pwaInstallStatus');
    var notifStatus = document.getElementById('pwaNotificationStatus');
    if (installStep) installStep.classList.toggle('complete', installed);
    if (notifStep) notifStep.classList.toggle('complete', notificationGranted);
    if (installStatus) installStatus.textContent = installed ? 'Terpasang' : 'Wajib';
    if (notifStatus) {
      notifStatus.textContent = !notificationSupported ? 'Tidak didukung' :
        (Notification.permission === 'denied' ? 'Diblokir' :
          (notificationGranted ? 'Aktif' : 'Wajib'));
    }

    var button = document.getElementById('pwaGatePrimaryButton');
    var help = document.getElementById('pwaGateHelp');
    if (!button || !help) return;
    button.disabled = _pwaGateBusy;
    if (!installed) {
      button.innerHTML = '<i class="fas fa-download"></i><span>Instal Aplikasi</span>';
      help.textContent = getInstallHelpText();
    } else if (!notificationSupported || Notification.permission === 'denied') {
      button.innerHTML = '<i class="fas fa-cog"></i><span>Aktifkan dari Pengaturan Perangkat</span>';
      help.textContent = getNotificationHelpText();
    } else if (!notificationGranted) {
      button.innerHTML = '<i class="fas fa-bell"></i><span>Aktifkan Notifikasi</span>';
      help.textContent = getNotificationHelpText();
    } else {
      button.innerHTML = '<i class="fas fa-check-circle"></i><span>Notifikasi Aktif</span>';
      help.textContent = 'Perangkat memenuhi persyaratan. Sinkronisasi penerima notifikasi berjalan otomatis.';
    }
  }

  function handlePwaGatePrimary() {
    if (_pwaGateBusy) return;
    if (!isStandalonePWA()) {
      triggerPWAInstall();
      return;
    }
    if (!('Notification' in window) || !('PushManager' in window) || Notification.permission === 'denied') {
      updatePwaRequirementGate();
      return;
    }
    promptEnablePushNotification();
  }

  function recheckPwaRequirements() {
    _pwaInstalled = isStandalonePWA();
    _pushSubscriptionSynced = false;
    updatePwaRequirementGate();
    if (_swRegistration && currentUser) initPushNotification();
  }

  // Tangkap event beforeinstallprompt (Chrome/Edge/Android)
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _pwaInstallEvent = e;
    // Tampilkan tombol install hanya jika belum terinstall
    if (!_pwaInstalled) {
      var btn = document.getElementById('btnInstallPWA');
      if (btn) btn.classList.add('show');
    }
  });

  // Deteksi jika sudah berjalan sebagai PWA standalone
  (function() {
    var isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0;
    if (isStandalone) {
      _pwaInstalled = true;
      var btn = document.getElementById('btnInstallPWA');
      if (btn) btn.classList.remove('show');
    }
  })();

  // Setelah install berhasil, sembunyikan tombol
  window.addEventListener('appinstalled', function() {
    _pwaInstalled = true;
    var btn = document.getElementById('btnInstallPWA');
    if (btn) btn.classList.remove('show');
    showToast('success', 'Berhasil Diinstall!', 'SIM-SPPG kini dapat dibuka seperti aplikasi native.');
    _pwaInstallEvent = null;
    updatePwaRequirementGate();
  });

  function triggerPWAInstall() {
    if (_pwaInstallEvent) {
      _pwaInstallEvent.prompt();
      _pwaInstallEvent.userChoice.then(function(result) {
        if (result.outcome === 'accepted') {
          showToast('success', 'Aplikasi Terpasang', 'Buka SIM-SPPG dari ikon layar utama untuk melanjutkan.');
        } else {
          showToast('warning', 'Dibatalkan', 'Install dibatalkan. Kamu bisa install kapan saja.');
        }
        _pwaInstallEvent = null;
        var btn = document.getElementById('btnInstallPWA');
        if (btn) btn.classList.remove('show');
        updatePwaRequirementGate();
      });
    } else {
      // Fallback manual untuk iOS Safari & browser lain yang tidak support prompt
      showIOSInstallGuide();
    }
  }

  function showIOSInstallGuide() {
    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    var isAndroid = /android/i.test(ua);

    var msg = '';
    if (isIOS && isSafari) {
      msg = 'Di Safari: ketuk ikon Bagikan (⬆️) → pilih "Tambahkan ke Layar Utama" → ketuk Tambahkan.';
    } else if (isAndroid) {
      msg = 'Di Chrome: ketuk menu ⋮ → pilih "Tambahkan ke layar utama" atau "Install aplikasi".';
    } else {
      msg = 'Di Chrome Desktop: klik ikon ⊕ di address bar, atau menu ⋮ → "Install SIM-SPPG".';
    }

    // Tampilkan sebagai toast informatif
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = '#3b82f6';
    toast.innerHTML =
      '<div class="toast-icon" style="background:#dbeafe;color:#1e40af;"><i class="fas fa-mobile-alt"></i></div>' +
      '<div class="toast-content">' +
        '<h4>Cara Install Manual</h4>' +
        '<p style="font-size:11px;line-height:1.5;">' + msg + '</p>' +
      '</div>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 8000); // tampilkan lebih lama karena instruksi panjang
  }

  // Register Service Worker (file statis /sw.js — WAJIB file nyata, bukan
  // Blob URL, supaya push notification bisa diterima walau app tertutup,
  // dan supaya aplikasi bisa di-install sebagai PWA oleh browser).
  var _swRegistration = null;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./sw.js')
        .then(function(reg) {
          return reg.update().catch(function() { return reg; }).then(function() {
            return navigator.serviceWorker.ready;
          });
        })
        .then(function(reg) {
          _swRegistration = reg;
          updatePwaRequirementGate();
          if (currentUser) initPushNotification();
        })
        .catch(function(err) {
          console.error('Service worker registration gagal:', err);
        });
    });
  }

  // ============================================================
  // PUSH NOTIFICATION — aktivasi izin, subscribe, kirim ke backend
  // ============================================================
  var PUBLIC_VAPID_KEY = null; // diisi dari backend saat initPushNotification()

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function deviceLabel() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone/iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Macintosh/.test(ua)) return 'Mac';
    return 'Browser';
  }

  function sendSubscriptionToServer(subscriptionJson) {
    if (!currentUser) return;
    callApi('savePushSubscription', [subscriptionJson, deviceLabel()], function(result) {
      _pushSubscriptionSynced = !!(result && result.success);
      _pwaGateBusy = false;
      updatePwaRequirementGate();
    }, function(err) {
      _pushSubscriptionSynced = false;
      _pwaGateBusy = false;
      updatePwaRequirementGate();
      console.error('Gagal simpan push subscription:', err);
    });
  }

  function updatePushButtonUI() {
    var btn = document.getElementById('btnEnablePush');
    if (!btn) return;
    if (!('Notification' in window) || !('PushManager' in window)) {
      btn.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'granted') {
      btn.classList.add('hidden'); // sudah aktif, sembunyikan tombol
    } else {
      btn.classList.remove('hidden'); // 'default' atau 'denied' — tampilkan supaya user bisa aksi
    }
  }

  function initPushNotification() {
    updatePushButtonUI();
    updatePwaRequirementGate();
    if (!_swRegistration || !('PushManager' in window) || !currentUser) return;

    // Ambil VAPID public key dari backend (sekali per sesi)
    callApi('getPushPublicKey', [], function(result) {
      if (!result || !result.success || !result.data || !result.data.publicKey) return;
      PUBLIC_VAPID_KEY = result.data.publicKey;

      // Cek subscription yang sudah ada
      _swRegistration.pushManager.getSubscription().then(function(existingSub) {
        if (existingSub) {
          sendSubscriptionToServer(existingSub.toJSON());
          return;
        }
        // Belum ada subscription — minta izin & subscribe
        if (Notification.permission === 'granted') {
          subscribeUserToPush();
        }
        // Jika permission masih 'default', tunggu user klik tombol aktifkan
        // notifikasi (lihat promptEnablePushNotification()) agar tidak
        // langsung memunculkan dialog izin tanpa konteks.
      });
    }, null);
  }

  function subscribeUserToPush() {
    if (!_swRegistration || !PUBLIC_VAPID_KEY) {
      _pwaGateBusy = false;
      updatePwaRequirementGate();
      return;
    }
    _pwaGateBusy = true;
    updatePwaRequirementGate();
    _swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    }).then(function(sub) {
      sendSubscriptionToServer(sub.toJSON());
      updatePushButtonUI();
      showToast('success', 'Notifikasi Aktif', 'Anda akan menerima notifikasi push di perangkat ini.');
    }).catch(function(err) {
      _pushSubscriptionSynced = false;
      _pwaGateBusy = false;
      console.error('Gagal subscribe push:', err);
      updatePushButtonUI();
      updatePwaRequirementGate();
    });
  }

  // Dipanggil dari tombol UI (lonceng / pengaturan) untuk meminta izin secara eksplisit
  function promptEnablePushNotification() {
    if (!('Notification' in window)) {
      showToast('warning', 'Tidak Didukung', 'Browser ini tidak mendukung notifikasi push.');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('warning', 'Izin Diblokir', 'Aktifkan izin notifikasi lewat pengaturan browser/aplikasi Anda.');
      return;
    }
    if (Notification.permission === 'granted') {
      subscribeUserToPush();
      return;
    }
    Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        subscribeUserToPush();
      } else {
        showToast('warning', 'Izin Ditolak', 'Anda tidak akan menerima notifikasi push.');
      }
      updatePushButtonUI();
      updatePwaRequirementGate();
    });
  }
 
  // ============================================================
  // SUARA NOTIFIKASI (untuk saat app sedang dibuka — lonceng in-app)
  // ============================================================
  var _notifAudioCtx = null;
  function playNotifSound() {
    try {
      if (!_notifAudioCtx) {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        _notifAudioCtx = new AudioCtx();
      }
      var ctx = _notifAudioCtx;
      var now = ctx.currentTime;
      [880, 1108].forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.3);
      });
    } catch (e) { /* noop jika browser blokir autoplay audio */ }
  }

  document.addEventListener('DOMContentLoaded', function() {
    var lpwd = document.getElementById('loginPassword');
    if (lpwd) lpwd.addEventListener('keypress', function(e) { if (e.key === 'Enter') doLogin(); });
  });

  document.addEventListener('click', function(e) {
    var boxes = document.querySelectorAll('.autocomplete-box');
    boxes.forEach(function(box) {
      if (!box.contains(e.target)) {
        var dd = box.querySelector('.autocomplete-dropdown');
        if (dd) {
          dd.classList.remove('active');
          var combobox = box.querySelector('[role="combobox"]');
          if (combobox) combobox.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });

  try {
    if (safeStorage('get', 'sidebarCollapsed') === '1') {
      sidebarCollapsed = true;
      document.getElementById('mainSidebar').classList.add('collapsed');
      document.getElementById('mainWrapper').classList.add('sidebar-collapsed');
    }
  } catch(e) {}

  document.body.style.overflow = '';
  document.body.style.position = '';

  var hasActiveSession = checkSession();
  var bootstrapLoading = document.getElementById('appLoadingOverlay');
  if (hasActiveSession) {
    if (bootstrapLoading) bootstrapLoading.classList.remove('hidden');
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.documentElement.classList.remove('auth-pending');
    initApp();
  } else {
    if (bootstrapLoading) bootstrapLoading.classList.add('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('authOverlay').classList.remove('hidden');
    document.documentElement.classList.remove('auth-pending');
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeLightbox();
      // Tutup modal teratas yang sedang terbuka (selain lightbox, yang sudah ditangani di atas)
      var openModals = document.querySelectorAll('[id^="modal"]:not(.hidden)');
      if (openModals.length > 0) {
        var topModal = openModals[openModals.length - 1];
        closeModal(topModal.id);
      }
    }
  });

/* ===== INLINE MODULE 3 ===== */
/* ===== INLINE: app.js ===== */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.id = 'sim-sppg-runtime-fixes';
  style.textContent = [
    '.auth-container .auth-sub{color:var(--slate-400);font-size:13px;margin-bottom:24px;text-align:center;line-height:1.5}',
    '#btnLogin{touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:46px}',
    '.stat-card{background:#fff;border-radius:20px;padding:18px 16px;display:flex;flex-direction:column;align-items:center;text-align:center}',
    '.stat-icon{width:56px;height:56px;min-width:56px;display:flex;align-items:center;justify-content:center}',
    '.notif-item{position:relative;display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--slate-100);background:var(--white);transition:.2s ease;cursor:pointer}',
    '.notif-item:hover,.notif-item:focus-visible{background:var(--slate-50);outline:none}',
    '.notif-item.unread{background:linear-gradient(90deg,#eff8ff 0%,#fff 70%);box-shadow:inset 3px 0 0 var(--primary)}',
    '.notif-item.unread:after{content:"";position:absolute;right:12px;top:15px;width:7px;height:7px;border-radius:50%;background:var(--primary)}',
    '.notif-item-icon{width:40px;height:40px;min-width:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px}',
    '.notif-item-icon.action-add{background:#dcfce7;color:#15803d}.notif-item-icon.action-edit{background:#fef3c7;color:#b45309}.notif-item-icon.action-delete{background:#ffe4e6;color:#be123c}',
    '.notif-item-content{min-width:0;flex:1}.notif-item-head{display:flex;align-items:center;gap:8px;padding-right:14px;margin-bottom:5px}',
    '.notif-item-title{font-weight:700;color:var(--slate-800);font-size:13px;line-height:1.35;flex:1}',
    '.notif-action-chip{font-size:10px;font-weight:800;letter-spacing:.35px;text-transform:uppercase;padding:3px 7px;border-radius:999px;white-space:nowrap}',
    '.notif-action-chip.add{background:#dcfce7;color:#166534}.notif-action-chip.edit{background:#fef3c7;color:#92400e}.notif-action-chip.delete{background:#ffe4e6;color:#9f1239}',
    '.notif-item-desc{font-size:12px;line-height:1.5;color:var(--slate-600);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}',
    '.notif-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:10px;color:var(--slate-400)}.notif-item-meta span{display:inline-flex;align-items:center;gap:4px}.notif-item-arrow{margin-left:auto;color:var(--slate-300)}',
    '.notif-empty{padding:34px 18px;text-align:center;color:var(--slate-400)}.notif-empty i{font-size:28px;margin-bottom:10px}.notif-empty strong{display:block;color:var(--slate-600);font-size:13px;margin-bottom:3px}',
    '@media(max-width:600px){#notifPanel{position:fixed!important;left:10px!important;right:10px!important;top:calc(var(--header-height) + 8px)!important;width:auto!important;max-height:calc(100dvh - var(--header-height) - 24px)!important}.notif-item{padding:13px 14px}.notif-item-icon{width:38px;height:38px;min-width:38px}}'
  ].join('');
  document.head.appendChild(style);

  function setExternalLinkTargets() {
    var currentOrigin = location.origin;
    document.querySelectorAll('a[href]').forEach(function (link) {
      try {
        var url = new URL(link.getAttribute('href'), location.href);
        if (/^(https?:)$/.test(url.protocol) && url.origin !== currentOrigin) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch (_) {}
    });
  }

  function normalizeAllUsersCall() {
    if (typeof window.callApi !== 'function' || window.callApi.__allUsersFixed) return;
    var original = window.callApi;
    function wrapped(action, args) {
      var forwarded = Array.prototype.slice.call(arguments);
      if (action === 'getAllUsers' && (!Array.isArray(args) || args.length === 0)) {
        var role = window.currentUser && window.currentUser.role ? window.currentUser.role : '';
        forwarded[1] = role ? [role] : [];
      }
      return original.apply(this, forwarded);
    }
    wrapped.__allUsersFixed = true;
    window.callApi = wrapped;
  }

  var lastSppgSignature = '';
  function populateSppgDatalist() {
    var datalist = document.getElementById('sppgDatalist');
    if (!datalist || !Array.isArray(window.sppgList)) return;
    var values = window.sppgList.map(function (item) {
      return typeof item === 'string' ? item : (item && (item.SPPG || item.nama || item.name));
    }).filter(Boolean).map(function (value) { return String(value).trim(); });
    var signature = values.join('|');
    if (signature === lastSppgSignature && datalist.options.length === values.length) return;
    lastSppgSignature = signature;
    var fragment = document.createDocumentFragment();
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      fragment.appendChild(option);
    });
    datalist.replaceChildren(fragment);
  }

  function bindMobileLogin() {
    var btn = document.getElementById('btnLogin');
    var username = document.getElementById('loginUsername');
    var password = document.getElementById('loginPassword');
    if (!btn || typeof window.doLogin !== 'function' || btn.dataset.mobileLoginBound === '1') return;
    btn.dataset.mobileLoginBound = '1';
    btn.type = 'button';
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      if (!btn.disabled) window.doLogin();
    });
    [username, password].forEach(function (input) {
      if (!input) return;
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!btn.disabled) window.doLogin();
        }
      });
    });
  }

  function validateEditUserSppg() {
    if (typeof window.saveEditUser !== 'function' || window.saveEditUser.__sppgValidated) return;
    var original = window.saveEditUser;
    function wrapped() {
      var input = document.getElementById('editUserSPPG');
      var value = input ? input.value.trim().toUpperCase() : '';
      var master = Array.isArray(window.SPPG_MASTER) ? window.SPPG_MASTER.map(function (item) { return String(item).trim().toUpperCase(); }) : [];
      if (value && master.length && master.indexOf(value) === -1) {
        if (typeof window.showToast === 'function') window.showToast('warning', 'SPPG Tidak Valid', 'Pilih SPPG dari daftar yang tersedia.');
        if (input) input.focus();
        return;
      }
      return original.apply(this, arguments);
    }
    wrapped.__sppgValidated = true;
    window.saveEditUser = wrapped;
  }

  function fixNominalRaw() {
    if (typeof window.getNominalRaw !== 'function' || window.getNominalRaw.__mobileFixed) return;
    var original = window.getNominalRaw;
    function wrapped(inputOrId) {
      var result = Number(original.apply(this, arguments)) || 0;
      var input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
      if (!input && arguments.length === 0) input = document.getElementById('addTxNominal');
      if (input) {
        var parsed = Number(String(input.value || '').replace(/[^0-9]/g, '')) || 0;
        if (parsed > 0 && result !== parsed) { input.dataset.raw = String(parsed); result = parsed; }
      }
      return result;
    }
    wrapped.__mobileFixed = true;
    window.getNominalRaw = wrapped;
  }

  function resetVerificationMode() { try { verifikasiPembayaranMode = false; } catch (_) {} }
  function syncBodyOverflow() {
    var visibleModal = Array.prototype.some.call(document.querySelectorAll('.modal'), function (modal) {
      return getComputedStyle(modal).display !== 'none' && !modal.classList.contains('hidden');
    });
    document.body.style.overflow = visibleModal ? 'hidden' : '';
    try { _openModalCount = visibleModal ? Math.max(1, Number(_openModalCount) || 0) : 0; } catch (_) {}
  }

  function fixModalLifecycle() {
    if (typeof window.closeModal === 'function' && !window.closeModal.__verificationFixed) {
      var originalClose = window.closeModal;
      window.closeModal = function (id) {
        var modalId = typeof id === 'string' ? id : (id && id.id);
        if (modalId === 'modalPin') resetVerificationMode();
        var result = originalClose.apply(this, arguments);
        requestAnimationFrame(syncBodyOverflow);
        return result;
      };
      window.closeModal.__verificationFixed = true;
    }
  }

  function relativeTime(raw, fallback) {
    if (!raw) return fallback || '-';
    var date = new Date(raw);
    if (isNaN(date.getTime())) return fallback || raw;
    var minutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return minutes + ' menit lalu';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' jam lalu';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + ' hari lalu';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function installNotificationOverride() {
    var panel = document.getElementById('notifPanelList');
    if (!panel || typeof window.$ !== 'function' || !Array.isArray(window.notifList) || typeof window.esc !== 'function') return;
    window.renderNotifPanel = function () {
      var listEl = window.$('notifPanelList');
      if (!listEl) return;
      if (!window.notifList.length) {
        listEl.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><strong>Belum ada notifikasi</strong><p>Aktivitas penting aplikasi akan muncul di sini.</p></div>';
        return;
      }
      listEl.innerHTML = window.notifList.map(function (item, index) {
        var type = item.actionType === 'DELETE' ? ['delete','Dihapus','action-delete'] : item.actionType === 'EDIT' ? ['edit','Diperbarui','action-edit'] : ['add','Baru','action-add'];
        var actor = String(item.pelaku || 'Sistem').trim() || 'Sistem';
        var desc = String(item.deskripsi || '').trim() || ((item.label || 'Aktivitas aplikasi') + ' oleh ' + actor + '.');
        return '<div class="notif-item ' + (item.isRead ? '' : 'unread') + '" onclick="handleNotifClick(' + index + ')" role="button" tabindex="0">' +
          '<div class="notif-item-icon ' + type[2] + '"><i class="fas ' + window.esc(item.icon || 'fa-bell') + '"></i></div>' +
          '<div class="notif-item-content"><div class="notif-item-head"><div class="notif-item-title">' + window.esc(item.label || 'Aktivitas Baru') + '</div><span class="notif-action-chip ' + type[0] + '">' + type[1] + '</span></div>' +
          '<div class="notif-item-desc">' + window.esc(desc) + '</div><div class="notif-item-meta"><span><i class="fas fa-user-circle"></i>' + window.esc(actor) + '</span><span><i class="fas fa-clock"></i>' + window.esc(relativeTime(item.waktuRaw, item.waktu)) + '</span></div></div></div>';
      }).join('');
    };
    window.renderNotifPanel();
  }

  var attempts = 0;
  function installFixes() {
    attempts += 1;
    setExternalLinkTargets();
    normalizeAllUsersCall();
    populateSppgDatalist();
    bindMobileLogin();
    validateEditUserSppg();
    fixNominalRaw();
    fixModalLifecycle();
    installNotificationOverride();
    if (attempts < 40 && (typeof window.callApi !== 'function' || typeof window.doLogin !== 'function')) setTimeout(installFixes, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFixes, { once: true });
  else installFixes();

  var observerScheduled = false;
  new MutationObserver(function (records) {
    var relevant = records.some(function (record) {
      return !(record.target && (record.target.id === 'sppgDatalist' || (record.target.closest && record.target.closest('#sppgDatalist'))));
    });
    if (!relevant || observerScheduled) return;
    observerScheduled = true;
    setTimeout(function () {
      observerScheduled = false;
      setExternalLinkTargets();
      populateSppgDatalist();
      bindMobileLogin();
      fixModalLifecycle();
    }, 120);
  }).observe(document.body, { childList: true, subtree: true });
})();

/* ===== INLINE: dashboard-ui-v2.js ===== */
(function(){
'use strict';
var charts={};
function $(id){return document.getElementById(id)}
function money(v){return 'Rp '+(Number(v)||0).toLocaleString('id-ID')}
function compact(v){v=Number(v)||0;if(Math.abs(v)>=1e9)return 'Rp '+(v/1e9).toFixed(1).replace('.0','')+' M';if(Math.abs(v)>=1e6)return 'Rp '+(v/1e6).toFixed(1).replace('.0','')+' Jt';if(Math.abs(v)>=1e3)return 'Rp '+Math.round(v/1e3)+' Rb';return money(v)}
function num(id){var n=$(id);return n?Number(String(n.textContent||'').replace(/[^0-9-]/g,''))||0:0}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function api(name,args){return new Promise(function(resolve){if(typeof window.callApi!=='function')return resolve(null);window.callApi(name,args||[],resolve,function(){resolve(null)})})}
function range(days){var e=new Date(),s=new Date();s.setDate(e.getDate()-days+1);function f(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}return{start:f(s),end:f(e)}}
function css(){if($('dash-v2-css'))return;var s=document.createElement('style');s.id='dash-v2-css';s.textContent=`
#page-dashboard{--d-blue:#1e6f9c;--d-navy:#153754;--d-green:#10b981;--d-rose:#f43f5e;--d-amber:#f59e0b}
.dash-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.45fr .55fr;gap:22px;padding:26px;margin-bottom:18px;border-radius:24px;background:linear-gradient(135deg,#153754,#1e6f9c 60%,#168aad);color:#fff;box-shadow:0 18px 44px rgba(21,55,84,.18)}
.dash-hero:after{content:"";position:absolute;width:260px;height:260px;right:-100px;top:-130px;border-radius:50%;background:rgba(255,255,255,.08)}.dash-hero>*{position:relative;z-index:1}
.dash-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}
.dash-hero h2{margin:13px 0 7px;font-size:clamp(23px,3vw,34px);letter-spacing:-.7px}.dash-hero p{max-width:720px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.65}
.dash-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:17px}.dash-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:12px;background:rgba(255,255,255,.11);font-size:11px;font-weight:600}
.dash-health{height:100%;padding:18px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.1);backdrop-filter:blur(10px)}.dash-health-head{display:flex;justify-content:space-between;font-size:11px;font-weight:700}.dash-score{font-size:31px;font-weight:800;margin-top:12px}.dash-health p{font-size:10px;margin:2px 0 0}.dash-bar{height:8px;margin:14px 0 10px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden}.dash-bar span{display:block;height:100%;width:0;background:linear-gradient(90deg,#6ee7b7,#fde68a);border-radius:inherit;transition:.45s}
#page-dashboard .stats-grid{gap:14px;margin-bottom:18px}#page-dashboard .stat-card{position:relative;overflow:hidden;align-items:flex-start;text-align:left;min-height:148px;padding:18px;border:1px solid #e5edf4;border-radius:18px;box-shadow:0 9px 24px rgba(15,23,42,.055);transition:.2s}#page-dashboard .stat-card:hover{transform:translateY(-3px);box-shadow:0 15px 32px rgba(15,23,42,.09)}
#page-dashboard .stat-card:after{content:"";position:absolute;width:90px;height:90px;right:-38px;top:-38px;border-radius:50%;background:rgba(30,111,156,.08)}#page-dashboard .stat-card:nth-child(2):after{background:rgba(16,185,129,.1)}#page-dashboard .stat-card:nth-child(3):after{background:rgba(244,63,94,.1)}#page-dashboard .stat-card:nth-child(4):after{background:rgba(245,158,11,.12)}
#page-dashboard .stat-icon{width:44px;height:44px;min-width:44px;border-radius:14px;margin-bottom:17px}#page-dashboard .stat-info{width:100%}#page-dashboard .stat-value{font-size:clamp(19px,2vw,25px);font-weight:800;color:#172b3a;letter-spacing:-.5px}#page-dashboard .stat-label{margin-top:5px;font-size:12px;font-weight:700;color:#526577}#page-dashboard .stat-trend{margin-top:9px;font-size:10px}
.dash-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:16px;margin-bottom:16px}.dash-grid.equal{grid-template-columns:repeat(2,minmax(0,1fr))}.dash-panel{min-width:0;background:#fff;border:1px solid #e4edf4;border-radius:20px;box-shadow:0 10px 28px rgba(15,23,42,.05)}
.dash-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 18px 0}.dash-title{display:flex;align-items:center;gap:11px}.dash-icon{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#eaf5fb;color:#1e6f9c}.dash-panel h3{font-size:14px;color:#1d3344;margin:0}.dash-desc{font-size:10px;color:#7b8d9b;margin-top:3px}.dash-body{padding:12px 18px 18px}.dash-chart{height:285px;position:relative}.dash-filter{padding:7px 9px;border:1px solid #d9e5ee;border-radius:10px;background:#fff;color:#42586b;font-size:10px;font-weight:700}
.dash-insights{display:grid;gap:10px}.dash-insight{display:flex;gap:11px;padding:12px;border:1px solid #edf2f6;border-radius:14px;background:#f7fafc}.dash-insight i{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:11px}.dash-insight strong{display:block;font-size:11px;color:#243b4d;margin-bottom:3px}.dash-insight span{display:block;font-size:10px;line-height:1.45;color:#718394}
.dash-sppg{display:grid;gap:10px}.dash-sppg-row{display:grid;grid-template-columns:minmax(90px,1fr) minmax(100px,1.25fr) auto;gap:11px;align-items:center}.dash-sppg-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:700;color:#334b5e}.dash-track{height:7px;background:#edf3f7;border-radius:999px;overflow:hidden}.dash-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#1e6f9c)}.dash-val{font-size:10px;font-weight:800;color:#1e425c}.dash-empty{display:grid;place-items:center;min-height:210px;text-align:center;color:#8293a2}.dash-empty i{font-size:27px;color:#bdd0dc;margin-bottom:8px}.dash-empty strong{display:block;font-size:11px}
@media(max-width:980px){.dash-hero,.dash-grid,.dash-grid.equal{grid-template-columns:1fr}}@media(max-width:640px){.dash-hero{padding:20px;border-radius:20px}.dash-health{display:none}#page-dashboard .stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}#page-dashboard .stat-card{min-width:0;min-height:136px;padding:14px}#page-dashboard .stat-value{font-size:17px}.dash-chart{height:245px}.dash-head{padding:15px 15px 0}.dash-body{padding:10px 15px 15px}}
`;document.head.appendChild(s)}
function hero(){return `<section class="dash-hero"><div><span class="dash-eyebrow"><i class="fas fa-chart-line"></i> Ringkasan operasional</span><h2 id="dashGreeting">Selamat datang di SIM-SPPG</h2><p>Pantau arus kas, transaksi yang memerlukan perhatian, dan performa setiap unit SPPG dalam satu tampilan.</p><div class="dash-meta"><span class="dash-chip"><i class="fas fa-building"></i><span id="dashSppg">Semua SPPG</span></span><span class="dash-chip"><i class="fas fa-user-shield"></i><span id="dashRole">Pengguna</span></span><span class="dash-chip"><i class="fas fa-calendar-day"></i><span id="dashDate">-</span></span></div></div><div class="dash-health"><div class="dash-health-head"><span>Kesehatan anggaran</span><i class="fas fa-shield-alt"></i></div><div class="dash-score" id="dashScore">0%</div><p id="dashHealthText">Menunggu data transaksi</p><div class="dash-bar"><span id="dashBar"></span></div><p>Rasio saldo terhadap total pemasukan.</p></div></section>`}
function panels(){return `<div id="dashPanels"><div class="dash-grid"><section class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-chart-area"></i></div><div><h3>Tren arus kas</h3><div class="dash-desc">Pemasukan, pengeluaran, dan saldo harian</div></div></div><select id="dashPeriod" class="dash-filter"><option value="7">7 hari</option><option value="30" selected>30 hari</option><option value="90">90 hari</option></select></div><div class="dash-body"><div class="dash-chart"><canvas id="dashCashflow"></canvas></div></div></section><section class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-lightbulb"></i></div><div><h3>Insight hari ini</h3><div class="dash-desc">Sorotan otomatis operasional</div></div></div></div><div class="dash-body"><div id="dashInsights" class="dash-insights"></div></div></section></div><div class="dash-grid equal"><section class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-chart-pie"></i></div><div><h3>Komposisi transaksi</h3><div class="dash-desc">Porsi pemasukan dan pengeluaran</div></div></div></div><div class="dash-body"><div class="dash-chart"><canvas id="dashComposition"></canvas></div></div></section><section id="dashSppgPanel" class="dash-panel"><div class="dash-head"><div class="dash-title"><div class="dash-icon"><i class="fas fa-building"></i></div><div><h3>Pengeluaran per SPPG</h3><div class="dash-desc">Unit dengan pengeluaran terbesar</div></div></div></div><div class="dash-body"><div id="dashSppgList" class="dash-sppg"></div></div></section></div></div>`}
function applyDashboardRoleVisibility(){var u=window.currentUser||{},panel=$('dashSppgPanel'),grid=panel&&panel.parentElement,isAdmin=u.role==='ADMIN'||u.role==='SUPER_ADMIN';if(panel)panel.style.display=isAdmin?'':'none';if(grid)grid.style.gridTemplateColumns=isAdmin?'':'minmax(0,1fr)'}
function identity(){var u=window.currentUser||{},h=new Date().getHours(),g=h<11?'Selamat pagi':h<15?'Selamat siang':h<19?'Selamat sore':'Selamat malam';if($('dashGreeting'))$('dashGreeting').textContent=g+(u.namaLengkap?', '+u.namaLengkap.split(' ')[0]:'')+'.';if($('dashSppg'))$('dashSppg').textContent=u.role==='SUPER_ADMIN'?'Seluruh SPPG':(u.sppg||'SPPG belum ditentukan');if($('dashRole'))$('dashRole').textContent=String(u.role||u.jabatan||'Pengguna').replace(/_/g,' ');if($('dashDate'))$('dashDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
function health(){var inc=num('statPemasukan'),bal=num('statSaldo'),score=inc?Math.max(0,Math.min(100,Math.round(bal/inc*100))):0;if($('dashScore'))$('dashScore').textContent=score+'%';if($('dashBar'))$('dashBar').style.width=score+'%';if($('dashHealthText'))$('dashHealthText').textContent=score>=50?'Kondisi anggaran sehat':score>=20?'Perlu pengendalian belanja':inc?'Saldo perlu perhatian':'Menunggu data transaksi'}
function empty(canvas,msg){if(!canvas)return;canvas.style.display='none';canvas.parentElement.innerHTML='<div class="dash-empty"><div><i class="fas fa-chart-area"></i><strong>'+esc(msg)+'</strong></div></div>'}
function renderCharts(rows){if(!window.Chart)return;Chart.defaults.font.family='Inter, sans-serif';Chart.defaults.color='#708293';var c=$('dashCashflow');if(charts.cash)charts.cash.destroy();if(!rows.length)empty(c,'Belum ada data tren pada periode ini.');else charts.cash=new Chart(c,{type:'line',data:{labels:rows.map(r=>r.tanggal),datasets:[{label:'Pemasukan',data:rows.map(r=>+r.pemasukan||0),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.08)',fill:true,tension:.35,borderWidth:2,pointRadius:2},{label:'Pengeluaran',data:rows.map(r=>+r.pengeluaran||0),borderColor:'#f43f5e',backgroundColor:'rgba(244,63,94,.06)',fill:true,tension:.35,borderWidth:2,pointRadius:2},{label:'Saldo',data:rows.map(r=>+r.saldo||0),borderColor:'#1e6f9c',tension:.35,borderWidth:2.5,pointRadius:1,borderDash:[5,4]}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.raw)}}},scales:{x:{grid:{display:false},ticks:{maxRotation:0,maxTicksLimit:7}},y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.13)'},ticks:{callback:compact}}}}});var d=$('dashComposition');if(charts.comp)charts.comp.destroy();var inc=num('statPemasukan'),exp=num('statPengeluaran');if(!inc&&!exp)empty(d,'Komposisi transaksi belum tersedia.');else charts.comp=new Chart(d,{type:'doughnut',data:{labels:['Pemasukan','Pengeluaran'],datasets:[{data:[inc,exp],backgroundColor:['#10b981','#f43f5e'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.label+': '+money(c.raw)}}}}})}
function renderSppg(rows){var box=$('dashSppgList'),data=(rows||[]).slice().sort((a,b)=>(+b.pengeluaran||0)-(+a.pengeluaran||0)).slice(0,7);if(!data.length){box.innerHTML='<div class="dash-empty"><div><i class="fas fa-building"></i><strong>Data per SPPG belum tersedia.</strong></div></div>';return}var max=Math.max.apply(null,data.map(r=>+r.pengeluaran||0))||1;box.innerHTML=data.map(r=>`<div class="dash-sppg-row"><div class="dash-sppg-name" title="${esc(r.name)}">${esc(r.name)}</div><div class="dash-track"><span style="width:${Math.max(3,Math.round((+r.pengeluaran||0)/max*100))}%"></span></div><div class="dash-val">${compact(r.pengeluaran)}</div></div>`).join('')}
function insights(rows,sppg){var box=$('dashInsights'),queue=num('statAntrian'),pending=num('statAntrianNominal'),last=rows[rows.length-1],top=(sppg||[]).slice().sort((a,b)=>(+b.pengeluaran||0)-(+a.pengeluaran||0))[0],items=[['fa-hourglass-half','#fff7ed','#c2410c',queue+' transaksi menunggu approval',pending?'Nominal tertunda '+money(pending)+'.':'Tidak ada nominal tertunda.'],['fa-calendar-check','#ecfdf5','#047857',last?'Aktivitas terakhir '+last.tanggal:'Belum ada aktivitas harian',last?'Pemasukan '+money(last.pemasukan)+' dan pengeluaran '+money(last.pengeluaran)+'.':'Data muncul setelah transaksi tercatat.'],['fa-building','#eff6ff','#1d4ed8',top?top.name+' tertinggi':'Perbandingan SPPG belum tersedia',top?'Pengeluaran tercatat '+money(top.pengeluaran)+'.':'Data unit belum tersedia.'],['fa-shield-alt','#f5f3ff','#6d28d9','Kontrol pengeluaran','Pastikan bukti transaksi dan approval selalu lengkap.']];box.innerHTML=items.map(i=>`<div class="dash-insight"><i class="fas ${i[0]}" style="background:${i[1]};color:${i[2]}"></i><div><strong>${esc(i[3])}</strong><span>${esc(i[4])}</span></div></div>`).join('')}
var loading=false,lastLoad=0;async function load(force){if(loading||!window.currentUser||(!force&&Date.now()-lastLoad<30000))return;loading=true;var days=+$('dashPeriod').value||30,r=range(days),res=await Promise.all([api('getChartData',[{dateStart:r.start,dateEnd:r.end}]),api('getSPPGData',[r.start,r.end])]),rows=Array.isArray(res[0])?res[0]:[],sppg=Array.isArray(res[1])?res[1]:[];renderCharts(rows);renderSppg(sppg);insights(rows,sppg);identity();health();lastLoad=Date.now();loading=false}
function init(){var page=$('page-dashboard'),stats=$('dashboardStats');if(!page||!stats)return setTimeout(init,300);if($('dashPanels'))return;css();stats.insertAdjacentHTML('beforebegin',hero());stats.insertAdjacentHTML('afterend',panels());applyDashboardRoleVisibility();$('dashPeriod').addEventListener('change',()=>load(true));['statSaldo','statPemasukan','statPengeluaran','statAntrian','statAntrianNominal'].forEach(id=>{var n=$(id);if(n)new MutationObserver(function(){health()}).observe(n,{childList:true,subtree:true,characterData:true})});identity();health();setInterval(function(){var p=$('page-dashboard');if(p&&!p.classList.contains('hidden')&&getComputedStyle(p).display!=='none')load(false)},30000);setTimeout(()=>load(true),700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* ===== INLINE: dashboard-ui-fix.js ===== */
(function(){
'use strict';
var repairing=false;
function repair(){
  if(repairing)return;
  var cashWrap=document.querySelector('#dashPanels .dash-grid:first-child .dash-chart');
  var compWrap=document.querySelector('#dashPanels .dash-grid.equal .dash-chart');
  var changed=false;
  if(cashWrap&&!document.getElementById('dashCashflow')){cashWrap.innerHTML='<canvas id="dashCashflow"></canvas>';changed=true;}
  if(compWrap&&!document.getElementById('dashComposition')){compWrap.innerHTML='<canvas id="dashComposition"></canvas>';changed=true;}
  if(changed){
    repairing=true;
    setTimeout(function(){
      var period=document.getElementById('dashPeriod');
      if(period)period.dispatchEvent(new Event('change',{bubbles:true}));
      repairing=false;
    },120);
  }
}
var dashboardObserverTarget = document.getElementById('page-dashboard') || document.getElementById('dashPanels');
if (dashboardObserverTarget) {
  new MutationObserver(function(){ setTimeout(repair,30); })
    .observe(dashboardObserverTarget,{childList:true,subtree:true});
}
})();

// Legacy report/Telegram runtime removed after security audit.

/* ===== UNIFIED HARDENING RUNTIME ===== */
/* SIM-SPPG unified runtime
 * Session guard, authentication experience, registration routing,
 * role-aware UI hardening, file-input repair, and report downloads.
 */
(function () {
  'use strict';

  if (window.__SIMSPPG_UNIFIED_RUNTIME__) return;
  window.__SIMSPPG_UNIFIED_RUNTIME__ = true;

  var CONFIG = {
    tokenKey: 'sppg_jwt',
    refreshTokenKey: 'sppg_refresh_token',
    sessionKey: 'sppg_session',
    clockSkewMs: 60 * 1000,
    refreshLeadMs: 5 * 60 * 1000,
    idleTimeoutMs: 60 * 60 * 1000,
    sessionCheckMs: 30 * 1000,
    logoUrl: 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png'
  };

  var PUBLIC_FUNCTIONS = {
    loginUser: 1,
    refreshSession: 1,
    checkSession: 1,
    recoverPassword: 1,
    recoverUsername: 1,
    recoverToken: 1,
    getAppConfig: 1,
    getDropdownOptions: 1,
    getPushPublicKey: 1
  };

  var REPORT_DATASETS = [
    { key:'TRANSAKSI', label:'Data Transaksi', icon:'fa-exchange-alt', action:'getTransactions', dateFields:['tanggal','Tanggal','Timestamp','timestamp'] },
    { key:'APPROVAL', label:'Data Approval Transaksi', icon:'fa-clipboard-check', action:'getTransactions', approval:true, dateFields:['waktuApprove','WAKTU APPROVE','tanggal','Tanggal'] },
    { key:'PENDING', label:'Data Pending Payment', icon:'fa-hand-holding-usd', action:'getPendingPayments', dateFields:['tanggalPending','Tanggal Pending','Timestamp'] },
    { key:'SUPPLIER', label:'Data Supplier', icon:'fa-truck', action:'getMasterSupplier', dateFields:['TIMESTAMP','Timestamp','created_at'] },
    { key:'BAHAN', label:'Master Bahan Baku', icon:'fa-boxes', action:'getMasterBahanBaku', dateFields:['TIMESTAMP','Timestamp','UPDATE','created_at'] },
    { key:'SURVEI', label:'Data Survei Harga', icon:'fa-search-dollar', action:'getSurveiBahanBaku', dateFields:['waktuSurvei','WAKTU SURVEI','TIMESTAMP','Timestamp'] },
    { key:'SERAH_TERIMA', label:'Data Serah Terima', icon:'fa-dolly', action:'getSerahTerima', dateFields:['TIMESTAMP','Timestamp','Tanggal','tanggal'] },
    { key:'MENU', label:'Data Menu Harian', icon:'fa-utensils', action:'getMenuHarian', dateFields:['tanggal','TANGGAL','Tanggal','TIMESTAMP'] },
    { key:'USERS', label:'Data Pengguna', icon:'fa-users', action:'getAllUsers', dateFields:['timestamp','TIMESTAMP','created_at'] },
    { key:'ADMIN_ASSIGNMENT', label:'Konfigurasi Admin', icon:'fa-user-shield', action:'getAdminAssignments', dateFields:['created_at'] },
    { key:'AUDIT', label:'Riwayat Aktivitas', icon:'fa-history', action:'getAuditLog', dateFields:['waktuRaw','TIMESTAMP','timestamp','waktu'] }
  ];

  var SENSITIVE_COLUMN = /(password|passwd|secret|token|refresh|service_role|private_key|\bpin\b|otp|endpoint|p256dh|auth_key)/i;
  var installAttempts = 0;
  var reportInstalled = false;
  var authObserver = null;
  var sessionRefreshPromise = null;

  function byId(id) { return document.getElementById(id); }
  function storageGet(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
  function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  function storageRemove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char];
    });
  }
  function notify(type, title, message) {
    if (typeof window.showToast === 'function') return window.showToast(type, title, message);
    if (window.Swal) return window.Swal.fire(title, message, type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success');
    window.alert(title + '\n' + message);
  }
  function role() {
    return String(window.currentUser && (window.currentUser.role || window.currentUser.ROLE) || '').toUpperCase();
  }
  function email() {
    return String(window.currentUser && (window.currentUser.email || window.currentUser.EMAIL || window.currentUser.username) || '').toLowerCase();
  }

  function decodeJwtPayload(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (encoded.length % 4) encoded += '=';
      var binary = window.atob(encoded);
      var text;
      try {
        text = decodeURIComponent(Array.prototype.map.call(binary, function (char) {
          return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (_) {
        text = binary;
      }
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function jwtExpiryMs(token) {
    var payload = decodeJwtPayload(token);
    var exp = payload && Number(payload.exp);
    return exp > 0 ? exp * 1000 : 0;
  }

  function isTokenUsable(token) {
    var expiry = jwtExpiryMs(token);
    return !!expiry && expiry > Date.now() + CONFIG.clockSkewMs;
  }

  function stopBackgroundTasks() {
    try {
      if (window.notifPollTimer) {
        clearInterval(window.notifPollTimer);
        window.notifPollTimer = null;
      }
    } catch (_) {}
  }

  function renderLoggedOut(message) {
    var app = byId('appContainer');
    var auth = byId('authOverlay');
    var loading = byId('appLoadingOverlay');
    if (app) app.classList.add('hidden');
    if (auth) auth.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (typeof window.showLogin === 'function') {
      try { window.showLogin(); } catch (_) {}
    }
    if (message) {
      var box = byId('loginError');
      if (box) {
        var span = box.querySelector('span');
        if (span) span.textContent = message;
        box.classList.add('show');
      }
    }
  }

  function clearAuthState(message, updateUi) {
    storageRemove(CONFIG.tokenKey);
    storageRemove(CONFIG.refreshTokenKey);
    storageRemove(CONFIG.sessionKey);
    window._supabaseToken = '';
    window.currentUser = null;
    window.sessionExpiry = 0;
    stopBackgroundTasks();
    if (updateUi) renderLoggedOut(message || 'Sesi berakhir. Silakan login kembali.');
  }

  function readValidSession(restoreGlobals) {
    var raw = storageGet(CONFIG.sessionKey);
    var token = storageGet(CONFIG.tokenKey);
    var refreshToken = storageGet(CONFIG.refreshTokenKey);
    if (!raw && !token && !refreshToken) return false;
    if (!raw) {
      clearAuthState('', false);
      return false;
    }
    var session;
    try { session = JSON.parse(raw); } catch (_) { session = null; }
    if (!session || !session.user) {
      clearAuthState('', false);
      return false;
    }
    var idleExpiry = Number(session.expiry) || 0;
    if (!idleExpiry || Date.now() >= idleExpiry) {
      clearAuthState('', false);
      return false;
    }
    if (!isTokenUsable(token) && !refreshToken) {
      clearAuthState('', false);
      return false;
    }
    if (restoreGlobals) {
      window.currentUser = session.user;
      window.sessionExpiry = idleExpiry;
      window._supabaseToken = token;
    }
    return true;
  }

  function isAuthFailure(value) {
    var message = value && String(value.message || value.error || value.msg || value) || '';
    return /token.*(invalid|expired|kedaluwarsa)|jwt.*(invalid|expired|kedaluwarsa)|authorization.*(wajib|missing|required)|sesi.*(berakhir|kedaluwarsa)/i.test(message);
  }

  function validTokenOrEmpty() {
    var token = storageGet(CONFIG.tokenKey);
    return isTokenUsable(token) ? token : '';
  }

  function tokenNeedsRefresh() {
    var expiry = jwtExpiryMs(storageGet(CONFIG.tokenKey));
    return !expiry || expiry <= Date.now() + CONFIG.refreshLeadMs;
  }

  function touchVisibleSession() {
    if (document.visibilityState === 'hidden' || !window.currentUser) return;
    if (typeof window.resetIdleLogoutTimer === 'function') window.resetIdleLogoutTimer();
  }

  function installSessionGuard() {
    if (window.__sppgUnifiedSessionInstalled) return true;
    if (typeof window.callApi !== 'function' || typeof window.checkSession !== 'function') return false;
    window.__sppgUnifiedSessionInstalled = true;

    var original = window.callApi;
    window.getJwtToken = function () {
      return storageGet(CONFIG.tokenKey);
    };
    window.checkSession = function () { return readValidSession(true); };

    function refreshAccessToken() {
      if (sessionRefreshPromise) return sessionRefreshPromise;
      var refreshToken = storageGet(CONFIG.refreshTokenKey);
      if (!refreshToken || !readValidSession(false)) return Promise.resolve(false);
      sessionRefreshPromise = new Promise(function(resolve) {
        original('refreshSession', [refreshToken], function(result) {
          if (!result || !result.success || !result.token || !result.refreshToken) {
            resolve(false);
            return;
          }
          storageSet(CONFIG.tokenKey, result.token);
          storageSet(CONFIG.refreshTokenKey, result.refreshToken);
          window._supabaseToken = result.token;
          resolve(isTokenUsable(result.token));
        }, function() {
          resolve(false);
        });
      }).then(function(ok) {
        sessionRefreshPromise = null;
        return ok;
      }, function() {
        sessionRefreshPromise = null;
        return false;
      });
      return sessionRefreshPromise;
    }
    window.__sppgRefreshAccessToken = refreshAccessToken;

    window.callApi = function (action, params, success, failure) {
      var isPublic = !!PUBLIC_FUNCTIONS[action];
      if (action === 'loginUser') {
        clearAuthState('', false);
      } else if (!isPublic && !readValidSession(false)) {
        var error = new Error('Sesi berakhir. Silakan login kembali.');
        clearAuthState(error.message, true);
        if (typeof failure === 'function') setTimeout(function () { failure(error); }, 0);
        return;
      }

      function handleSuccess(result) {
        if (action === 'loginUser' && result && result.success && result.token) {
          var tokenExpiry = jwtExpiryMs(result.token);
          if (!tokenExpiry || tokenExpiry <= Date.now() + CONFIG.clockSkewMs || !result.refreshToken) {
            clearAuthState('', false);
            if (typeof failure === 'function') failure(new Error('Server mengirim sesi yang tidak valid. Silakan login kembali.'));
            return;
          }
          result.sessionExpiry = Date.now() + CONFIG.idleTimeoutMs;
          storageSet(CONFIG.tokenKey, result.token);
          storageSet(CONFIG.refreshTokenKey, result.refreshToken);
          window._supabaseToken = result.token;
        }
        if (!isPublic && isAuthFailure(result)) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        if (typeof success === 'function') success(result);
      }

      function handleFailure(error) {
        if (!isPublic && isAuthFailure(error)) {
          clearAuthState('Sesi berakhir. Silakan login kembali.', true);
        }
        if (typeof failure === 'function') failure(error);
      }

      if (isPublic) return original(action, params, handleSuccess, handleFailure);
      touchVisibleSession();

      function invoke(retried) {
        return original(action, params, handleSuccess, function(error) {
          if (!retried && isAuthFailure(error) && storageGet(CONFIG.refreshTokenKey)) {
            refreshAccessToken().then(function(ok) {
              if (ok) invoke(true);
              else handleFailure(error);
            });
            return;
          }
          handleFailure(error);
        });
      }

      if (!tokenNeedsRefresh() && validTokenOrEmpty()) return invoke(false);
      refreshAccessToken().then(function(ok) {
        if (ok) invoke(true);
        else {
          var error = new Error('Sesi tidak dapat diperpanjang. Silakan login kembali.');
          clearAuthState(error.message, true);
          if (typeof failure === 'function') failure(error);
        }
      });
    };
    window.callApi.__unifiedRuntime = true;
    window.callApi.__original = original;
    readValidSession(true);
    return true;
  }

  function installStyles() { return; }

  function visible(element) {
    if (!element || element.classList.contains('hidden')) return false;
    var computed = window.getComputedStyle(element);
    return computed.display !== 'none' && computed.visibility !== 'hidden';
  }

  function authMode() {
    if (visible(byId('recoveryForm'))) return 'recovery';
    return 'login';
  }

  function updateAuthHeading() {
    var overlay = byId('authOverlay');
    if (!overlay || !overlay.classList.contains('auth-architecture')) return;
    var mode = authMode();
    overlay.dataset.authMode = mode;
    var heading = overlay.querySelector('.auth-architecture-heading');
    if (!heading) return;
    var eyebrow = heading.querySelector('.auth-eyebrow');
    var title = heading.querySelector('h2');
    var description = heading.querySelector('p');
    var content = {
      login: ['Selamat datang', 'Masuk ke SIM-SPPG', 'Gunakan email dan password akun Anda untuk melanjutkan.'],
      recovery: ['Pemulihan akun', 'Pulihkan akses SIM-SPPG', 'Ikuti langkah verifikasi untuk mendapatkan kembali akses akun.']
    }[mode];
    eyebrow.textContent = content[0];
    title.textContent = content[1];
    description.textContent = content[2];
  }
 
  function repairInputs() {
    document.querySelectorAll('input[type="file"]').forEach(function (input) {
      var accept = input.getAttribute('accept') || '';
      if (accept.indexOf('image<!--') !== -1) input.setAttribute('accept', accept.replace(/image<!--/g, 'image/*'));
    });
    var loginEmail = byId('loginUsername');
    if (loginEmail) {
      loginEmail.type = 'email';
      loginEmail.autocomplete = 'email';
      loginEmail.inputMode = 'email';
      loginEmail.required = true;
      loginEmail.setAttribute('aria-label', 'Email akun');
    }
    var loginPassword = byId('loginPassword');
    if (loginPassword) {
      loginPassword.autocomplete = 'current-password';
      loginPassword.required = true;
    }
  }

  function enhanceAuthentication() {
    var overlay = byId('authOverlay');
    if (!overlay) return false;
    repairInputs();
    overlay.classList.add('auth-architecture');
    overlay.dataset.architectureReady = '1';

    var yayasan = byId('regYayasan');
    if (yayasan) {
      yayasan.required = true;
      yayasan.setAttribute('aria-required', 'true');
    }

    updateAuthHeading();
    if (!authObserver) {
      authObserver = new MutationObserver(function () {
        window.requestAnimationFrame(function () {
repairInputs();
updateAuthHeading();
        });
      });
      authObserver.observe(overlay, { subtree:true, attributes:true, attributeFilter:['class','style','hidden'] });
    }
    return true;
  }

  function ensureRoleMenus() {
    if (!window.MENU_CONFIG) return false;
    if (!window.MENU_CONFIG.USER) {
      window.MENU_CONFIG.USER = [
        { page:'dashboard', label:'Beranda', icon:'fa-th-large' },
        { page:'profil', label:'Profil', icon:'fa-user-circle' },
        { label:'AKTIVITAS SAYA', isHeader:true },
        { page:'transaksi', label:'Transaksi Saya', icon:'fa-exchange-alt' },
        { page:'pending-payment', label:'Pending Payment Saya', icon:'fa-hand-holding-usd' },
        { label:'AKUN', isHeader:true },
        { action:'logout', label:'Keluar', icon:'fa-sign-out-alt' }
      ];
      if (window.BOTTOM_NAV_CONFIG && !window.BOTTOM_NAV_CONFIG.USER) window.BOTTOM_NAV_CONFIG.USER = ['dashboard','transaksi','profil'];
    }
    Object.keys(window.MENU_CONFIG).forEach(function (key) {
      var items = window.MENU_CONFIG[key];
      if (!Array.isArray(items)) return;
      var report = items.find(function (item) { return item && item.page === 'laporan'; });
      if (!report) return;
      items = items.filter(function (item) {
        return !(item && (item.page === 'laporan' || (item.isHeader && String(item.label).toUpperCase() === 'PELAPORAN')));
      });
      var accountIndex = items.findIndex(function (item) { return item && item.isHeader && String(item.label).toUpperCase() === 'AKUN'; });
      if (accountIndex < 0) {
        var logoutIndex = items.findIndex(function (item) { return item && item.action === 'logout'; });
        accountIndex = logoutIndex < 0 ? items.length : logoutIndex;
      }
      items.splice(accountIndex, 0, { label:'PELAPORAN', isHeader:true }, report);
      window.MENU_CONFIG[key] = items;
    });
    return true;
  }

  function hideRestrictedUserWidgets() {
    if (role() !== 'USER') return;
    document.querySelectorAll('#page-dashboard h1,#page-dashboard h2,#page-dashboard h3,#page-dashboard h4,#page-dashboard .card-title,#page-dashboard .chart-title,#page-dashboard .stat-label').forEach(function (node) {
      if (/pengeluaran\s+per\s+sppg/i.test(node.textContent || '')) {
        var block = node.closest('.chart-container,.card,.dashboard-card,.table-container,.section-card') || node.parentElement;
        if (block) block.style.display = 'none';
      }
    });
  }

  function hardenPrint() {
    if (typeof window.printCurrentPage !== 'function' || window.printCurrentPage.__unifiedRuntime) return;
    var original = window.printCurrentPage;
    window.printCurrentPage = function () {
      document.documentElement.style.setProperty('--print-start-offset', '0');
      window.scrollTo(0, 0);
      return original.apply(this, arguments);
    };
    window.printCurrentPage.__unifiedRuntime = true;
  }

  function api(action, args) {
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') return reject(new Error('API aplikasi belum siap.'));
      window.callApi(action, args || [], resolve, reject);
    });
  }

  function unwrap(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && result.success === false) throw new Error(result.message || 'Backend menolak permintaan.');
    return [];
  }

  function reportParams(dataset, start, end) {
    if (dataset.action === 'getTransactions') return [{ dateStart:start, dateEnd:end }];
    if (dataset.action === 'getMenuHarian') return [{}];
    if (dataset.action === 'getAuditLog') return [{}];
    if (dataset.action === 'getAdminAssignments') return [''];
    return [];
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var raw = String(value).trim();
    var indo = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (indo) return new Date(Number(indo[3]), Number(indo[2]) - 1, Number(indo[1]));
    var date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  }

  function sanitizeRows(rows) {
    return rows.map(function (row) {
      var clean = {};
      Object.keys(row || {}).forEach(function (key) {
        if (!SENSITIVE_COLUMN.test(key)) clean[key] = row[key];
      });
      return clean;
    });
  }

  async function loadReportDataset(dataset, start, end) {
    var rows = unwrap(await api(dataset.action, reportParams(dataset, start, end)));
    if (dataset.approval) rows = rows.filter(function (row) {
      return !!(row.approvedBy || row['APPROVED BY'] || row.waktuApprove || row['WAKTU APPROVE']);
    });
    var startDate = new Date(start + 'T00:00:00');
    var endDate = new Date(end + 'T23:59:59.999');
    var field = dataset.dateFields.find(function (candidate) {
      return rows.some(function (row) { return row && parseDate(row[candidate]); });
    });
    if (field) rows = rows.filter(function (row) {
      var date = parseDate(row[field]);
      return date && date >= startDate && date <= endDate;
    });
    return sanitizeRows(rows);
  }

  function reportColumns(rows) {
    var columns = [];
    rows.forEach(function (row) {
      Object.keys(row || {}).forEach(function (key) { if (columns.indexOf(key) < 0) columns.push(key); });
    });
    return columns;
  }

  function reportCell(value) {
    if (value == null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  function loadLibrary(src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Library laporan gagal dimuat.')); };
      document.head.appendChild(script);
    });
  }

  async function createExcel(datasets, start, end) {
    await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', function () { return !!window.XLSX; });
    var workbook = window.XLSX.utils.book_new();
    var summary = [['LAPORAN SIM-SPPG'], ['Periode', start + ' s.d. ' + end], ['Dibuat oleh', email() || '-'], ['Dibuat pada', new Date().toLocaleString('id-ID')], [], ['Data','Jumlah']];
    datasets.forEach(function (dataset) { summary.push([dataset.config.label, dataset.rows.length]); });
    window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(summary), 'Ringkasan');
    datasets.forEach(function (dataset, index) {
      var columns = reportColumns(dataset.rows);
      var rows = dataset.rows.map(function (row) {
        var output = {};
        columns.forEach(function (key) { output[key] = reportCell(row[key]); });
        return output;
      });
      var sheet = rows.length ? window.XLSX.utils.json_to_sheet(rows) : window.XLSX.utils.aoa_to_sheet([['Tidak ada data pada periode terpilih']]);
      sheet['!cols'] = columns.map(function (key) { return { wch:Math.min(Math.max(key.length + 2, 14), 42) }; });
      var name = dataset.config.label.replace(/[\\\/?*\[\]:]/g, '').slice(0, 28) || ('Data ' + (index + 1));
      window.XLSX.utils.book_append_sheet(workbook, sheet, name);
    });
    window.XLSX.writeFile(workbook, 'laporan-sim-sppg_' + start + '_' + end + '.xlsx', { compression:true });
  }

  var REPORT_HISTORY_KEY = 'sim_sppg_report_history_v1';

  function reportHistoryList() {
    try { return JSON.parse(storageGet(REPORT_HISTORY_KEY) || '[]'); } catch (_) { return []; }
  }

  function reportNumericTotal(rows) {
    var total = 0, found = false;
    var candidates = ['nominal','NOMINAL','Nominal','total','TOTAL','Total','totalNominal','TOTAL NOMINAL'];
    rows.forEach(function (row) {
      for (var i = 0; i < candidates.length; i += 1) {
        var key = candidates[i];
        if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '' && row[key] != null && !isNaN(parseFloat(row[key]))) {
          total += parseFloat(row[key]);
          found = true;
          break;
        }
      }
    });
    return found ? total : null;
  }

  function recordReportHistory(datasets, start, end, format) {
    var jumlah = datasets.reduce(function (sum, d) { return sum + d.rows.length; }, 0);
    var total = 0;
    datasets.forEach(function (d) { var t = reportNumericTotal(d.rows); if (t != null) total += t; });
    var entry = {
      tanggal: new Date().toISOString(),
      periodeAwal: start,
      periodeAkhir: end,
      periode: start + ' s.d. ' + end,
      format: format.toUpperCase(),
      jumlah: jumlah,
      total: total,
      dibuatOleh: email() || '-'
    };
    var list = reportHistoryList();
    list.unshift(entry);
    if (list.length > 20) list = list.slice(0, 20);
    storageSet(REPORT_HISTORY_KEY, JSON.stringify(list));
    renderReportHistory();
  }

  function renderReportHistory() {
    var target = byId('reportHistoryList');
    if (!target) return;
    var list = reportHistoryList();
    if (!list.length) {
      target.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">Belum ada laporan yang dibuat.</td></tr>';
      return;
    }
    target.innerHTML = list.map(function (r) {
      return '<tr><td>' + escapeHtml(new Date(r.tanggal).toLocaleString('id-ID')) + '</td>' +
        '<td>' + escapeHtml(r.periode || '-') + '</td>' +
        '<td>' + escapeHtml(r.format || '-') + '</td>' +
        '<td>' + escapeHtml(String(r.jumlah || 0)) + '</td>' +
        '<td>Rp ' + Math.round(r.total || 0).toLocaleString('id-ID') + '</td></tr>';
    }).join('');
  }

  async function createPdf(datasets, start, end) {
    var now = new Date();
    var tgl = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    var jam = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    var printedBy = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.namaLengkap + ' (' + currentUser.role + ')') : (email() || '-');
    var grandRows = 0;
    var summaryRows = '';
    datasets.forEach(function (dataset, idx) {
      grandRows += dataset.rows.length;
      var total = reportNumericTotal(dataset.rows);
      var bg = idx % 2 === 0 ? '' : 'background:#fafafa;';
      summaryRows +=
        '<tr style="' + bg + '">' +
        '<td style="font-weight:600;">' + escapeHtml(dataset.config.label) + '</td>' +
        '<td style="text-align:center;">' + dataset.rows.length + '</td>' +
        '<td style="text-align:right;font-weight:600;color:' + (total == null ? '#94a3b8' : '#047857') + ';">' + (total == null ? '-' : 'Rp ' + Math.round(total).toLocaleString('id-ID')) + '</td>' +
        '</tr>';
    });
    summaryRows +=
      '<tr style="background:#f1f5f9;font-weight:700;">' +
      '<td>TOTAL KESELURUHAN</td>' +
      '<td style="text-align:center;">' + grandRows + '</td>' +
      '<td></td>' +
      '</tr>';

    var detailSections = datasets.map(function (dataset) {
      var columns = reportColumns(dataset.rows).slice(0, 12);
      var rowsHtml = dataset.rows.length ? dataset.rows.map(function (row, i) {
        var bg = i % 2 === 0 ? '' : 'background:#fafafa;';
        return '<tr style="' + bg + '"><td style="text-align:center;">' + (i + 1) + '</td>' +
          columns.map(function (key) { return '<td>' + escapeHtml(reportCell(row[key])) + '</td>'; }).join('') +
          '</tr>';
      }).join('') : '<tr><td colspan="' + (columns.length + 1) + '" style="text-align:center;color:#94a3b8;padding:14px;">Tidak ada data pada periode terpilih.</td></tr>';
      return '<p class="section-title">' + escapeHtml(dataset.config.label) + ' <span style="font-weight:400;color:#64748b;">(' + dataset.rows.length + ' baris)</span></p>' +
        '<table><thead><tr><th style="width:26px;">No</th>' +
        columns.map(function (key) { return '<th>' + escapeHtml(key) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
    }).join('');

    var html =
      '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
      '<title>Laporan SIM-SPPG</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;font-size:10px;color:#0f172a;margin:0;padding:16px;}' +
      '.hero{background:#1e6f9c;color:#fff;border-radius:8px;padding:14px 18px;margin-bottom:14px;}' +
      '.hero h2{margin:0 0 4px 0;font-size:16px;}' +
      '.hero p{margin:0;font-size:10px;opacity:.9;}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:18px;}' +
      'thead th{background:#f1f5f9;padding:6px 8px;text-align:left;border:1px solid #cbd5e1;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;}' +
      'tbody td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:middle;font-size:9px;}' +
      '.section-title{font-size:12px;font-weight:700;margin:16px 0 6px 0;color:#334155;border-left:3px solid #10b981;padding-left:8px;}' +
      '@media print{@page{size:A4 landscape;margin:10mm;}}' +
      '</style></head><body>' +
      '<div class="hero"><h2>Laporan SIM-SPPG</h2>' +
      '<p>Periode ' + start + ' s.d. ' + end + ' &nbsp;|&nbsp; Dicetak oleh: ' + escapeHtml(printedBy) + ' &nbsp;|&nbsp; Tanggal: ' + tgl + ' ' + jam + '</p></div>' +
      '<p class="section-title">Ringkasan Umum</p>' +
      '<table style="max-width:520px;"><thead><tr><th>Kelompok Data</th><th style="text-align:center;">Jumlah</th><th style="text-align:right;">Total Nominal (Rp)</th></tr></thead>' +
      '<tbody>' + summaryRows + '</tbody></table>' +
      detailSections +
      '</body></html>';

    var win = window.open('', '_blank');
    if (!win) { notify('error', 'Gagal', 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.'); throw new Error('Popup diblokir.'); }
    win.document.write(html);
    win.document.close();
    win.onload = function () { win.print(); };
  }

  function selectedReportDatasets() {
    return Array.prototype.slice.call(document.querySelectorAll('.report-unified-check input:checked')).map(function (input) {
      return REPORT_DATASETS.find(function (dataset) { return dataset.key === input.value; });
    }).filter(Boolean);
  }

  function updateReportCount() {
    var target = byId('reportUnifiedCount');
    if (target) target.textContent = document.querySelectorAll('.report-unified-check input:checked').length + ' dipilih';
  }

  async function downloadReport() {
    var start = byId('reportUnifiedStart').value;
    var end = byId('reportUnifiedEnd').value;
    var format = byId('reportUnifiedFormat').value;
    var configs = selectedReportDatasets();
    var button = byId('reportUnifiedDownload');
    var progress = byId('reportUnifiedProgress');
    if (!start || !end) return notify('warning','Periode belum lengkap','Pilih tanggal mulai dan tanggal selesai.');
    if (new Date(start) > new Date(end)) return notify('warning','Periode tidak valid','Tanggal mulai tidak boleh melewati tanggal selesai.');
    if (!configs.length) return notify('warning','Data belum dipilih','Pilih minimal satu jenis data.');
    button.disabled = true;
    progress.classList.remove('hidden');
    try {
      var datasets = [];
      for (var i = 0; i < configs.length; i += 1) {
        progress.textContent = 'Mengambil ' + configs[i].label + ' (' + (i + 1) + '/' + configs.length + ')...';
        datasets.push({ config:configs[i], rows:await loadReportDataset(configs[i], start, end) });
      }
      progress.textContent = 'Menyusun file ' + format.toUpperCase() + '...';
      if (format === 'xlsx') await createExcel(datasets, start, end); else await createPdf(datasets, start, end);
      recordReportHistory(datasets, start, end, format);
      notify('success','Laporan berhasil dibuat', format === 'pdf' ? 'Jendela cetak/simpan PDF telah dibuka.' : 'File ' + format.toUpperCase() + ' telah diunduh ke perangkat.');
    } catch (error) {
      console.error('[SIM-SPPG REPORT]', error);
      notify('error','Gagal membuat laporan',error.message || String(error));
    } finally {
      button.disabled = false;
      progress.classList.add('hidden');
      button.innerHTML = '<i class="fas fa-download"></i><span>Download Laporan</span>';
    }
  }

  function installReportCenter() {
    var page = byId('page-laporan') || byId('laporanPage') || document.querySelector('[data-page-content="laporan"]');
    if (!page || page.dataset.unifiedReportReady === '1') return false;
    page.dataset.unifiedReportReady = '1';
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    page.innerHTML =
      '<div class="report-unified-hero"><div><span class="report-unified-eyebrow"><i class="fas fa-chart-pie"></i> PUSAT LAPORAN</span><h2>Unduh laporan sesuai kebutuhan</h2><p>Pilih periode, beberapa kelompok data, dan format file. Kolom sensitif seperti password, token, PIN, dan OTP otomatis dikecualikan.</p></div></div>' +
      '<div class="report-unified-grid"><section class="report-unified-card"><div class="report-unified-title"><span>1</span><div><h3>Periode & Format</h3><p>Tentukan rentang data yang akan diproses.</p></div></div><div class="report-unified-fields">' +
      '<label><span>Tanggal Mulai</span><input id="reportUnifiedStart" type="date" value="' + first.toISOString().slice(0,10) + '"></label>' +
      '<label><span>Tanggal Selesai</span><input id="reportUnifiedEnd" type="date" value="' + now.toISOString().slice(0,10) + '"></label>' +
      '<label><span>Format File</span><select id="reportUnifiedFormat"><option value="pdf">PDF — siap cetak</option><option value="xlsx">Excel — multi-sheet</option></select></label></div></section>' +
      '<section class="report-unified-card"><div class="report-unified-title"><span>2</span><div><h3>Pilih Data</h3><p>Data diambil melalui backend sesuai hak akses akun.</p></div></div>' +
      '<div class="report-unified-actions"><button id="reportUnifiedAll" type="button">Pilih Semua</button><button id="reportUnifiedNone" type="button">Kosongkan</button><strong id="reportUnifiedCount">0 dipilih</strong></div>' +
      '<div class="report-unified-checks">' + REPORT_DATASETS.map(function (dataset, index) {
        return '<label class="report-unified-check"><input type="checkbox" value="' + escapeHtml(dataset.key) + '" ' + (index < 8 ? 'checked' : '') + '><i class="fas ' + dataset.icon + '"></i><span><b>' + escapeHtml(dataset.label) + '</b><small>Sumber backend aplikasi</small></span></label>';
      }).join('') + '</div></section></div>' +
      '<div id="reportUnifiedProgress" class="report-unified-progress hidden">Menyiapkan data...</div>' +
      '<div class="report-unified-bar"><div><strong>File dibuat langsung di perangkat</strong><span>Data mengikuti cakupan akses pengguna yang sedang login.</span></div><button id="reportUnifiedDownload" type="button" class="btn btn-primary"><i class="fas fa-download"></i><span>Download Laporan</span></button></div>' +
      '<section class="report-unified-card" style="margin-top:18px;"><div class="report-unified-title"><span><i class="fas fa-history"></i></span><div><h3>Riwayat File Laporan</h3><p>Daftar laporan yang pernah dibuat di perangkat ini.</p></div></div>' +
      '<div class="table-scroll"><table><thead><tr><th>Dibuat</th><th>Periode</th><th>Format</th><th>Jumlah</th><th>Total</th></tr></thead><tbody id="reportHistoryList"></tbody></table></div></section>';

    document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.addEventListener('change', updateReportCount); });
    byId('reportUnifiedAll').addEventListener('click', function () { document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.checked = true; }); updateReportCount(); });
    byId('reportUnifiedNone').addEventListener('click', function () { document.querySelectorAll('.report-unified-check input').forEach(function (input) { input.checked = false; }); updateReportCount(); });
    byId('reportUnifiedDownload').addEventListener('click', downloadReport);
    updateReportCount();
    renderReportHistory();
    window.generateDanKirimLaporan = downloadReport;
    window.handleKirimLaporan = downloadReport;
    window.loadRiwayatLaporan = function () { return installReportCenter(); };
    window.kirimLaporanTelegram = function () { throw new Error('Pengiriman Telegram dinonaktifkan. Gunakan Download Laporan.'); };
    reportInstalled = true;
    return true;
  }

  function bootstrapRuntime() {
    installStyles();
    enhanceAuthentication();
    installSessionGuard();
    ensureRoleMenus();
    hardenPrint();
    hideRestrictedUserWidgets();
    installReportCenter();

    installAttempts += 1;
    if (installAttempts < 200 && (!window.__sppgUnifiedSessionInstalled || !window.callApi || !window.MENU_CONFIG)) {
      setTimeout(bootstrapRuntime, 150);
    } else if (installAttempts >= 200) {
      enhanceAuthentication();
    }
  }

  readValidSession(false);
  window.SPPGSessionGuard = {
    getToken: validTokenOrEmpty,
    isTokenUsable: isTokenUsable,
    getTokenExpiry: jwtExpiryMs,
    validateSession: function () { return readValidSession(true); },
    clearAuth: function (message) { clearAuthState(message, true); }
  };

  // Script berada di akhir body, jadi guard dipasang langsung sebelum bootstrap
  // aplikasi lain berjalan pada DOMContentLoaded.
  bootstrapRuntime();

  window.addEventListener('pageshow', bootstrapRuntime, { passive:true });
  window.addEventListener('storage', function(event) {
    if (event.key === CONFIG.sessionKey && !event.newValue && window.currentUser) {
      clearAuthState('Sesi telah berakhir di perangkat ini.', true);
    } else if (event.key === CONFIG.tokenKey && event.newValue) {
      window._supabaseToken = event.newValue;
    }
  });
  setInterval(function () {
    if (!storageGet(CONFIG.sessionKey)) {
      if (window.currentUser) clearAuthState('Sesi berakhir. Silakan login kembali.', true);
      return;
    }
    if (!readValidSession(true)) {
      clearAuthState('Sesi berakhir. Silakan login kembali.', true);
      return;
    }
    if (document.visibilityState !== 'hidden' && tokenNeedsRefresh()) {
      touchVisibleSession();
      if (typeof window.__sppgRefreshAccessToken === 'function') {
        window.__sppgRefreshAccessToken().then(function(ok) {
          if (!ok && !isTokenUsable(storageGet(CONFIG.tokenKey))) {
            clearAuthState('Sesi tidak dapat diperpanjang. Silakan login kembali.', true);
          }
        });
      }
    }
  }, CONFIG.sessionCheckMs);

  var domObserver = new MutationObserver(function () {
    var overlay = byId('authOverlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    window.requestAnimationFrame(function () {
      repairInputs();
      updateAuthHeading();
    });
  });
  domObserver.observe(document.documentElement, { childList:false, subtree:false, attributes:true, attributeFilter:['class'] });
})();


/* FULL_DATASET_EXPORT_PRINT_V1 */
(function(){
'use strict';
var MODULES={
  transaksi:{fn:'getTransactions',page:'transaksi'},approval:{fn:'getTransactions',page:'approval'},
  users:{fn:'getAllUsers',page:'users'},'master-bahan':{fn:'getMasterBahanBaku',page:'master-bahan'},
  'master-supplier':{fn:'getMasterSupplier',page:'master-supplier'},survei:{fn:'getSurveiBahanBaku',page:'survei'},
  'serah-terima':{fn:'getSerahTerima',page:'serah-terima'},'menu-mbg':{fn:'getMenuHarian',page:'menu-mbg'},
  'pending-payment':{fn:'getPendingPayments',page:'pending-payment'},'audit-log':{fn:'getAuditLog',page:'audit-log'}
};
function api(fn,params){return new Promise(function(resolve,reject){callApi(fn,params||[],resolve,reject)})}
function rowsOf(result){
  if(Array.isArray(result))return result;
  if(result&&Array.isArray(result.data))return result.data;
  if(result&&result.result&&Array.isArray(result.result.data))return result.result.data;
  return [];
}
function elementValue(id){var e=document.getElementById(id);return e?String(e.value||'').trim():''}
function transactionFilters(){
  var ids=[['txFilterSPPG','sppg'],['filterSPPG','sppg'],['txFilterYayasan','yayasan'],['filterYayasan','yayasan'],['txFilterKategori','kategori'],['filterKategori','kategori'],['txFilterTglStart','dateStart'],['filterTglStart','dateStart'],['txFilterTglEnd','dateEnd'],['filterTglEnd','dateEnd']];
  var out={};ids.forEach(function(x){var v=elementValue(x[0]);if(v&&v!=='ALL'&&out[x[1]]===undefined)out[x[1]]=v});return out;
}
function apiParams(key){
  if(key==='transaksi'||key==='approval')return [transactionFilters()];
  if(key==='audit-log')return [{search:elementValue('auditSearchInput'),action:elementValue('auditFilterAction'),dateStart:elementValue('auditFilterTglStart'),dateEnd:elementValue('auditFilterTglEnd')}];
  return [{}];
}
function filterControls(page){
  var root=document.getElementById('page-'+page);if(!root)return[];
  return Array.prototype.slice.call(root.querySelectorAll('input,select')).filter(function(e){
    var id=String(e.id||'').toLowerCase(),v=String(e.value||'').trim();
    return v&&v!=='ALL'&&(id.indexOf('filter')>=0||id.indexOf('search')>=0);
  });
}
function localFilter(rows,page){
  var controls=filterControls(page);if(!controls.length)return rows;
  return rows.filter(function(row){
    var text=JSON.stringify(row||{}).toLowerCase();
    return controls.every(function(e){
      var id=String(e.id||'').toLowerCase(),v=String(e.value||'').trim().toLowerCase();
      if(!v||v==='all'||id.indexOf('tglstart')>=0||id.indexOf('tglend')>=0||id.indexOf('datestart')>=0||id.indexOf('dateend')>=0)return true;
      return text.indexOf(v)>=0;
    });
  });
}
async function fetchAll(key){
  var cfg=MODULES[key];if(!cfg)throw new Error('Modul ekspor tidak didukung: '+key);
  var first=await api(cfg.fn,apiParams(key));var firstRows=rowsOf(first);
  var total=Number(first&&first.total)||firstRows.length,hasMore=!!(first&&first.hasMore),page=Number(first&&first.page)||1,pageSize=Number(first&&first.pageSize)||100;
  var rows=firstRows.slice();
  while(hasMore&&page<100){page++;var params=apiParams(key);var opt=params[0]&&typeof params[0]==='object'?Object.assign({},params[0]):{};opt.page=page;opt.pageSize=Math.min(100,Math.max(25,pageSize));params=[opt];var next=await api(cfg.fn,params);rows=rows.concat(rowsOf(next));hasMore=!!(next&&next.hasMore);if(rows.length>=total)break;}
  return localFilter(rows,cfg.page);
}
function flatten(row){
  var out={};Object.keys(row||{}).forEach(function(k){var v=row[k];if(v===null||v===undefined)out[k]='';else if(typeof v==='object')out[k]=JSON.stringify(v);else out[k]=v});return out;
}
function csvCell(v){var x=String(v==null?'':v).replace(/\r?\n/g,' ');return '"'+x.replace(/"/g,'""')+'"'}
function downloadCsv(rows,key){
  var flat=rows.map(flatten),cols=[];flat.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});
  if(!cols.length)throw new Error('Tidak ada data sesuai filter aktif.');
  var lines=[cols.map(csvCell).join(',')];flat.forEach(function(r){lines.push(cols.map(function(c){return csvCell(r[c])}).join(','))});
  var blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SIM-SPPG_'+key+'_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}
function printRows(rows,key){
  var flat=rows.map(flatten),cols=[];flat.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});if(!cols.length)throw new Error('Tidak ada data sesuai filter aktif.');
  var escFn=typeof esc==='function'?esc:function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var html='<!doctype html><html><head><meta charset="utf-8"><title>SIM-SPPG '+escFn(key)+'</title><style>@page{size:A4 landscape;margin:10mm}body{font:10px Arial;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#555}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:5px;vertical-align:top;word-break:break-word}th{background:#eef4f8}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>SIM-SPPG — '+escFn(key)+'</h1><p>Total '+rows.length+' data • '+new Date().toLocaleString('id-ID')+'</p><table><thead><tr>'+cols.map(function(c){return'<th>'+escFn(c)+'</th>'}).join('')+'</tr></thead><tbody>'+flat.map(function(r){return'<tr>'+cols.map(function(c){return'<td>'+escFn(r[c])+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>';
  var w=window.open('','_blank');if(!w)throw new Error('Popup print diblokir browser.');w.document.open();w.document.write(html);w.document.close();
}
function pageKey(){return String(window.currentPage||'').trim()}
async function run(kind){var key=pageKey();if(!MODULES[key])throw new Error('Ekspor penuh belum tersedia untuk halaman ini.');if(typeof showLoading==='function')showLoading(true);try{var rows=await fetchAll(key);if(kind==='csv')downloadCsv(rows,key);else printRows(rows,key);if(typeof showToast==='function')showToast('success',kind==='csv'?'CSV Dibuat':'Print Disiapkan',rows.length+' data sesuai filter aktif.');}finally{if(typeof showLoading==='function')showLoading(false)}}
window.exportCurrentFilteredCSV=function(){run('csv').catch(function(e){if(typeof showToast==='function')showToast('error','Ekspor Gagal',e.message);else alert(e.message)})};
window.printCurrentFilteredData=function(){run('print').catch(function(e){if(typeof showToast==='function')showToast('error','Print Gagal',e.message);else alert(e.message)})};
document.addEventListener('click',function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('button,a'):null;
  // Approval memiliki generator laporan khusus dengan struktur bisnis,
  // ringkasan, dan indikator kelengkapan. Jangan alihkan ke ekspor objek mentah.
  if(!b||pageKey()==='laporan'||pageKey()==='approval'||pageKey()==='transaksi')return;
  var signature=(String(b.textContent||'')+' '+String(b.title||'')+' '+String(b.getAttribute('aria-label')||'')+' '+String(b.getAttribute('onclick')||'')).toLowerCase();
  var kind=signature.indexOf('csv')>=0||signature.indexOf('export')>=0?'csv':signature.indexOf('print')>=0||signature.indexOf('cetak')>=0?'print':'';
  if(!kind||!MODULES[pageKey()])return;
  ev.preventDefault();ev.stopImmediatePropagation();if(kind==='csv')window.exportCurrentFilteredCSV();else window.printCurrentFilteredData();
},true);
})();

/* APPROVAL V2 DETAIL MODULE */
(function(){
'use strict';
window.renderPaymentProofHistory=function(tx){var ps=Array.isArray(tx&&tx.paymentProofs)?tx.paymentProofs:[];if(!ps.length)return'<div class="detail-doc-item doc-missing" style="margin-bottom:16px"><div class="detail-doc-icon"><i class="fas fa-receipt"></i></div><div><div class="detail-doc-label">Belum ada bukti pelunasan</div><div class="detail-doc-status">Transaksi masih menunggu pembayaran.</div></div></div>';var h='<div class="detail-section-title"><i class="fas fa-money-check-alt"></i> Riwayat Pembayaran ('+ps.length+')</div>';ps.forEach(function(p){var st=String(p.status||'').toUpperCase(),badge=st==='TERVERIFIKASI'?'badge-green':st==='DITOLAK'?'badge-red':'badge-orange';h+='<div class="info-card" style="margin-bottom:10px">'+infoRow('Pembayaran #'+(p.paymentSequence||'-'),'<strong>'+formatRupiah(p.nominal)+'</strong>')+infoRow('Status','<span class="badge '+badge+'">'+esc(st.replaceAll('_',' '))+'</span>')+infoRow('Diupload oleh',esc(p.submittedBy||'-'))+infoRow('Waktu upload',esc(p.submittedAt||'-'))+(p.verifiedBy?infoRow('Diverifikasi oleh',esc(p.verifiedBy)):'')+(p.verificationNotes?infoRow('Catatan',esc(p.verificationNotes)):'')+'</div>'+renderFilePreview(p.file,'Bukti Pelunasan #'+(p.paymentSequence||''),'fa-receipt')+(p.verifierSignature?renderFilePreview(p.verifierSignature,'TTD Verifikator #'+(p.paymentSequence||''),'fa-signature'):'')});return h};
})();

/* APPROVAL V2 STATUS MODULE */
(function(){
'use strict';
renderApprovalTable=window.renderApprovalTable;
window.openBulkApprovalPin=function(){showToast('warning','Tidak Tersedia','Bulk approval dinonaktifkan karena setiap transaksi wajib memiliki bukti pelunasan dan TTD verifikator.')};window.submitBulkApproval=window.openBulkApprovalPin;openBulkApprovalPin=window.openBulkApprovalPin;submitBulkApproval=window.submitBulkApproval;
})();

/* APPROVAL V2 ACTION MODULE */
(function(){
'use strict';
function n(v){return Number(v)||0}
function isAdmin(){return currentUser&&(currentUser.role==='ADMIN'||currentUser.role==='SUPER_ADMIN')}
function stat(x){return String(x&&x.metodeTransaksi||'').toUpperCase()}
function own(x){return currentUser&&String(x.user||'').toLowerCase()===String(currentUser.email||'').toLowerCase()}
window.openUserBuktiModal=function(id){if(!currentUser||currentUser.role!=='USER'||!uploadBuktiModeEnabled){showToast('warning','Tidak Tersedia','Upload bukti mandiri tidak tersedia.');return}showLoading(true);callApi('getTransactionDetail',[id],function(tx){showLoading(false);if(!tx||!own(tx)){showToast('error','Akses Ditolak','Transaksi bukan milik akun Anda.');return}if(stat(tx)==='SUDAH_DIBAYAR'){showToast('info','Sudah Lunas','Transaksi sudah dibayar.');return}if(stat(tx)==='MENUNGGU_VERIFIKASI'){showToast('info','Menunggu TTD','Pelunasan lengkap dan sedang menunggu TTD verifikator.');return}currentUserBuktiTxId=id;userBuktiFileData=null;window.userBuktiSisa=Math.max(0,n(tx.sisaPembayaran!=null?tx.sisaPembayaran:n(tx.nominal)-n(tx.nominalDibayar)));$('userBuktiBody').innerHTML='<div class="info-card">'+infoRow('Transaksi',esc(tx.kode||'-'))+infoRow('Item',esc(tx.item||'-'))+infoRow('Nominal Total','<strong>'+formatRupiah(tx.nominal)+'</strong>')+infoRow('Sudah diajukan',formatRupiah(tx.nominalDibayar||0))+infoRow('Sisa','<strong style="color:var(--rose)">'+formatRupiah(window.userBuktiSisa)+'</strong>')+'</div><div class="form-group"><label class="form-label">Nominal pembayaran ini <span class="req">*</span></label><input type="number" id="userBuktiNominal" min="1" max="'+window.userBuktiSisa+'" value="'+window.userBuktiSisa+'" class="form-input"><p class="form-hint">Boleh sebagian. TTD baru tersedia setelah total pembayaran penuh.</p></div><div class="form-group"><label class="form-label">Bukti pelunasan <span class="req">*</span></label><div class="file-input-wrap"><input type="file" id="userBuktiFile" accept="image/*,.pdf" onchange="handleUserBuktiFile(this)"><div class="file-input-label" id="labelUserBukti"><i class="fas fa-receipt"></i><span>Pilih foto/PDF</span></div></div><div id="userBuktiPreview" style="margin-top:10px"></div></div>';openModal('modalUserBukti')},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Tidak dapat memuat transaksi')})};openUserBuktiModal=window.openUserBuktiModal;
window.handleUserBuktiFile=function(input){var f=input.files&&input.files[0];if(!f)return;if(f.size>10*1024*1024){input.value='';showToast('error','File Terlalu Besar','Maksimal 10 MB.');return}var r=new FileReader();r.onload=function(e){var data=String(e.target.result);userBuktiFileData={base64:data.split(',')[1],mimeType:f.type||(f.name.toLowerCase().endsWith('.pdf')?'application/pdf':'image/jpeg'),fileName:f.name};var l=$('labelUserBukti');if(l)l.innerHTML='<i class="fas fa-check-circle" style="color:var(--emerald)"></i><span>'+esc(f.name)+'</span>';var p=$('userBuktiPreview');if(p)p.innerHTML=userBuktiFileData.mimeType.indexOf('image/')===0?'<img src="'+esc(data)+'" style="width:100%;max-height:220px;object-fit:contain;border-radius:10px">':'<div class="detail-doc-item"><div class="detail-doc-icon"><i class="fas fa-file-pdf"></i></div><div>'+esc(f.name)+'</div></div>'};r.readAsDataURL(f)};handleUserBuktiFile=window.handleUserBuktiFile;
window.submitUserBukti=function(){var amount=n($('userBuktiNominal')&&$('userBuktiNominal').value),left=n(window.userBuktiSisa);if(amount<=0){showToast('error','Validasi','Nominal wajib lebih dari 0.');return}if(amount>left){showToast('error','Validasi','Nominal melebihi sisa tagihan.');return}if(!userBuktiFileData){showToast('error','Validasi','Bukti pelunasan wajib diupload.');return}showLoading(true);callApi('submitUserBuktiPembayaran',[{txId:currentUserBuktiTxId,nominalDibayar:amount,buktiBase64:userBuktiFileData.base64,buktiMimeType:userBuktiFileData.mimeType,buktiFileName:userBuktiFileData.fileName}],function(r){showLoading(false);if(r&&r.success){closeModal('modalUserBukti');showToast('success',r.status==='MENUNGGU_VERIFIKASI'?'Menunggu TTD Verifikator':'Pembayaran Parsial',r.message);loadApprovalData();loadTransactions();loadDashboardData()}else showToast('error','Gagal',r&&r.message||'Bukti gagal disimpan')},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Terjadi kesalahan')})};submitUserBukti=window.submitUserBukti;
window.openApprovalModal=function(id){if(!isAdmin())return;currentTrxId=id;approvalFileData=null;showLoading(true);callApi('getTransactionDetail',[id],function(tx){showLoading(false);if(tx.canVerify){openVerifikasiModal(id);return}window.approvalTx=tx;currentApprovalNominal=Math.max(0,n(tx.sisaPembayaran!=null?tx.sisaPembayaran:tx.nominal));renderApprovalForm(tx);openModal('modalApproval');setTimeout(initApprovalCanvas,100)},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Tidak dapat memuat transaksi')})};openApprovalModal=window.openApprovalModal;
window.renderApprovalForm=function(tx){$('approvalBody').innerHTML='<div class="info-card">'+infoRow('Transaksi',esc(tx.kode||'-'))+infoRow('Item',esc(tx.item||'-'))+infoRow('Nominal transaksi',formatRupiah(tx.nominal))+infoRow('Sudah diajukan',formatRupiah(tx.nominalDibayar||0))+infoRow('Sisa dilunasi admin','<strong style="color:var(--emerald)">'+formatRupiah(currentApprovalNominal)+'</strong>')+'</div>'+renderPaymentProofHistory(tx)+'<div class="form-group"><label class="form-label">Bukti pelunasan <span class="req">*</span></label><input type="file" id="approvalFileInput" class="form-input" accept="image/*,.pdf" onchange="handleApprovalFile(this)"></div><div class="form-group"><label class="form-label">Catatan (Opsional)</label><textarea id="approvalCatatan" class="form-input"></textarea></div><div class="form-group"><label class="form-label">TTD Verifikator <span class="req">*</span></label><div class="canvas-container"><canvas id="approvalTtdCanvas"></canvas></div><div class="canvas-actions"><button type="button" onclick="clearApprovalCanvas()"><i class="fas fa-eraser"></i> Hapus</button></div></div>'};renderApprovalForm=window.renderApprovalForm;
window.preSubmitApproval=function(){if(!approvalFileData){showToast('error','Validasi','Bukti pelunasan wajib diupload.');return}if(!$('approvalTtdCanvas')||isCanvasBlank('approvalTtdCanvas')){showToast('error','Validasi','TTD verifikator wajib diisi.');return}pendingConfirmNominal=currentApprovalNominal||0;$('nominalConfirmTitle').textContent='Sisa Pelunasan';$('nominalConfirmDisplay').textContent=formatRupiah(pendingConfirmNominal);$('nominalConfirmLabel').textContent='Ketik ulang sisa nominal untuk konfirmasi';$('nominalConfirmInput').value='';$('pinError').style.display='none';openModal('modalPin')};preSubmitApproval=window.preSubmitApproval;
window.openVerifikasiModal=function(id){if(!isAdmin())return;currentVerifikasiTxId=id;showLoading(true);callApi('getTransactionDetail',[id],function(tx){showLoading(false);if(!tx.canVerify){showToast('warning','Belum Lunas','Total bukti belum penuh. TTD belum dapat diberikan.');return}currentVerifikasiNominal=n(tx.nominal);window.verificationTx=tx;renderVerifikasiForm(tx);openModal('modalVerifikasiPembayaran');setTimeout(function(){initTtdCanvas('verifTtdCanvas')},100)},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Tidak dapat memuat transaksi')})};openVerifikasiModal=window.openVerifikasiModal;
window.renderVerifikasiForm=function(tx){$('verifikasiBody').innerHTML='<div class="info-card">'+infoRow('Transaksi',esc(tx.kode||'-'))+infoRow('Item',esc(tx.item||'-'))+infoRow('Nominal transaksi',formatRupiah(tx.nominal))+infoRow('Total diajukan','<strong style="color:var(--emerald)">'+formatRupiah(tx.nominalDibayar)+'</strong>')+infoRow('Sisa',formatRupiah(tx.sisaPembayaran))+'</div><div style="padding:10px;background:#fff7ed;color:#9a3412;border-radius:8px;margin:12px 0"><i class="fas fa-info-circle"></i> TTD akan memverifikasi seluruh bukti yang menunggu.</div>'+renderPaymentProofHistory(tx)+'<div class="form-group"><label class="form-label">Catatan (Opsional)</label><textarea id="verifCatatan" class="form-input"></textarea></div><div class="form-group"><label class="form-label">TTD Verifikator <span class="req">*</span></label><div class="canvas-container"><canvas id="verifTtdCanvas"></canvas></div><div class="canvas-actions"><button type="button" onclick="clearTtdCanvas(\'verifTtdCanvas\')"><i class="fas fa-eraser"></i> Hapus</button></div></div>'};renderVerifikasiForm=window.renderVerifikasiForm;
window.submitVerifikasiPembayaran=function(){if(!$('verifTtdCanvas')||isCanvasBlank('verifTtdCanvas')){showToast('error','Validasi','TTD verifikator wajib diisi.');return}verifCatatanTemp=$('verifCatatan')?$('verifCatatan').value:'';verifikasiPembayaranMode=true;pendingConfirmNominal=currentVerifikasiNominal||0;$('nominalConfirmTitle').textContent='Total Transaksi';$('nominalConfirmDisplay').textContent=formatRupiah(pendingConfirmNominal);$('nominalConfirmLabel').textContent='Ketik ulang total nominal untuk konfirmasi TTD';$('nominalConfirmInput').value='';$('pinError').style.display='none';openModal('modalPin')};submitVerifikasiPembayaran=window.submitVerifikasiPembayaran;
window.submitApprovalWithPin=function(){var t=String($('nominalConfirmInput')?$('nominalConfirmInput').value:'').trim();if(!/^\d+$/.test(t)||parseInt(t,10)!==Math.round(pendingConfirmNominal)){if($('pinErrorText'))$('pinErrorText').textContent='Nominal konfirmasi tidak cocok.';if($('pinError'))$('pinError').style.display='block';return}var verificationRequested=verifikasiPembayaranMode;closeModal('modalPin');if(verificationRequested){verifikasiPembayaranMode=false;doSubmitVerifikasiPembayaran();return}if(bulkApprovalMode){bulkApprovalMode=false;openBulkApprovalPin();return}if(!approvalFileData||!$('approvalTtdCanvas')||isCanvasBlank('approvalTtdCanvas')){showToast('error','Validasi','Bukti dan TTD wajib tersedia.');return}var d={id:currentTrxId,approvedBy:currentUser.namaLengkap||currentUser.username,ttdBase64:$('approvalTtdCanvas').toDataURL('image/png').split(',')[1],catatanApproval:$('approvalCatatan')?$('approvalCatatan').value:'',buktiBase64:approvalFileData.base64,buktiMimeType:approvalFileData.mimeType,buktiFileName:approvalFileData.fileName};closeModal('modalApproval');showLoading(true);callApi('approveTransaction',[d],function(r){showLoading(false);if(r&&r.success){showToast('success','Sudah Dibayar',r.message);loadTransactions();loadApprovalData();loadDashboardData()}else showToast('error','Gagal',r&&r.message||'Approval gagal')},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Terjadi kesalahan')})};submitApprovalWithPin=window.submitApprovalWithPin;
window.doSubmitVerifikasiPembayaran=function(){if(!$('verifTtdCanvas')||isCanvasBlank('verifTtdCanvas'))return;var sig=$('verifTtdCanvas').toDataURL('image/png').split(',')[1];closeModal('modalVerifikasiPembayaran');showLoading(true);callApi('verifyUserPayment',[{txId:currentVerifikasiTxId,ttdBase64:sig,catatanApproval:verifCatatanTemp,approvedBy:currentUser.namaLengkap||currentUser.username}],function(r){showLoading(false);if(r&&r.success){showToast('success','Sudah Dibayar',r.message);loadApprovalData();loadTransactions();loadDashboardData()}else showToast('error','Gagal',r&&r.message||'Verifikasi gagal')},function(e){showLoading(false);showToast('error','Gagal',e&&e.message||'Terjadi kesalahan')})};doSubmitVerifikasiPembayaran=window.doSubmitVerifikasiPembayaran;
})();

/* Activate bulk payment handlers after the legacy action modules. */
(function(){
  var submitSingleUserProof=window.submitUserBukti;
  window.openBulkApprovalPin=window.__bulkOpenApproval;
  window.submitBulkApproval=window.__bulkSubmitApproval;
  window.preSubmitApproval=window.__bulkPreSubmitApproval;
  window.submitApprovalWithPin=window.__bulkSubmitApprovalPin;
  window.submitUserBukti=function(){
    var ids=Array.isArray(window.currentUserBuktiTxIds)?window.currentUserBuktiTxIds:[];
    if(ids.length>=2)return window.__bulkSubmitUserProof();
    return submitSingleUserProof();
  };
  openBulkApprovalPin=window.openBulkApprovalPin;
  submitBulkApproval=window.submitBulkApproval;
  preSubmitApproval=window.preSubmitApproval;
  submitApprovalWithPin=window.submitApprovalWithPin;
  submitUserBukti=window.submitUserBukti;
})();
