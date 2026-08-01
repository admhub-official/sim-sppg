(function () {
  'use strict';

  var installed = false;

  function getApprovalData() {
    if (Array.isArray(window.filteredApprovalData)) return window.filteredApprovalData.slice();
    if (Array.isArray(window.approvalData)) return window.approvalData.slice();
    return [];
  }

  function isApprovalPage() {
    if (window.currentPage === 'approval') return true;
    var page = document.getElementById('page-approval');
    return Boolean(page && !page.classList.contains('hidden'));
  }

  function install() {
    if (installed || typeof window.printCurrentPage !== 'function') return installed;

    var original = window.printCurrentPage;
    if (original.__approvalPrintAllPages) {
      installed = true;
      return true;
    }

    window.printCurrentPage = function () {
      if (!isApprovalPage()) return original.apply(this, arguments);

      var rows = getApprovalData();
      if (!rows.length) {
        if (typeof window.showToast === 'function') {
          window.showToast('warning', 'Tidak Ada Data', 'Tidak ada data Approval sesuai filter untuk dicetak.');
        }
        return;
      }

      if (typeof window.exportApprovalReportPDF === 'function') {
        window.exportApprovalReportPDF(rows, 'Laporan Approval Transaksi');
        return;
      }

      return original.apply(this, arguments);
    };

    window.printCurrentPage.__approvalPrintAllPages = true;
    installed = true;
    return true;
  }

  if (!install()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts >= 120) clearInterval(timer);
    }, 100);
  }
})();
