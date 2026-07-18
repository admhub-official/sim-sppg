from pathlib import Path

p=Path('app.js')
s=p.read_text(encoding='utf-8')

if "var GEOCODE_FN_URL" not in s:
    anchor="var PUSH_PUBLIC_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/push-public-action';"
    s=s.replace(anchor,anchor+"\nvar GEOCODE_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/geocode-action';")

if "var GEOCODE_FN" not in s:
    anchor="var PUSH_PUBLIC_FN = { getPushPublicKey:1 };"
    s=s.replace(anchor,anchor+"\nvar GEOCODE_FN = { geocodeAlamat:1 };")

old="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (PUSH_PUBLIC_FN[fnName] ? PUSH_PUBLIC_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL : (PUSH_FN[fnName] ? PUSH_FN_URL : SUPABASE_FN_URL))))))));"
new="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (PUSH_PUBLIC_FN[fnName] ? PUSH_PUBLIC_FN_URL : (GEOCODE_FN[fnName] ? GEOCODE_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL : (PUSH_FN[fnName] ? PUSH_FN_URL : SUPABASE_FN_URL)))))))));"
if old in s:
    s=s.replace(old,new)
elif "GEOCODE_FN[fnName] ? GEOCODE_FN_URL" not in s:
    raise SystemExit('requestUrl anchor not found')

p.write_text(s,encoding='utf-8')
