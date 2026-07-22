from pathlib import Path

app_path = Path('app.js')
verifier_path = Path('scripts/check-verifier-flow-regression.mjs')

app = app_path.read_text(encoding='utf-8')
verifier = verifier_path.read_text(encoding='utf-8')

old_status = """function renderApprovalDetailHero(tx) {
  var doc = _approvalDocStatus(tx);
  var docBadge = doc.status === 'Lengkap' ? 'badge-green' : (doc.status === 'Tidak Ada Keduanya' ? 'badge-red' : 'badge-amber');"""
new_status = """function renderApprovalDetailHero(tx) {
  var fallbackDoc = _approvalDocStatus(tx);
  var docStatus = String(tx.statusDokumen || fallbackDoc.status || 'Belum dicek');
  var isDocComplete = docStatus.indexOf('Lengkap') > -1 && docStatus.indexOf('Tidak') === -1;
  var docBadge = isDocComplete ? 'badge-green' : (docStatus.indexOf('Tidak') > -1 ? 'badge-red' : 'badge-amber');"""
if old_status not in app:
    raise SystemExit('approval detail status block not found')
app = app.replace(old_status, new_status, 1)

old_badge = "'<span class=\"badge ' + docBadge + '\">' + esc(doc.status) + '</span>'"
new_badge = "'<span class=\"badge ' + docBadge + '\">' + esc(docStatus) + '</span>'"
if old_badge not in app:
    raise SystemExit('approval detail status badge not found')
app = app.replace(old_badge, new_badge, 1)

old_cache = '/<script src="\\.\\/app\\.js\\?v=20260722-user-detail-key-v2"><\\/script>/.test(index)'
new_cache = '/<script src="\\.\\/app\\.js\\?v=20260722-approval-detail-v3"><\\/script>/.test(index)'
if old_cache not in verifier:
    raise SystemExit('verifier frontend cache assertion not found')
verifier = verifier.replace(old_cache, new_cache, 1)

app_path.write_text(app, encoding='utf-8')
verifier_path.write_text(verifier, encoding='utf-8')
print('Aligned approval detail document status and cache regression')
