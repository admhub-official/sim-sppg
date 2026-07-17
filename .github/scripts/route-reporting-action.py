from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

url_anchor = "var OPERATIONS_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/operations-action';\n"
url_line = "var REPORTING_FN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/reporting-action';\n"
if url_line not in text:
    if url_anchor not in text:
        raise SystemExit('operations URL anchor not found')
    text = text.replace(url_anchor, url_anchor + url_line, 1)

map_anchor = "var OPERATIONS_FN = {\n  getAllUsers:1, deleteUser:1,\n  getPendingPayments:1, updatePendingPayment:1, deletePendingPayment:1,\n  getSurveiBahanBaku:1, updateSurvei:1, deleteSurvei:1,\n  getSerahTerima:1, updateSerahTerima:1, deleteSerahTerima:1,\n  getMenuHarian:1, updateMenuMBG:1, deleteMenuMBG:1\n};\n"
report_map = "var REPORTING_FN = {\n  getDashboardKPI:1, getChartData:1, getSPPGData:1, getRekapHarian:1,\n  getFilterOptions:1, getAuditLog:1, getNotifications:1\n};\n"
if report_map not in text:
    if map_anchor not in text:
        raise SystemExit('operations map anchor not found')
    text = text.replace(map_anchor, map_anchor + report_map, 1)

old = "var requestUrl = isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : SUPABASE_FN_URL));"
new = "var requestUrl = isSecureUserAction ? SECURE_USER_FN_URL : (TRANSACTION_FN[fnName] ? TRANSACTION_FN_URL : (OPERATIONS_FN[fnName] ? OPERATIONS_FN_URL : (REPORTING_FN[fnName] ? REPORTING_FN_URL : SUPABASE_FN_URL)));"
if new not in text:
    if old not in text:
        raise SystemExit('request URL anchor not found')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('reporting-action routing installed')
