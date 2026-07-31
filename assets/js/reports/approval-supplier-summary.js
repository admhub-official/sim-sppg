(function () {
  'use strict';

  var LOGO_BGN_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/logo_bgn/logobgn.png';
  var SUPPLIER_LABEL = 'Supplier/ Penjual/ a.n Trx';

  function text(value, fallback) {
    var result = String(value == null ? '' : value).trim();
    return result || (fallback == null ? '-' : fallback);
  }

  function esc(value) {
    return text(value, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function csv(value) {
    var result = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
    if (/^[=+\-@]/.test(result)) result = "'" + result;
    return '"' + result.replace(/"/g, '""') + '"';
  }

  function normalizeStatus(value) {
    return text(value, '').toLocaleLowerCase('id-ID');
  }

  function completenessClass(value) {
    var status = normalizeStatus(value);
    if (status === 'lengkap') return 'status-complete';
    if (status.indexOf('tidak ada') !== -1 || status.indexOf('tidak lengkap') !== -1) return 'status-incomplete';
    return 'status-warning';
  }

  function removePageSummary() {
    var summary = document.getElementById('approvalSupplierSummary');
    if (summary) summary.remove();
  }

  function buildSupplierSummary(report) {
    var groups = Object.create(null);
    (report.rows || []).forEach(function (row) {
      var supplier = text(row.supplier, 'Supplier belum tercatat');
      var account = text(row.rekeningPenerima, '-');
      var key = supplier + '\u0001' + account;
      if (!groups[key]) {
        groups[key] = {
          supplier: supplier,
          account: account,
          count: 0,
          complete: 0,
          incomplete: 0,
          total: 0
        };
      }
      groups[key].count += 1;
      groups[key].total += Number(row.nominal) || 0;
      if (normalizeStatus(row.kelengkapan) === 'lengkap') groups[key].complete += 1;
      else groups[key].incomplete += 1;
    });

    return Object.keys(groups).map(function (key) {
      return groups[key];
    }).sort(function (left, right) {
      return right.total - left.total || left.supplier.localeCompare(right.supplier, 'id');
    });
  }

  function summaryTotals(summary) {
    return summary.reduce(function (total, group) {
      total.count += Number(group.count) || 0;
      total.complete += Number(group.complete) || 0;
      total.incomplete += Number(group.incomplete) || 0;
      total.nominal += Number(group.total) || 0;
      return total;
    }, { count: 0, complete: 0, incomplete: 0, nominal: 0 });
  }

  function styleSpreadsheetSheet(sheet, headerRow, firstDataRow, lastDataRow, statusColumn, noColumn, nominalColumn) {
    if (!sheet || !sheet['!ref'] || !window.XLSX || !window.XLSX.utils) return;
    var range = window.XLSX.utils.decode_range(sheet['!ref']);
    var headerIndex = Math.max(0, Number(headerRow || 1) - 1);
    var dataStart = Math.max(headerIndex + 1, Number(firstDataRow || headerIndex + 2) - 1);
    var dataEnd = Math.min(range.e.r, Number(lastDataRow || range.e.r + 1) - 1);

    function applyStyle(cell, style) {
      if (!cell) return;
      cell.s = cell.s || {};
      Object.keys(style).forEach(function (key) { cell.s[key] = style[key]; });
    }

    for (var col = range.s.c; col <= range.e.c; col += 1) {
      var headerCell = sheet[window.XLSX.utils.encode_cell({ r: headerIndex, c: col })];
      applyStyle(headerCell, {
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '15577A' } },
        border: {
          top: { style: 'thin', color: { rgb: 'B8C9D4' } },
          bottom: { style: 'thin', color: { rgb: 'B8C9D4' } },
          left: { style: 'thin', color: { rgb: 'B8C9D4' } },
          right: { style: 'thin', color: { rgb: 'B8C9D4' } }
        }
      });
    }

    for (var row = dataStart; row <= dataEnd; row += 1) {
      for (var dataCol = range.s.c; dataCol <= range.e.c; dataCol += 1) {
        var cell = sheet[window.XLSX.utils.encode_cell({ r: row, c: dataCol })];
        applyStyle(cell, {
          alignment: {
            horizontal: dataCol === nominalColumn ? 'right' : (dataCol === noColumn ? 'center' : 'left'),
            vertical: 'top',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: 'DBE3E8' } },
            bottom: { style: 'thin', color: { rgb: 'DBE3E8' } },
            left: { style: 'thin', color: { rgb: 'DBE3E8' } },
            right: { style: 'thin', color: { rgb: 'DBE3E8' } }
          }
        });
      }

      if (typeof statusColumn === 'number') {
        var statusCell = sheet[window.XLSX.utils.encode_cell({ r: row, c: statusColumn })];
        if (statusCell) {
          var status = normalizeStatus(statusCell.v);
          var fill = 'FEF3C7';
          var color = '92400E';
          if (status === 'lengkap') {
            fill = 'DCFCE7';
            color = '166534';
          } else if (status.indexOf('tidak ada') !== -1 || status.indexOf('tidak lengkap') !== -1) {
            fill = 'FEE2E2';
            color = '991B1B';
          }
          applyStyle(statusCell, {
            fill: { patternType: 'solid', fgColor: { rgb: fill } },
            font: { bold: true, color: { rgb: color } }
          });
        }
      }
    }
  }

  function install() {
    removePageSummary();
    if (typeof window._approvalReportModel !== 'function' ||
        typeof window.exportApprovalReportPDF !== 'function' ||
        typeof window.exportApprovalSpreadsheet !== 'function' ||
        typeof window._loadApprovalSpreadsheetLibrary !== 'function' ||
        typeof window._appendApprovalSheet !== 'function') {
      return false;
    }
    if (window.exportApprovalReportPDF.__supplierSummaryExportOnly) return true;

    window.exportApprovalReportPDF = function (data, pageLabel) {
      var report = window._approvalReportModel(data);
      var summary = buildSupplierSummary(report);
      var totals = summaryTotals(summary);
      var title = pageLabel || 'Laporan Approval Transaksi';
      var createdBy = window.currentUser
        ? (window.currentUser.namaLengkap || window.currentUser.email || '-')
        : '-';

      var detailRows = report.rows.map(function (row) {
        return '<tr><td class="no-cell">' + row.no + '</td><td>' + esc(row.tanggal) + '</td>' +
          '<td class="code">' + esc(row.kode) + '</td><td>' + esc(row.sppg) + '</td><td>' + esc(row.item) + '</td>' +
          '<td>' + esc(row.supplier) + '</td><td>' + esc(row.rekeningPenerima) + '</td>' +
          '<td class="money">Rp ' + Math.round(row.nominal).toLocaleString('id-ID') + '</td>' +
          '<td>' + esc(row.metode) + '</td><td><span class="status-badge ' + completenessClass(row.kelengkapan) + '">' +
          esc(row.kelengkapan) + '</span></td></tr>';
      }).join('');

      var summaryRows = summary.map(function (group, index) {
        return '<tr><td class="no-cell">' + (index + 1) + '</td><td>' + esc(group.supplier) + '</td><td>' + esc(group.account) + '</td>' +
          '<td>' + group.count + '</td><td><span class="count-badge complete-count">' + group.complete + '</span></td>' +
          '<td><span class="count-badge incomplete-count">' + group.incomplete + '</span></td><td class="money">Rp ' +
          Math.round(group.total).toLocaleString('id-ID') + '</td></tr>';
      }).join('');

      var totalRow = '<tr class="grand-total"><td></td><td colspan="2">TOTAL KESELURUHAN</td>' +
        '<td>' + totals.count + '</td><td>' + totals.complete + '</td>' +
        '<td>' + totals.incomplete + '</td><td class="money">Rp ' +
        Math.round(totals.nominal).toLocaleString('id-ID') + '</td></tr>';

      var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
        '@page{size:A4 landscape;margin:8mm 6mm 10mm}*{box-sizing:border-box}' +
        'body{margin:0;color:#172033;background:#fff;font:7.4px/1.4 Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        'header{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:0 0 9px;margin-bottom:12px;border-bottom:3px solid #15577a}' +
        '.brand{display:flex;align-items:center;gap:11px}.brand-logo{width:52px;height:52px;object-fit:contain;flex:none}.brand-copy{min-width:0}' +
        'h1{margin:0;color:#15577a;font-size:17px;line-height:1.15}h2{margin:16px 0 7px;color:#15577a;font-size:11.5px;line-height:1.2}' +
        '.meta{text-align:right;color:#475569;white-space:nowrap;line-height:1.55}' +
        '.table-wrap{border:1px solid #b8c9d4;border-radius:7px;overflow:hidden}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed}' +
        'thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}' +
        'th{background:#dcecf5;color:#103b55;text-align:center!important;vertical-align:middle;padding:6px 4px;border:1px solid #b8c9d4;font-weight:700}' +
        'td{text-align:left;vertical-align:top;padding:5px 5px;border:1px solid #dbe3e8;overflow-wrap:anywhere}' +
        'tbody tr:nth-child(even) td{background:#f8fafc}.no-cell{text-align:center!important;padding-left:2px!important;padding-right:2px!important;white-space:nowrap}' +
        '.money{text-align:right!important;font-weight:700;white-space:nowrap}.code{font-family:Consolas,monospace}' +
        '.detail-table col.no{width:3%}.detail-table col.date{width:9%}.detail-table col.code-col{width:10%}.detail-table col.sppg{width:9%}' +
        '.detail-table col.item{width:10%}.detail-table col.supplier{width:12%}.detail-table col.account{width:17%}.detail-table col.nominal{width:10%}.detail-table col.payment{width:9%}.detail-table col.docs{width:11%}' +
        '.summary-table col.no{width:3.5%}.summary-table col.supplier{width:20%}.summary-table col.account{width:24.5%}.summary-table col.trx{width:10%}' +
        '.summary-table col.complete{width:14%}.summary-table col.incomplete{width:14%}.summary-table col.total{width:14%}' +
        '.status-badge{display:inline-block;max-width:100%;border-radius:999px;padding:2px 6px;font-weight:700;line-height:1.25;white-space:normal}' +
        '.status-complete{background:#dcfce7;color:#166534;border:1px solid #86efac}.status-warning{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}' +
        '.status-incomplete{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}' +
        '.count-badge{display:inline-block;min-width:20px;text-align:center;border-radius:999px;padding:2px 6px;font-weight:700}.complete-count{background:#dcfce7;color:#166534}.incomplete-count{background:#fee2e2;color:#991b1b}' +
        '.grand-total td{background:#dbeafe!important;color:#0f3d5c;font-weight:700;border-top:2px solid #15577a;vertical-align:middle}.grand-total td:nth-child(2){text-align:right}' +
        '.summary-note{margin:5px 0 8px;color:#475569;font-size:7px}' +
        '</style></head><body><header><div class="brand"><img class="brand-logo" src="' + LOGO_BGN_URL + '" alt="Logo BGN" onerror="this.style.display=\'none\'">' +
        '<div class="brand-copy"><h1>' + esc(title) + '</h1><div>SIM-SPPG</div></div></div><div class="meta">Periode: ' +
        esc(report.period) + '<br>Filter: ' + esc(report.filters) + '<br>Dibuat oleh: ' + esc(createdBy) + '<br>Jumlah: ' + report.count + ' transaksi</div></header>' +
        '<h2>Detail Approval</h2><div class="table-wrap"><table class="detail-table"><colgroup><col class="no"><col class="date"><col class="code-col"><col class="sppg"><col class="item"><col class="supplier"><col class="account"><col class="nominal"><col class="payment"><col class="docs"></colgroup>' +
        '<thead><tr><th>No</th><th>Tanggal</th><th>Kode</th><th>SPPG</th><th>Item</th><th>' + SUPPLIER_LABEL + '</th><th>Rekening Penerima</th><th>Nominal</th><th>Status</th><th>Kelengkapan</th></tr></thead><tbody>' +
        detailRows + '</tbody></table></div><h2>Rekap Pembayaran per Supplier</h2><div class="summary-note">Total keseluruhan dihitung dari seluruh transaksi yang masuk dalam laporan sesuai filter aktif.</div>' +
        '<div class="table-wrap"><table class="summary-table"><colgroup><col class="no"><col class="supplier"><col class="account"><col class="trx"><col class="complete"><col class="incomplete"><col class="total"></colgroup>' +
        '<thead><tr><th>No</th><th>' + SUPPLIER_LABEL + '</th><th>Rekening Penerima</th><th>Transaksi</th><th>Dokumen Lengkap</th><th>Belum Lengkap</th><th>Total Nominal</th></tr></thead><tbody>' +
        summaryRows + totalRow + '</tbody></table></div></body></html>';

      var printWindow = window.open('', '_blank');
      if (!printWindow) {
        if (typeof window.showToast === 'function') window.showToast('error', 'Gagal', 'Pop-up diblokir browser.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = function () { printWindow.print(); };
    };
    window.exportApprovalReportPDF.__supplierSummaryExportOnly = true;

    window.exportApprovalReportCSV = function (data) {
      var report = window._approvalReportModel(data);
      var summary = buildSupplierSummary(report);
      var totals = summaryTotals(summary);
      var lines = [];
      var add = function (values) { lines.push(values.map(csv).join(',')); };
      add(['LAPORAN APPROVAL TRANSAKSI SIM-SPPG']);
      add(['Logo BGN', LOGO_BGN_URL]);
      add(['Periode', report.period]);
      add(['Filter aktif', report.filters]);
      add(['Jumlah transaksi', report.count]);
      add(['Total nominal', Math.round(report.total)]);
      lines.push('');
      add(['DETAIL APPROVAL']);
      add(['No','Tanggal','Kode','SPPG','Nama Item',SUPPLIER_LABEL,'Rekening Penerima','Nominal (Rp)','Status Pembayaran','Status Kelengkapan']);
      report.rows.forEach(function (row) {
        add([row.no,row.tanggal,row.kode,row.sppg,row.item,row.supplier,row.rekeningPenerima,Math.round(row.nominal),row.metode,row.kelengkapan]);
      });
      lines.push('');
      add(['REKAP PEMBAYARAN PER SUPPLIER']);
      add(['No',SUPPLIER_LABEL,'Rekening Penerima','Jumlah Transaksi','Dokumen Lengkap','Dokumen Belum Lengkap','Total Nominal (Rp)']);
      summary.forEach(function (group, index) {
        add([index + 1,group.supplier,group.account,group.count,group.complete,group.incomplete,Math.round(group.total)]);
      });
      add(['','TOTAL KESELURUHAN','',totals.count,totals.complete,totals.incomplete,Math.round(totals.nominal)]);
      var blob = new Blob(['\uFEFFsep=,\r\n' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    };
    window.exportApprovalReportCSV.__supplierSummaryExportOnly = true;

    window.exportApprovalSpreadsheet = function (data, format) {
      var report = window._approvalReportModel(data);
      var summary = buildSupplierSummary(report);
      var totals = summaryTotals(summary);
      var extension = format === 'ods' ? 'ods' : 'xlsx';
      if (typeof window.showLoading === 'function') window.showLoading(true);

      window._loadApprovalSpreadsheetLibrary().then(function () {
        var workbook = window.XLSX.utils.book_new();
        workbook.Props = workbook.Props || {};
        workbook.Props.Title = 'Laporan Approval Transaksi SIM-SPPG';
        workbook.Props.Subject = 'Logo BGN: ' + LOGO_BGN_URL;

        var detailRows = [['No','Tanggal','Kode','SPPG','Nama Penginput','Email','Jenis Kategori','Nama Item',SUPPLIER_LABEL,'Rekening Penerima','Nama Bank','Nomor Rekening','Atas Nama','Nominal (Rp)','Status Pembayaran','Status Kelengkapan']];
        report.rows.forEach(function (row) {
          detailRows.push([row.no,row.tanggal,row.kode,row.sppg,row.nama,row.email,row.jenis,row.item,row.supplier,row.rekeningPenerima,row.bank,row.rekening,row.atasNama,Math.round(row.nominal),row.metode,row.kelengkapan]);
        });

        var summaryRows = [['No',SUPPLIER_LABEL,'Rekening Penerima','Jumlah Transaksi','Dokumen Lengkap','Dokumen Belum Lengkap','Total Nominal (Rp)']];
        summary.forEach(function (group, index) {
          summaryRows.push([index + 1,group.supplier,group.account,group.count,group.complete,group.incomplete,Math.round(group.total)]);
        });
        summaryRows.push(['','TOTAL KESELURUHAN','',totals.count,totals.complete,totals.incomplete,Math.round(totals.nominal)]);

        window._appendApprovalSheet(workbook, 'Detail Approval', detailRows, [4,16,22,16,22,30,24,34,28,42,18,22,26,18,25,27], 1);
        window._appendApprovalSheet(workbook, 'Rekap Supplier', summaryRows, [4,30,44,18,20,24,22], 1);

        var detailSheet = workbook.Sheets['Detail Approval'];
        var summarySheet = workbook.Sheets['Rekap Supplier'];
        if (detailSheet) {
          detailSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
          styleSpreadsheetSheet(detailSheet, 1, 2, detailRows.length, 15, 0, 13);
        }
        if (summarySheet) {
          summarySheet['!freeze'] = { xSplit: 0, ySplit: 1 };
          styleSpreadsheetSheet(summarySheet, 1, 2, summaryRows.length, null, 0, 6);
          var totalRowIndex = summaryRows.length - 1;
          for (var col = 0; col <= 6; col += 1) {
            var totalCell = summarySheet[window.XLSX.utils.encode_cell({ r: totalRowIndex, c: col })];
            if (totalCell) {
              totalCell.s = totalCell.s || {};
              totalCell.s.fill = { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } };
              totalCell.s.font = { bold: true, color: { rgb: '0F3D5C' } };
            }
          }
        }

        window.XLSX.writeFile(workbook, 'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.' + extension, { bookType: extension, compression: true, cellStyles: true });
        if (typeof window.showLoading === 'function') window.showLoading(false);
      }).catch(function (error) {
        if (typeof window.showLoading === 'function') window.showLoading(false);
        if (typeof window.showToast === 'function') {
          window.showToast('error', 'Gagal', error && error.message ? error.message : 'Spreadsheet gagal dibuat.');
        }
      });
    };
    window.exportApprovalSpreadsheet.__supplierSummaryExportOnly = true;
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removePageSummary, { once: true });
  } else {
    removePageSummary();
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 80) clearInterval(timer);
    }, 100);
  }
})();
