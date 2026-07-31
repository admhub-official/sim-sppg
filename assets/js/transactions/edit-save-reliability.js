(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function value(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function api(name, params) {
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') return reject(new Error('API aplikasi belum siap.'));
      window.callApi(name, params || [], resolve, reject);
    });
  }
  function upload(file, kind, label) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error(label + ' tidak dapat dibaca.')); };
      reader.onload = function (event) {
        var base64 = String(event.target.result || '').split(',')[1] || '';
        api('uploadTxFile', [base64, file.type, file.name, kind]).then(function (result) {
          if (!result || !result.success || !result.fileName) {
            throw new Error((result && result.message) || label + ' gagal diunggah.');
          }
          resolve(result.fileName);
        }).catch(reject);
      };
      reader.readAsDataURL(file);
    });
  }
  function setButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.innerHTML = loading
      ? '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...'
      : '<i class="fas fa-save"></i> Simpan Perubahan';
  }

  window.saveEditTransaksi = async function () {
    var button = document.querySelector('#modalEditTransaksi .modal-footer .btn-primary');
    if (button && button.disabled) return;

    var id = value('editTxId');
    var fields = {
      'Tanggal': value('editTxTanggal'),
      'Kategori': value('editTxKategori'),
      'Jenis Kategori': value('editTxJenisKat'),
      'SPPG': value('editTxSPPG'),
      'Nama Item/Bahan Baku': value('editTxItem'),
      'Nominal': Number(value('editTxNominal')) || 0,
      'Catatan': value('editTxCatatan'),
      'Metode Transaksi': value('editTxMetode')
    };

    if (!id || !fields.Tanggal || !fields.SPPG || !fields['Nama Item/Bahan Baku'] || !(fields.Nominal > 0)) {
      window.showToast('error', 'Validasi', 'Tanggal, SPPG, nama item, dan nominal wajib diisi.');
      return;
    }

    if (fields.Kategori === 'PENGELUARAN') {
      fields['Supplier ID'] = value('editTxSupplierId');
      fields['Nama Supplier'] = value('editTxSupplier');
      fields['Nama Bank Supplier'] = value('editTxSupplierBank');
      fields['No Rekening Supplier'] = value('editTxSupplierAccount');
      fields['Atas Nama Rekening Supplier'] = value('editTxSupplierAccountHolder');
      if (!fields['Nama Supplier']) {
        window.showToast('error', 'Supplier Wajib', 'Pilih supplier atau isi nama penjual manual.');
        return;
      }
    }

    setButtonLoading(button, true);
    if (typeof window.showLoading === 'function') window.showLoading(true);

    try {
      var foto = byId('editTxFoto') && byId('editTxFoto').files[0];
      var nota = byId('editTxNota') && byId('editTxNota').files[0];
      var canvas = byId('editTxTtdCanvas');
      var uploads = [];

      if (foto) {
        uploads.push(upload(foto, 'foto', 'Bukti transaksi').then(function (path) {
          fields['Upload Foto'] = path;
        }));
      }
      if (nota) {
        uploads.push(upload(nota, 'nota', 'Nota pembelian').then(function (path) {
          fields['Nota Pembelian'] = path;
        }));
      }
      if (canvas && typeof window.isCanvasBlank === 'function' && !window.isCanvasBlank('editTxTtdCanvas')) {
        var blob = canvas.toDataURL('image/png');
        var base64 = String(blob).split(',')[1] || '';
        uploads.push(api('uploadTxFile', [base64, 'image/png', 'TTD_USER_' + Date.now() + '.png', 'ttdUser'])
          .then(function (result) {
            if (!result || !result.success || !result.fileName) throw new Error('TTD user gagal diunggah.');
            fields['TTD User'] = result.fileName;
          }));
      }

      await Promise.all(uploads);
      var result = await api('editTransaction', [id, fields]);
      if (!result || result.success !== true) {
        throw new Error((result && result.message) || 'Perubahan transaksi gagal disimpan.');
      }

      window.showToast('success', 'Berhasil', result.message || 'Perubahan transaksi berhasil disimpan.');
      window.closeModal('modalEditTransaksi');
      if (typeof window.loadTransactions === 'function') window.loadTransactions();
      if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
      if (typeof window.updateChart === 'function') window.updateChart();
    } catch (error) {
      var message = error && error.message ? error.message : 'Perubahan transaksi gagal disimpan.';
      window.showToast('error', 'Gagal Menyimpan', message);
    } finally {
      if (typeof window.showLoading === 'function') window.showLoading(false);
      setButtonLoading(button, false);
    }
  };
})();
