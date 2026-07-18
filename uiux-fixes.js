/* SIM-SPPG explicit runtime API router. */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;

  var BASE='https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/';
  var ROUTES={
    'transaction-action':['getTransactions','getTransactionDetail','addTransaction','editTransaction','approveTransaction','submitUserBuktiPembayaran','verifyUserPayment','sendCatatanApproval','uploadTxFile','deleteTransaction'],
    'operations-action':['getAllUsers','deleteUser','getUploadBuktiMode','setUploadBuktiMode','addPendingPayment','addSurveiBahanBaku','addSerahTerima','addMenuHarian','getAdminAssignments','addAdminAssignment','updateAdminAssignment','deleteAdminAssignment','getPendingPayments','updatePendingPayment','deletePendingPayment','getSurveiBahanBaku','updateSurvei','deleteSurvei','getSerahTerima','updateSerahTerima','deleteSerahTerima','getMenuHarian','updateMenuMBG','deleteMenuMBG'],
    'reporting-action':['getDashboardKPI','getChartData','getSPPGData','getRekapHarian','getFilterOptions','getAuditLog','getNotifications','markNotificationRead','markAllNotificationsRead'],
    'master-action':['getMasterBahanBaku','addMasterBahanBaku','updateMasterBahanBaku','deleteMasterBahanBaku','getMasterSupplier','addMasterSupplier','updateMasterSupplier','deleteSupplier','uploadSupplierFile','uploadFotoSurvei','uploadSerahTerimaFile'],
    'file-access-action':['getFileUrl','showCredentials'],
    'secure-user-action':['updateUserProfile','uploadFotoProfil'],
    'push-action':['savePushSubscription','deletePushSubscription'],
    'push-public-action':['getPushPublicKey'],
    'geocode-action':['geocodeAlamat'],
    'register-user-v2':['registerUser'],
    'auth-public-action':['verifyRegistrationOtp','resendRegistrationOtp','loginUser','checkSession'],
    'account-recovery-action':['recoverPassword','recoverUsername','recoverToken'],
    'app-config-action':['getAppConfig','getDropdownOptions']
  };
  var PUBLIC=new Set(['registerUser','getPushPublicKey','verifyRegistrationOtp','resendRegistrationOtp','loginUser','checkSession','recoverPassword','recoverUsername','recoverToken','getAppConfig','getDropdownOptions']);
  var routeMap={};
  Object.keys(ROUTES).forEach(function(slug){ROUTES[slug].forEach(function(fn){routeMap[fn]=slug;});});

  window.callApi=function(fnName,params,onSuccess,onFailure){
    var slug=routeMap[fnName];
    if(!slug){
      var unknown=new Error('Fungsi API tidak terdaftar: '+String(fnName||''));
      if(onFailure) onFailure(unknown); else console.error(unknown.message);
      return;
    }
    var headers={'Content-Type':'application/json'};
    if(!PUBLIC.has(fnName)){
      try{var token=localStorage.getItem('sppg_jwt')||'';if(token)headers.Authorization='Bearer '+token;}catch(_e){}
    }
    if(slug==='secure-user-action'&&window._supabaseKey)headers.apikey=window._supabaseKey;
    var controller=typeof AbortController!=='undefined'?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},20000):null;
    fetch(BASE+slug,{method:'POST',headers:headers,body:JSON.stringify({function:fnName,parameters:Array.isArray(params)?params:[]}),signal:controller?controller.signal:undefined})
      .then(function(res){return res.text().then(function(text){var json={};try{json=text?JSON.parse(text):{};}catch(_e){throw new Error('Respons server tidak valid (HTTP '+res.status+').');}if(!res.ok||json.error)throw new Error(json.error||('Server error (HTTP '+res.status+')'));return Object.prototype.hasOwnProperty.call(json,'result')?json.result:json;});})
      .then(function(result){if(fnName==='loginUser'&&result&&result.success&&result.token){try{localStorage.setItem('sppg_jwt',result.token);}catch(_e){}window._supabaseToken=result.token;}if(onSuccess)onSuccess(result);})
      .catch(function(err){if(err&&err.name==='AbortError')err=new Error('Koneksi ke server timeout, silakan coba lagi.');if(onFailure)onFailure(err);else console.error('callApi failed ('+fnName+'):',err);})
      .finally(function(){if(timer)clearTimeout(timer);});
  };
})();
