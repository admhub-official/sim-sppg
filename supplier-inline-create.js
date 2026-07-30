(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  const CREATE_VALUE = '__CREATE_NEW_SUPPLIER__';

  function notify(type, title, message) {
    if (typeof window.showToast === 'function') {
      try { return window.showToast(type, title, message); } catch (_) {
        try { return window.showToast(message, type); } catch (_) {}
      }
    }
    alert(message || title);
  }

  function byLabel(root, pattern) {
    const label = [...root.querySelectorAll('label')].find((node) => pattern.test(node.textContent || ''));
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
        || byLabel(form, /(supplier|penjual)/i),
      id: form.querySelector('[name="supplierId"], [name="supplier_id"], #supplierId, #supplier-id, input[data-field="supplierId"]')
    };
  }

  function fieldGroup(field) {
    if (!field) return null;
    return field.closest('.form-group, .input-group, .field, .mb-3, .form-field, [class*="form-group"]')
      || field.parentElement;
  }

  function hideManualBankFields(form) {
    if (!form) return;
    const patterns = [
      /nama\s*bank\s*(supplier|penjual)?/i,
      /(no\.?|nomor)\s*rekening\s*(supplier|penjual)?/i,
      /atas\s*nama\s*rekening/i
    ];
    [...form.querySelectorAll('label')].forEach((label) => {
      if (!patterns.some((pattern) => pattern.test(label.textContent || ''))) return;
      const field = (label.htmlFor && document.getElementById(label.htmlFor))
        || label.querySelector('input,select,textarea')
        || label.parentElement?.querySelector('input,select,textarea');
      const group = fieldGroup(field) || label.parentElement;
      if (group) {
        group.hidden = true;
        group.style.setProperty('display', 'none', 'important');
      }
      if (field) {
        field.required = false;
        field.disabled = true;
        field.value = '';
      }
    });

    [...form.querySelectorAll('small, p, .form-text, .helper-text, [class*="hint"]')].forEach((node) => {
      if (/penjual\s*manual|isi\s*rekening|pembayaran\s*melalui\s*transfer/i.test(node.textContent || '')) {
        node.hidden = true;
        node.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function modalHtml(defaultName) {
    const safeName = String(defaultName || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `
      <div id="inlineSupplierModal" style="position:fixed;inset:0;z-index:180000;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:14px">
        <div style="width:min(720px,100%);max-height:calc(100dvh - 28px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.25)">
          <div style="position:sticky;top:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;z-index:2">
            <div><h3 style="margin:0;color:#1e293b;font-size:18px">Tambah Supplier Baru</h3><p style="margin:5px 0 0;color:#64748b;font-size:12px">Data disimpan ke Data Supplier dan langsung dipilih pada transaksi.</p></div>
            <button type="button" id="inlineSupplierClose" aria-label="Tutup" style="border:0;background:#f1f5f9;width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:20px">×</button>
          </div>
          <form id="inlineSupplierForm" style="padding:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Nama Supplier/Penjual *<input id="inlineSupplierName" required value="${safeName}" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="font-size:12px;font-weight:600;color:#334155">No. WhatsApp *<input id="inlineSupplierWhatsapp" required inputmode="tel" placeholder="08xxxxxxxxxx" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="font-size:12px;font-weight:600;color:#334155">Email<input id="inlineSupplierEmail" type="email" placeholder="supplier@email.com" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Alamat Toko/Usaha *<textarea id="inlineSupplierAddress" required rows="2" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></textarea></label>
            <label style="font-size:12px;font-weight:600;color:#334155">Nama Bank *<input id="inlineSupplierBank" required style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="font-size:12px;font-weight:600;color:#334155">No. Rekening *<input id="inlineSupplierAccount" required inputmode="numeric" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Atas Nama Rekening *<input id="inlineSupplierHolder" required style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></label>
            <label style="grid-column:1/-1;font-size:12px;font-weight:600;color:#334155">Item yang Dijual *<textarea id="inlineSupplierItems" required rows="2" placeholder="Pisahkan dengan koma" style="display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></textarea></label>
            <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px;padding-top:4px">
              <button type="button" id="inlineSupplierCancel" style="padding:10px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;cursor:pointer">Batal</button>
              <button type="submit" id="inlineSupplierSave" style="padding:10px 16px;border:0;background:#1e6f9c;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Simpan Supplier</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function closeModal() { $('inlineSupplierModal')?.remove(); }

  function selectCreatedSupplier(nameInput, idInput, id, name) {
    if (nameInput) {
      const list = nameInput.list;
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
        if (typeof window.loadSupplierData === 'function') window.loadSupplierData();
        notify('success', 'Supplier Ditambahkan', 'Supplier baru tersimpan dan sudah dipilih pada transaksi.');
      }, (error) => {
        save.disabled = false;
        save.textContent = 'Simpan Supplier';
        notify('error', 'Gagal', error?.message || 'Supplier gagal disimpan.');
      });
    });
    setTimeout(() => $('inlineSupplierName')?.focus(), 50);
  }

  function injectDatalistCreateOption(nameInput) {
    const list = nameInput?.list;
    if (!list || list.querySelector(`option[value="${CREATE_VALUE}"]`)) return;
    const option = document.createElement('option');
    option.value = CREATE_VALUE;
    option.label = '+ Tambah Supplier Baru';
    option.dataset.inlineCreateSupplier = '1';
    list.prepend(option);
  }

  function isVisible(node) {
    if (!(node instanceof HTMLElement)) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  }

  function injectCustomDropdownCreateItem(nameInput, idInput) {
    const inputRect = nameInput.getBoundingClientRect();
    const candidates = [...document.querySelectorAll('[role="listbox"], .dropdown-menu, .suggestions, .autocomplete-list, [class*="suggestion"], [class*="dropdown"]')]
      .filter(isVisible)
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 120 && rect.top >= inputRect.top - 20 && Math.abs(rect.left - inputRect.left) < 420;
      });
    candidates.forEach((menu) => {
      if (menu.querySelector('[data-inline-create-supplier="1"]')) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.inlineCreateSupplier = '1';
      item.innerHTML = '<span style="font-size:16px;line-height:1">＋</span><span>Tambah Supplier Baru</span>';
      item.style.cssText = 'width:100%;display:flex;align-items:center;gap:8px;padding:11px 14px;border:0;border-bottom:1px solid #e2e8f0;background:#eff6ff;color:#1e6f9c;font-weight:700;text-align:left;cursor:pointer;position:sticky;top:0;z-index:4';
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.style.display = 'none';
        openCreateSupplier(nameInput, idInput);
      });
      menu.prepend(item);
    });
  }

  function enhance() {
    const form = transactionForm();
    if (!form) return;
    hideManualBankFields(form);
    const { name, id } = supplierFields(form);
    if (!name) return;

    injectDatalistCreateOption(name);
    if (name.dataset.inlineSupplierReady !== '1') {
      name.dataset.inlineSupplierReady = '1';
      name.setAttribute('placeholder', 'Ketik atau pilih nama supplier');
      name.addEventListener('input', () => {
        if (name.value === CREATE_VALUE) {
          name.value = '';
          if (id) id.value = '';
          openCreateSupplier(name, id);
          return;
        }
        const options = name.list ? [...name.list.options] : [];
        const match = options.find((option) => !option.dataset.inlineCreateSupplier && norm(option.value) === norm(name.value));
        if (id) id.value = match ? String(match.dataset.id || match.dataset.supplierId || '') : '';
      });
      ['focus', 'click', 'input', 'keydown'].forEach((eventName) => {
        name.addEventListener(eventName, () => setTimeout(() => injectCustomDropdownCreateItem(name, id), 0));
      });
    }
    injectCustomDropdownCreateItem(name, id);
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', enhance);
  enhance();
})();
