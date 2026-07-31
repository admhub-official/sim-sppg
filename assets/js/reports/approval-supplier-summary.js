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
      if (row.kelengkapan === 'Lengkap') groups[key].complete += 1;
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
        return '<tr><td class="center">' + row.no + '</td><td>' + esc(row.tanggal) + '</td>' +
          '<td>' + esc(row.kode) + '</td><td>' + esc(row.sppg) + '</td><td>' + esc(row.item) + '</td>' +
          '<td>' + esc(row.supplier) + '</td><td>' + esc(row.rekeningPenerima) + '</td>' +
          '<td class="money">Rp ' + Math.round(row.nominal).toLocaleString('id-ID') + '</td>' +
          '<td>' + esc(row.metode) + '</td><td>' + esc(row.kelengkapan) + '</td></tr>';
      }).join('');
      var summaryRows = summary.map(function (group, index) {
        return '<tr><td class="center">' + (index + 1) + '</td><td>' + esc(group.supplier) + '</td><td>' + esc(group.account) + '</td>' +
          '<td class="center">' + group.count + '</td><td class="center">' + group.complete + '</td>' +
          '<td class="center">' + group.incomplete + '</td><td class="money">Rp ' +
          Math.round(group.total).toLocaleString('id-ID') + '</td></tr>';
      }).join('');
      var totalRow = '<tr class="grand-total"><td colspan="3">TOTAL KESELURUHAN</td>' +
        '<td class="center">' + totals.count + '</td><td class="center">' + totals.complete + '</td>' +
        '<td class="center">' + totals.incomplete + '</td><td class="money">Rp ' +
        Math.round(totals.nominal).toLocaleString('id-ID') + '</td></tr>';
      var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
        '@page{size:A4 landscape;margin:8mm 6mm 10mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:7.2px/1.35 Arial,sans-serif}' +
        'header{display:flex;justify-content:space-between;gap:18px;align-items:center;padding-bottom:8px;margin-bottom:8px;border-bottom:3px solid #15577a}' +
        '.brand{display:flex;align-items:center;gap:10px}.brand-logo{width:48px;height:48px;object-fit:contain;flex:none}.brand-copy{min-width:0}' +
        'h1{margin:0;color:#15577a;font-size:16px}h2{margin:14px 0 6px;color:#15577a;font-size:11px}.meta{text-align:right;color:#475569;white-space:nowrap}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#e2eef5;color:#153b53;text-align:left;padding:5px 4px;border:1px solid #b8c9d4}' +
        'td{padding:4px;border:1px solid #dbe3e8;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f8fafc}.center{text-align:center}.money{text-align:right;font-weight:700;white-space:nowrap}' +
        '.grand-total td{background:#dbeafe!important;color:#0f3d5c;font-weight:700;border-top:2px solid #15577a}.grand-total td:first-child{text-align:right}' +
        '.summary-note{margin:5px 0 7px;color:#475569;font-size:7px}' +
        '</style></head><body><header><div class="brand"><img class="brand-logo" src="' + LOGO_BGN_URL + '" alt="Logo BGN" onerror="this.style.display=\'none\'">' +
        '<div class="brand-copy"><h1>' + esc(title) + '</h1><div>SIM-SPPG</div></div></div><div class="meta">Periode: ' +
        esc(report.period) + '<br>Filter: ' + esc(report.filters) + '<br>Dibuat oleh: ' + esc(createdBy) + '<br>Jumlah: ' + report.count + ' transaksi</div></header>' +
        '<h2>Detail Approval</h2><table><thead><tr><th>No</th><th>Tanggal</th><th>Kode</th><th>SPPG</th><th>Item</th><th>' + SUPPLIER_LABEL + '</th><th>Rekening Penerima</th><th>Nominal</th><th>Status</th><th>Kelengkapan</th></tr></thead><tbody>' +
        detailRows + '</tbody></table><h2>Rekap Pembayaran per Supplier</h2><div class="summary-note">Total keseluruhan dihitung dari seluruh transaksi yang masuk dalam laporan sesuai filter aktif.</div>' +
        '<table><thead><tr><th>No</th><th>' + SUPPLIER_LABEL + '</th><th>Rekening Penerima</th><th>Transaksi</th><th>Dokumen Lengkap</th><th>Belum Lengkap</th><th>Total Nominal</th></tr></thead><tbody>' +
        summaryRows + totalRow + '</tbody></table></body></html>';
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
        window._appendApprovalSheet(workbook, 'Detail Approval', detailRows, [6,16,22,16,22,30,24,34,28,42,18,22,26,18,25,27], 1);
        window._appendApprovalSheet(workbook, 'Rekap Supplier', summaryRows, [6,30,44,18,20,24,22], 1);
        window.XLSX.writeFile(workbook, 'Laporan_Approval_SIM-SPPG_' + new Date().toISOString().slice(0, 10) + '.' + extension, { bookType: extension, compression: true });
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
