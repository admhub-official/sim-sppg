from pathlib import Path

app_path = Path('app.js')
check_path = Path('scripts/check-egress-regression.mjs')
app = app_path.read_text(encoding='utf-8')
check = check_path.read_text(encoding='utf-8')

app = app.replace(
    'var apiReadCache = Object.create(null);\n',
    'var apiReadCache = Object.create(null);\nvar apiReadInFlight = Object.create(null);\n',
    1,
)

cache_anchor = """  if (cached) delete apiReadCache[cacheKey];\n\n  var requestUrl = API_BASE_URL + slug;\n"""
cache_replacement = """  if (cached) delete apiReadCache[cacheKey];\n\n  // Coalesce identical cacheable reads that arrive before the first response.\n  // This keeps one network request per read key while preserving every caller callback.\n  if (cacheKey && apiReadInFlight[cacheKey]) {\n    apiReadInFlight[cacheKey].push({ onSuccess: onSuccess, onFailure: onFailure });\n    return;\n  }\n  if (cacheKey) apiReadInFlight[cacheKey] = [{ onSuccess: onSuccess, onFailure: onFailure }];\n\n  function resolveRead(result) {\n    if (!cacheKey) { if (onSuccess) onSuccess(result); return; }\n    var listeners = apiReadInFlight[cacheKey] || [];\n    delete apiReadInFlight[cacheKey];\n    listeners.forEach(function(listener) {\n      if (!listener.onSuccess) return;\n      try { listener.onSuccess(JSON.parse(JSON.stringify(result))); }\n      catch(e) { listener.onSuccess(result); }\n    });\n  }\n\n  function rejectRead(err) {\n    if (!cacheKey) { if (onFailure) onFailure(err); else console.error('callApi fetch failed (' + fnName + '):', err); return; }\n    var listeners = apiReadInFlight[cacheKey] || [];\n    delete apiReadInFlight[cacheKey];\n    listeners.forEach(function(listener) {\n      if (listener.onFailure) listener.onFailure(err);\n      else console.error('callApi fetch failed (' + fnName + '):', err);\n    });\n  }\n\n  var requestUrl = API_BASE_URL + slug;\n"""
if cache_anchor not in app:
    raise SystemExit('callApi cache anchor missing')
app = app.replace(cache_anchor, cache_replacement, 1)

success_anchor = """      if (onSuccess) onSuccess(result);\n      schedulePagedMutationRefresh(fnName, result);\n"""
if success_anchor not in app:
    raise SystemExit('callApi success anchor missing')
app = app.replace(success_anchor, """      resolveRead(result);\n      schedulePagedMutationRefresh(fnName, result);\n""", 1)

failure_anchor = """      if (err && err.name === 'AbortError') err = new Error('Koneksi ke server timeout, silakan coba lagi.');\n      if (onFailure) onFailure(err); else console.error('callApi fetch failed (' + fnName + '):', err);\n"""
if failure_anchor not in app:
    raise SystemExit('callApi failure anchor missing')
app = app.replace(failure_anchor, """      if (err && err.name === 'AbortError') err = new Error('Koneksi ke server timeout, silakan coba lagi.');\n      rejectRead(err);\n""", 1)

# Replace stale egress assertions that depended on the retired runtime router.
check = check.replace("const stageRouter = read('assets/js/supplier/stage-d-api-router.js');\n", '')
old_asserts = """assert(stageRouter.includes(\"getTransactionSummary\"), 'client router must send transaction KPI requests to the summary endpoint');\nassert(stageRouter.includes(\"transaction-summary-action\"), 'transaction KPI route must target transaction-summary-action');\nassert(stageRouter.includes('summaryPending'), 'identical transaction KPI requests must share one in-flight request');\nassert(stageRouter.includes('SUMMARY_CACHE_TTL_MS'), 'transaction KPI responses must use a short-lived client cache');\nassert(stageRouter.includes('AbortController'), 'transaction KPI requests must have a timeout path');\n"""
new_asserts = """assert(app.includes(\"'transaction-summary-action': { getTransactionSummary:1 }\"), 'central client router must target transaction-summary-action');\nassert(app.includes('getTransactionSummary:15000'), 'transaction KPI responses must use a short-lived client cache');\nassert(app.includes('apiReadInFlight'), 'identical cacheable reads must share one in-flight request');\nassert(app.includes('apiReadInFlight[cacheKey].push'), 'coalesced reads must preserve all caller callbacks');\nassert(app.includes('AbortController'), 'central API requests must retain a timeout path');\n"""
if old_asserts not in check:
    raise SystemExit('stale stage router egress assertions missing')
check = check.replace(old_asserts, new_asserts, 1)

for token in [
    'var apiReadInFlight = Object.create(null);',
    'apiReadInFlight[cacheKey].push',
    'function resolveRead(result)',
    'function rejectRead(err)',
]:
    if token not in app:
        raise SystemExit('central read dedupe token missing: ' + token)
if 'stage-d-api-router.js' in check or 'stageRouter' in check:
    raise SystemExit('egress guardrail still depends on retired stage router')

app_path.write_text(app, encoding='utf-8')
check_path.write_text(check, encoding='utf-8')
print('Central cacheable-read in-flight dedupe installed and egress guardrail updated.')
