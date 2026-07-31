(function () {
  'use strict';

  var openPanel = null;
  var uid = 0;
  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function fireChange(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function closeOpenPanel() {
    if (!openPanel) return;
    openPanel.classList.add('hidden');
    var owner = openPanel.__owner;
    if (owner) owner.setAttribute('aria-expanded', 'false');
    openPanel = null;
  }
  function openMenu(menu, owner) {
    closeOpenPanel();
    menu.__owner = owner;
    menu.classList.remove('hidden');
    owner.setAttribute('aria-expanded', 'true');
    var rect = owner.getBoundingClientRect();
    menu.classList.toggle('drop-up', window.innerHeight - rect.bottom < 260 && rect.top > 260);
    openPanel = menu;
  }

  function injectStyles() {
    if ($('appUnifiedDropdownStyles')) return;
    var style = document.createElement('style');
    style.id = 'appUnifiedDropdownStyles';
    style.textContent = [
      '.app-native-control{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}',
      '.app-select,.app-autocomplete,.app-supplier-combobox{position:relative;width:100%}',
      '.app-select-button,.app-autocomplete-input{width:100%;min-height:44px;border:1px solid var(--slate-200);border-radius:10px;background:var(--white);color:var(--slate-700);font:inherit;text-align:left}',
      '.app-select-button{padding:10px 44px 10px 14px;cursor:pointer;position:relative;display:flex;align-items:center}',
      '.app-select-button:focus,.app-select.is-open .app-select-button,.app-autocomplete-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(30,111,156,.14)}',
      '.app-select-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
      '.app-select-chevron,.app-autocomplete-toggle{position:absolute;right:1px;top:1px;bottom:1px;width:44px;border:0;border-left:1px solid var(--slate-200);border-radius:0 9px 9px 0;background:var(--slate-50);color:var(--slate-600);display:flex;align-items:center;justify-content:center;cursor:pointer}',
      '.app-select-chevron{right:14px;top:50%;bottom:auto;width:auto;border:0;background:transparent;transform:translateY(-50%)}',
      '.app-dropdown-menu{position:absolute;z-index:13000;left:0;right:0;top:calc(100% + 6px);max-height:310px;overflow-y:auto;overscroll-behavior:contain;padding:6px;border:1px solid var(--slate-200);border-radius:12px;background:var(--white);box-shadow:var(--shadow-xl)}',
      '.app-dropdown-menu.drop-up{top:auto;bottom:calc(100% + 6px)}',
      '.app-dropdown-option{width:100%;border:0;border-radius:9px;padding:11px 12px;background:transparent;color:var(--slate-700);cursor:pointer;display:flex;align-items:center;gap:10px;text-align:left;font:inherit;line-height:1.35}',
      '.app-dropdown-option:hover,.app-dropdown-option.is-active,.app-dropdown-option.is-selected{background:var(--primary-light);color:var(--primary-dark)}',
      '.app-dropdown-option.is-selected{font-weight:700}',
      '.app-dropdown-check{margin-left:auto;color:var(--primary)}',
      '.app-dropdown-search{position:sticky;top:-6px;z-index:2;background:var(--white);padding:5px 3px 8px}',
      '.app-dropdown-search input{width:100%;min-height:40px;border:1px solid var(--slate-200);border-radius:9px;padding:8px 10px;background:var(--slate-50);font:inherit}',
      '.app-dropdown-empty{padding:14px 12px;text-align:center;color:var(--slate-500)}',
      '.app-create-supplier{color:var(--primary);font-weight:700;border-bottom:1px solid var(--slate-100);margin-bottom:4px}',
      '.app-option-main{min-width:0;flex:1}.app-option-title{display:block;font-weight:600}.app-option-meta{display:block;margin-top:2px;color:var(--slate-500);font-size:11px}',
      '.app-autocomplete-input{padding:10px 46px 10px 14px}',
      '.category-segmented{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}',
      '.category-segmented button{min-height:48px;border:1px solid var(--slate-200);border-radius:10px;background:var(--white);font:inherit;font-weight:800;cursor:pointer;transition:.18s ease}',
      '.category-segmented button[data-value="PENGELUARAN"]{color:#be123c}.category-segmented button[data-value="PEMASUKAN"]{color:#047857}',
      '.category-segmented button[data-value="PENGELUARAN"].is-selected{background:#fff1f2;border-color:#f43f5e;box-shadow:0 0 0 3px rgba(244,63,94,.12)}',
      '.category-segmented button[data-value="PEMASUKAN"].is-selected{background:#ecfdf5;border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.12)}',
      '@media(max-width:640px){.app-dropdown-menu{max-height:min(46vh,340px)}.app-dropdown-option{min-height:46px}.app-select-button,.app-autocomplete-input{min-height:48px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function enhanceCategory(select) {
    if (!select || select.dataset.categorySegmented === 'ready') return;
    select.dataset.categorySegmented = 'ready';
    select.dataset.appSelect = 'skip';
    select.classList.add('app-native-control');
    var box = document.createElement('div');
    box.className = 'category-segmented';
    box.setAttribute('role', 'radiogroup');
    ['PENGELUARAN', 'PEMASUKAN'].forEach(function (value) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = value;
      button.textContent = value;
      button.onclick = function () {
        select.value = value;
        fireChange(select);
        sync();
      };
      box.appendChild(button);
    });
    select.parentNode.insertBefore(box, select.nextSibling);
    function sync() {
      Array.prototype.forEach.call(box.children, function (button) {
        var selected = button.dataset.value === select.value;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
      });
    }
    select.addEventListener('change', sync);
    sync();
  }

  function shouldEnhanceSelect(select) {
    if (!select || select.tagName !== 'SELECT' || select.multiple || Number(select.size || 0) > 1) return false;
    if (select.dataset.nativeSelect === 'true' || select.dataset.appSelect === 'ready' || select.dataset.appSelect === 'skip') return false;
    return select.classList.contains('form-input') || select.classList.contains('filter-input') || select.classList.contains('filter-select') || !!select.closest('.form-group,.filter-group,.modal-body,.toolbar,.filters,.settings-panel');
  }

  function enhanceSelect(select) {
    if (!shouldEnhanceSelect(select)) return;
    select.dataset.appSelect = 'ready';
    select.classList.add('app-native-control');
    var wrapper = document.createElement('div');
    wrapper.className = 'app-select';
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'app-select-button'; button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span class="app-select-value"></span><span class="app-select-chevron"><i class="fas fa-chevron-down"></i></span>';
    var menu = document.createElement('div'); menu.className = 'app-dropdown-menu hidden';
    select.parentNode.insertBefore(wrapper, select.nextSibling); wrapper.appendChild(button); wrapper.appendChild(menu);
    function sync() {
      var option = select.options[select.selectedIndex];
      button.querySelector('.app-select-value').textContent = option ? option.textContent.trim() : 'Pilih opsi';
      button.disabled = select.disabled;
    }
    function render(query) {
      var q = String(query || '').trim().toLowerCase();
      var opts = Array.prototype.slice.call(select.options).filter(function (option) { return !q || option.textContent.toLowerCase().indexOf(q) !== -1; });
      var searchable = select.options.length > 7;
      menu.innerHTML = (searchable ? '<div class="app-dropdown-search"><input type="search" placeholder="Cari pilihan..." autocomplete="off"></div>' : '') +
        (opts.length ? opts.map(function (option) {
          return '<button type="button" class="app-dropdown-option' + (option.selected ? ' is-selected' : '') + '" data-value="' + esc(option.value) + '"' + (option.disabled ? ' disabled' : '') + '><span class="app-option-main">' + esc(option.textContent.trim()) + '</span>' + (option.selected ? '<i class="fas fa-check app-dropdown-check"></i>' : '') + '</button>';
        }).join('') : '<div class="app-dropdown-empty">Pilihan tidak ditemukan</div>');
      Array.prototype.forEach.call(menu.querySelectorAll('[data-value]'), function (item) {
        item.onclick = function () { select.value = item.dataset.value; fireChange(select); sync(); closeOpenPanel(); };
      });
      var search = menu.querySelector('input');
      if (search) { search.oninput = function () { render(search.value); var next = menu.querySelector('input'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); } }; }
    }
    button.onclick = function () {
      if (!menu.classList.contains('hidden')) { closeOpenPanel(); return; }
      render(''); openMenu(menu, button); var search = menu.querySelector('input'); if (search) setTimeout(function () { search.focus(); }, 0);
    };
    select.addEventListener('change', sync);
    new MutationObserver(function () { sync(); }).observe(select, { childList: true, subtree: true, attributes: true });
    sync();
  }

  function datalistValues(input) {
    var list = input.list || $(input.getAttribute('list'));
    if (!list) return [];
    return Array.prototype.slice.call(list.options).map(function (option) { return { value: option.value, label: option.label || option.textContent || option.value }; });
  }
  function enhanceDatalist(input) {
    if (!input || !input.getAttribute('list') || input.dataset.appAutocomplete === 'ready') return;
    if (/Supplier$/i.test(input.id)) return;
    var listId = input.getAttribute('list');
    var list = $(listId);
    if (!list) return;
    input.dataset.appAutocomplete = 'ready';
    input.removeAttribute('list');
    input.autocomplete = 'off';
    input.classList.add('app-autocomplete-input');
    var wrapper = document.createElement('div'); wrapper.className = 'app-autocomplete';
    input.parentNode.insertBefore(wrapper, input); wrapper.appendChild(input);
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'app-autocomplete-toggle'; toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
    var menu = document.createElement('div'); menu.className = 'app-dropdown-menu hidden';
    wrapper.appendChild(toggle); wrapper.appendChild(menu);
    function render() {
      var q = String(input.value || '').trim().toLowerCase();
      var values = datalistValuesFromNode(list).filter(function (item) { return !q || (item.value + ' ' + item.label).toLowerCase().indexOf(q) !== -1; });
      menu.innerHTML = values.length ? values.map(function (item) { return '<button type="button" class="app-dropdown-option" data-value="' + esc(item.value) + '"><span class="app-option-main">' + esc(item.value) + '</span></button>'; }).join('') : '<div class="app-dropdown-empty">Pilihan tidak ditemukan</div>';
      Array.prototype.forEach.call(menu.querySelectorAll('[data-value]'), function (item) { item.onclick = function () { input.value = item.dataset.value; fireChange(input); closeOpenPanel(); }; });
    }
    function open() { render(); openMenu(menu, input); }
    input.onfocus = open;
    input.addEventListener('input', open);
    toggle.onclick = function () { if (menu.classList.contains('hidden')) { open(); input.focus(); } else closeOpenPanel(); };
  }
  function datalistValuesFromNode(list) {
    return Array.prototype.slice.call(list.options || []).map(function (option) { return { value: option.value, label: option.label || option.textContent || option.value }; });
  }

  function supplierChoices(mode) {
    if (typeof window.transactionSupplierChoices === 'function') return window.transactionSupplierChoices(mode) || [];
    var all = (window.dropdownOptions && window.dropdownOptions.suppliers) || [];
    var sppg = $(mode === 'edit' ? 'editTxSPPG' : 'addTxSPPG');
    var target = sppg ? String(sppg.value || '').trim().toLowerCase() : '';
    return target ? all.filter(function (s) { return String(s.sppg || '').trim().toLowerCase() === target; }) : all;
  }
  function openOfficialSupplierForm() {
    if (typeof window.openAddSupplierModal === 'function') { window.openAddSupplierModal(); return; }
    if ($('modalAddSupplier') && typeof window.openModal === 'function') { window.openModal('modalAddSupplier'); return; }
    if (typeof window.showPage === 'function') window.showPage('supplier');
  }
  function enhanceSupplier(mode) {
    var input = $(mode === 'edit' ? 'editTxSupplier' : 'addTxSupplier');
    if (!input || input.dataset.appSupplier === 'ready') return;
    input.dataset.appSupplier = 'ready'; input.removeAttribute('list'); input.autocomplete = 'off'; input.classList.add('app-autocomplete-input');
    var wrapper = document.createElement('div'); wrapper.className = 'app-supplier-combobox';
    input.parentNode.insertBefore(wrapper, input); wrapper.appendChild(input);
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'app-autocomplete-toggle'; toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
    var menu = document.createElement('div'); menu.className = 'app-dropdown-menu hidden'; wrapper.appendChild(toggle); wrapper.appendChild(menu);
    function render() {
      var q = String(input.value || '').trim().toLowerCase();
      var list = supplierChoices(mode).filter(function (s) { return !q || [s.nama, s.sppg].concat(s.items || []).join(' ').toLowerCase().indexOf(q) !== -1; });
      menu.innerHTML = '<button type="button" class="app-dropdown-option app-create-supplier" data-create="1"><i class="fas fa-plus-circle"></i><span class="app-option-main"><span class="app-option-title">Tambah Supplier Baru</span><span class="app-option-meta">Gunakan form supplier resmi termasuk upload MOU</span></span></button>' +
        (list.length ? list.map(function (s) { return '<button type="button" class="app-dropdown-option" data-id="' + esc(s.id || '') + '"><i class="fas fa-store"></i><span class="app-option-main"><span class="app-option-title">' + esc(s.nama || '-') + '</span><span class="app-option-meta">' + esc(s.sppg || '') + '</span></span></button>'; }).join('') : '<div class="app-dropdown-empty">Supplier tidak ditemukan</div>');
      menu.querySelector('[data-create]').onclick = function () { closeOpenPanel(); openOfficialSupplierForm(); };
      Array.prototype.forEach.call(menu.querySelectorAll('[data-id]'), function (item) { item.onclick = function () { var s = supplierChoices(mode).find(function (row) { return String(row.id || '') === item.dataset.id; }); if (!s) return; input.value = s.nama || ''; if (typeof window.handleTransactionSupplierInput === 'function') window.handleTransactionSupplierInput(mode); closeOpenPanel(); }; });
    }
    function open() { render(); openMenu(menu, input); }
    input.addEventListener('focus', open); input.addEventListener('input', open);
    toggle.onclick = function () { if (menu.classList.contains('hidden')) { open(); input.focus(); } else closeOpenPanel(); };
  }

  function cleanupLegacy() {
    ['txSupplierDatalist'].forEach(function (id) { var node = $(id); if (node) node.remove(); });
    Array.prototype.forEach.call(document.querySelectorAll('.app-combobox,.app-supplier-combobox,.app-select'), function (node) {
      if (node.dataset.currentUi === '1') return;
      if (node.querySelector('#addTxSupplier,#editTxSupplier')) {
        var input = node.querySelector('input'); if (input && node.parentNode) node.parentNode.insertBefore(input, node);
        node.remove();
      }
    });
  }
  function scan(root) {
    root = root || document;
    enhanceCategory($('addTxKategori'));
    enhanceCategory($('editTxKategori'));
    enhanceSupplier('add'); enhanceSupplier('edit');
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll('select') : [], enhanceSelect);
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll('input[list]') : [], enhanceDatalist);
  }
  function init() {
    injectStyles(); cleanupLegacy(); scan(document);
    new MutationObserver(function (mutations) { mutations.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (node) { if (node.nodeType === 1) scan(node); }); }); }).observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('click', function (event) { if (openPanel && !openPanel.contains(event.target) && event.target !== openPanel.__owner && !event.target.closest('.app-autocomplete-toggle,.app-select-button')) closeOpenPanel(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeOpenPanel(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();