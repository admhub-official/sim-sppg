(() => {
  'use strict';

  const CATEGORY_GROUPS = {
    PEMASUKAN: [
      'Anggaran Bahan Baku',
      'Anggaran Sewa Mobil',
      'Anggaran Insentif Fasilitas'
    ],
    SUPPLIER_REQUIRED: [
      'Belanja Bahan Baku',
      'Material Bangunan',
      'Gas LPG',
      'Sewa & Utilitas (AC/WIFI)',
      'IPAL',
      'Inventaris Kantor',
      'Cetak & Promosi'
    ],
    SUPPLIER_OPTIONAL: [
      'Gaji/Upah Karyawan',
      'Operasional Perjalanan',
      'Konsumsi',
      'Dana Talangan',
      'Cicilan',
      'Fee Yayasan',
      'Administrasi & Lainnya'
    ]
  };

  const ALL_TYPES = [
    ...CATEGORY_GROUPS.PEMASUKAN,
    ...CATEGORY_GROUPS.SUPPLIER_REQUIRED,
    ...CATEGORY_GROUPS.SUPPLIER_OPTIONAL
  ];

  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  const supplierRequired = value => CATEGORY_GROUPS.SUPPLIER_REQUIRED.some(item => normalize(item) === normalize(value));
  const allowedType = value => ALL_TYPES.some(item => normalize(item) === normalize(value));

  function toast(message, type = 'warning') {
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    if (typeof window.showNotification === 'function') return window.showNotification(message, type);
    alert(message);
  }

  function findFieldByLabel(pattern) {
    const labels = [...document.querySelectorAll('label')];
    const label = labels.find(node => pattern.test(node.textContent || ''));
    if (!label) return null;
    if (label.htmlFor) return document.getElementById(label.htmlFor);
    return label.querySelector('input,select,textarea') || label.parentElement?.querySelector('input,select,textarea') || null;
  }

  function findCategoryTypeField(root = document) {
    return root.querySelector('[name="jenisKategori"], [name="jenis_kategori"], #jenisKategori, #jenis-kategori, input[data-field="jenisKategori"]')
      || findFieldByLabel(/jenis\s*kategori/i);
  }

  function findMainCategoryField(root = document) {
    return root.querySelector('[name="kategori"], #kategori, select[data-field="kategori"]')
      || findFieldByLabel(/^\s*kategori\s*$/i);
  }

  function findSupplierField(root = document) {
    return root.querySelector('[name="supplierName"], [name="namaSupplier"], #supplierName, #namaSupplier, input[data-field="supplier"]')
      || findFieldByLabel(/nama\s*(supplier|penjual)/i);
  }

  function findSupplierIdField(root = document) {
    return root.querySelector('[name="supplierId"], [name="supplier_id"], #supplierId, #supplier-id, input[data-field="supplierId"]');
  }

  function ensureCategoryDatalist(input) {
    if (!input || input.dataset.strictCategoryReady === '1') return;
    input.dataset.strictCategoryReady = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('placeholder', 'Klik atau ketik untuk memilih jenis kategori');

    const id = `strict-category-options-${Math.random().toString(36).slice(2)}`;
    const list = document.createElement('datalist');
    list.id = id;

    const addGroup = (label, values) => {
      const marker = document.createElement('option');
      marker.value = '';
      marker.label = label;
      marker.disabled = true;
      list.appendChild(marker);
      values.forEach(value => {
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
    input.setAttribute('list', id);

    const show = () => {
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch (_) {}
      }
    };
    input.addEventListener('click', show);
    input.addEventListener('focus', show);
    input.addEventListener('input', () => syncSupplierRequirement(input));
    input.addEventListener('change', () => validateCategoryType(input, false));
    input.addEventListener('blur', () => validateCategoryType(input, false));
  }

  function validateCategoryType(input, announce = true) {
    if (!input) return true;
    const value = String(input.value || '').trim();
    if (!value || !allowedType(value)) {
      input.setCustomValidity('Jenis kategori wajib dipilih dari daftar yang tersedia.');
      input.setAttribute('aria-invalid', 'true');
      if (announce) toast('Jenis kategori tidak valid. Pilih salah satu data dari dropdown.', 'error');
      return false;
    }
    const canonical = ALL_TYPES.find(item => normalize(item) === normalize(value));
    if (canonical) input.value = canonical;
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    syncMainCategory(input);
    syncSupplierRequirement(input);
    return true;
  }

  function syncMainCategory(typeInput) {
    const category = findMainCategoryField(typeInput.closest('form') || document);
    if (!category) return;
    const type = String(typeInput.value || '').trim();
    const value = CATEGORY_GROUPS.PEMASUKAN.some(item => normalize(item) === normalize(type)) ? 'PEMASUKAN' : 'PENGELUARAN';
    category.value = value;
    category.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function supplierOptions(input) {
    if (!input) return [];
    const listId = input.getAttribute('list');
    const list = listId ? document.getElementById(listId) : null;
    if (list) return [...list.querySelectorAll('option')].map(option => ({
      id: option.dataset.id || option.dataset.supplierId || option.value,
      name: option.value,
      label: option.label || option.textContent || option.value
    })).filter(item => item.name);

    const select = input.tagName === 'SELECT' ? input : null;
    if (select) return [...select.options].map(option => ({
      id: option.value,
      name: option.dataset.name || option.textContent || '',
      label: option.textContent || ''
    })).filter(item => item.id);
    return [];
  }

  function ensureCreateSupplierHint(input) {
    const wrapper = input?.closest('.form-group, .input-group, .field, .mb-3') || input?.parentElement;
    if (!wrapper || wrapper.querySelector('[data-create-supplier-hint]')) return;
    const hint = document.createElement('div');
    hint.dataset.createSupplierHint = '1';
    hint.style.cssText = 'margin-top:6px;font-size:12px;color:#64748b;';
    hint.innerHTML = 'Supplier tidak tersedia? <button type="button" data-open-supplier-menu style="border:0;background:none;color:#1e6f9c;font-weight:600;padding:0;cursor:pointer">Buat data supplier baru</button> terlebih dahulu.';
    hint.querySelector('button').addEventListener('click', () => {
      const target = document.querySelector('[data-page="supplier"], [data-menu="supplier"], a[href*="supplier"], button[onclick*="supplier" i]');
      if (target) target.click();
      else toast('Buka menu Data Supplier dan lengkapi seluruh form supplier baru.', 'info');
    });
    wrapper.appendChild(hint);
  }

  function syncSupplierRequirement(typeInput) {
    const form = typeInput?.closest('form') || document;
    const supplier = findSupplierField(form);
    const supplierId = findSupplierIdField(form);
    if (!supplier) return;
    const required = supplierRequired(typeInput.value);
    supplier.required = required;
    supplier.toggleAttribute('aria-required', required);
    supplier.dataset.supplierRequired = required ? '1' : '0';
    ensureCreateSupplierHint(supplier);
    if (!required) {
      supplier.setCustomValidity('');
      supplier.removeAttribute('aria-invalid');
      return;
    }
    validateSupplierSelection(typeInput, supplier, supplierId, false);
  }

  function validateSupplierSelection(typeInput, supplier, supplierId, announce = true) {
    if (!supplierRequired(typeInput?.value)) return true;
    const name = String(supplier?.value || '').trim();
    const id = String(supplierId?.value || (supplier?.tagName === 'SELECT' ? supplier.value : '') || '').trim();
    const options = supplierOptions(supplier);
    const match = options.find(item => normalize(item.name) === normalize(name) || normalize(item.label) === normalize(name) || String(item.id) === id);
    const valid = Boolean(name && id && (options.length === 0 || match));
    if (!valid) {
      supplier?.setCustomValidity('Supplier wajib dipilih dari Data Supplier.');
      supplier?.setAttribute('aria-invalid', 'true');
      if (announce) toast('Supplier wajib dipilih dari Data Supplier. Jika belum ada, buat data supplier baru terlebih dahulu.', 'error');
      return false;
    }
    supplier?.setCustomValidity('');
    supplier?.removeAttribute('aria-invalid');
    return true;
  }

  function enhance(root = document) {
    const typeInput = findCategoryTypeField(root);
    if (!typeInput) return;
    ensureCategoryDatalist(typeInput);
    syncSupplierRequirement(typeInput);

    const form = typeInput.closest('form');
    if (form && form.dataset.strictTransactionRules !== '1') {
      form.dataset.strictTransactionRules = '1';
      form.addEventListener('submit', event => {
        const supplier = findSupplierField(form);
        const supplierId = findSupplierIdField(form);
        const validType = validateCategoryType(typeInput, true);
        const validSupplier = validateSupplierSelection(typeInput, supplier, supplierId, true);
        if (!validType || !validSupplier) {
          event.preventDefault();
          event.stopImmediatePropagation();
          (validType ? supplier : typeInput)?.focus();
        }
      }, true);
    }
  }

  const observer = new MutationObserver(() => enhance(document));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => enhance(document));
  enhance(document);

  window.SIM_SPPG_TRANSACTION_CATEGORY_RULES = Object.freeze({
    categories: CATEGORY_GROUPS,
    allTypes: ALL_TYPES,
    supplierRequired
  });
})();
