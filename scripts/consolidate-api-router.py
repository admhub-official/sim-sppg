from pathlib import Path

app_path = Path('app.js')
loader_path = Path('supplier-dropdown.js')
ci_path = Path('.github/workflows/ci.yml')
app = app_path.read_text(encoding='utf-8')
loader = loader_path.read_text(encoding='utf-8')
ci = ci_path.read_text(encoding='utf-8')

old_tx = """  'transaction-action': {\n    addTransaction:1, editTransaction:1, sendCatatanApproval:1, getTransactionSuggestions:1,\n    getTransactionSummary:1, uploadTxFile:1, deleteTransaction:1\n  },\n"""
new_tx = """  'transaction-action': { sendCatatanApproval:1, getTransactionSuggestions:1, deleteTransaction:1 },\n  'transaction-create-action': { addTransaction:1 },\n  'transaction-edit-action': { editTransaction:1 },\n  'transaction-file-upload-action': { uploadTxFile:1 },\n  'transaction-summary-action': { getTransactionSummary:1 },\n"""
if old_tx not in app:
    raise SystemExit('transaction route block anchor missing')
app = app.replace(old_tx, new_tx, 1)

old_master = """  'master-action': {\n    getMasterBahanBaku:1, addMasterBahanBaku:1, updateMasterBahanBaku:1, deleteMasterBahanBaku:1,\n    getMasterSupplier:1, addMasterSupplier:1, updateMasterSupplier:1, deleteSupplier:1,\n    uploadSupplierFile:1, uploadFotoSurvei:1, uploadSerahTerimaFile:1\n  },\n"""
new_master = """  'master-action': {\n    getMasterBahanBaku:1, addMasterBahanBaku:1, updateMasterBahanBaku:1, deleteMasterBahanBaku:1,\n    getMasterSupplier:1, addMasterSupplier:1, updateMasterSupplier:1,\n    uploadSupplierFile:1, uploadFotoSurvei:1, uploadSerahTerimaFile:1\n  },\n  'supplier-delete-action': { deleteSupplier:1 },\n"""
if old_master not in app:
    raise SystemExit('master route block anchor missing')
app = app.replace(old_master, new_master, 1)

map_anchor = """Object.keys(API_ROUTES).forEach(function(slug) {\n  Object.keys(API_ROUTES[slug]).forEach(function(fn) { API_ROUTE_BY_FUNCTION[fn] = slug; });\n});\n"""
resolver = map_anchor + """\nfunction resolveApiSlug(fnName, params) {\n  if (fnName === 'getTransactions' && Array.isArray(params) && params[0] && params[0].approvalOnly === true) {\n    return 'approval-query-action';\n  }\n  return API_ROUTE_BY_FUNCTION[fnName] || '';\n}\n"""
if map_anchor not in app:
    raise SystemExit('route map anchor missing')
app = app.replace(map_anchor, resolver, 1)

app = app.replace(
    "  getAppConfig:300000, getDropdownOptions:300000,\n",
    "  getAppConfig:300000, getDropdownOptions:300000, getTransactionSummary:15000,\n",
    1,
)

if "  var slug = API_ROUTE_BY_FUNCTION[fnName];" not in app:
    raise SystemExit('callApi route lookup anchor missing')
app = app.replace("  var slug = API_ROUTE_BY_FUNCTION[fnName];", "  var slug = resolveApiSlug(fnName, params);", 1)

if "  var TIMEOUT_MS = 20000;" not in app:
    raise SystemExit('timeout anchor missing')
app = app.replace("  var TIMEOUT_MS = 20000;", "  var TIMEOUT_MS = fnName === 'uploadTxFile' ? 60000 : 20000;", 1)

stage_line = "    { base: MODULE_BASE, file: 'stage-d-api-router.js', marker: 'data-stage-d-api-router', version: '20260731-edit-route-v2' },\n"
add_line = "    { base: TRANSACTION_BASE, file: 'add-save-reliability.js', marker: 'data-add-save-reliability', version: '20260731-create-route-v1' },\n"
for line, label in [(stage_line, 'stage-d loader entry'), (add_line, 'add reliability loader entry')]:
    if line not in loader:
        raise SystemExit(f'{label} missing')
    loader = loader.replace(line, '', 1)

ci = ci.replace("            assets/js/supplier/stage-d-api-router.js\n", '')

required_app = [
    "'transaction-create-action': { addTransaction:1 }",
    "'transaction-edit-action': { editTransaction:1 }",
    "'transaction-file-upload-action': { uploadTxFile:1 }",
    "'transaction-summary-action': { getTransactionSummary:1 }",
    "'supplier-delete-action': { deleteSupplier:1 }",
    "return 'approval-query-action';",
    "var slug = resolveApiSlug(fnName, params);",
    "fnName === 'uploadTxFile' ? 60000 : 20000",
    "getTransactionSummary:15000",
]
for token in required_app:
    if token not in app:
        raise SystemExit('missing app token after consolidation: ' + token)

for retired in ['stage-d-api-router.js', 'add-save-reliability.js']:
    if retired in loader:
        raise SystemExit('retired runtime router still loaded: ' + retired)

app_path.write_text(app, encoding='utf-8')
loader_path.write_text(loader, encoding='utf-8')
ci_path.write_text(ci, encoding='utf-8')

for path in [
    Path('assets/js/supplier/stage-d-api-router.js'),
    Path('assets/js/transactions/add-save-reliability.js'),
]:
    if not path.exists():
        raise SystemExit('expected retired module missing before cleanup: ' + str(path))
    path.unlink()

print('Central API router now owns all hardened endpoint routing; runtime wrappers removed.')
