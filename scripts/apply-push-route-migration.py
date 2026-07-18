from pathlib import Path

p=Path('app.js')
s=p.read_text(encoding='utf-8')

if "var PUSH_FN_URL =" not in s:
    s=s.replace("var SECURE_USER_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/secure-user-action';",
                "var SECURE_USER_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/secure-user-action';\nvar PUSH_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/push-action';\nvar PUSH_PUBLIC_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/push-public-action';")

if 'var PUSH_FN = {' not in s:
    s=s.replace("var FILE_ACCESS_FN = { getFileUrl:1, showCredentials:1 };",
                "var FILE_ACCESS_FN = { getFileUrl:1, showCredentials:1 };\nvar PUSH_FN = { savePushSubscription:1, deletePushSubscription:1 };\nvar PUSH_PUBLIC_FN = { getPushPublicKey:1 };")

s=s.replace("recoverToken:1, getAppConfig:1, getDropdownOptions:1\n};",
            "recoverToken:1, getAppConfig:1, getDropdownOptions:1, getPushPublicKey:1\n};")

old="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL : SUPABASE_FN_URL))))));"
new="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (PUSH_PUBLIC_FN[fnName] ? PUSH_PUBLIC_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL : (PUSH_FN[fnName] ? PUSH_FN_URL : SUPABASE_FN_URL))))))));"
if old in s:
    s=s.replace(old,new)
elif 'PUSH_PUBLIC_FN[fnName]' not in s:
    raise SystemExit('callApi requestUrl anchor not found')

required=['PUSH_FN_URL','PUSH_PUBLIC_FN_URL','savePushSubscription:1','deletePushSubscription:1','getPushPublicKey:1','PUSH_PUBLIC_FN[fnName]','PUSH_FN[fnName]']
for token in required:
    if token not in s: raise SystemExit(f'missing token: {token}')
p.write_text(s,encoding='utf-8')
print('push route migration applied')
