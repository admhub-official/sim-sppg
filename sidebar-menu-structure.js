/* SIM-SPPG sidebar information architecture.
 * Reorders existing menu nodes without recreating them, preserving handlers,
 * badges, active state and role visibility. The operation is idempotent so it
 * never continuously moves nodes while the user is clicking.
 */
(function () {
  'use strict';

  var GROUPS = [
    { title: 'NAVIGASI', items: ['dashboard', 'profil'] },
    { title: 'OPERASIONAL', items: ['manajemen users', 'semua transaksi', 'approval', 'pending payment', 'riwayat aktivitas'] },
    { title: 'DATA MASTER', items: ['master bahan baku', 'data supplier'] },
    { title: 'OPERASIONAL MBG', items: ['survei harga', 'serah terima', 'data menu mbg'] },
    { title: 'PELAPORAN', items: ['laporan'] },
    { title: 'AKUN', items: ['keluar'] }
  ];

  var observer = null;
  var organizing = false;
  var lastSignature = '';

  function normalize(value) {
    return String(value || '').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function menuLabel(item) {
    var label = item.querySelector('.menu-label, .menu-text, span');
    return normalize(label ? label.textContent : item.textContent);
  }

  function findMenuItems(sidebar) {
    var selectors = ['.menu-item', '[data-page]', '[onclick*="navigateTo"]'];
    var found = [];
    selectors.forEach(function (selector) {
      sidebar.querySelectorAll(selector).forEach(function (node) {
        if (found.indexOf(node) < 0 && menuLabel(node)) found.push(node);
      });
    });
    return found.filter(function (node) {
      var label = menuLabel(node);
      return GROUPS.some(function (group) { return group.items.indexOf(label) >= 0; });
    });
  }

  function commonParent(nodes) {
    if (!nodes.length) return null;
    var parent = nodes[0].parentElement;
    return parent && nodes.every(function (node) { return node.parentElement === parent; }) ? parent : null;
  }

  function signature(items) {
    return items.map(function (item) {
      return menuLabel(item) + ':' + (item.hidden || item.classList.contains('hidden') || getComputedStyle(item).display === 'none' ? '0' : '1');
    }).sort().join('|');
  }

  function heading(title) {
    var node = document.createElement('div');
    node.className = 'menu-section-title sim-sppg-menu-heading';
    node.setAttribute('aria-hidden', 'true');
    node.textContent = title;
    return node;
  }

  function installStyles() {
    if (document.getElementById('simSppgSidebarStructureStyle')) return;
    var style = document.createElement('style');
    style.id = 'simSppgSidebarStructureStyle';
    style.textContent = [
      '.sim-sppg-menu-heading{padding:18px 16px 7px!important;margin:0!important;color:rgba(255,255,255,.58)!important;font-size:10px!important;font-weight:800!important;letter-spacing:1.15px!important;line-height:1.2!important;text-transform:uppercase!important;pointer-events:none!important}',
      '.sim-sppg-menu-heading:first-child{padding-top:8px!important}',
      '.sidebar.collapsed .sim-sppg-menu-heading{height:1px!important;padding:0!important;margin:8px 12px!important;overflow:hidden!important;background:rgba(255,255,255,.14)!important;font-size:0!important}',
      '.sidebar .menu-item{pointer-events:auto!important;position:relative!important;z-index:2!important}',
      '.sidebar .menu-item[data-sidebar-logout="1"]{margin-top:2px!important}',
      '.sidebar .menu-item[data-sidebar-logout="1"] i,.sidebar .menu-item[data-sidebar-logout="1"] svg{color:#fecaca!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function organize(force) {
    if (organizing) return;
    var sidebar = document.querySelector('.sidebar, #sidebar, aside[role="navigation"]');
    if (!sidebar) return;
    var items = findMenuItems(sidebar);
    if (!items.length) return;
    var container = commonParent(items);
    if (!container) return;

    var nextSignature = signature(items);
    if (!force && container.getAttribute('data-sidebar-structure-ready') === '1' && nextSignature === lastSignature) return;

    organizing = true;
    if (observer) observer.disconnect();
    try {
      installStyles();
      container.querySelectorAll('.sim-sppg-menu-heading').forEach(function (node) { node.remove(); });
      Array.from(container.children).forEach(function (node) {
        if (items.indexOf(node) >= 0) return;
        var cls = String(node.className || '');
        if (/menu-(section|group|category|title)|section-title/i.test(cls) || /^(menu utama|data master|menu mbg|akun|laporan)$/i.test(normalize(node.textContent))) {
          node.style.display = 'none';
        }
      });

      var byLabel = {};
      items.forEach(function (item) { byLabel[menuLabel(item)] = item; });
      GROUPS.forEach(function (group) {
        var existing = group.items.map(function (label) { return byLabel[label]; }).filter(Boolean);
        if (!existing.length) return;
        container.appendChild(heading(group.title));
        existing.forEach(function (item) {
          if (menuLabel(item) === 'keluar') item.setAttribute('data-sidebar-logout', '1');
          container.appendChild(item);
        });
      });

      container.setAttribute('data-sidebar-structure-ready', '1');
      lastSignature = signature(items);
    } finally {
      organizing = false;
      if (observer) observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    }
  }

  var scheduled = false;
  function schedule(force) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      organize(!!force);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { schedule(true); }, { once: true });
  else schedule(true);

  window.addEventListener('load', function () { schedule(false); }, { once: true });
  setTimeout(function () { schedule(false); }, 700);

  observer = new MutationObserver(function (mutations) {
    if (organizing) return;
    var relevant = mutations.some(function (m) {
      if (m.type === 'attributes') return m.target && m.target.matches && m.target.matches('.menu-item,[data-page]');
      return Array.from(m.addedNodes || []).some(function (node) {
        return node.nodeType === 1 && node.matches && (node.matches('.menu-item,[data-page]') || node.querySelector('.menu-item,[data-page]'));
      });
    });
    if (relevant) schedule(false);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
})();