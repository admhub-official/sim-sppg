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

  function present(value) {
    if (value === true) return true;
    if (value == null || value === false) return false;
    if (typeof value === 'object') {
      return Boolean(value.signedUrl || value.previewUrl || value.viewUrl || value.path || value.name || value.fileName);
    }
    var result = String(value).trim();
    return Boolean(result && result !== '-' && !/^(FOTO|FILE)$/i.test(result));
  }

  function removeLegacyApprovalSummary() {
    var summary = document.getElementById('approvalSupplierSummary');
    if (summary) summary.remove();
  }

  function removeCompletenessFilter() {
    var filter = document.getElementById('apprFilterKelengkapan');
    if (filter) filter.remove();
  }

  function installDocumentRule() {
    window._approvalDocStatus = function (tx) {
      tx = tx || {};
      var method = text(tx.metodeTransaksi || tx.metode || '', '').toUpperCase().replace(/\s+/g, '_');
      var isBelumBayar = method === 'BELUM_BAYAR';

      var proof = tx.hasBuktiTransaksi === true ||
        present(tx.uploadFoto) || present(tx.uploadFile) || present(tx.fileBukti) ||
        present(tx.fileBuktiFoto) || present(tx.fileBuktiFile) || present(tx.fileBuktiApproval) ||
        Number(tx.jumlahBuktiPembayaran || tx.paymentProofCount || 0) > 0 ||
        (Array.isArray(tx.paymentProofs) && tx.paymentProofs.length > 0) ||
        tx.hasPendingPaymentProof === true;

      var nota = present(tx.notaPembelian) || present(tx.fileNota) || present(tx.nota);
      var ttd = present(tx.ttdUser) || present(tx.fileTtdUser) || present(tx.ttd);
      var missing = [];

      // BELUM_BAYAR hanya wajib Nota + TTD. Bukti transaksi/pembayaran bersifat opsional.
      if (!isBelumBayar && !proof) missing.push('Bukti');
      if (!nota) missing.push('Nota');
      if (!ttd) missing.push('TTD');

      var status = 'Lengkap';
      if (missing.length > 1) status = 'Tidak Lengkap';
      else if (missing.length === 1) status = 'Tidak ada ' + missing[0];

      return {
        bukti: proof ? 'Ada' : 'Tidak Ada',
        nota: nota ? 'Ada' : 'Tidak Ada',
        ttd: ttd ? 'Ada' : 'Tidak Ada',
        status: status,
        proofRequired: !isBelumBayar
      };
    };
  }

  function buildSupplierSummary(report) {
    var groups = Object.create(null);
    (report.rows || []).forEach(function (row) {
      var supplier = text(row.supplier, 'Supplier belum tercatat');
      var account = text(row.rekeningPenerima, '-');
      var key = supplier + '\u0001' + account;
      if (!groups[key]) {
        groups[key] = { supplier: supplier, account: account, count: 0, total: 0 };
      }
      groups[key].count += 1;
      groups[key].total += Number(row.nominal) || 0;
    });

    return Object.keys(groups).map(function (key) {
      return groups[key];
    }).sort(function (left, right) {
      return right.total - left.total || left.supplier.localeCompare(right.supplier, 'id');
    });
  }

  function buildCategorySummary(report) {
    var groups = Object.create(null);
    (report.rows || []).forEach(function (row) {
      var category = text(row.jenis, 'Tanpa Kategori');
      if (!groups[category]) groups[category] = { category: category, count: 0, total: 0 };
      groups[category].count += 1;
      groups[category].total += Number(row.nominal) || 0;
    });

    var grandTotal = Number(report.total) || (report.rows || []).reduce(function (sum, row) {
      return sum + (Number(row.nominal) || 0);
    }, 0);

    return Object.keys(groups).map(function (key) {
      var group = groups[key];
      group.share = grandTotal ? group.total / grandTotal : 0;
      return group;
    }).sort(function (left, right) {
      return right.total - left.total || left.category.localeCompare(right.category, 'id');
    });
  }

  function supplierTotals(summary) {
    return summary.reduce(function (total, group) {
      total.count += Number(group.count) || 0;
      total.nominal += Number(group.total) || 0;
      return total;
    }, { count: 0, nominal: 0 });
  }

  function categoryTotals(summary) {
    return summary.reduce(function (total, group) {
      total.count += Number(group.count) || 0;
      total.nominal += Number(group.total) || 0;
      return total;
    }, { count: 0, nominal: 0 });
  }

  function styleSpreadsheetSheet(sheet, headerRow, firstDataRow, lastDataRow, noColumn, nominalColumn) {
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
    }
  }

  function styleTotalRow(sheet, rowIndex, lastColumn) {
    if (!sheet || !window.XLSX || !window.XLSX.utils) return;
    for (var col = 0; col <= lastColumn; col += 1) {
      var cell = sheet[window.XLSX.utils.encode_cell({ r: rowIndex, c: col })];
      if (!cell) continue;
      cell.s = cell.s || {};
      cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } };
      cell.s.font = { bold: true, color: { rgb: '0F3D5C' } };
    }
  }

  function install() {
    removeLegacyApprovalSummary();
    removeCompletenessFilter();
    installDocumentRule();

    if (typeof window._approvalReportModel !== 'function' ||
        typeof window.exportApprovalReportPDF !== 'function' ||
        typeof window.exportApprovalSpreadsheet !== 'function' ||
        typeof window._loadApprovalSpreadsheetLibrary !== 'function' ||
        typeof window._appendApprovalSheet !== 'function') {
      return false;
    }
    if (window.exportApprovalReportPDF.__approvalCleanReportV3) return true;

    window.exportApprovalReportPDF = function (data, pageLabel) {
      var report = window._approvalReportModel(data);
      var supplierSummary = buildSupplierSummary(report);
      var categorySummary = buildCategorySummary(report);
      var supplierTotal = supplierTotals(supplierSummary);
      var categoryTotal = categoryTotals(categorySummary);
      var title = pageLabel || 'Laporan Approval Transaksi';
      var createdBy = window.currentUser
        ? (window.currentUser.namaLengkap || window.currentUser.email || '-')
        : '-';

      var detailRows = report.rows.map(function (row) {
        return '<tr><td class="no-cell">' + row.no + '</td><td>' + esc(row.tanggal) + '</td>' +
          '<td class="code">' + esc(row.kode) + '</td><td>' + esc(row.sppg) + '</td><td>' + esc(row.jenis) + '</td>' +
          '<td>' + esc(row.item) + '</td><td>' + esc(row.supplier) + '</td><td>' + esc(row.rekeningPenerima) + '</td>' +
          '<td class="money">Rp ' + Math.round(row.nominal).toLocaleString('id-ID') + '</td><td>' + esc(row.metode) + '</td></tr>';
      }).join('');

      var categoryRows = categorySummary.map(function (group, index) {
        return '<tr><td class="no-cell">' + (index + 1) + '</td><td>' + esc(group.category) + '</td><td class="center">' + group.count +
          '</td><td class="money">Rp ' + Math.round(group.total).toLocaleString('id-ID') + '</td><td class="center">' +
          (group.share * 100).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%</td></tr>';
      }).join('');

      var categoryTotalRow = '<tr class="grand-total"><td></td><td>TOTAL KESELURUHAN</td><td class="center">' + categoryTotal.count +
        '</td><td class="money">Rp ' + Math.round(categoryTotal.nominal).toLocaleString('id-ID') + '</td><td class="center">100%</td></tr>';

      var supplierRows = supplierSummary.map(function (group, index) {
        return '<tr><td class="no-cell">' + (index + 1) + '</td><td>' + esc(group.supplier) + '</td><td>' + esc(group.account) +
          '</td><td class="center">' + group.count + '</td><td class="money">Rp ' + Math.round(group.total).toLocaleString('id-ID') + '</td></tr>';
      }).join('');

      var supplierTotalRow = '<tr class="grand-total"><td></td><td colspan="2">TOTAL KESELURUHAN</td><td class="center">' + supplierTotal.count +
        '</td><td class="money">Rp ' + Math.round(supplierTotal.nominal).toLocaleString('id-ID') + '</td></tr>';

      var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
        '@page{size:A4 landscape;margin:8mm 6mm 10mm}*{box-sizing:border-box}' +
        'body{margin:0;color:#172033;background:#fff;font:7.4px/1.4 Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        'header{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:0 0 9px;margin-bottom:12px;border-bottom:3px solid #15577a}' +
        '.brand{display:flex;align-items:center;gap:11px}.brand-logo{width:52px;height:52px;object-fit:contain;flex:none}.brand-copy{min-width:0}' +
        'h1{margin:0;color:#15577a;font-size:17px;line-height:1.15}h2{margin:16px 0 7px;color:#15577a;font-size:11.5px;line-height:1.2}' +
        '.meta{text-align:right;color:#475569;white-space:nowrap;line-height:1.55}.summary-note{margin:5px 0 8px;color:#475569;font-size:7px}' +
        '.table-wrap{border:1px solid #b8c9d4;border-radius:7px;overflow:hidden}table{width:100%;border-collapse:collapse;table-layout:fixed}' +
        'thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}' +
        'th{background:#dcecf5;color:#103b55;text-align:center!important;vertical-align:middle;padding:6px 4px;border:1px solid #b8c9d4;font-weight:700}' +
        'td{text-align:left;vertical-align:top;padding:5px;border:1px solid #dbe3e8;overflow-wrap:anywhere}tbody tr:nth-child(even) td{background:#f8fafc}' +
        '.no-cell,.center{text-align:center!important}.no-cell{padding-left:2px!important;padding-right:2px!important;white-space:nowrap}.money{text-align:right!important;font-weight:700;white-space:nowrap}.code{font-family:Consolas,monospace}' +
        '.detail-table col.no{width:3%}.detail-table col.date{width:8%}.detail-table col.code-col{width:10%}.detail-table col.sppg{width:9%}.detail-table col.category{width:11%}' +
        '.detail-table col.item{width:11%}.detail-table col.supplier{width:13%}.detail-table col.account{width:17%}.detail-table col.nominal{width:9%}.detail-table col.payment{width:9%}' +
        '.category-table col.no{width:4%}.category-table col.category{width:40%}.category-table col.trx{width:14%}.category-table col.total{width:22%}.category-table col.share{width:20%}' +
        '.supplier-table col.no{width:4%}.supplier-table col.supplier{width:30%}.supplier-table col.account{width:38%}.supplier-table col.trx{width:10%}.supplier-table col.total{width:18%}' +
        '.grand-total td{background:#dbeafe!important;color:#0f3d5c;font-weight:700;border-top:2px solid #15577a;vertical-align:middle}' +
        '</style></head><body><header><div class="brand"><img class="brand-logo" src="' + LOGO_BGN_URL + '" alt="Logo BGN" onerror="this.style.display=\'none\'">' +
        '<div class="brand-copy"><h1>' + esc(title) + '</h1><div>SIM-SPPG</div></div></div><div class="meta">Periode: ' + esc(report.period) +
        '<br>Filter: ' + esc(report.filters) + '<br>Dibuat oleh: ' + esc(createdBy) + '<br>Jumlah: ' + report.count + ' transaksi</div></header>' +
        '<h2>Detail Approval</h2><div class="table-wrap"><table class="detail-table"><colgroup><col class="no"><col class="date"><col class="code-col"><col class="sppg"><col class="category"><col class="item"><col class="supplier"><col class="account"><col class="nominal"><col class="payment"></colgroup>' +
        '<thead><tr><th>No</th><th>Tanggal</th><th>Kode</th><th>SPPG</th><th>Jenis Kategori</th><th>Item</th><th>' + SUPPLIER_LABEL + '</th><th>Rekening Penerima</th><th>Nominal</th><th>Status</th></tr></thead><tbody>' + detailRows + '</tbody></table></div>' +
        '<h2>Rekap per Jenis Kategori</h2><div class="summary-note">Rekap dihitung dari seluruh transaksi yang masuk dalam laporan sesuai filter aktif.</div>' +
        '<div class="table-wrap"><table class="category-table"><colgroup><col class="no"><col class="category"><col class="trx"><col class="total"><col class="share"></colgroup>' +
        '<thead><tr><th>No</th><th>Jenis Kategori</th><th>Transaksi</th><th>Total Nominal</th><th>Kontribusi</th></tr></thead><tbody>' + categoryRows + categoryTotalRow + '</tbody></table></div>' +
        '<h2>Rekap Pembayaran per Supplier</h2><div class="summary-note">Rekap dikelompokkan berdasarkan supplier dan rekening penerima.</div>' +
        '<div class="table-wrap"><table class="supplier-table"><colgroup><col class="no"><col class="supplier"><col class="account"><col class="trx"><col class="total"></colgroup>' +
        '<thead><tr><th>No</th><th>' + SUPPLIER_LABEL + '</th><th>Rekening Penerima</th><th>Transaksi</th><th>Total Nominal</th></tr></thead><tbody>' + supplierRows + supplierTotalRow + '</tbody></table></div>' +
        '</body></html>';

      var printWindow = window.open('', '_blank');
      if (!printWindow) {
        if (typeof window.showToast === 'function') window.showToast('error', 'Gagal', 'Pop-up diblokir browser.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = function () { printWindow.print(); };
      if (typeof window.showToast === 'function') window.showToast('success', 'PDF Siap', 'Laporan Approval siap dicetak atau disimpan sebagai PDF.');
    };
    window.exportApprovalReportPDF.__approvalCleanReportV3 = true;

    window.exportApprovalReportCSV = function (data) {
      var report = window._approvalReportModel(data);
      var supplierSummary = buildSupplierSummary(report);
      var categorySummary = buildCategorySummary(report);
      var supplierTotal = supplierTotals(supplierSummary);
      var categoryTotal = categoryTotals(categorySummary);
      var createdBy = window.currentUser
        ? (window.currentUser.namaLengkap || window.currentUser.email || '-')
        : '-';
      var lines = [];
      var add = function (values) { lines.push(values.map(csv).join(',')); };

      add(['LAPORAN APPROVAL TRANSAKSI SIM-SPPG']);
      add(['Periode', report.period]);
      add(['Filter aktif', report.filters]);
      add(['Dibuat oleh', createdBy]);
      add(['Jumlah transaksi', report.count]);
      add(['Total nominal', Math.round(report.total)]);
      lines.push('');

      add(['DETAIL APPROVAL']);
      add(['No','Tanggal','Kode','SPPG','Nama Penginput','Email Penginput','Jenis Kategori','Nama Item',SUPPLIER_LABEL,'Rekening Penerima','Nama Bank','Nomor Rekening','Atas Nama','Nominal (Rp)','Status Pembayaran']);
      report.rows.forEach(function (row) {
        add([row.no,row.tanggal,row.kode,row.sppg,row.nama,row.email,row.jenis,row.item,row.supplier,row.rekeningPenerima,row.bank,row.rekening,row.atasNama,Math.round(row.nominal),row.metode]);
      });
      lines.push('');

      add(['REKAP PER JENIS KATEGORI']);
      add(['No','Jenis Kategori','Jumlah Transaksi','Total Nominal (Rp)','Kontribusi (%)']);
      categorySummary.forEach(function (group, index) {
        add([index + 1,group.category,group.count,Math.round(group.total),Number((group.share * 100).toFixed(2))]);
      });
      add(['','TOTAL KESELURUHAN',categoryTotal.count,Math.round(categoryTotal.nominal),100]);
      lines.push('');

      add(['REKAP PEMBAYARAN PER SUPPLIER']);
      add(['No',SUPPLIER_LABEL,'Rekening Penerima','Jumlah Transaksi','Total Nominal (Rp)']);
      supplierSummary.forEach(function (group, index) {
        add([index + 1,group.supplier,group.account,group.count,Math.round(group.total)]);
      });
      add(['','TOTAL KESELURUHAN','',supplierTotal.count,Math.round(supplierTotal.nominal)]);

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
    window.exportApprovalReportCSV.__approvalCleanReportV3 = true;

    window.exportApprovalSpreadsheet = function (data, format) {
      var report = window._approvalReportModel(data);
      var supplierSummary = buildSupplierSummary(report);
      var categorySummary = buildCategorySummary(report);
      var supplierTotal = supplierTotals(supplierSummary);
      var categoryTotal = categoryTotals(categorySummary);
      var extension = format === 'ods' ? 'ods' : 'xlsx';
      if (typeof window.showLoading === 'function') window.showLoading(true);

      window._loadApprovalSpreadsheetLibrary().then(function () {
        var workbook = window.XLSX.utils.book_new();
        workbook.Props = workbook.Props || {};
        workbook.Props.Title = 'Laporan Approval Transaksi SIM-SPPG';
        workbook.Props.Subject = 'Rekap Approval per Jenis Kategori dan Supplier';

        var detailRows = [['No','Tanggal','Kode','SPPG','Nama Penginput','Email','Jenis Kategori','Nama Item',SUPPLIER_LABEL,'Rekening Penerima','Nama Bank','Nomor Rekening','Atas Nama','Nominal (Rp)','Status Pembayaran']];
        report.rows.forEach(function (row) {
          detailRows.push([row.no,row.tanggal,row.kode,row.sppg,row.nama,row.email,row.jenis,row.item,row.supplier,row.rekeningPenerima,row.bank,row.rekening,row.atasNama,Math.round(row.nominal),row.metode]);
        });

        var categoryRows = [['No','Jenis Kategori','Jumlah Transaksi','Total Nominal (Rp)','Kontribusi']];
        categorySummary.forEach(function (group, index) {
          categoryRows.push([index + 1,group.category,group.count,Math.round(group.total),group.share]);
        });
        categoryRows.push(['','TOTAL KESELURUHAN',categoryTotal.count,Math.round(categoryTotal.nominal),1]);

        var supplierRows = [['No',SUPPLIER_LABEL,'Rekening Penerima','Jumlah Transaksi','Total Nominal (Rp)']];
        supplierSummary.forEach(function (group, index) {
          supplierRows.push([index + 1,group.supplier,group.account,group.count,Math.round(group.total)]);
        });
        supplierRows.push(['','TOTAL KESELURUHAN','',supplierTotal.count,Math.round(supplierTotal.nominal)]);

        window._appendApprovalSheet(workbook, 'Detail Approval', detailRows, [4,16,22,16,22,30,24,34,28,42,18,22,26,18,25], 1);
        window._appendApprovalSheet(workbook, 'Rekap Jenis Kategori', categoryRows, [4,34,18,22,16], 1);
        window._appendApprovalSheet(workbook, 'Rekap Supplier', supplierRows, [4,30,44,18,22], 1);

        var detailSheet = workbook.Sheets['Detail Approval'];
        var categorySheet = workbook.Sheets['Rekap Jenis Kategori'];
        var supplierSheet = workbook.Sheets['Rekap Supplier'];

        if (detailSheet) {
          detailSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
          styleSpreadsheetSheet(detailSheet, 1, 2, detailRows.length, 0, 13);
        }
        if (categorySheet) {
          categorySheet['!freeze'] = { xSplit: 0, ySplit: 1 };
          styleSpreadsheetSheet(categorySheet, 1, 2, categoryRows.length, 0, 3);
          for (var categoryRow = 1; categoryRow < categoryRows.length; categoryRow += 1) {
            var percentCell = categorySheet[window.XLSX.utils.encode_cell({ r: categoryRow, c: 4 })];
            if (percentCell) percentCell.z = '0.00%';
          }
          styleTotalRow(categorySheet, categoryRows.length - 1, 4);
        }
        if (supplierSheet) {
          supplierSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
          styleSpreadsheetSheet(supplierSheet, 1, 2, supplierRows.length, 0, 4);
          styleTotalRow(supplierSheet, supplierRows.length - 1, 4);
        }

        window.XLSX.writeFile(
          workbook,
          'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.' + extension,
          { bookType: extension, compression: true, cellStyles: true }
        );
        if (typeof window.showLoading === 'function') window.showLoading(false);
        if (typeof window.showToast === 'function') window.showToast('success', 'Laporan Siap', 'Detail, rekap Jenis Kategori, dan rekap Supplier berhasil dibuat.');
      }).catch(function (error) {
        if (typeof window.showLoading === 'function') window.showLoading(false);
        if (typeof window.showToast === 'function') {
          window.showToast('error', 'Gagal', error && error.message ? error.message : 'Spreadsheet gagal dibuat.');
        }
      });
    };
    window.exportApprovalSpreadsheet.__approvalCleanReportV3 = true;
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      removeLegacyApprovalSummary();
      removeCompletenessFilter();
      installDocumentRule();
    }, { once: true });
  } else {
    removeLegacyApprovalSummary();
    removeCompletenessFilter();
    installDocumentRule();
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 80) clearInterval(timer);
    }, 100);
  }
})();
