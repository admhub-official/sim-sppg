from pathlib import Path

path = Path('app.js')
source = path.read_text(encoding='utf-8')

old = "var SUPABASE_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/dynamic-action';"
new = """var SUPABASE_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/dynamic-action';
var SECURE_USER_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/secure-user-action';"""
assert source.count(old) == 1
source = source.replace(old, new, 1)

old = """  var headers = { 'Content-Type': 'application/json' };
  if (!PUBLIC_FN[fnName]) {
    var token = getJwtToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }

  var TIMEOUT_MS = 20000;"""
new = """  var headers = { 'Content-Type': 'application/json' };
  var isSecureUserAction = fnName === 'updateUserProfile' || fnName === 'uploadFotoProfil';
  var requestUrl = isSecureUserAction ? SECURE_USER_FN_URL : SUPABASE_FN_URL;
  if (!PUBLIC_FN[fnName]) {
    var token = getJwtToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  if (isSecureUserAction && window._supabaseKey) {
    headers.apikey = window._supabaseKey;
  }

  var TIMEOUT_MS = 20000;"""
assert source.count(old) == 1
source = source.replace(old, new, 1)

old = "fetch(SUPABASE_FN_URL, {"
new = "fetch(requestUrl, {"
assert source.count(old) == 1
source = source.replace(old, new, 1)

path.write_text(source, encoding='utf-8')
