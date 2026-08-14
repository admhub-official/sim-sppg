from pathlib import Path

app_path = Path('app.js')
worker_path = Path('_worker.js')
app = app_path.read_text(encoding='utf-8')
worker = worker_path.read_text(encoding='utf-8')

# Move the only still-needed compatibility state into canonical app source.
if 'var currentTrxId = null;' not in app:
    anchor = 'var pendingConfirmNominal = 0;'
    if anchor not in app:
        raise SystemExit('pendingConfirmNominal anchor missing')
    app = app.replace(anchor, 'var currentTrxId = null;\n' + anchor, 1)

# Stop rewriting app.js at the edge. Canonical app.js must be served unchanged.
start = worker.find("    if (url.pathname.endsWith('/app.js')) {")
end = worker.find("    if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {", start)
if start < 0 or end < 0:
    raise SystemExit('worker app.js rewrite block not found')
worker = worker[:start] + worker[end:]

# Remove retired/no-op script injection from the HTML compatibility list.
for line in [
    '        `<script src="./supplier-inline-create.js?v=${version}"></script>`,\n',
    '        `<script src="./professional-report-v1.js?v=${version}"></script>`\n',
]:
    if line in worker:
        worker = worker.replace(line, '', 1)

# If professional-report was the last array entry, sidebar now needs no trailing comma issue.
worker = worker.replace(
    '        `<script src="./sidebar-menu-structure.js?v=${version}"></script>`,\n      ].join',
    '        `<script src="./sidebar-menu-structure.js?v=${version}"></script>`\n      ].join',
    1,
)

# Keep old optional tags matchable for backward-compatible cached HTML, but the replacement
# must never re-inject the retired files.
for retired in [
    '<script src="./supplier-inline-create.js?v=${version}"></script>',
    '<script src="./professional-report-v1.js?v=${version}"></script>',
    "installLegacyReportCenterDisabled",
    "professional-report-v1.js owns menu Laporan",
    "runtimeState + source",
]:
    if retired in worker:
        raise SystemExit('retired worker runtime token remains: ' + retired)

if "if (url.pathname.endsWith('/app.js'))" in worker:
    raise SystemExit('app.js edge rewrite still present')
if 'var currentTrxId = null;' not in app:
    raise SystemExit('canonical currentTrxId declaration missing')

app_path.write_text(app, encoding='utf-8')
worker_path.write_text(worker, encoding='utf-8')

noop = Path('supplier-inline-create.js')
if not noop.exists():
    raise SystemExit('expected no-op supplier-inline-create.js missing')
noop.unlink()

print('Worker no longer rewrites app.js or injects retired/no-op scripts.')
