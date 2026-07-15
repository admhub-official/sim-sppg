/* SIM-SPPG Report Download Module
 * Replaces the legacy Telegram report delivery flow with direct PDF/XLSX downloads.
 */
(function () {
  'use strict';

  var REPORT_TABLES = [
    { key: 'TRANSAKSI', label: 'Data Transaksi', icon: 'fa-exchange-alt', dateFields: ['Tanggal','tanggal','created_at','WAKTU INPUT'] },
    { key: 'Pending Payment', label: 'Data Pending Payment', icon: 'fa-hand-holding-usd', dateFields: ['Tanggal Pending','tanggalPending','tanggal_pending','created_at'] },
    { key: 'MASTER_SUPPLIER', label: 'Data Supplier', icon: 'fa-truck', dateFields: ['created_at','UPDATED AT','updated_at'] },
    { key: 'MASTER_BB', label: 'Master Bahan Baku', icon: 'fa-boxes', dateFields: ['created_at','UPDATED AT','updated_at'] },
    { key: 'SURVEI_BB', label: 'Data Survei Harga', icon: 'fa-search-dollar', dateFields: ['WAKTU SURVEI','Waktu Survei','tanggal','created_at'] },
    { key: 'SERAH_TERIMA', label: 'Data Serah Terima', icon: 'fa-dolly', dateFields: ['Tanggal','tanggal','WAKTU','created_at'] },
    { key: 'MENU_HARIAN', label: 'Data Menu Harian', icon: 'fa-utensils', dateFields: ['Tanggal','tanggal','TANGGAL','created_at'] },
    { key: 'DETAIL_MENU_HARIAN', label: 'Detail Menu Harian', icon: 'fa-list-ul', dateFields: ['Tanggal','tanggal','TANGGAL','created_at'] },
    { key: 'USERS', label: 'Data Pengguna', icon: 'fa-users', dateFields: ['created_at','TANGGAL DAFTAR','tanggal_daftar','UPDATED AT'] },
    { key: 'ADMIN_ASSIGNMENT', label: 'Konfigurasi Admin', icon: 'fa-user-shield', dateFields: ['created_at','updated_at'] },
    { key: 'AUDIT LOG', label: 'Riwayat Aktivitas / Approval', icon: 'fa-history', dateFields: ['WAKTU','waktu','created_at','timestamp'] },
    { key: 'riwayat_laporan', label: 'Riwayat Laporan', icon: 'fa-file-alt', dateFields: ['tanggal_generate','created_at','periode_awal'] },
    { key: 'APP_SETTINGS', label: 'Pengaturan Aplikasi', icon: 'fa-cog', dateFields: ['updated_at','created_at'] },
    { key: 'LOGIN_ATTEMPTS', label: 'Riwayat Percobaan Login', icon: 'fa-sign-in-alt', dateFields: ['created_at','waktu','timestamp'] },
    { key: 'NOTIFICATION_READS', label: 'Status Baca Notifikasi', icon: 'fa-bell', dateFields: ['read_at','created_at'] },
    { key: 'PUSH_SUBSCRIPTIONS', label: 'Langganan Push Notification', icon: 'fa-mobile-alt', dateFields: ['created_at','updated_at'] },
    { key: 'APP_LOCKS', label: 'Data Kunci Aplikasi', icon: 'fa-lock', dateFields: ['created_at','expires_at','updated_at'] }
  ];

  var SENSITIVE_COLUMN = /(password|passwd|secret|token|refresh|access_key|service_role|private_key|pin|otp|endpoint|p256dh|auth_key)/i;

  function byId(id) { return document.getElementById(id); }
  function htmlEscape(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch];
    });
  }
  function notify(type, title, message) {
    if (typeof window.showToast === 'function') return window.showToast(type, title, message);
    if (window.Swal) return window.Swal.fire(title, message, type === 'error' ? 'error' : 'success');
    alert(title + '\n' + message);
  }
  function formatDateId(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  function safeFilename(value) { return String(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(); }

  function getProjectUrl() {
    return window.SUPABASE_URL_LAPORAN || window.SUPABASE_URL || 'https://dmjsgtichrfxhyywstrt.supabase.co';
  }
  async function getToken() {
    if (window._supabaseToken) return window._supabaseToken;
    try {
      if (window.supabase && window.supabase.auth) {
        var result = await window.supabase.auth.getSession();
        return result && result.data && result.data.session ? result.data.session.access_token : '';
      }
    } catch (_) {}
    return '';
  }
  function getApiKey() { return window._supabaseKey || window.SUPABASE_ANON_KEY || ''; }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var raw = String(value).trim();
    var indo = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+.*)?$/);
    if (indo) return new Date(Number(indo[3]), Number(indo[2]) - 1, Number(indo[1]));
    var date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  }
  function filterByRange(rows, config, start, end) {
    if (!start && !end) return rows;
    var startDate = start ? new Date(start + 'T00:00:00') : null;
    var endDate = end ? new Date(end + 'T23:59:59.999') : null;
    var detected = config.dateFields.find(function (field) {
      return rows.some(function (row) { return row && row[field] != null && parseDate(row[field]); });
    });
    if (!detected) return rows;
    return rows.filter(function (row) {
      var date = parseDate(row[detected]);
      if (!date) return false;
      return (!startDate || date >= startDate) && (!endDate || date <= endDate);
    });
  }
  function sanitizeRows(rows) {
    return (rows || []).map(function (row) {
      var clean = {};
      Object.keys(row || {}).forEach(function (key) {
        if (!SENSITIVE_COLUMN.test(key)) clean[key] = row[key];
      });
      return clean;
    });
  }

  async function fetchTable(config, start, end) {
    var token = await getToken();
    var url = getProjectUrl() + '/rest/v1/' + encodeURIComponent(config.key) + '?select=*';
    var response = await fetch(url, {
      headers: {
        apikey: getApiKey(),
        Authorization: token ? 'Bearer ' + token : '',
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      var detail = await response.text();
      throw new Error(config.label + ' gagal dimuat (' + response.status + '): ' + detail.slice(0, 180));
    }
    return sanitizeRows(filterByRange(await response.json(), config, start, end));
  }

  function selectedConfigs() {
    return Array.prototype.slice.call(document.querySelectorAll('.report-data-check:checked')).map(function (el) {
      return REPORT_TABLES.find(function (item) { return item.key === el.value; });
    }).filter(Boolean);
  }
  function setBusy(active, text) {
    var btn = byId('btnDownloadReport');
    var progress = byId('reportProgress');
    if (btn) {
      btn.disabled = active;
      btn.innerHTML = active ? '<i class="fas fa-circle-notch fa-spin"></i><span>' + htmlEscape(text || 'Menyiapkan laporan...') + '</span>' : '<i class="fas fa-download"></i><span>Download Laporan</span>';
    }
    if (progress) progress.classList.toggle('hidden', !active);
  }
  function progress(message) {
    var el = byId('reportProgressText');
    if (el) el.textContent = message;
  }

  function buildUi() {
    var page = byId('page-laporan') || byId('laporanPage') || document.querySelector('[data-page-content="laporan"]');
    if (!page || page.dataset.downloadReportReady === '1') return false;
    page.dataset.downloadReportReady = '1';
    page.innerHTML = '' +
      '<div class="report-hero"><div><span class="report-eyebrow"><i class="fas fa-chart-pie"></i> PUSAT LAPORAN</span><h2>Unduh laporan sesuai kebutuhan</h2><p>Pilih periode, beberapa kelompok data, dan format file. Data sensitif seperti password, token, PIN, dan OTP otomatis tidak disertakan.</p></div><div class="report-hero-icon"><i class="fas fa-file-arrow-down"></i></div></div>' +
      '<div class="report-grid"><section class="report-card report-settings"><div class="report-section-title"><span>1</span><div><h3>Periode & Format</h3><p>Tentukan rentang data yang akan dimasukkan.</p></div></div>' +
      '<div class="report-fields"><label><span>Tanggal Mulai</span><input id="reportStartDate" type="date"></label><label><span>Tanggal Selesai</span><input id="reportEndDate" type="date"></label><label><span>Format File</span><select id="reportFormat"><option value="pdf">PDF — siap cetak</option><option value="xlsx">Excel — multi-sheet</option></select></label></div></section>' +
      '<section class="report-card report-selection"><div class="report-section-title"><span>2</span><div><h3>Pilih Data</h3><p>Bisa memilih lebih dari satu jenis data.</p></div></div>' +
      '<div class="report-select-actions"><button type="button" id="reportSelectAll">Pilih Semua</button><button type="button" id="reportClearAll">Kosongkan</button><strong id="reportSelectedCount">0 dipilih</strong></div>' +
      '<div class="report-check-grid">' + REPORT_TABLES.map(function (item, index) {
        return '<label class="report-check"><input class="report-data-check" type="checkbox" value="' + htmlEscape(item.key) + '" ' + (index < 8 ? 'checked' : '') + '><span class="report-check-icon"><i class="fas ' + item.icon + '"></i></span><span><b>' + htmlEscape(item.label) + '</b><small>' + htmlEscape(item.key) + '</small></span><i class="fas fa-check report-check-mark"></i></label>';
      }).join('') + '</div></section></div>' +
      '<div id="reportProgress" class="report-progress hidden"><i class="fas fa-circle-notch fa-spin"></i><span id="reportProgressText">Menyiapkan data...</span></div>' +
      '<div class="report-download-bar"><div><strong>File dibuat langsung di perangkat</strong><span>Tidak dikirim ke Telegram dan tidak membutuhkan Chat ID.</span></div><button id="btnDownloadReport" type="button" class="btn btn-primary"><i class="fas fa-download"></i><span>Download Laporan</span></button></div>';

    bindUi();
    return true;
  }

  function updateSelectedCount() {
    var count = document.querySelectorAll('.report-data-check:checked').length;
    var el = byId('reportSelectedCount');
    if (el) el.textContent = count + ' dipilih';
  }
  function bindUi() {
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    byId('reportStartDate').value = first.toISOString().slice(0, 10);
    byId('reportEndDate').value = now.toISOString().slice(0, 10);
    document.querySelectorAll('.report-data-check').forEach(function (el) { el.addEventListener('change', updateSelectedCount); });
    byId('reportSelectAll').addEventListener('click', function () { document.querySelectorAll('.report-data-check').forEach(function (el) { el.checked = true; }); updateSelectedCount(); });
    byId('reportClearAll').addEventListener('click', function () { document.querySelectorAll('.report-data-check').forEach(function (el) { el.checked = false; }); updateSelectedCount(); });
    byId('btnDownloadReport').addEventListener('click', downloadSelectedReport);
    updateSelectedCount();
  }

  function loadScript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Library laporan gagal dimuat.')); };
      document.head.appendChild(script);
    });
  }

  function getColumns(rows) {
    var keys = [];
    rows.forEach(function (row) { Object.keys(row || {}).forEach(function (key) { if (keys.indexOf(key) === -1) keys.push(key); }); });
    return keys;
  }
  function stringifyCell(value) {
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  async function createExcel(datasets, start, end) {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', function () { return !!window.XLSX; });
    var workbook = window.XLSX.utils.book_new();
    var summaryRows = [
      ['LAPORAN SIM-SPPG'],
      ['Periode', formatDateId(start) + ' s.d. ' + formatDateId(end)],
      ['Dibuat pada', new Date().toLocaleString('id-ID')],
      ['Dibuat oleh', (window.currentUser && (window.currentUser.namaLengkap || window.currentUser.email)) || '-'],
      [], ['Kelompok Data', 'Jumlah Baris']
    ];
    datasets.forEach(function (dataset) { summaryRows.push([dataset.config.label, dataset.rows.length]); });
    var summary = window.XLSX.utils.aoa_to_sheet(summaryRows);
    summary['!cols'] = [{ wch: 32 }, { wch: 36 }];
    window.XLSX.utils.book_append_sheet(workbook, summary, 'Ringkasan');

    datasets.forEach(function (dataset, index) {
      var cols = getColumns(dataset.rows);
      var rows = dataset.rows.map(function (row) {
        var out = {};
        cols.forEach(function (key) { out[key] = stringifyCell(row[key]); });
        return out;
      });
      var sheet = rows.length ? window.XLSX.utils.json_to_sheet(rows, { header: cols }) : window.XLSX.utils.aoa_to_sheet([['Tidak ada data pada periode terpilih']]);
      sheet['!autofilter'] = rows.length ? { ref: sheet['!ref'] } : undefined;
      sheet['!cols'] = cols.map(function (key) {
        var max = Math.max(key.length, 12);
        rows.slice(0, 100).forEach(function (row) { max = Math.max(max, String(row[key] || '').length); });
        return { wch: Math.min(max + 2, 45) };
      });
      var sheetName = dataset.config.label.replace(/[\\\/?*\[\]:]/g, '').slice(0, 28) || ('Data ' + (index + 1));
      window.XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });
    window.XLSX.writeFile(workbook, 'laporan-sim-sppg_' + start + '_' + end + '.xlsx', { compression: true });
  }

  async function createPdf(datasets, start, end) {
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', function () { return !!(window.jspdf && window.jspdf.jsPDF); });
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js', function () {
      try { return !!window.jspdf.jsPDF.API.autoTable; } catch (_) { return false; }
    });
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    var width = doc.internal.pageSize.getWidth();
    var height = doc.internal.pageSize.getHeight();
    var primary = [30, 111, 156];

    function header(title, subtitle) {
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.roundedRect(10, 10, width - 20, 24, 3, 3, 'F');
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(title, 16, 21);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.text(subtitle, 16, 28);
      doc.setTextColor(35,45,60);
    }
    header('Laporan SIM-SPPG', 'Periode ' + formatDateId(start) + ' s.d. ' + formatDateId(end) + ' • Dibuat ' + new Date().toLocaleString('id-ID'));
    var y = 43;
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text('Ringkasan Data', 10, y); y += 5;
    doc.autoTable({
      startY:y,
      head:[['No','Kelompok Data','Jumlah Baris']],
      body:datasets.map(function (d, i) { return [i + 1, d.config.label, d.rows.length]; }),
      theme:'grid',
      headStyles:{ fillColor:primary, textColor:255, fontStyle:'bold' },
      alternateRowStyles:{ fillColor:[241,247,250] },
      styles:{ fontSize:8, cellPadding:2.4 },
      margin:{ left:10, right:10 }
    });

    datasets.forEach(function (dataset) {
      doc.addPage('a4', 'landscape');
      header(dataset.config.label, 'Periode ' + formatDateId(start) + ' s.d. ' + formatDateId(end) + ' • ' + dataset.rows.length + ' baris');
      if (!dataset.rows.length) {
        doc.setFontSize(11); doc.setTextColor(100,110,125); doc.text('Tidak ada data pada periode yang dipilih.', 14, 48);
        return;
      }
      var columns = getColumns(dataset.rows).slice(0, 12);
      doc.autoTable({
        startY:40,
        head:[['No'].concat(columns)],
        body:dataset.rows.map(function (row, index) { return [index + 1].concat(columns.map(function (col) { return stringifyCell(row[col]); })); }),
        theme:'striped',
        headStyles:{ fillColor:primary, textColor:255, fontStyle:'bold', fontSize:7.2 },
        alternateRowStyles:{ fillColor:[243,248,251] },
        styles:{ fontSize:6.4, cellPadding:1.7, overflow:'linebreak', valign:'middle' },
        margin:{ left:8, right:8, bottom:14 },
        didDrawPage:function () {
          doc.setFontSize(7); doc.setTextColor(120,130,145);
          doc.text('SIM-SPPG • ' + dataset.config.label, 10, height - 7);
          doc.text('Halaman ' + doc.internal.getCurrentPageInfo().pageNumber, width - 10, height - 7, { align:'right' });
        }
      });
    });
    doc.save('laporan-sim-sppg_' + start + '_' + end + '.pdf');
  }

  async function downloadSelectedReport() {
    var start = byId('reportStartDate').value;
    var end = byId('reportEndDate').value;
    var configs = selectedConfigs();
    var format = byId('reportFormat').value;
    if (!start || !end) return notify('warning', 'Periode belum lengkap', 'Pilih tanggal mulai dan tanggal selesai.');
    if (new Date(start) > new Date(end)) return notify('warning', 'Periode tidak valid', 'Tanggal mulai tidak boleh melewati tanggal selesai.');
    if (!configs.length) return notify('warning', 'Data belum dipilih', 'Pilih minimal satu kelompok data.');

    setBusy(true, 'Mengambil data...');
    try {
      var datasets = [];
      for (var i = 0; i < configs.length; i += 1) {
        progress('Mengambil ' + configs[i].label + ' (' + (i + 1) + '/' + configs.length + ')...');
        try {
          datasets.push({ config:configs[i], rows:await fetchTable(configs[i], start, end) });
        } catch (error) {
          console.warn('[REPORT]', error);
          datasets.push({ config:configs[i], rows:[], error:error.message });
        }
      }
      progress(format === 'xlsx' ? 'Menyusun workbook Excel...' : 'Menyusun dokumen PDF...');
      if (format === 'xlsx') await createExcel(datasets, start, end);
      else await createPdf(datasets, start, end);
      notify('success', 'Laporan berhasil dibuat', 'File ' + format.toUpperCase() + ' telah diunduh ke perangkat.');
    } catch (error) {
      console.error('[REPORT DOWNLOAD ERROR]', error);
      notify('error', 'Gagal membuat laporan', error.message || 'Terjadi kesalahan saat membuat file.');
    } finally {
      setBusy(false);
    }
  }

  function installStyles() {
    if (byId('report-download-styles')) return;
    var style = document.createElement('style');
    style.id = 'report-download-styles';
    style.textContent = '.report-hero{background:linear-gradient(135deg,#15577a,#1e6f9c 55%,#2d8fbf);color:#fff;border-radius:20px;padding:26px;display:flex;justify-content:space-between;gap:20px;box-shadow:0 16px 36px rgba(21,87,122,.2);margin-bottom:18px}.report-eyebrow{display:inline-flex;gap:7px;align-items:center;font-size:10px;font-weight:800;letter-spacing:1px;background:rgba(255,255,255,.14);padding:6px 10px;border-radius:999px}.report-hero h2{font-size:24px;margin:12px 0 7px}.report-hero p{max-width:720px;color:rgba(255,255,255,.82);font-size:12px}.report-hero-icon{width:74px;height:74px;min-width:74px;border-radius:20px;background:rgba(255,255,255,.13);display:flex;align-items:center;justify-content:center;font-size:30px}.report-grid{display:grid;grid-template-columns:minmax(270px,.72fr) minmax(0,1.7fr);gap:18px}.report-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;box-shadow:0 5px 18px rgba(15,23,42,.045)}.report-section-title{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.report-section-title>span{width:30px;height:30px;min-width:30px;border-radius:10px;background:#e0f2fe;color:#15577a;display:flex;align-items:center;justify-content:center;font-weight:800}.report-section-title h3{font-size:15px;color:#1e293b}.report-section-title p{font-size:11px;color:#64748b}.report-fields{display:grid;gap:13px}.report-fields label{display:grid;gap:6px}.report-fields label>span{font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px}.report-fields input,.report-fields select{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;color:#1e293b;min-height:42px}.report-select-actions{display:flex;align-items:center;gap:8px;margin-bottom:14px}.report-select-actions button{border:0;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:10px;padding:7px 10px;border-radius:8px;cursor:pointer}.report-select-actions strong{margin-left:auto;color:#64748b;font-size:10px}.report-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:430px;overflow:auto;padding-right:3px}.report-check{position:relative;border:1px solid #e2e8f0;border-radius:12px;padding:11px;display:flex;gap:10px;align-items:center;cursor:pointer;transition:.18s;background:#fff}.report-check:hover{border-color:#7dd3fc;transform:translateY(-1px)}.report-check input{position:absolute;opacity:0}.report-check:has(input:checked){border-color:#38bdf8;background:#f0f9ff;box-shadow:inset 0 0 0 1px #38bdf8}.report-check-icon{width:34px;height:34px;min-width:34px;border-radius:10px;background:#f1f5f9;color:#1e6f9c;display:flex;align-items:center;justify-content:center}.report-check b{display:block;font-size:11px;color:#1e293b}.report-check small{display:block;font-size:8px;color:#94a3b8;margin-top:2px}.report-check-mark{margin-left:auto;color:#0ea5e9;opacity:0}.report-check:has(input:checked) .report-check-mark{opacity:1}.report-download-bar{margin-top:18px;background:#fff;border:1px solid #dbe5ee;border-radius:16px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px;box-shadow:0 6px 20px rgba(15,23,42,.05)}.report-download-bar strong,.report-download-bar span{display:block}.report-download-bar strong{font-size:12px;color:#1e293b}.report-download-bar span{font-size:10px;color:#64748b}.report-progress{margin-top:14px;border-radius:12px;padding:11px 14px;background:#eff6ff;color:#1d4ed8;display:flex;gap:9px;align-items:center;font-size:11px;font-weight:700}.report-progress.hidden{display:none}.report-download-bar .btn{min-width:190px;justify-content:center}@media(max-width:900px){.report-grid{grid-template-columns:1fr}.report-check-grid{max-height:none}}@media(max-width:560px){.report-hero{padding:20px}.report-hero h2{font-size:20px}.report-hero-icon{display:none}.report-check-grid{grid-template-columns:1fr}.report-download-bar{align-items:stretch;flex-direction:column}.report-download-bar .btn{width:100%}}';
    document.head.appendChild(style);
  }

  function initialize() {
    installStyles();
    buildUi();
    window.generateDanKirimLaporan = downloadSelectedReport;
    window.kirimLaporanTelegram = function () { throw new Error('Pengiriman Telegram telah dinonaktifkan. Gunakan Download Laporan.'); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
  var observer = new MutationObserver(function () { buildUi(); });
  observer.observe(document.documentElement, { childList:true, subtree:true });
})();
