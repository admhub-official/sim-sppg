from pathlib import Path

p=Path('app.js')
s=p.read_text(encoding='utf-8')

# Add native geocode route URL/map.
anchor="var PUSH_PUBLIC_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/push-public-action';"
if "var GEOCODE_FN_URL" not in s:
    s=s.replace(anchor, anchor+"\nvar GEOCODE_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/geocode-action';")
anchor2="var PUSH_PUBLIC_FN = { getPushPublicKey:1 };"
if "var GEOCODE_FN =" not in s:
    s=s.replace(anchor2, anchor2+"\nvar GEOCODE_FN = { geocodeAlamat:1 };")

old="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (PUSH_PUBLIC_FN[fnName] ? PUSH_PUBLIC_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL : (PUSH_FN[fnName] ? PUSH_FN_URL : SUPABASE_FN_URL))))))));"
new="""var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL :
    (PUSH_PUBLIC_FN[fnName] ? PUSH_PUBLIC_FN_URL :
    (GEOCODE_FN[fnName] ? GEOCODE_FN_URL :
    (isSecureUserAction ? SECURE_USER_FN_URL :
    (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL :
    (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL :
    (REPORTING_FN[fnName] ? REPORTING_FN_URL :
    (MASTER_FN[fnName] ? MASTER_FN_URL :
    (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL :
    (PUSH_FN[fnName] ? PUSH_FN_URL : ''))))))));
  if (!requestUrl) {
    var routeError = new Error('Fungsi API tidak terdaftar: ' + fnName);
    if (onFailure) onFailure(routeError); else console.error(routeError.message);
    return;
  }"""
if old in s:
    s=s.replace(old,new)
elif "Fungsi API tidak terdaftar" not in s:
    raise SystemExit('callApi route resolver anchor not found')

p.write_text(s,encoding='utf-8')

# Runtime override no longer needed.
u=Path('uiux-fixes.js')
u.write_text("/* Native routing is now in app.js. Kept as an empty compatibility stub. */\n(function(){ 'use strict'; })();\n",encoding='utf-8')
print('final routing hardening applied')
