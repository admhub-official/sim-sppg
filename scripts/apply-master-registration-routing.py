from pathlib import Path
p=Path('app.js')
t=p.read_text(encoding='utf-8')
anchor="var REPORTING_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/reporting-action';\n"
insert="var MASTER_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/master-action';\nvar REGISTER_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/register-user-v2';\n"
if insert not in t:
    if anchor not in t: raise SystemExit('reporting URL anchor missing')
    t=t.replace(anchor,anchor+insert,1)
map_anchor="var REPORTING_FN = {\n  getDashboardKPI:1, getChartData:1, getSPPGData:1, getRekapHarian:1,\n  getFilterOptions:1, getAuditLog:1, getNotifications:1\n};\n"
master_map="var MASTER_FN = {\n  getMasterBahanBaku:1, addMasterBahanBaku:1, updateMasterBahanBaku:1, deleteMasterBahanBaku:1,\n  getMasterSupplier:1, addMasterSupplier:1, updateMasterSupplier:1, deleteSupplier:1,\n  uploadSupplierFile:1, uploadFotoSurvei:1, uploadSerahTerimaFile:1\n};\n"
if master_map not in t:
    if map_anchor not in t: raise SystemExit('reporting map anchor missing')
    t=t.replace(map_anchor,map_anchor+master_map,1)
old="var requestUrl = isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : SUPABASE_FN_URL)));"
new="var requestUrl = fnName === 'registerUser' ? REGISTER_FN_URL : (isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : (MASTER_FN[fnName] ? MASTER_FN_URL : SUPABASE_FN_URL)))));"
if new not in t:
    if old not in t: raise SystemExit('request router anchor missing')
    t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
print('master and registration routing installed')
print('routing retry version 2')
