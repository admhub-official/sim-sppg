from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
original = s


def replace_once(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f'Missing cleanup anchor: {label}')
    s = s.replace(old, new, 1)

# Auth: public registration/OTP has been retired; keep login-only selectors.
s = s.replace('<!-- AUTH OVERLAY (LOGIN & REGISTER)                              -->',
              '<!-- AUTH OVERLAY (LOGIN)                                         -->')
s = s.replace(
    '.auth-card #btnLogin,\n.auth-card #btnRegister,\n.auth-card #btnVerifyOtp {',
    '.auth-card #btnLogin {',
)
s = s.replace(
    '.auth-card #btnLogin:hover,\n.auth-card #btnRegister:hover,\n.auth-card #btnVerifyOtp:hover {',
    '.auth-card #btnLogin:hover {',
)
s = s.replace(
    '.auth-card #btnLogin, .auth-card #btnRegister, .auth-card #btnVerifyOtp { min-height: 46px !important; }',
    '.auth-card #btnLogin { min-height: 46px !important; }',
)
s = s.replace(
    '  .auth-form-panel,\n  #authOverlay[data-auth-mode="register"] .auth-form-panel {',
    '  .auth-form-panel {',
)

# Remove the retired standalone report-center CSS. No active bundle references it.
report_css_start = s.find('/* ============================================================\n   REPORT UI — EXISTING STYLES')
report_css_end_marker = '\n</style>\n\n<style id="user-management-row-detail-styles">'
if report_css_start >= 0:
    report_css_end = s.find(report_css_end_marker, report_css_start)
    if report_css_end < 0:
        raise SystemExit('Missing report CSS end anchor')
    s = s[:report_css_start] + s[report_css_end:]

# Remove the legacy Telegram report page. Its handlers are no longer implemented.
report_page_start_marker = '<!-- ============================================================ -->\n<!-- PANEL: LAPORAN -->'
report_page_end_marker = '      <!-- ==================== ADMIN ASSIGNMENT PAGE (SUPER_ADMIN) ==================== -->'
report_page_start = s.find(report_page_start_marker)
if report_page_start >= 0:
    report_page_end = s.find(report_page_end_marker, report_page_start)
    if report_page_end < 0:
        raise SystemExit('Missing legacy report page end anchor')
    s = s[:report_page_start] + report_page_end_marker + s[report_page_end + len(report_page_end_marker):]

# Exact duplicate responsive rules.
dupe_stats = '''    @media (min-width: 900px) {\n      .stats-grid { grid-template-columns: repeat(4, 1fr); }\n    }\n    @media (min-width: 1024px) {\n      .stats-grid { gap: 20px; margin-bottom: 28px; }\n    }\n@media (min-width: 900px) {\n  .stats-grid { grid-template-columns: repeat(4, 1fr); }\n}\n@media (min-width: 1024px) {\n  .stats-grid { gap: 20px; margin-bottom: 28px; }\n}\n'''
canonical_stats = '''    @media (min-width: 900px) {\n      .stats-grid { grid-template-columns: repeat(4, 1fr); }\n    }\n    @media (min-width: 1024px) {\n      .stats-grid { gap: 20px; margin-bottom: 28px; }\n    }\n'''
if dupe_stats in s:
    s = s.replace(dupe_stats, canonical_stats, 1)

# Earlier filter declarations are shadowed immediately by stronger duplicates.
filter_dupe = '''    .filter-bar.collapsed .filter-collapsible { display: none; }\n    .filter-toggle-btn { order: -1; }\n    .filter-bar .filter-collapsible { display: contents; }\n    .filter-toggle-btn {\n      flex-shrink: 0;\n    }\n    .filter-bar .search-box { flex: 1 1 100%; min-width: 0; max-width: 100%; }\n    .filter-bar.collapsed .filter-collapsible { display: none !important; }\n    .filter-toggle-btn { flex-shrink: 0; }\n'''
filter_clean = '''    .filter-toggle-btn { order: -1; flex-shrink: 0; }\n    .filter-bar .filter-collapsible { display: contents; }\n    .filter-bar .search-box { flex: 1 1 100%; min-width: 0; max-width: 100%; }\n    .filter-bar.collapsed .filter-collapsible { display: none !important; }\n'''
if filter_dupe in s:
    s = s.replace(filter_dupe, filter_clean, 1)

# Preserve page fade animation and give overlays their own keyframe name.
if '@keyframes fadeIn { to { opacity: 1; } }' in s:
    s = s.replace('@keyframes fadeIn { to { opacity: 1; } }',
                  '@keyframes overlayFadeIn { to { opacity: 1; } }', 1)
s = s.replace('animation: fadeIn 0.25s forwards;', 'animation: overlayFadeIn 0.25s forwards;')
s = s.replace('animation: fadeIn 0.2s forwards;', 'animation: overlayFadeIn 0.2s forwards;')

# The same modal scrolling properties already exist in the canonical modal-box block.
modal_duplicate = '''    /* iOS: saat keyboard muncul, pastikan modal scroll ke atas */\n    .modal-box {\n      /* Existing styles sudah ada, tambahkan ini: */\n      overscroll-behavior: contain;\n      -webkit-overflow-scrolling: touch;\n    }\n'''
s = s.replace(modal_duplicate, '')

if s == original:
    raise SystemExit('No cleanup changes were applied')

# Guardrails against bringing retired UI back accidentally.
for retired in [
    'id="page-laporan"',
    'handleKirimLaporan()',
    'loadRiwayatLaporan()',
    '#btnRegister',
    '#btnVerifyOtp',
    'data-auth-mode="register"',
    '.report-unified-hero',
]:
    if retired in s:
        raise SystemExit(f'Retired token remains after cleanup: {retired}')

if '@keyframes overlayFadeIn' not in s:
    raise SystemExit('Overlay keyframe cleanup missing')
if '<script src="./app.js?' not in s:
    raise SystemExit('Main app script reference was unexpectedly removed')

p.write_text(s, encoding='utf-8')
print('index.html dead/overlap cleanup applied')
