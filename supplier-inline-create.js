(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');

  function notify(type, title, message) {
    if (typeof window.showToast === 'function') {
      try { return window.showToast(type, title, message); } catch (_) {
        try { return window.showToast(message, type); } catch (_) {}
      }
    }
    alert(message || title);
  }

  function byLabel(root, pattern) {
    const labels = [...root.querySelectorAll('label')];
    const label = labels.find((node) => pattern.test(node.textContent || ''));
    if (!label) return null;
    return (label.htmlFor && document.getElementById(label.htmlFor))
      || label.querySelector('input,select,textarea')
      || label.parentElement?.querySelector('input,select,textarea')
      || null;
  }

  function transactionForm() {
    const category = document.querySelector('[name="jenisKategori"], #jenisKategori, [name="jenis_kategori"]')
      || byLabel(document, /jenis\s*kategori/i);
    return category?.closest('form') || null;
  }

  function supplierFields(form) {
    if (!form) return {};
    return {
      name: form.querySelector('[name="supplierName"], [name="namaSupplier"], #supplierName, #namaSupplier, input[data-field="supplier"]')
        || byLabel(form, /nama\s*(supplier|penjual)/i),
      id: form.querySelector('[name="supplierId"], [name="supplier_id"], #supplierId, #supplier-id, input[data-field="supplierId"]')
    };
  }

  function hideManualBankFields(form) {
    if (!form) return;
    [...form.querySelectorAll('label')].forEach((label) => {
      if (!/(nama\s*bank|no\.?\s*rekening|nomor\s*rekening|atas\s*nama\s*rekening)\s*(supplier|penjual)?/i.test(label.textContent || '')) return;
      const group = label.closest('.form-group, .input-group, .field, .mb-3') || label.parentElement;
      if (group) group.style.display = 'none';
      const field = (label.htmlFor && document.getElementById(label.htmlFor)) || group?.querySelector('input,select,textarea');
      if (field) {
        field.required = false;
        field.value = '';
      }
    });
  }

  function modalHtml(defaultName) {
    return `
      <div id="inlineSupplierModal" style="position:fixed;inset:0;z-index:180000;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:14px">
        <div style="width:min(720px,100%);max-height:calc(100dvh - 28px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.25)">
          <div style="position:sticky;top:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;z-index:2">
            <div><h3 style="margin:0;color:#1e293b;font-size:18px">Tambah Supplier Baru</h3><p style="margin:5px 0 0;color:#64748b;font-size:12px">Data disimpan ke menu Data Supplier dan langsung dipilih pada transaksi.</p></div>
            <button type="button" id="inlineSupplierClose" aria-label="Tutup" style="border:0;background:#f1f5f9;width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:20px">×</button>
          </div>
          <form id="inlineSupplierForm" style="padding:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Nama Supplier/Penjual *<input id="inlineSupplierName" required value="${String(defaultName || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="font-size:12px;font-weight:600;color:#334155">No. WhatsApp *<input id="inlineSupplierWhatsapp" required inputmode="tel" placeholder="08xxxxxxxxxx" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="font-size:12px;font-weight:600;color:#334155">Email<input id="inlineSupplierEmail" type="email" placeholder="supplier@email.com" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Alamat Toko/Usaha *<textarea id="inlineSupplierAddress" required rows="2" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></textarea></label>
            <label style="font-size:12px;font-weight:600;color:#334155">Nama Bank *<input id="inlineSupplierBank" required style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="font-size:12px;font-weight:600;color:#334155">No. Rekening *<input id="inlineSupplierAccount" required inputmode="numeric" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Atas Nama Rekening *<input id="inlineSupplierHolder" required style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Item yang Dijual *<textarea id="inlineSupplierItems" required rows="2" placeholder="Pisahkan dengan koma" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></textarea></label>
            <div style="grid-column:1/-1;padding:10px 12px;background:#eff6ff;border-radius:10px;color:#1e40af;font-size:12px">Foto supplier, TTD, dan file MOU dapat dilengkapi atau diperbarui kemudian melalui menu Data Supplier.</div>
            <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px;padding-top:4px">
              <button type="button" id="inlineSupplierCancel" style="padding:10px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;cursor:pointer">Batal</button>
              <button type="submit" id="inlineSupplierSave" style="padding:10px 16px;border:0;background:#1e6f9c;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Simpan Supplier</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function closeModal() {
    $('inlineSupplierModal')?.remove();
  }

  function selectCreatedSupplier(nameInput, idInput, id, name) {
    if (nameInput) {
      const listId = nameInput.getAttribute('list');
      const list = listId && document.getElementById(listId);
      if (list && ![...list.options].some((option) => String(option.dataset.id || option.dataset.supplierId) === String(id))) {
        const option = document.createElement('option');
        option.value = name;
        option.dataset.id = id;
        option.dataset.supplierId = id;
        list.appendChild(option);
      }
      nameInput.value = name;
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      nameInput.setCustomValidity('');
    }
    if (idInput) {
      idInput.value = id;
      idInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function openCreateSupplier(nameInput, idInput) {
    closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml(nameInput?.value));
    $('inlineSupplierClose').onclick = closeModal;
    $('inlineSupplierCancel').onclick = closeModal;
    $('inlineSupplierModal').addEventListener('click', (event) => { if (event.target === $('inlineSupplierModal')) closeModal(); });
    $('inlineSupplierForm').addEventListener('submit', (event) => {
      event.preventDefault();
      if (typeof window.callApi !== 'function') return notify('error', 'Gagal', 'Koneksi API supplier tidak tersedia.');
      const whatsapp = $('inlineSupplierWhatsapp').value.trim();
      if (!/^(?:\+62|62|0)8\d{7,12}$/.test(whatsapp.replace(/[\s-]/g, ''))) {
        $('inlineSupplierWhatsapp').focus();
        return notify('error', 'Validasi', 'Nomor WhatsApp belum valid.');
      }
      const payload = {
        NAMA_SUPPLIER: $('inlineSupplierName').value.trim(),
        NO_WHATSAPP: whatsapp,
        EMAIL: $('inlineSupplierEmail').value.trim(),
        ALAMAT_TOKO: $('inlineSupplierAddress').value.trim(),
        NAMA_BANK: $('inlineSupplierBank').value.trim(),
        NO_REKENING: $('inlineSupplierAccount').value.trim(),
        ATAS_NAMA_REKENING: $('inlineSupplierHolder').value.trim(),
        ITEM_YANG_DIJUAL: $('inlineSupplierItems').value.trim(),
        STATUS: 'Aktif'
      };
      const save = $('inlineSupplierSave');
      save.disabled = true;
      save.textContent = 'Menyimpan…';
      window.callApi('addSupplier', [payload], (result) => {
        const data = result?.result || result || {};
        if (!data.success || !data.id) {
          save.disabled = false;
          save.textContent = 'Simpan Supplier';
          return notify('error', 'Gagal', data.message || 'Supplier gagal disimpan.');
        }
        selectCreatedSupplier(nameInput, idInput, data.id, payload.NAMA_SUPPLIER);
        closeModal();
        notify('success', 'Supplier Ditambahkan', 'Supplier baru tersimpan dan sudah dipilih pada transaksi.');
        if (typeof window.loadSupplierData === 'function') window.loadSupplierData();
      }, (error) => {
        save.disabled = false;
        save.textContent = 'Simpan Supplier';
        notify('error', 'Gagal', error?.message || 'Supplier gagal disimpan.');
      });
    });
    setTimeout(() => $('inlineSupplierName')?.focus(), 50);
  }

  function enhance() {
    const form = transactionForm();
    if (!form) return;
    hideManualBankFields(form);
    const { name, id } = supplierFields(form);
    if (!name || name.dataset.inlineSupplierReady === '1') return;
    name.dataset.inlineSupplierReady = '1';
    name.setAttribute('placeholder', 'Ketik atau pilih nama supplier');
    const wrapper = name.closest('.form-group, .input-group, .field, .mb-3') || name.parentElement;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.inlineCreateSupplier = '1';
    button.textContent = '+ Tambah Supplier Baru';
    button.style.cssText = 'margin-top:7px;border:0;background:none;color:#1e6f9c;font-weight:700;padding:0;cursor:pointer;font-size:12px';
    button.addEventListener('click', () => openCreateSupplier(name, id));
    wrapper?.appendChild(button);
    name.addEventListener('input', () => {
      const options = name.list ? [...name.list.options] : [];
      const match = options.find((option) => norm(option.value) === norm(name.value));
      if (id) id.value = match ? String(match.dataset.id || match.dataset.supplierId || '') : '';
    });
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', enhance);
  enhance();
})();
