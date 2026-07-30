(() => {
  'use strict';

  const CATEGORY_GROUPS = {
    PEMASUKAN: ['Anggaran Bahan Baku', 'Anggaran Sewa Mobil', 'Anggaran Insentif Fasilitas'],
    SUPPLIER_REQUIRED: ['Belanja Bahan Baku', 'Material Bangunan', 'Gas LPG', 'Sewa & Utilitas (AC/WIFI)', 'IPAL', 'Inventaris Kantor', 'Cetak & Promosi'],
    SUPPLIER_OPTIONAL: ['Gaji/Upah Karyawan', 'Operasional Perjalanan', 'Konsumsi', 'Dana Talangan', 'Cicilan', 'Fee Yayasan', 'Administrasi & Lainnya']
  };
  const ALL_TYPES = [...CATEGORY_GROUPS.PEMASUKAN, ...CATEGORY_GROUPS.SUPPLIER_REQUIRED, ...CATEGORY_GROUPS.SUPPLIER_OPTIONAL];
  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  const supplierRequired = (value) => CATEGORY_GROUPS.SUPPLIER_REQUIRED.some((item) => normalize(item) === normalize(value));
  const allowedType = (value) => ALL_TYPES.some((item) => normalize(item) === normalize(value));

  function toast(message, type = 'warning') {
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    if (typeof window.showNotification === 'function') return window.showNotification(message, type);
    alert(message);
  }

  function fieldByLabel(root, pattern) {
    const label = [...root.querySelectorAll('label')].find((node) => pattern.test(node.textContent || ''));
    if (!label) return null;
    return (label.htmlFor && document.getElementById(label.htmlFor))
      || label.querySelector('input,select,textarea')
      || label.parentElement?.querySelector('input,select,textarea')
      || null;
  }

  function findType(root = document) {
    return root.querySelector('[name="jenisKategori"], [name="jenis_kategori"], #jenisKategori, #jenis-kategori, input[data-field="jenisKategori"]')
      || fieldByLabel(root, /jenis\s*kategori/i);
  }
  function findCategory(root = document) {
    return root.querySelector('[name="kategori"], #kategori, select[data-field="kategori"]')
      || fieldByLabel(root, /^\s*kategori\s*$/i);
  }
  function findSupplier(root = document) {
    return root.querySelector('[name="supplierName"], [name="namaSupplier"], [name="supplier"], #supplierName, #namaSupplier, #supplier, input[data-field="supplier"]')
      || fieldByLabel(root, /(supplier|penjual)/i);
  }
  function findSupplierId(root = document) {
    return root.querySelector('[name="supplierId"], [name="supplier_id"], #supplierId, #supplier-id, input[data-field="supplierId"]');
  }
  function transactionRoot(typeInput) {
    return typeInput?.closest('form, .modal-box, .modal-content, .modal-dialog, [role="dialog"], #modalTransaksi, #transactionModal')
      || document;
  }

  function ensureCategoryDatalist(input) {
    if (!input || input.dataset.strictCategoryReady === '1') return;
    input.dataset.strictCategoryReady = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('placeholder', 'Klik atau ketik untuk memilih jenis kategori');
    const list = document.createElement('datalist');
    list.id = `strict-category-options-${Math.random().toString(36).slice(2)}`;
    const addGroup = (label, values) => {
      values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.label = label;
        list.appendChild(option);
      });
    };
    addGroup('PEMASUKAN', CATEGORY_GROUPS.PEMASUKAN);
    addGroup('PENGELUARAN — Wajib Isi Supplier', CATEGORY_GROUPS.SUPPLIER_REQUIRED);
    addGroup('PENGELUARAN — Tanpa Supplier', CATEGORY_GROUPS.SUPPLIER_OPTIONAL);
    document.body.appendChild(list);
    input.setAttribute('list', list.id);
    const show = () => { if (typeof input.showPicker === 'function') try { input.showPicker(); } catch (_) {} };
    input.addEventListener('click', show);
    input.addEventListener('focus', show);
    input.addEventListener('input', () => syncSupplierRequirement(input));
    input.addEventListener('change', () => validateType(input, false));
    input.addEventListener('blur', () => validateType(input, false));
  }

  function validateType(input, announce = true) {
    if (!input) return true;
    const value = String(input.value || '').trim();
    if (!value || !allowedType(value)) {
      input.setCustomValidity('Jenis kategori wajib dipilih dari daftar yang tersedia.');
      input.setAttribute('aria-invalid', 'true');
      if (announce) toast('Jenis kategori tidak valid. Pilih salah satu data dari dropdown.', 'error');
      return false;
    }
    input.value = ALL_TYPES.find((item) => normalize(item) === normalize(value)) || value;
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    syncMainCategory(input);
    syncSupplierRequirement(input);
    return true;
  }

  function syncMainCategory(typeInput) {
    const root = transactionRoot(typeInput);
    const category = findCategory(root);
    if (!category) return;
    category.value = CATEGORY_GROUPS.PEMASUKAN.some((item) => normalize(item) === normalize(typeInput.value)) ? 'PEMASUKAN' : 'PENGELUARAN';
    category.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function supplierOptions(input) {
    if (!input) return [];
    if (input.tagName === 'SELECT') return [...input.options]
      .filter((option) => !option.dataset.inlineCreateSupplier)
      .map((option) => ({ id: option.value, name: option.dataset.name || option.textContent || '', label: option.textContent || '' }))
      .filter((item) => item.id);
    if (input.list) return [...input.list.options]
      .filter((option) => !option.dataset.inlineCreateSupplier)
      .map((option) => ({ id: option.dataset.id || option.dataset.supplierId || option.value, name: option.value, label: option.label || option.value }))
      .filter((item) => item.name);
    return [];
  }

  function syncSupplierRequirement(typeInput) {
    const root = transactionRoot(typeInput);
    const supplier = findSupplier(root);
    const supplierId = findSupplierId(root);
    if (!supplier) return;
    const required = supplierRequired(typeInput.value);
    supplier.required = required;
    supplier.toggleAttribute('aria-required', required);
    supplier.dataset.supplierRequired = required ? '1' : '0';
    if (!required) {
      supplier.setCustomValidity?.('');
      supplier.removeAttribute('aria-invalid');
      return;
    }
    validateSupplier(typeInput, supplier, supplierId, false);
  }

  function validateSupplier(typeInput, supplier, supplierId, announce = true) {
    if (!supplierRequired(typeInput?.value)) return true;
    const name = String(supplier?.tagName === 'SELECT' ? supplier.selectedOptions?.[0]?.textContent : supplier?.value || '').trim();
    const id = String(supplierId?.value || (supplier?.tagName === 'SELECT' ? supplier.value : '') || '').trim();
    const options = supplierOptions(supplier);
    const match = options.find((item) => normalize(item.name) === normalize(name) || normalize(item.label) === normalize(name) || String(item.id) === id);
    const valid = Boolean(name && id && (options.length === 0 || match));
    if (!valid) {
      supplier?.setCustomValidity?.('Supplier wajib dipilih dari Data Supplier.');
      supplier?.setAttribute('aria-invalid', 'true');
      if (announce) toast('Supplier wajib dipilih dari Data Supplier. Gunakan Tambah Supplier Baru bila belum tersedia.', 'error');
      return false;
    }
    supplier?.setCustomValidity?.('');
    supplier?.removeAttribute('aria-invalid');
    return true;
  }

  function enhance() {
    const typeInput = findType(document);
    if (!typeInput) return;
    ensureCategoryDatalist(typeInput);
    syncSupplierRequirement(typeInput);
    const root = transactionRoot(typeInput);
    const form = root.matches?.('form') ? root : root.querySelector?.('form');
    const submitRoot = form || root;
    if (submitRoot && submitRoot.dataset.strictTransactionRules !== '1') {
      submitRoot.dataset.strictTransactionRules = '1';
      submitRoot.addEventListener('submit', (event) => {
        const supplier = findSupplier(root);
        const supplierId = findSupplierId(root);
        const validType = validateType(typeInput, true);
        const validSupplier = validateSupplier(typeInput, supplier, supplierId, true);
        if (!validType || !validSupplier) {
          event.preventDefault();
          event.stopImmediatePropagation();
          (validType ? supplier : typeInput)?.focus();
        }
      }, true);
    }
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', enhance);
  enhance();
  window.SIM_SPPG_TRANSACTION_CATEGORY_RULES = Object.freeze({ categories: CATEGORY_GROUPS, allTypes: ALL_TYPES, supplierRequired });
})();
