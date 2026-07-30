(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function injectStyles() {
    if ($('appUnifiedDropdownStyles')) return;
    var style = document.createElement('style');
    style.id = 'appUnifiedDropdownStyles';
    style.textContent = [
      '.app-combobox,.app-select{position:relative;width:100%}',
      '.app-combobox-input{padding-right:46px}',
      '.app-combobox-toggle{position:absolute;top:1px;right:1px;bottom:1px;width:44px;border:0;border-left:1px solid var(--slate-200);border-radius:0 9px 9px 0;background:var(--slate-50);color:var(--slate-600);cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.app-combobox-toggle:hover{background:var(--primary-light);color:var(--primary)}',
      '.app-combobox-menu,.app-select-menu{position:absolute;z-index:12050;left:0;right:0;top:calc(100% + 6px);max-height:300px;overflow-y:auto;overscroll-behavior:contain;padding:6px;border:1px solid var(--slate-200);border-radius:12px;background:var(--white);box-shadow:var(--shadow-xl)}',
      '.app-combobox-option,.app-select-option{width:100%;border:0;border-radius:9px;padding:10px 12px;background:transparent;color:var(--slate-700);cursor:pointer;display:flex;align-items:center;gap:10px;text-align:left;font-size:13px;line-height:1.35}',
      '.app-combobox-option:hover,.app-combobox-option.is-active,.app-select-option:hover,.app-select-option.is-active{background:var(--primary-light);color:var(--primary-dark)}',
      '.app-combobox-option.is-create{color:var(--primary);font-weight:700;border-bottom:1px solid var(--slate-100);margin-bottom:4px}',
      '.app-combobox-option-main{min-width:0;flex:1}',
      '.app-combobox-option-title{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.app-combobox-option-meta{display:block;margin-top:2px;color:var(--slate-500);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.app-combobox-empty,.app-select-empty{padding:14px 12px;color:var(--slate-500);text-align:center}',
      '.app-native-select{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}',
      '.app-select-button{width:100%;min-height:44px;padding:10px 44px 10px 14px;border:1px solid var(--slate-200);border-radius:10px;background:var(--white);color:var(--slate-700);font:inherit;text-align:left;cursor:pointer;position:relative;display:flex;align-items:center;gap:8px}',
      '.app-select-button:hover{border-color:var(--slate-300)}',
      '.app-select-button:focus,.app-select.is-open .app-select-button{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(30,111,156,.14)}',
      '.app-select-button[disabled]{opacity:.6;cursor:not-allowed;background:var(--slate-50)}',
      '.app-select-value{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
      '.app-select-chevron{position:absolute;right:14px;top:50%;transform:translateY(-50%);transition:transform .18s ease;color:var(--slate-500)}',
      '.app-select.is-open .app-select-chevron{transform:translateY(-50%) rotate(180deg)}',
      '.app-select-search-wrap{position:sticky;top:-6px;z-index:2;background:var(--white);padding:6px 4px 8px}',
      '.app-select-search{width:100%;min-height:40px;border:1px solid var(--slate-200);border-radius:9px;padding:8px 10px 8px 34px;background:var(--slate-50);color:var(--slate-700);font:inherit}',
      '.app-select-search-wrap i{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--slate-400)}',
      '.app-select-option.is-selected{background:var(--primary-light);color:var(--primary-dark);font-weight:700}',
      '.app-select-option:disabled,.app-select-option.is-disabled{opacity:.45;cursor:not-allowed}',
      '.app-select-check{margin-left:auto;color:var(--primary)}',
      '.app-select-group{padding:8px 10px 4px;color:var(--slate-500);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}',
      '.app-select-menu.drop-up{top:auto;bottom:calc(100% + 6px)}',
      '@media(max-width:640px){.app-combobox-menu,.app-select-menu{max-height:min(48vh,340px)}.app-combobox-option,.app-select-option{min-height:46px}.app-select-button{min-height:48px}}'
    ].join('');
    document.head.appendChild(style);
  }

  /* Supplier searchable dropdown */
  var supplierStates = { add: -1, edit: -1 };
  function modePrefix(mode) { return mode === 'edit' ? 'editTx' : 'addTx'; }
  function getSupplierInput(mode) { return $(modePrefix(mode) + 'Supplier'); }
  function getSupplierWrapper(mode) { return $(modePrefix(mode) + 'SupplierCombobox'); }
  function getSupplierMenu(mode) { return $(modePrefix(mode) + 'SupplierDropdown'); }
  function supplierChoices(mode) {
    if (typeof window.transactionSupplierChoices === 'function') return window.transactionSupplierChoices(mode) || [];
    var all = (window.dropdownOptions && window.dropdownOptions.suppliers) || [];
    var sppg = $(modePrefix(mode) + 'SPPG');
    var target = sppg ? String(sppg.value || '').trim().toLowerCase() : '';
    return target ? all.filter(function (s) { return String(s.sppg || '').trim().toLowerCase() === target; }) : all;
  }
  function filteredSuppliers(mode) {
    var input = getSupplierInput(mode);
    var query = input ? String(input.value || '').trim().toLowerCase() : '';
    return supplierChoices(mode).filter(function (s) {
      return !query || [s.nama, s.sppg].concat(s.items || []).join(' ').toLowerCase().indexOf(query) !== -1;
    });
  }
  function closeSupplier(mode) {
    var input = getSupplierInput(mode), menu = getSupplierMenu(mode);
    if (!menu) return;
    menu.classList.add('hidden');
    if (input) input.setAttribute('aria-expanded', 'false');
    supplierStates[mode] = -1;
  }
  function selectSupplier(mode, id) {
    if (id === '__CREATE__') {
      closeSupplier(mode);
      if (typeof window.openAddSupplierModal === 'function') window.openAddSupplierModal();
      else if (typeof window.openModal === 'function') window.openModal('modalAddSupplier');
      return;
    }
    var supplier = supplierChoices(mode).find(function (s) { return String(s.id || '') === String(id || ''); });
    var input = getSupplierInput(mode);
    if (!supplier || !input) return;
    input.value = supplier.nama || '';
    if (typeof window.handleTransactionSupplierInput === 'function') window.handleTransactionSupplierInput(mode);
    closeSupplier(mode);
  }
  function renderSupplier(mode) {
    var menu = getSupplierMenu(mode);
    if (!menu) return;
    var list = filteredSuppliers(mode);
    supplierStates[mode] = -1;
    var html = '<button type="button" class="app-combobox-option is-create" role="option" data-create="1"><i class="fas fa-plus-circle"></i><span class="app-combobox-option-main"><span class="app-combobox-option-title">Tambah Supplier Baru</span><span class="app-combobox-option-meta">Buka form supplier di dalam aplikasi</span></span></button>';
    html += list.length ? list.map(function (s, index) {
      var meta = [s.sppg || '', (s.items || []).join(', ')].filter(Boolean).join(' • ');
      return '<button type="button" class="app-combobox-option" role="option" data-index="' + index + '" data-id="' + esc(s.id || '') + '"><i class="fas fa-store"></i><span class="app-combobox-option-main"><span class="app-combobox-option-title">' + esc(s.nama || '-') + '</span>' + (meta ? '<span class="app-combobox-option-meta">' + esc(meta) + '</span>' : '') + '</span></button>';
    }).join('') : '<div class="app-combobox-empty"><i class="fas fa-search"></i> Supplier tidak ditemukan.</div>';
    menu.innerHTML = html;
    var create = menu.querySelector('[data-create="1"]');
    if (create) create.onclick = function () { selectSupplier(mode, '__CREATE__'); };
    Array.prototype.forEach.call(menu.querySelectorAll('[data-id]'), function (button) {
      button.onclick = function () { selectSupplier(mode, button.getAttribute('data-id')); };
    });
  }
  function openSupplier(mode) {
    var input = getSupplierInput(mode), menu = getSupplierMenu(mode);
    if (!input || !menu) return;
    renderSupplier(mode); menu.classList.remove('hidden'); input.setAttribute('aria-expanded', 'true');
  }
  function supplierKeydown(event, mode) {
    var menu = getSupplierMenu(mode);
    if (!menu) return;
    if (event.key === 'Escape') { closeSupplier(mode); return; }
    if (event.key === 'ArrowDown' && menu.classList.contains('hidden')) openSupplier(mode);
    var options = Array.prototype.slice.call(menu.querySelectorAll('.app-combobox-option'));
    if (!options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      var next = supplierStates[mode] + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) next = options.length - 1;
      if (next >= options.length) next = 0;
      supplierStates[mode] = next;
      options.forEach(function (option, index) { option.classList.toggle('is-active', index === next); });
      options[next].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && supplierStates[mode] >= 0) {
      event.preventDefault(); options[supplierStates[mode]].click();
    }
  }
  function buildSupplier(mode) {
    var input = getSupplierInput(mode);
    if (!input || getSupplierWrapper(mode)) return;
    input.removeAttribute('list'); input.autocomplete = 'off'; input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.classList.add('app-combobox-input');
    var wrapper = document.createElement('div'); wrapper.className = 'app-combobox'; wrapper.id = modePrefix(mode) + 'SupplierCombobox';
    input.parentNode.insertBefore(wrapper, input); wrapper.appendChild(input);
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'app-combobox-toggle'; toggle.setAttribute('aria-label', 'Buka pilihan supplier'); toggle.innerHTML = '<i class="fas fa-chevron-down"></i>'; wrapper.appendChild(toggle);
    var menu = document.createElement('div'); menu.id = modePrefix(mode) + 'SupplierDropdown'; menu.className = 'app-combobox-menu hidden'; menu.setAttribute('role', 'listbox'); wrapper.appendChild(menu); input.setAttribute('aria-controls', menu.id);
    input.addEventListener('focus', function () { openSupplier(mode); });
    input.addEventListener('input', function () { renderSupplier(mode); openSupplier(mode); });
    input.addEventListener('keydown', function (event) { supplierKeydown(event, mode); });
    toggle.addEventListener('click', function () { if (menu.classList.contains('hidden')) { openSupplier(mode); input.focus(); } else closeSupplier(mode); });
  }

  /* Universal in-app select dropdown */
  var selectUid = 0;
  var openInstance = null;
  function shouldEnhance(select) {
    if (!select || select.tagName !== 'SELECT' || select.multiple || Number(select.size || 0) > 1) return false;
    if (select.dataset.nativeSelect === 'true' || select.dataset.appSelect === 'ready') return false;
    return select.classList.contains('form-input') || select.classList.contains('filter-input') || select.classList.contains('filter-select') || !!select.closest('.form-group,.filter-group,.modal-body,.toolbar,.filters,.settings-panel');
  }
  function optionRecords(select) {
    var records = [];
    Array.prototype.forEach.call(select.children, function (node) {
      if (node.tagName === 'OPTGROUP') {
        records.push({ group: true, label: node.label || '' });
        Array.prototype.forEach.call(node.children, function (option) { records.push({ option: option }); });
      } else if (node.tagName === 'OPTION') records.push({ option: node });
    });
    return records;
  }
  function selectedLabel(select) {
    var option = select.options[select.selectedIndex];
    return option ? option.textContent.trim() : (select.getAttribute('placeholder') || 'Pilih opsi');
  }
  function syncInstance(instance) {
    instance.button.disabled = instance.select.disabled;
    instance.value.textContent = selectedLabel(instance.select);
    instance.value.classList.toggle('is-placeholder', !instance.select.value);
  }
  function closeSelect(instance) {
    if (!instance) return;
    instance.wrapper.classList.remove('is-open'); instance.menu.classList.add('hidden'); instance.button.setAttribute('aria-expanded', 'false');
    instance.activeIndex = -1;
    if (openInstance === instance) openInstance = null;
  }
  function placeMenu(instance) {
    instance.menu.classList.remove('drop-up');
    var rect = instance.button.getBoundingClientRect();
    if (window.innerHeight - rect.bottom < 260 && rect.top > 260) instance.menu.classList.add('drop-up');
  }
  function renderSelect(instance, query) {
    syncInstance(instance);
    var q = String(query || '').trim().toLowerCase();
    var html = '', visible = 0;
    optionRecords(instance.select).forEach(function (record) {
      if (record.group) { html += '<div class="app-select-group">' + esc(record.label) + '</div>'; return; }
      var option = record.option;
      var label = option.textContent.trim();
      if (q && label.toLowerCase().indexOf(q) === -1) return;
      visible++;
      html += '<button type="button" class="app-select-option' + (option.selected ? ' is-selected' : '') + (option.disabled ? ' is-disabled' : '') + '" role="option" data-value="' + esc(option.value) + '"' + (option.disabled ? ' disabled' : '') + '><span>' + esc(label) + '</span>' + (option.selected ? '<i class="fas fa-check app-select-check"></i>' : '') + '</button>';
    });
    if (!visible) html += '<div class="app-select-empty"><i class="fas fa-search"></i> Pilihan tidak ditemukan</div>';
    var searchable = instance.select.options.length > 7;
    instance.menu.innerHTML = (searchable ? '<div class="app-select-search-wrap"><i class="fas fa-search"></i><input type="search" class="app-select-search" placeholder="Cari pilihan..." autocomplete="off"></div>' : '') + html;
    Array.prototype.forEach.call(instance.menu.querySelectorAll('.app-select-option'), function (button) {
      button.addEventListener('click', function () {
        instance.select.value = button.getAttribute('data-value');
        instance.select.dispatchEvent(new Event('input', { bubbles: true }));
        instance.select.dispatchEvent(new Event('change', { bubbles: true }));
        syncInstance(instance); closeSelect(instance); instance.button.focus();
      });
    });
    var search = instance.menu.querySelector('.app-select-search');
    if (search) search.addEventListener('input', function () { renderSelect(instance, search.value); var next = instance.menu.querySelector('.app-select-search'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); } });
  }
  function openSelect(instance) {
    if (instance.select.disabled) return;
    if (openInstance && openInstance !== instance) closeSelect(openInstance);
    renderSelect(instance, ''); placeMenu(instance);
    instance.wrapper.classList.add('is-open'); instance.menu.classList.remove('hidden'); instance.button.setAttribute('aria-expanded', 'true'); openInstance = instance;
    var search = instance.menu.querySelector('.app-select-search'); if (search) setTimeout(function () { search.focus(); }, 0);
  }
  function selectKeydown(event, instance) {
    if (event.key === 'Escape') { closeSelect(instance); instance.button.focus(); return; }
    if ((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') && !instance.wrapper.classList.contains('is-open')) { event.preventDefault(); openSelect(instance); return; }
    var options = Array.prototype.slice.call(instance.menu.querySelectorAll('.app-select-option:not(:disabled)'));
    if (!options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      instance.activeIndex += event.key === 'ArrowDown' ? 1 : -1;
      if (instance.activeIndex < 0) instance.activeIndex = options.length - 1;
      if (instance.activeIndex >= options.length) instance.activeIndex = 0;
      options.forEach(function (item, index) { item.classList.toggle('is-active', index === instance.activeIndex); });
      options[instance.activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && instance.activeIndex >= 0) { event.preventDefault(); options[instance.activeIndex].click(); }
  }
  function enhanceSelect(select) {
    if (!shouldEnhance(select)) return;
    select.dataset.appSelect = 'ready'; select.classList.add('app-native-select');
    var wrapper = document.createElement('div'); wrapper.className = 'app-select'; wrapper.dataset.forSelect = select.id || ('appSelect' + (++selectUid));
    select.parentNode.insertBefore(wrapper, select); wrapper.appendChild(select);
    var button = document.createElement('button'); button.type = 'button'; button.className = 'app-select-button'; button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
    var value = document.createElement('span'); value.className = 'app-select-value'; button.appendChild(value);
    var chevron = document.createElement('i'); chevron.className = 'fas fa-chevron-down app-select-chevron'; button.appendChild(chevron); wrapper.appendChild(button);
    var menu = document.createElement('div'); menu.className = 'app-select-menu hidden'; menu.setAttribute('role', 'listbox'); wrapper.appendChild(menu);
    var instance = { select: select, wrapper: wrapper, button: button, value: value, menu: menu, activeIndex: -1 };
    select.__appSelectInstance = instance; syncInstance(instance);
    button.addEventListener('click', function () { if (wrapper.classList.contains('is-open')) closeSelect(instance); else openSelect(instance); });
    button.addEventListener('keydown', function (event) { selectKeydown(event, instance); });
    menu.addEventListener('keydown', function (event) { selectKeydown(event, instance); });
    select.addEventListener('change', function () { syncInstance(instance); if (wrapper.classList.contains('is-open')) renderSelect(instance, ''); });
    new MutationObserver(function () { syncInstance(instance); if (wrapper.classList.contains('is-open')) renderSelect(instance, ''); }).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label', 'value'] });
  }
  function enhanceAll(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.tagName === 'SELECT') enhanceSelect(root);
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll('select') : [], enhanceSelect);
  }

  function init() {
    injectStyles();
    var datalist = $('txSupplierDatalist'); if (datalist) datalist.remove();
    buildSupplier('add'); buildSupplier('edit'); enhanceAll(document);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) { Array.prototype.forEach.call(mutation.addedNodes, function (node) { if (node.nodeType === 1) { buildSupplier('add'); buildSupplier('edit'); enhanceAll(node); } }); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', function (event) {
    ['add', 'edit'].forEach(function (mode) { var wrapper = getSupplierWrapper(mode); if (wrapper && !wrapper.contains(event.target)) closeSupplier(mode); });
    if (openInstance && !openInstance.wrapper.contains(event.target)) closeSelect(openInstance);
  });
  window.addEventListener('resize', function () { if (openInstance) placeMenu(openInstance); });
  window.addEventListener('scroll', function () { if (openInstance) placeMenu(openInstance); }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.refreshTransactionSupplierDropdown = function (mode) { if (mode) renderSupplier(mode); else { renderSupplier('add'); renderSupplier('edit'); } };
  window.refreshAppDropdowns = function () { enhanceAll(document); Array.prototype.forEach.call(document.querySelectorAll('select[data-app-select="ready"]'), function (select) { if (select.__appSelectInstance) syncInstance(select.__appSelectInstance); }); };
})();