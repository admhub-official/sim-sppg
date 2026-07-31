(function () {
  'use strict';

  function text(value, fallback) {
    var result = String(value == null ? '' : value).trim();
    return result || (fallback == null ? '-' : fallback);
  }

  function escapeHtml(value) {
    return text(value, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function firstValue(source, keys, fallback) {
    for (var index = 0; index < keys.length; index += 1) {
      var value = source && source[keys[index]];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return fallback;
  }

  function supplierFields(transaction) {
    var supplier = text(firstValue(transaction, [
      'supplierName', 'namaSupplier', 'NAMA SUPPLIER', 'Supplier', 'supplier'
    ], 'Belum tercatat'), 'Belum tercatat');
    var bank = text(firstValue(transaction, [
      'supplierBankName', 'namaBankSupplier', 'NAMA BANK SUPPLIER', 'NAMA BANK', 'bank'
    ], '-'));
    var accountNumber = text(firstValue(transaction, [
      'supplierAccountNumber', 'noRekeningSupplier', 'NO REKENING SUPPLIER', 'NO REKENING', 'rekening'
    ], '-'));
    var accountHolder = text(firstValue(transaction, [
      'supplierAccountHolder', 'atasNamaRekeningSupplier', 'ATAS NAMA REKENING SUPPLIER',
      'ATAS NAMA REKENING', 'atasNama'
    ], '-'));
    var accountDescription = bank + ' - ' + accountNumber + ' a.n ' + accountHolder;

    return {
      supplier: supplier,
      bank: bank,
      accountNumber: accountNumber,
      accountHolder: accountHolder,
      accountDescription: accountDescription
    };
  }

  function enrichReport(report, sourceRows) {
    if (!report || !Array.isArray(report.rows)) return report;
    report.rows.forEach(function (row, index) {
      var fields = supplierFields((sourceRows || [])[index] || {});
      row.supplier = fields.supplier;
      row.bank = fields.bank;
      row.rekening = fields.accountNumber;
      row.atasNama = fields.accountHolder;
      row.rekeningPenerima = fields.accountDescription;
    });
    return report;
  }

  function statusClass(status) {
    if (status === 'Lengkap') return 'ok';
    if (status === 'Tidak Lengkap') return 'bad';
    return 'warn';
  }

  function install() {
    if (typeof window._approvalReportModel !== 'function' ||
        typeof window.exportApprovalReportPDF !== 'function' ||
        typeof window.exportApprovalSpreadsheet !== 'function') {
      return false;
    }
    if (window.exportApprovalReportPDF.__supplierAccountColumns) return true;

    var originalModel = window._approvalReportModel;
    window._approvalReportModel = function (data) {
      return enrichReport(originalModel(data), data);
    };

    window.exportApprovalReportPDF = function (data, pageLabel) {
      var report = window._approvalReportModel(data);
      var createdBy = window.currentUser
        ? (window.currentUser.namaLengkap || window.currentUser.email || '-')
        : '-';
      var title = pageLabel || 'Laporan Approval Transaksi';
      var rows = report.rows.map(function (row) {
        return '<tr>' +
          '<td class="center">' + row.no + '</td>' +
          '<td>' + escapeHtml(row.tanggal) + '</td>' +
          '<td class="code">' + escapeHtml(row.kode) + '</td>' +
          '<td>' + escapeHtml(row.sppg) + '</td>' +
          '<td>' + escapeHtml(row.item) + '</td>' +
          '<td>' + escapeHtml(row.supplier) + '</td>' +
          '<td class="account">' + escapeHtml(row.rekeningPenerima) + '</td>' +
          '<td class="money">Rp ' + Math.round(row.nominal).toLocaleString('id-ID') + '</td>' +
          '<td>' + escapeHtml(row.metode) + '</td>' +
          '<td><span class="status ' + statusClass(row.kelengkapan) + '">' + escapeHtml(row.kelengkapan) + '</span></td>' +
          '</tr>';
      }).join('');

      var html = '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
        '<title>' + escapeHtml(title) + '</title><style>' +
        '@page{size:A4 landscape;margin:8mm 6mm 10mm}*{box-sizing:border-box}' +
        'body{margin:0;color:#172033;font:7.2px/1.35 Arial,sans-serif}' +
        'header{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;padding-bottom:8px;margin-bottom:8px;border-bottom:3px solid #15577a}' +
        'h1{margin:0;color:#15577a;font-size:16px}.meta{text-align:right;color:#475569;line-height:1.5}' +
        '.summary{display:flex;gap:8px;margin:0 0 9px}.summary div{flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px}' +
        '.summary span{display:block;color:#64748b;font-size:7px}.summary strong{display:block;margin-top:2px;font-size:10px}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#e2eef5;color:#153b53;text-align:left;padding:5px 4px;border:1px solid #b8c9d4;font-size:6.6px}' +
        'td{padding:4px;border:1px solid #dbe3e8;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f8fafc}' +
        '.center{text-align:center}.money{text-align:right;font-weight:700;white-space:nowrap}.code{font-family:monospace}.account{font-size:6.8px}' +
        '.status{display:inline-block;border-radius:10px;padding:2px 5px;font-weight:700}.status.ok{background:#dcfce7;color:#166534}.status.warn{background:#fef3c7;color:#92400e}.status.bad{background:#fee2e2;color:#991b1b}' +
        'th:nth-child(1){width:3%}th:nth-child(2){width:7%}th:nth-child(3){width:9%}th:nth-child(4){width:8%}th:nth-child(5){width:13%}' +
        'th:nth-child(6){width:12%}th:nth-child(7){width:20%}th:nth-child(8){width:10%}th:nth-child(9){width:9%}th:nth-child(10){width:9%}' +
        '</style></head><body><header><div><h1>' + escapeHtml(title) + '</h1><div>SIM-SPPG</div></div>' +
        '<div class="meta">Periode: ' + escapeHtml(report.period) + '<br>Filter: ' + escapeHtml(report.filters) + '<br>Dibuat oleh: ' + escapeHtml(createdBy) + '</div></header>' +
        '<div class="summary"><div><span>Jumlah transaksi</span><strong>' + report.count + '</strong></div>' +
        '<div><span>Total nominal</span><strong>Rp ' + Math.round(report.total).toLocaleString('id-ID') + '</strong></div>' +
        '<div><span>Dibuat pada</span><strong>' + escapeHtml(new Date().toLocaleString('id-ID')) + '</strong></div></div>' +
        '<table><thead><tr><th>No</th><th>Tanggal</th><th>Kode</th><th>SPPG</th><th>Nama Item</th>' +
        '<th>Supplier / Penjual</th><th>Rekening Penerima</th><th>Nominal</th><th>Status Pembayaran</th><th>Kelengkapan</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></body></html>';

      var printWindow = window.open('', '_blank');
      if (!printWindow) {
        if (typeof window.showToast === 'function') window.showToast('error', 'Gagal', 'Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = function () { printWindow.print(); };
      if (typeof window.showToast === 'function') window.showToast('success', 'PDF Siap', 'Jendela cetak/simpan PDF telah dibuka.');
    };
    window.exportApprovalReportPDF.__supplierAccountColumns = true;

    window.exportApprovalSpreadsheet = function (data, format) {
      var report = window._approvalReportModel(data);
      var extension = format === 'ods' ? 'ods' : 'xlsx';
      var formatLabel = extension === 'ods' ? 'Spreadsheet ODS' : 'Excel';
      if (typeof window.showLoading === 'function') window.showLoading(true);

      window._loadApprovalSpreadsheetLibrary().then(function () {
        var workbook = window.XLSX.utils.book_new();
        var createdBy = window.currentUser
          ? (window.currentUser.namaLengkap || window.currentUser.email || '-')
          : '-';
        var summaryRows = [
          ['LAPORAN APPROVAL TRANSAKSI SIM-SPPG'],
          ['Periode', report.period],
          ['Filter aktif', report.filters],
          ['Dibuat pada', new Date().toLocaleString('id-ID')],
          ['Dibuat oleh', createdBy],
          ['Jumlah transaksi', report.count],
          ['Total nominal (Rp)', Math.round(report.total)],
          [],
          ['RINGKASAN PER JENIS KATEGORI'],
          ['Jenis Kategori', 'Jumlah Transaksi', 'Total Nominal (Rp)', 'Kontribusi']
        ];
        report.categories.forEach(function (row) {
          summaryRows.push([row.label, row.count, Math.round(row.total), report.total ? row.total / report.total : 0]);
        });
        summaryRows.push(['TOTAL', report.count, Math.round(report.total), 1]);

        var detailRows = [[
          'No', 'Tanggal Transaksi', 'Kode Transaksi', 'SPPG', 'Nama Penginput', 'Email Penginput',
          'Jenis Kategori', 'Nama Item', 'Supplier / Penjual', 'Rekening Penerima',
          'Nama Bank', 'Nomor Rekening', 'Atas Nama Penerima', 'Nominal (Rp)',
          'Status Approval/Pembayaran', 'Status Kelengkapan', 'Indikator Warna',
          'Bukti Pembayaran', 'Nota', 'TTD User'
        ]];
        report.rows.forEach(function (row) {
          detailRows.push([
            row.no, row.tanggal, row.kode, row.sppg, row.nama, row.email,
            row.jenis, row.item, row.supplier, row.rekeningPenerima,
            row.bank, row.rekening, row.atasNama, Math.round(row.nominal),
            row.metode, row.kelengkapan, row.indikator, row.bukti, row.nota, row.ttd
          ]);
        });

        var sppgRows = [['SPPG', 'Nama Penginput', 'Email Penginput', 'Jumlah Transaksi', 'Dokumen Lengkap', 'Dokumen Belum Lengkap', 'Total Nominal (Rp)']];
        report.sppg.forEach(function (row) {
          sppgRows.push([row.sppg, row.nama, row.email, row.count, row.lengkap, row.tidakLengkap, Math.round(row.total)]);
        });
        var completenessRows = [['Status Kelengkapan', 'Jumlah Transaksi', 'Total Nominal (Rp)']];
        report.completeness.forEach(function (row) {
          completenessRows.push([row.label, row.count, Math.round(row.total)]);
        });

        window._appendApprovalSheet(workbook, 'Ringkasan', summaryRows, [30, 20, 22, 16]);
        window._appendApprovalSheet(workbook, 'Detail Approval', detailRows,
          [6, 16, 22, 16, 22, 30, 24, 34, 28, 42, 18, 22, 26, 18, 25, 27, 18, 20, 14, 14], 1);
        window._appendApprovalSheet(workbook, 'SPPG dan Penginput', sppgRows, [18, 24, 30, 18, 18, 24, 20], 1);
        window._appendApprovalSheet(workbook, 'Kelengkapan', completenessRows, [30, 20, 22], 1);

        window.XLSX.writeFile(
          workbook,
          'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.' + extension,
          { bookType: extension, compression: true }
        );
        if (typeof window.showLoading === 'function') window.showLoading(false);
        if (typeof window.showToast === 'function') window.showToast('success', formatLabel + ' Siap', 'Supplier dan rekening penerima telah ditambahkan.');
      }).catch(function (error) {
        if (typeof window.showLoading === 'function') window.showLoading(false);
        if (typeof window.showToast === 'function') window.showToast('error', 'Gagal', error && error.message ? error.message : 'Spreadsheet gagal dibuat.');
      });
    };
    window.exportApprovalSpreadsheet.__supplierAccountColumns = true;

    return true;
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 80) clearInterval(timer);
    }, 100);
  }
})();
