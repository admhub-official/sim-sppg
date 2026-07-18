from pathlib import Path

path = Path('app.js')
src = path.read_text(encoding='utf-8')
start = src.index("var SUPABASE_FN_URL =")
end = src.index("// ============================================================\n// 1. STATE MANAGEMENT", start)
block = r'''var API_BASE_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';
var API_ROUTES = {
  'transaction-action': {
    getTransactions:1, getTransactionDetail:1, addTransaction:1, editTransaction:1,
    approveTransaction:1, submitUserBuktiPembayaran:1, verifyUserPayment:1,
    sendCatatanApproval:1, uploadTxFile:1, deleteTransaction:1
  },
  'operations-action': {
    getAllUsers:1, deleteUser:1, getUploadBuktiMode:1, setUploadBuktiMode:1,
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
  'register-user-v2': { registerUser:1 },
  'auth-public-action': { verifyRegistrationOtp:1, resendRegistrationOtp:1, loginUser:1, checkSession:1 },
  'account-recovery-action': { recoverPassword:1, recoverUsername:1, recoverToken:1 },
  'app-config-action': { getAppConfig:1, getDropdownOptions:1 }
};
var PUBLIC_FN = {
  registerUser:1, verifyRegistrationOtp:1, resendRegistrationOtp:1,
  loginUser:1, checkSession:1, recoverPassword:1, recoverUsername:1,
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

function callApi(fnName, params, onSuccess, onFailure) {
  var slug = API_ROUTE_BY_FUNCTION[fnName];
  if (!slug) {
    var unknown = new Error('Fungsi API tidak terdaftar: ' + String(fnName || ''));
    if (onFailure) onFailure(unknown); else console.error(unknown.message);
    return;
  }

  var headers = { 'Content-Type': 'application/json' };
  if (!PUBLIC_FN[fnName]) {
    var token = getJwtToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }
  if (slug === 'secure-user-action' && window._supabaseKey) headers.apikey = window._supabaseKey;

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
        try { localStorage.setItem('sppg_jwt', result.token); } catch(e) {}
        window._supabaseToken = result.token;
      }
      if (onSuccess) onSuccess(result);
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

'''
path.write_text(src[:start] + block + src[end:], encoding='utf-8')
print('Patched app.js with native explicit API router')
