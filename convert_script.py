import re

# Baca file
with open('/workspace/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# LANGKAH 1: Hapus polyfill lama dan ganti dengan callApi()
# Temukan blok dari "// 0. POLYFILL: google.script.run" sampai "})();\n\n// ============================================================"
polyfill_pattern = r'// ============================================================\n// 0\. POLYFILL: google\.script\.run.*?window\.google\.script\.run = createScriptRunProxy\(null, null\);\n\}\)\);'

new_callapi = '''// ============================================================
// 0. API HELPER — langsung ke Supabase Edge Function
// ============================================================
var SUPABASE_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/dynamic-action ';

var PUBLIC_FN = {
  registerUser:1, verifyRegistrationOtp:1, resendRegistrationOtp:1,
  loginUser:1, checkSession:1, recoverPassword:1, recoverUsername:1,
  recoverToken:1, getAppConfig:1, getDropdownOptions:1
};

function getJwtToken() {
  try { return localStorage.getItem('sppg_jwt') || ''; } catch(e) { return ''; }
}

function callApi(fnName, params, onSuccess, onFailure) {
  var headers = { 'Content-Type': 'application/json' };
  if (!PUBLIC_FN[fnName]) {
    var token = getJwtToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  var TIMEOUT_MS = 20000;
  var MAX_RETRY  = 2;
  function doFetch(attempt) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tid = controller ? setTimeout(function(){ controller.abort(); }, TIMEOUT_MS) : null;
    fetch(SUPABASE_FN_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ function: fnName, parameters: params }),
      signal: controller ? controller.signal : undefined
    })
    .then(function(res) {
      if (tid) clearTimeout(tid);
      return res.text().then(function(text) {
        var json;
        try { json = text ? JSON.parse(text) : {}; } catch(e) { throw new Error('Server error (HTTP ' + res.status + ')'); }
        if (!res.ok && !json.error) throw new Error('Server error (HTTP ' + res.status + ')');
        return json;
      });
    })
    .then(function(json) {
      if (json && json.error) {
        if (onFailure) onFailure(new Error(json.error));
        else console.error('callApi error (' + fnName + '):', json.error);
        return;
      }
      var result = (json && Object.prototype.hasOwnProperty.call(json, 'result')) ? json.result : json;
      if (fnName === 'loginUser' && result && result.success && result.token) {
        try { localStorage.setItem('sppg_jwt', result.token); } catch(e) {}
      }
      if (onSuccess) onSuccess(result);
    })
    .catch(function(err) {
      if (tid) clearTimeout(tid);
      var isNet = err && (err.name === 'AbortError' || err.name === 'TypeError');
      if (isNet && attempt < MAX_RETRY) { setTimeout(function(){ doFetch(attempt+1); }, 800*(attempt+1)); return; }
      if (err && err.name === 'AbortError') err = new Error('Koneksi ke server timeout, silakan coba lagi.');
      if (onFailure) onFailure(err);
      else console.error('callApi fetch failed (' + fnName + '):', err);
    });
  }
  doFetch(0);
}'''

content = re.sub(polyfill_pattern, new_callapi, content, flags=re.DOTALL)

# Simpan sementara untuk verifikasi
with open('/workspace/index_temp.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Langkah 1 selesai: Polyfill diganti dengan callApi()")
