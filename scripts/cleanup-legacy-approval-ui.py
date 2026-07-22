from pathlib import Path
import re

index_path = Path('index.html')
sw_path = Path('sw.js')
check_path = Path('scripts/check-approval-row-detail.mjs')
verifier_path = Path('scripts/check-verifier-flow-regression.mjs')

index = index_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
check = check_path.read_text(encoding='utf-8')
verifier = verifier_path.read_text(encoding='utf-8')

# Remove the retired mobile Approval table-to-card mapper, including its obsolete action grid.
legacy_pattern = re.compile(
    r"\n\s*/\* --- Approval Table --- \*/.*?\n\s*/\* --- Master Bahan Table --- \*/",
    re.S,
)
index, count = legacy_pattern.subn('\n\n      /* --- Master Bahan Table --- */', index, count=1)
if count != 1:
    raise SystemExit('legacy Approval mobile table mapper not found')

# Add dark-mode parity for the new desktop table, mobile cards, and Approval bottom sheet.
dark_anchor = "  .approval-pagination { margin-top: 14px; }\n"
dark_css = """  .approval-pagination { margin-top: 14px; }
  body.dark-mode .approval-desktop-view,
  body.dark-mode .approval-mobile-toolbar,
  body.dark-mode .approval-mobile-card,
  body.dark-mode #modalDetail.approval-detail-mode .modal-box,
  body.dark-mode #modalDetail.approval-detail-mode .modal-header { background: #1e293b; border-color: #334155; }
  body.dark-mode .approval-data-table thead th { background: #172033; color: #94a3b8; border-color: #334155; }
  body.dark-mode .approval-data-table tbody td { background: #1e293b; border-color: #334155; color: #cbd5e1; }
  body.dark-mode #page-approval .approval-row-clickable:hover td { background: #243048; }
  body.dark-mode .approval-transaction-cell strong,
  body.dark-mode .approval-nominal-cell,
  body.dark-mode .approval-card-title-wrap h3,
  body.dark-mode .approval-card-amount strong,
  body.dark-mode .approval-detail-summary h4,
  body.dark-mode .approval-detail-nominal strong { color: #f8fafc; }
  body.dark-mode .approval-transaction-cell span,
  body.dark-mode .approval-user-cell,
  body.dark-mode .approval-card-date,
  body.dark-mode .approval-card-note,
  body.dark-mode .approval-detail-summary p { color: #94a3b8; }
  body.dark-mode .approval-card-meta span { color: #cbd5e1; background: #172033; }
  body.dark-mode .approval-card-open { border-color: #334155; color: #38bdf8; }
  body.dark-mode .approval-detail-hero { background: linear-gradient(135deg,#172033,#1e293b 58%,#17332c); border-color: #334155; }
  body.dark-mode .approval-detail-icon { background: #0f172a; color: #38bdf8; }
"""
if dark_anchor not in index:
    raise SystemExit('Approval pagination style anchor not found')
index = index.replace(dark_anchor, dark_css, 1)

# Strengthen cleanup regression assertions.
cleanup_assertions = """
requireMatch(!index.includes('/* --- Approval Table --- */'), 'retired Approval mobile mapper comment must be removed');
requireMatch(!index.includes('.approval-table tbody'), 'retired Approval table selectors must be removed');
requireMatch(index.includes('body.dark-mode .approval-mobile-card'), 'new mobile Approval cards must support dark mode');
"""
anchor = "requireMatch(!index.includes('id=\"approval-row-detail-styles\"'), 'old Approval-only style patch must be removed');\n"
if cleanup_assertions.strip() not in check:
    if anchor not in check:
        raise SystemExit('Approval check cleanup anchor not found')
    check = check.replace(anchor, anchor + cleanup_assertions, 1)

# Bump caches again so devices cannot reuse the intermediate responsive bundle.
index, count = re.subn(r'app\.js\?v=[^"\']+', 'app.js?v=20260722-approval-responsive-v5', index)
if count < 1:
    raise SystemExit('app cache-bust script not found')
sw, count = re.subn(r"const CACHE_VERSION = 'sim-sppg-[^']+';", "const CACHE_VERSION = 'sim-sppg-v20260722-approval-responsive-v9';", sw, count=1)
if count != 1:
    raise SystemExit('service worker cache version not found')

check = check.replace('20260722-approval-responsive-v4', '20260722-approval-responsive-v5')
check = check.replace('sim-sppg-v20260722-approval-responsive-v8', 'sim-sppg-v20260722-approval-responsive-v9')
verifier = verifier.replace('20260722-approval-responsive-v4', '20260722-approval-responsive-v5')
verifier = verifier.replace('sim-sppg-v20260722-approval-responsive-v8', 'sim-sppg-v20260722-approval-responsive-v9')

index_path.write_text(index, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
check_path.write_text(check, encoding='utf-8')
verifier_path.write_text(verifier, encoding='utf-8')
print('Removed legacy Approval mapper and added dark-mode parity')
