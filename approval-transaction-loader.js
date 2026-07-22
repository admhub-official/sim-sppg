/* SIM-SPPG Approval data adapter.
 * Reuses the same getTransactions response contract as the Transaksi page,
 * then derives the pending Approval queue locally.
 */
(function () {
  'use strict';

  function clearWatchdog(state) {
    if (state && state.watchdog) {
      clearTimeout(state.watchdog);
      state.watchdog = null;
    }
  }

  function setRefreshing(refreshing) {
    var page = document.getElementById('page-approval');
    if (page) page.classList.toggle('approval-refreshing', !!refreshing);
  }

  function runQueued(state) {
    if (!state || !state.queued) return;
    state.queued = false;
    setTimeout(function () {
      if (typeof window.loadApprovalData === 'function') window.loadApprovalData();
    }, 0);
  }

  window.loadApprovalData = function () {
    if (!window.currentUser) return;

    var state = window.approvalLoadState;
    if (!state) {
      console.error('Approval load state tidak tersedia.');
      return;
    }

    if (state.inFlight) {
      state.queued = true;
      return;
    }

    state.inFlight = true;
    state.queued = false;
    var requestId = ++state.requestId;

    if (!state.hasLoaded && typeof window.renderApprovalLoadingState === 'function') {
      window.renderApprovalLoadingState();
    } else {
      setRefreshing(true);
    }

    if (window.selectedApprovalIds && typeof window.selectedApprovalIds.clear === 'function') {
      window.selectedApprovalIds.clear();
    }

    if (!window.approvalModeLoaded && typeof window.loadUploadBuktiMode === 'function') {
      window.loadUploadBuktiMode();
    }

    // Sama seperti loadTransactions(forceAll=true): ambil seluruh transaksi
    // pengeluaran, lalu tentukan status Approval setelah data diterima.
    var filters = { kategori: 'PENGELUARAN' };
    if (window.globalDateFilter && window.globalDateFilter.start) {
      filters.dateStart = window.globalDateFilter.start;
    }
    if (window.globalDateFilter && window.globalDateFilter.end) {
      filters.dateEnd = window.globalDateFilter.end;
    }

    clearWatchdog(state);
    state.watchdog = setTimeout(function () {
      if (!state.inFlight || requestId !== state.requestId) return;
      state.requestId++;
      state.inFlight = false;
      setRefreshing(false);
      if (typeof window.renderApprovalLoadError === 'function') {
        window.renderApprovalLoadError('Server terlalu lama merespons. Tekan Muat Ulang untuk mencoba kembali.');
      }
      runQueued(state);
    }, 15000);

    window.callApi('getTransactions', [filters], function (result) {
      if (requestId !== state.requestId) return;
      clearWatchdog(state);
      state.inFlight = false;
      setRefreshing(false);

      var rows;
      if (Array.isArray(result)) rows = result;
      else if (result && Array.isArray(result.data)) rows = result.data;
      else {
        console.error('Data transaksi untuk Approval tidak valid:', result);
        if (typeof window.renderApprovalLoadError === 'function') {
          window.renderApprovalLoadError('Format data transaksi tidak valid. Silakan muat ulang.');
        }
        if (typeof window.showToast === 'function') {
          window.showToast('error', 'Gagal', 'Data Approval tidak dapat dibaca.');
        }
        runQueued(state);
        return;
      }

      var normalize = typeof window.normalizeApprovalTransaction === 'function'
        ? window.normalizeApprovalTransaction
        : function (row) { return row; };
      var isPending = typeof window.isApprovalQueueTransaction === 'function'
        ? window.isApprovalQueueTransaction
        : function () { return true; };

      window.allTransactions = rows.map(normalize).filter(function (tx) {
        return tx && isPending(tx);
      });

      state.hasLoaded = true;
      if (typeof window.populateApprovalFilters === 'function') window.populateApprovalFilters();
      if (typeof window.filterApproval === 'function') window.filterApproval();
      runQueued(state);
    }, function (error) {
      if (requestId !== state.requestId) return;
      clearWatchdog(state);
      state.inFlight = false;
      setRefreshing(false);

      var message = error && error.message
        ? error.message
        : 'Tidak dapat memuat data transaksi untuk Approval.';
      console.error('Gagal memuat transaksi untuk Approval:', error);
      if (typeof window.renderApprovalLoadError === 'function') {
        window.renderApprovalLoadError(message);
      }
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'Gagal', message);
      }
      runQueued(state);
    });
  };
})();
