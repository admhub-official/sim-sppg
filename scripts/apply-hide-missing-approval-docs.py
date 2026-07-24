from pathlib import Path

APP_PATH = Path('app.js')
INDEX_PATH = Path('index.html')
SW_PATH = Path('sw.js')
WORKER_PATH = Path('_worker.js')
RELEASE = '20260724-approval-hide-missing-v1'


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        return text, False
    if old not in text:
        raise SystemExit(f'{label}: anchor not found')
    return text.replace(old, new, 1), True


app = APP_PATH.read_text(encoding='utf-8')
changed = False

app, did_change = replace_once(
    app,
    "function renderDetailTransaksi(tx) {\n  resetDetailModalFooter();\n  var isLengkap",
    "function renderDetailTransaksi(tx, options) {\n  resetDetailModalFooter();\n  options = options || {};\n  var hideMissingDocs = !!options.hideMissingDocs;\n  var isLengkap",
    'renderDetailTransaksi options',
)
changed = changed or did_change

preview_replacements = [
    (
        "docsHtml += renderFilePreview(tx.fileBuktiFoto || tx.fileBukti, 'Foto Bukti Transaksi', 'fa-camera');",
        "docsHtml += renderFilePreview(tx.fileBuktiFoto || tx.fileBukti, 'Foto Bukti Transaksi', 'fa-camera', hideMissingDocs);",
    ),
    (
        "docsHtml += renderFilePreview(tx.fileBuktiFile, 'File Bukti Transaksi', 'fa-file');",
        "docsHtml += renderFilePreview(tx.fileBuktiFile, 'File Bukti Transaksi', 'fa-file', hideMissingDocs);",
    ),
    (
        "docsHtml += renderFilePreview(tx.fileBuktiApproval, 'Bukti Pembayaran Admin', 'fa-money-check-alt');",
        "docsHtml += renderFilePreview(tx.fileBuktiApproval, 'Bukti Pembayaran Admin', 'fa-money-check-alt', hideMissingDocs);",
    ),
    (
        "docsHtml += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt');",
        "docsHtml += renderFilePreview(tx.fileNota, 'Nota Pembelian', 'fa-receipt', hideMissingDocs);",
    ),
    (
        "docsHtml += renderFilePreview(tx.fileTtdUser, 'TTD User', 'fa-signature');",
        "docsHtml += renderFilePreview(tx.fileTtdUser, 'TTD User', 'fa-signature', hideMissingDocs);",
    ),
    (
        "docsHtml += renderFilePreview(tx.fileTtdVerif, 'TTD Verifikator', 'fa-shield-alt');",
        "docsHtml += renderFilePreview(tx.fileTtdVerif, 'TTD Verifikator', 'fa-shield-alt', hideMissingDocs);",
    ),
]
for index, (old, new) in enumerate(preview_replacements, start=1):
    app, did_change = replace_once(app, old, new, f'document preview {index}')
    changed = changed or did_change

app, did_change = replace_once(
    app,
    "function renderFilePreview(fileInfo, title, iconClass) {\n  if (!fileInfo) {",
    "function renderFilePreview(fileInfo, title, iconClass, hideMissing) {\n  if (!fileInfo) {\n    if (hideMissing) return '';",
    'renderFilePreview hide-missing behavior',
)
changed = changed or did_change

app, did_change = replace_once(
    app,
    "    renderDetailTransaksi(tx);\n    currentApprovalDetailId = tx.id || id;",
    "    renderDetailTransaksi(tx, { hideMissingDocs: true });\n    currentApprovalDetailId = tx.id || id;",
    'Approval detail mode',
)
changed = changed or did_change

required_app_markers = [
    'function renderDetailTransaksi(tx, options)',
    'var hideMissingDocs = !!options.hideMissingDocs;',
    "renderDetailTransaksi(tx, { hideMissingDocs: true });",
    'function renderFilePreview(fileInfo, title, iconClass, hideMissing)',
    "if (hideMissing) return '';",
]
for marker in required_app_markers:
    if marker not in app:
        raise SystemExit(f'Validation failed, missing marker: {marker}')
if app.count('hideMissingDocs);') < 6:
    raise SystemExit('Validation failed: all Approval document previews must use hideMissingDocs')

if changed:
    APP_PATH.write_text(app, encoding='utf-8')

index = INDEX_PATH.read_text(encoding='utf-8')
import re
index_new, index_count = re.subn(
    r'<script src="\./app\.js\?v=[^"]+"></script>',
    f'<script src="./app.js?v={RELEASE}"></script>',
    index,
    count=1,
)
if index_count != 1:
    raise SystemExit('index.html app.js version anchor not found')
INDEX_PATH.write_text(index_new, encoding='utf-8')

sw = SW_PATH.read_text(encoding='utf-8')
sw_new, sw_count = re.subn(
    r"const CACHE_VERSION = 'sim-sppg-v[^']+';",
    f"const CACHE_VERSION = 'sim-sppg-v{RELEASE}';",
    sw,
    count=1,
)
if sw_count != 1:
    raise SystemExit('sw.js cache version anchor not found')
SW_PATH.write_text(sw_new, encoding='utf-8')

worker = WORKER_PATH.read_text(encoding='utf-8')
worker_new, worker_count = re.subn(
    r"const version = '[^']+';",
    f"const version = '{RELEASE}';",
    worker,
    count=1,
)
if worker_count != 1:
    raise SystemExit('_worker.js version anchor not found')
WORKER_PATH.write_text(worker_new, encoding='utf-8')

print('Approval detail updated: missing document cards are hidden only in the Approval menu.')
