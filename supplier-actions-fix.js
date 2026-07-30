(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function list() {
    return Array.isArray(window.filteredSuppliers) && window.filteredSuppliers.length
      ? window.filteredSuppliers
      : (Array.isArray(window.allSuppliers) ? window.allSuppliers : []);
  }
  function resolveSupplier(ref) {
    var rows = list();
    var key = String(ref == null ? '' : ref);
    return rows.find(function (row) {
      return String(row.ID || row.id || '') === key || String(row._row == null ? '' : row._row) === key;
    }) || rows[Number(ref)] || null;
  }
  function value(row, keys, fallback) {
    for (var i = 0; i < keys.length; i += 1) {
      if (row && row[keys[i]] != null && row[keys[i]] !== '') return row[keys[i]];
    }
    return fallback == null ? '' : fallback;
  }
  function itemsText(row) {
    var items = value(row, ['ITEM YANG DIJUAL', 'items'], []);
    return Array.isArray(items) ? items.join(', ') : String(items || '');
  }
  function info(label, content) {
    if (typeof window.infoRow === 'function') return window.infoRow(label, content);
    return '<div class="info-row"><span>' + esc(label) + '</span><strong>' + content + '</strong></div>';
  }

  window.openDetailSupplier = function (ref) {
    var row = resolveSupplier(ref);
    if (!row) {
      if (typeof window.showToast === 'function') window.showToast('error', 'Data tidak ditemukan', 'Data supplier tidak tersedia pada halaman ini.');
      return;
    }
    if (typeof window.resetDetailModalFooter === 'function') window.resetDetailModalFooter();
    var status = value(row, ['STATUS', 'Status'], '-');
    var html = '<div class="detail-section-title"><i class="fas fa-store" style="margin-right:6px"></i>Data Supplier</div>' +
      '<div class="info-card">' +
      info('Nama Supplier', '<strong>' + esc(value(row, ['NAMA SUPPLIER', 'Nama Supplier'], '-')) + '</strong>') +
      info('No. WhatsApp', esc(value(row, ['NO WHATSAPP', 'No WhatsApp'], '-'))) +
      info('Email', esc(value(row, ['EMAIL', 'Email'], '-'))) +
      info('Alamat Toko', esc(value(row, ['ALAMAT TOKO', 'Alamat'], '-'))) +
      info('Status', '<span class="badge badge-outline">' + esc(status) + '</span>') +
      '</div><div class="detail-section-title" style="margin-top:14px"><i class="fas fa-university" style="margin-right:6px"></i>Rekening & Dokumen</div>' +
      '<div class="info-card">' +
      info('Nama Bank', esc(value(row, ['NAMA BANK'], '-'))) +
      info('No. Rekening', esc(value(row, ['NO REKENING'], '-'))) +
      info('Atas Nama', esc(value(row, ['ATAS NAMA REKENING'], '-'))) +
      info('Item yang Dijual', esc(itemsText(row) || '-')) +
      info('SPPG', esc(value(row, ['SPPG'], '-'))) +
      info('Yayasan', esc(value(row, ['YAYASAN'], '-'))) +
      '</div>';
    var body = $('detailBody');
    var modal = $('modalDetail');
    if (!body || !modal) return;
    body.innerHTML = html;
    var title = modal.querySelector('.modal-header h3');
    var subtitle = modal.querySelector('.modal-header p');
    if (title) title.innerHTML = '<i class="fas fa-store" style="color:var(--primary);margin-right:8px"></i>Detail Supplier';
    if (subtitle) subtitle.textContent = 'Informasi lengkap data supplier';
    if (typeof window.openModal === 'function') window.openModal('modalDetail');
  };

  window.openEditSupplierModal = function (ref) {
    var row = resolveSupplier(ref);
    if (!row) {
      if (typeof window.showToast === 'function') window.showToast('error', 'Data tidak ditemukan', 'Data supplier tidak tersedia pada halaman ini.');
      return;
    }
    var supplierId = value(row, ['ID', 'id'], '');
    var rowRef = value(row, ['_row'], ref);
    if ($('editSupRow')) {
      $('editSupRow').value = supplierId || rowRef;
      $('editSupRow').dataset.supplierId = supplierId;
    }
    if ($('editSupNama')) $('editSupNama').value = value(row, ['NAMA SUPPLIER', 'Nama Supplier'], '');
    if ($('editSupWAEdit')) $('editSupWAEdit').value = value(row, ['NO WHATSAPP', 'No WhatsApp'], '');
    if ($('editSupEmailEdit')) $('editSupEmailEdit').value = value(row, ['EMAIL', 'Email'], '');
    if ($('editSupStatusEdit')) $('editSupStatusEdit').value = value(row, ['STATUS', 'Status'], 'Aktif');
    if ($('editSupAlamatEdit')) $('editSupAlamatEdit').value = value(row, ['ALAMAT TOKO', 'Alamat'], '');
    if ($('editSupBank')) $('editSupBank').value = value(row, ['NAMA BANK'], '');
    if ($('editSupNoRek')) $('editSupNoRek').value = value(row, ['NO REKENING'], '');
    if ($('editSupAtasNama')) $('editSupAtasNama').value = value(row, ['ATAS NAMA REKENING'], '');
    if ($('editSupItems')) $('editSupItems').value = itemsText(row);
    if (typeof window.openModal === 'function') window.openModal('modalEditSupplier');
  };

  window.saveEditSupplier = function () {
    var key = $('editSupRow') ? $('editSupRow').value : '';
    var row = resolveSupplier(key);
    var id = ($('editSupRow') && $('editSupRow').dataset.supplierId) || value(row, ['ID', 'id'], key);
    if (!id) {
      if (typeof window.showToast === 'function') window.showToast('error', 'Gagal', 'ID supplier tidak ditemukan.');
      return;
    }
    var patch = {
      'NAMA SUPPLIER': $('editSupNama') ? $('editSupNama').value.trim() : '',
      'NO WHATSAPP': $('editSupWAEdit') ? $('editSupWAEdit').value.trim() : '',
      'EMAIL': $('editSupEmailEdit') ? $('editSupEmailEdit').value.trim() : '',
      'STATUS': $('editSupStatusEdit') ? $('editSupStatusEdit').value : 'Aktif',
      'ALAMAT TOKO': $('editSupAlamatEdit') ? $('editSupAlamatEdit').value.trim() : '',
      'NAMA BANK': $('editSupBank') ? $('editSupBank').value.trim() : '',
      'NO REKENING': $('editSupNoRek') ? $('editSupNoRek').value.trim() : '',
      'ATAS NAMA REKENING': $('editSupAtasNama') ? $('editSupAtasNama').value.trim() : '',
      'ITEM YANG DIJUAL': $('editSupItems') ? $('editSupItems').value.split(/[\n,;]/).map(function (item) { return item.trim(); }).filter(Boolean) : []
    };
    if (!patch['NAMA SUPPLIER'] || !patch['ALAMAT TOKO']) {
      if (typeof window.showToast === 'function') window.showToast('error', 'Validasi', 'Nama supplier dan alamat wajib diisi.');
      return;
    }
    if (typeof window.showLoading === 'function') window.showLoading(true);
    window.callApi('updateMasterSupplier', [id, patch], function (result) {
      if (typeof window.showLoading === 'function') window.showLoading(false);
      if (result && result.success) {
        if (typeof window.showToast === 'function') window.showToast('success', 'Berhasil', result.message || 'Supplier berhasil diperbarui.');
        if (typeof window.closeModal === 'function') window.closeModal('modalEditSupplier');
        if (typeof window.loadSuppliers === 'function') window.loadSuppliers(false, window.supplierPage || 1, false);
        if (typeof window.loadDropdownOptions === 'function') window.loadDropdownOptions();
      } else if (typeof window.showToast === 'function') {
        window.showToast('error', 'Gagal', (result && result.message) || 'Supplier gagal diperbarui.');
      }
    }, function (error) {
      if (typeof window.showLoading === 'function') window.showLoading(false);
      if (typeof window.showToast === 'function') window.showToast('error', 'Gagal', error && error.message ? error.message : 'Terjadi kesalahan.');
    });
  };
})();