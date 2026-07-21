/* SIM-SPPG approval flow final override.
 * Loaded after app.js so it replaces the duplicate legacy Approval V2 handlers.
 */
(function () {
  'use strict';

  var directSnapshot = null;
  var verifierSnapshot = null;

  function el(id) { return document.getElementById(id); }
  function number(value) { return Number(value) || 0; }
  function adminAllowed() {
    return window.currentUser && ['ADMIN', 'SUPER_ADMIN'].includes(String(window.currentUser.role || '').toUpperCase());
  }
  function userDisplayName() {
    var user = window.currentUser || {};
    return user.namaLengkap || user.nama || user.username || user.email || '';
  }
  function canvasBase64(id) {
    var canvas = el(id);
    if (!canvas || typeof window.isCanvasBlank !== 'function' || window.isCanvasBlank(id)) return '';
    var dataUrl = canvas.toDataURL('image/png');
    return dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
  }
  function resetPinError() {
    var error = el('pinError');
    if (error) error.style.display = 'none';
  }
  function openNominalConfirmation(title, label, nominal) {
    window.pendingConfirmNominal = number(nominal);
    var titleEl = el('nominalConfirmTitle');
    var displayEl = el('nominalConfirmDisplay');
    var labelEl = el('nominalConfirmLabel');
    var inputEl = el('nominalConfirmInput');
    if (titleEl) titleEl.textContent = title;
    if (displayEl) displayEl.textContent = window.formatRupiah(window.pendingConfirmNominal);
    if (labelEl) labelEl.textContent = label;
    if (inputEl) inputEl.value = '';
    resetPinError();
    window.openModal('modalPin');
  }

  window.preSubmitApproval = function () {
    if (!adminAllowed()) return;
    var file = window.approvalFileData;
    if (!file || !file.base64) {
      window.showToast('error', 'Validasi', 'Bukti pelunasan wajib diupload.');
      return;
    }
    var signature = canvasBase64('approvalTtdCanvas');
    if (!signature) {
      window.showToast('error', 'Validasi', 'TTD verifikator wajib diisi.');
      return;
    }

    directSnapshot = {
      id: window.currentTrxId,
      approvedBy: userDisplayName(),
      ttdBase64: signature,
      catatanApproval: el('approvalCatatan') ? el('approvalCatatan').value : '',
      buktiBase64: file.base64,
      buktiMimeType: file.mimeType || 'image/png',
      buktiFileName: file.fileName || 'bukti.png'
    };
    window.verifikasiPembayaranMode = false;
    openNominalConfirmation('Sisa Pelunasan', 'Ketik ulang sisa nominal untuk konfirmasi', window.currentApprovalNominal || 0);
  };
  window.preSubmitApproval = window.preSubmitApproval;

  window.submitVerifikasiPembayaran = function () {
    if (!adminAllowed()) return;
    var signature = canvasBase64('verifTtdCanvas');
    if (!signature) {
      window.showToast('error', 'Validasi', 'TTD verifikator wajib diisi.');
      return;
    }

    verifierSnapshot = {
      txId: window.currentVerifikasiTxId,
      ttdBase64: signature,
      catatanApproval: el('verifCatatan') ? el('verifCatatan').value : '',
      approvedBy: userDisplayName()
    };
    window.verifTtdBase64Temp = signature;
    window.verifCatatanTemp = verifierSnapshot.catatanApproval;
    window.verifikasiPembayaranMode = true;
    openNominalConfirmation('Total Transaksi', 'Ketik ulang total nominal untuk konfirmasi TTD', window.currentVerifikasiNominal || 0);
  };

  window.doSubmitVerifikasiPembayaran = function () {
    var payload = verifierSnapshot;
    if (!payload || !payload.txId || !payload.ttdBase64) {
      window.showToast('error', 'Validasi', 'Data TTD verifikator tidak tersimpan. Silakan tanda tangan ulang.');
      return;
    }

    window.closeModal('modalVerifikasiPembayaran');
    window.showLoading(true);
    window.callApi('verifyUserPayment', [payload], function (result) {
      window.showLoading(false);
      if (result && result.success) {
        verifierSnapshot = null;
        window.verifTtdBase64Temp = '';
        window.verifCatatanTemp = '';
        window.showToast('success', 'Sudah Dibayar', result.message || 'Pembayaran berhasil diverifikasi.');
        window.loadApprovalData();
        window.loadTransactions();
        window.loadDashboardData();
      } else {
        window.showToast('error', 'Gagal', result && result.message ? result.message : 'Verifikasi gagal.');
      }
    }, function (error) {
      window.showLoading(false);
      window.showToast('error', 'Gagal', error && error.message ? error.message : 'Terjadi kesalahan.');
    });
  };

  window.submitApprovalWithPin = function () {
    var raw = String(el('nominalConfirmInput') ? el('nominalConfirmInput').value : '').trim();
    if (!/^\d+$/.test(raw) || parseInt(raw, 10) !== Math.round(number(window.pendingConfirmNominal))) {
      var text = el('pinErrorText');
      var error = el('pinError');
      if (text) text.textContent = 'Nominal konfirmasi tidak cocok.';
      if (error) error.style.display = 'block';
      return;
    }

    window.closeModal('modalPin');

    if (window.verifikasiPembayaranMode) {
      window.verifikasiPembayaranMode = false;
      window.doSubmitVerifikasiPembayaran();
      return;
    }

    if (window.bulkApprovalMode) {
      window.bulkApprovalMode = false;
      window.openBulkApprovalPin();
      return;
    }

    var payload = directSnapshot;
    if (!payload || !payload.id || !payload.buktiBase64 || !payload.ttdBase64) {
      window.showToast('error', 'Validasi', 'Snapshot bukti pembayaran atau TTD tidak tersedia. Silakan isi ulang.');
      return;
    }

    window.closeModal('modalApproval');
    window.showLoading(true);
    window.callApi('approveTransaction', [payload], function (result) {
      window.showLoading(false);
      if (result && result.success) {
        directSnapshot = null;
        window.approvalFileData = null;
        window.showToast('success', 'Sudah Dibayar', result.message || 'Approval berhasil.');
        window.loadTransactions();
        window.loadApprovalData();
        window.loadDashboardData();
      } else {
        window.showToast('error', 'Gagal', result && result.message ? result.message : 'Approval gagal.');
      }
    }, function (error) {
      window.showLoading(false);
      window.showToast('error', 'Gagal', error && error.message ? error.message : 'Terjadi kesalahan.');
    });
  };

  // Expose for inline onclick handlers.
  window.submitVerifikasiPembayaran = window.submitVerifikasiPembayaran;
  window.doSubmitVerifikasiPembayaran = window.doSubmitVerifikasiPembayaran;
  window.submitApprovalWithPin = window.submitApprovalWithPin;
})();