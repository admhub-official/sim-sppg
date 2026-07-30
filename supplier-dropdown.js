(function () {
  'use strict';

  var states = { add: -1, edit: -1 };

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function modePrefix(mode) { return mode === 'edit' ? 'editTx' : 'addTx'; }
  function getInput(mode) { return $(modePrefix(mode) + 'Supplier'); }
  function getWrapper(mode) { return $(modePrefix(mode) + 'SupplierCombobox'); }
  function getMenu(mode) { return $(modePrefix(mode) + 'SupplierDropdown'); }

  function choices(mode) {
    if (typeof window.transactionSupplierChoices === 'function') {
      return window.transactionSupplierChoices(mode) || [];
    }
    var all = (window.dropdownOptions && window.dropdownOptions.suppliers) || [];
    var sppg = $(modePrefix(mode) + 'SPPG');
    var target = sppg ? String(sppg.value || '').trim().toLowerCase() : '';
    return target ? all.filter(function (s) {
      return String(s.sppg || '').trim().toLowerCase() === target;
    }) : all;
  }

  function filtered(mode) {
    var input = getInput(mode);
    var query = input ? String(input.value || '').trim().toLowerCase() : '';
    return choices(mode).filter(function (s) {
      var haystack = [s.nama, s.sppg].concat(s.items || []).join(' ').toLowerCase();
      return !query || haystack.indexOf(query) !== -1;
    });
  }

  function close(mode) {
    var input = getInput(mode);
    var menu = getMenu(mode);
    if (!menu) return;
    menu.classList.add('hidden');
    if (input) input.setAttribute('aria-expanded', 'false');
    states[mode] = -1;
  }

  function select(mode, supplierId) {
    if (supplierId === '__CREATE__') {
      close(mode);
      if (typeof window.openAddSupplierModal === 'function') window.openAddSupplierModal();
      else if (typeof window.openModal === 'function') window.openModal('modalAddSupplier');
      return;
    }
    var supplier = choices(mode).find(function (s) {
      return String(s.id || '') === String(supplierId || '');
    });
    var input = getInput(mode);
    if (!supplier || !input) return;
    input.value = supplier.nama || '';
    if (typeof window.handleTransactionSupplierInput === 'function') {
      window.handleTransactionSupplierInput(mode);
    }
    close(mode);
  }

  function render(mode) {
    var menu = getMenu(mode);
    if (!menu) return;
    var list = filtered(mode);
    states[mode] = -1;
    var html = '<button type="button" class="app-combobox-option is-create" role="option" data-create="1">' +
      '<i class="fas fa-plus-circle"></i><span class="app-combobox-option-main">' +
      '<span class="app-combobox-option-title">Tambah Supplier Baru</span>' +
      '<span class="app-combobox-option-meta">Buka form supplier di dalam aplikasi</span></span></button>';
    if (list.length) {
      html += list.map(function (s, index) {
        var meta = [s.sppg || '', (s.items || []).join(', ')].filter(Boolean).join(' • ');
        return '<button type="button" class="app-combobox-option" role="option" data-index="' + index + '" data-id="' + esc(s.id || '') + '">' +
          '<i class="fas fa-store"></i><span class="app-combobox-option-main">' +
          '<span class="app-combobox-option-title">' + esc(s.nama || '-') + '</span>' +
          (meta ? '<span class="app-combobox-option-meta">' + esc(meta) + '</span>' : '') +
          '</span></button>';
      }).join('');
    } else {
      html += '<div class="app-combobox-empty"><i class="fas fa-search"></i> Supplier tidak ditemukan. Nama penjual tetap dapat diketik manual.</div>';
    }
    menu.innerHTML = html;
    var createButton = menu.querySelector('[data-create="1"]');
    if (createButton) createButton.addEventListener('click', function () { select(mode, '__CREATE__'); });
    Array.prototype.forEach.call(menu.querySelectorAll('[data-id]'), function (button) {
      button.addEventListener('click', function () { select(mode, button.getAttribute('data-id')); });
    });
  }

  function open(mode) {
    var input = getInput(mode);
    var menu = getMenu(mode);
    if (!input || !menu) return;
    render(mode);
    menu.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  }

  function keydown(event, mode) {
    var menu = getMenu(mode);
    if (!menu) return;
    if (event.key === 'Escape') { close(mode); return; }
    if (event.key === 'ArrowDown' && menu.classList.contains('hidden')) open(mode);
    var options = Array.prototype.slice.call(menu.querySelectorAll('.app-combobox-option'));
    if (!options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      var next = states[mode] + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) next = options.length - 1;
      if (next >= options.length) next = 0;
      states[mode] = next;
      options.forEach(function (option, index) { option.classList.toggle('is-active', index === next); });
      options[next].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && states[mode] >= 0) {
      event.preventDefault();
      options[states[mode]].click();
    }
  }

  function build(mode) {
    var input = getInput(mode);
    if (!input || getWrapper(mode)) return;
    input.removeAttribute('list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.classList.add('app-combobox-input');

    var wrapper = document.createElement('div');
    wrapper.className = 'app-combobox';
    wrapper.id = modePrefix(mode) + 'SupplierCombobox';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'app-combobox-toggle';
    toggle.setAttribute('aria-label', 'Buka pilihan supplier');
    toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
    wrapper.appendChild(toggle);

    var menu = document.createElement('div');
    menu.id = modePrefix(mode) + 'SupplierDropdown';
    menu.className = 'app-combobox-menu hidden';
    menu.setAttribute('role', 'listbox');
    wrapper.appendChild(menu);
    input.setAttribute('aria-controls', menu.id);

    input.addEventListener('focus', function () { open(mode); });
    input.addEventListener('input', function () { render(mode); open(mode); });
    input.addEventListener('keydown', function (event) { keydown(event, mode); });
    toggle.addEventListener('click', function () {
      if (menu.classList.contains('hidden')) { open(mode); input.focus(); } else close(mode);
    });
  }

  function injectStyles() {
    if ($('supplierDropdownStyles')) return;
    var style = document.createElement('style');
    style.id = 'supplierDropdownStyles';
    style.textContent = '.app-combobox{position:relative;width:100%}.app-combobox-input{padding-right:46px}.app-combobox-toggle{position:absolute;top:1px;right:1px;bottom:1px;width:44px;border:0;border-left:1px solid var(--slate-200);border-radius:0 9px 9px 0;background:var(--slate-50);color:var(--slate-600);cursor:pointer;display:flex;align-items:center;justify-content:center}.app-combobox-toggle:hover{background:var(--primary-light);color:var(--primary)}.app-combobox-menu{position:absolute;z-index:12050;left:0;right:0;top:calc(100% + 6px);max-height:280px;overflow-y:auto;overscroll-behavior:contain;padding:6px;border:1px solid var(--slate-200);border-radius:12px;background:var(--white);box-shadow:var(--shadow-xl)}.app-combobox-option{width:100%;border:0;border-radius:9px;padding:10px 12px;background:transparent;color:var(--slate-700);cursor:pointer;display:flex;align-items:center;gap:10px;text-align:left;font-size:13px;line-height:1.35}.app-combobox-option:hover,.app-combobox-option.is-active{background:var(--primary-light);color:var(--primary-dark)}.app-combobox-option.is-create{color:var(--primary);font-weight:700;border-bottom:1px solid var(--slate-100);margin-bottom:4px}.app-combobox-option-main{min-width:0;flex:1}.app-combobox-option-title{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.app-combobox-option-meta{display:block;margin-top:2px;color:var(--slate-500);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.app-combobox-empty{padding:14px 12px;color:var(--slate-500);text-align:center}@media(max-width:640px){.app-combobox-menu{max-height:min(45vh,320px)}.app-combobox-option{min-height:46px}}';
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    var datalist = $('txSupplierDatalist');
    if (datalist) datalist.remove();
    build('add');
    build('edit');
  }

  document.addEventListener('click', function (event) {
    ['add', 'edit'].forEach(function (mode) {
      var wrapper = getWrapper(mode);
      if (wrapper && !wrapper.contains(event.target)) close(mode);
    });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.refreshTransactionSupplierDropdown = function (mode) {
    if (mode) render(mode); else { render('add'); render('edit'); }
  };
})();
