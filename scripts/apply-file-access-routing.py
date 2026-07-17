from pathlib import Path
p=Path('app.js')
t=p.read_text(encoding='utf-8')
anchor="var MASTER_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/master-action';\n"
line="var FILE_ACCESS_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/file-access-action';\n"
if line not in t:
    if anchor not in t: raise SystemExit('master URL anchor missing')
    t=t.replace(anchor,anchor+line,1)
map_anchor="var MASTER_FN = {\n  getMasterBahanBaku:1, addMasterBahanBaku:1, updateMasterBahanBaku:1, deleteMasterBahanBaku:1,\n  getMasterSupplier:1, addMasterSupplier:1, updateMasterSupplier:1, deleteSupplier:1,\n  uploadSupplierFile:1, uploadFotoSurvei:1, uploadSerahTerimaFile:1\n};\n"
access_map="var FILE_ACCESS_FN = { getFileUrl:1, showCredentials:1 };\n"
if access_map not in t:
    if map_anchor not in t: raise SystemExit('master map anchor missing')
    t=t.replace(map_anchor,map_anchor+access_map,1)
old="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : SUPABASE_FN_URL)))));"
new="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : (FILE_ACCESS_FN[fnName] ? FILE_ACCESS_FN_URL : SUPABASE_FN_URL))))));"
if new not in t:
    if old not in t: raise SystemExit('router anchor missing')
    t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
print('file access routing installed')
