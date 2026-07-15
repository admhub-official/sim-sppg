from pathlib import Path
import re

html_path = Path('index.html')
js_path = Path('app.js')
html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

needle = '@media print{@page{margin:10mm;size:A4 landscape}.print-all-container thead{display:table-header-group}.print-all-container tr{break-inside:avoid;page-break-inside:avoid}}\n</head>'
assert html.count(needle) == 1, html.count(needle)
html = html.replace(needle, needle.replace('\n</head>', '\n</style>\n</head>'), 1)

html = re.sub(
    r'font-size\s*:\s*(\d+(?:\.\d+)?)px',
    lambda m: 'font-size:10px' if float(m.group(1)) < 10 else m.group(0),
    html,
)
js = re.sub(
    r'font-size\s*:\s*(\d+(?:\.\d+)?)px',
    lambda m: 'font-size:10px' if float(m.group(1)) < 10 else m.group(0),
    js,
)

def transition_repl(match):
    timing = match.group(1).strip()
    return (
        f'transition:color {timing},background-color {timing},'
        f'border-color {timing},box-shadow {timing},opacity {timing},'
        f'transform {timing}'
    )

html, transition_count = re.subn(
    r'transition\s*:\s*all\s+([^;}]+)', transition_repl, html
)
assert transition_count == 38, transition_count

replacements = [
    ("""      globalDateFilter = parsed;
      $('globalDateStart').value = parsed.start || '';
      $('globalDateEnd').value = parsed.end || '';
      $('globalDateFilterLabel').textContent = parsed.label || 'Semua Tanggal';""",
     """      globalDateFilter = parsed;
      var startInput = $('globalDateStart');
      var endInput = $('globalDateEnd');
      var labelElement = $('globalDateFilterLabel');
      if (startInput) startInput.value = parsed.start || '';
      if (endInput) endInput.value = parsed.end || '';
      if (labelElement) labelElement.textContent = parsed.label || 'Semua Tanggal';"""),
    ("""function toggleGlobalDateFilterPanel() {
  $('globalDateFilterPanel').classList.toggle('hidden');
}

function closeGlobalDateFilterPanel() {
  $('globalDateFilterPanel').classList.add('hidden');
}""",
     """function toggleGlobalDateFilterPanel() {
  var panel = $('globalDateFilterPanel');
  if (panel) panel.classList.toggle('hidden');
}

function closeGlobalDateFilterPanel() {
  var panel = $('globalDateFilterPanel');
  if (panel) panel.classList.add('hidden');
}"""),
    ("""    globalDateFilter = { start: null, end: null, label: 'Semua Tanggal' };
    $('globalDateStart').value = '';
    $('globalDateEnd').value = '';
    $('globalDateFilterLabel').textContent = 'Semua Tanggal';""",
     """    globalDateFilter = { start: null, end: null, label: 'Semua Tanggal' };
    var allStartInput = $('globalDateStart');
    var allEndInput = $('globalDateEnd');
    var allLabelElement = $('globalDateFilterLabel');
    if (allStartInput) allStartInput.value = '';
    if (allEndInput) allEndInput.value = '';
    if (allLabelElement) allLabelElement.textContent = 'Semua Tanggal';"""),
    ("""  globalDateFilter = { start: startStr, end: endStr, label: label };
  $('globalDateStart').value = startStr;
  $('globalDateEnd').value = endStr;
  $('globalDateFilterLabel').textContent = label;""",
     """  globalDateFilter = { start: startStr, end: endStr, label: label };
  var presetStartInput = $('globalDateStart');
  var presetEndInput = $('globalDateEnd');
  var presetLabelElement = $('globalDateFilterLabel');
  if (presetStartInput) presetStartInput.value = startStr;
  if (presetEndInput) presetEndInput.value = endStr;
  if (presetLabelElement) presetLabelElement.textContent = label;"""),
    ("""function applyGlobalDateFilterCustom() {
  var start = $('globalDateStart').value || null;
  var end = $('globalDateEnd').value || null;
  var label = (start || end) ? (formatTglLabel(start) + ' - ' + formatTglLabel(end)) : 'Semua Tanggal';
  globalDateFilter = { start: start, end: end, label: label };
  $('globalDateFilterLabel').textContent = label;""",
     """function applyGlobalDateFilterCustom() {
  var startInput = $('globalDateStart');
  var endInput = $('globalDateEnd');
  var start = startInput ? (startInput.value || null) : null;
  var end = endInput ? (endInput.value || null) : null;
  var label = (start || end) ? (formatTglLabel(start) + ' - ' + formatTglLabel(end)) : 'Semua Tanggal';
  globalDateFilter = { start: start, end: end, label: label };
  var labelElement = $('globalDateFilterLabel');
  if (labelElement) labelElement.textContent = label;"""),
    ("""        if (!data || !data.length) { $('chartDataCount').textContent = '0 data'; chartInstance.data.labels = []; chartInstance.data.datasets.forEach(function(ds){ ds.data = []; }); chartInstance.update(); return; }
              $('chartDataCount').textContent = data.length + ' data';""",
     """        var chartCount = $('chartDataCount');
        if (!data || !data.length) {
          if (chartCount) chartCount.textContent = '0 data';
          chartInstance.data.labels = [];
          chartInstance.data.datasets.forEach(function(ds){ ds.data = []; });
          chartInstance.update();
          return;
        }
        if (chartCount) chartCount.textContent = data.length + ' data';"""),
    ("new MutationObserver(function(){setTimeout(repair,30)}).observe(document.documentElement,{childList:true,subtree:true});",
     """var dashboardObserverTarget = document.getElementById('page-dashboard') || document.getElementById('dashPanels');
if (dashboardObserverTarget) {
  new MutationObserver(function(){ setTimeout(repair,30); })
    .observe(dashboardObserverTarget,{childList:true,subtree:true});
}"""),
    ("if (page === 'laporan') { loadRiwayatLaporan(); }",
     "if (page === 'laporan') { /* Unified report center is installed by bootstrapRuntime(). */ }"),
]

for old, new in replacements:
    assert js.count(old) == 1, old[:80]
    js = js.replace(old, new, 1)

start_marker = '// ============================================================\n// MODUL: LAPORAN — Generate PDF & Kirim ke Telegram\n// ============================================================'
end_marker = '/* ===== UNIFIED HARDENING RUNTIME ===== */'
start = js.find(start_marker)
end = js.find(end_marker)
assert start != -1 and end != -1 and start < end
js = js[:start] + '// Legacy report/Telegram runtime removed after security audit.\n\n' + js[end:]

old = """    window.generateDanKirimLaporan = downloadReport;
    window.kirimLaporanTelegram = function () { throw new Error('Pengiriman Telegram dinonaktifkan. Gunakan Download Laporan.'); };
    reportInstalled = true;"""
new = """    window.generateDanKirimLaporan = downloadReport;
    window.handleKirimLaporan = downloadReport;
    window.loadRiwayatLaporan = function () { return installReportCenter(); };
    window.kirimLaporanTelegram = function () { throw new Error('Pengiriman Telegram dinonaktifkan. Gunakan Download Laporan.'); };
    reportInstalled = true;"""
assert js.count(old) == 1
js = js.replace(old, new, 1)

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
