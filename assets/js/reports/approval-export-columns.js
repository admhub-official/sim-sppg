(function () {
  'use strict';

  function text(value, fallback) {
    var result = String(value == null ? '' : value).trim();
    return result || (fallback == null ? '-' : fallback);
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

  function install() {
    if (typeof window._approvalReportModel !== 'function') return false;
    if (window._approvalReportModel.__supplierAccountColumnsV3) return true;

    var originalModel = window._approvalReportModel;
    var wrappedModel = function (data) {
      return enrichReport(originalModel(data), data);
    };
    wrappedModel.__supplierAccountColumnsV3 = true;
    window._approvalReportModel = wrappedModel;
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
