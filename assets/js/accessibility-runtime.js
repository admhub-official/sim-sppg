(function () {
  'use strict';

  var activeModal = null;
  var returnFocus = null;
  var observer = null;
  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(',');

  function visible(node) {
    if (!node || node.hidden) return false;
    var style = window.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function focusables(modal) {
    return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE)).filter(visible);
  }

  function modalTitle(modal) {
    return modal.querySelector('.modal-header h1,.modal-header h2,.modal-header h3,.modal-title,h1,h2,h3');
  }

  function prepareModal(modal) {
    if (!modal || !modal.classList.contains('active')) return;
    if (activeModal !== modal) {
      returnFocus = document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
      activeModal = modal;
    }

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.removeAttribute('aria-hidden');

    var title = modalTitle(modal);
    if (title) {
      if (!title.id) title.id = modal.id ? modal.id + '-a11y-title' : 'sim-sppg-modal-title';
      modal.setAttribute('aria-labelledby', title.id);
    }

    window.setTimeout(function () {
      if (activeModal !== modal || !modal.classList.contains('active')) return;
      var nodes = focusables(modal);
      if (nodes.length && !modal.contains(document.activeElement)) nodes[0].focus();
      else if (!nodes.length) {
        modal.tabIndex = -1;
        modal.focus();
      }
    }, 0);
  }

  function closeModalState(modal) {
    if (!modal) return;
    modal.removeAttribute('aria-modal');
    modal.setAttribute('aria-hidden', 'true');
    if (activeModal !== modal) return;

    activeModal = null;
    var target = returnFocus;
    returnFocus = null;
    if (target && document.contains(target) && typeof target.focus === 'function') {
      window.setTimeout(function () { target.focus(); }, 0);
    }
  }

  function syncModals() {
    var open = document.querySelector('.modal-overlay.active');
    if (open) prepareModal(open);
    if (activeModal && !activeModal.classList.contains('active')) closeModalState(activeModal);

    document.querySelectorAll('.modal-overlay:not(.active)').forEach(function (modal) {
      if (modal !== activeModal) modal.setAttribute('aria-hidden', 'true');
    });
  }

  function onModalKeydown(event) {
    if (event.key !== 'Tab' || !activeModal || !activeModal.classList.contains('active')) return;
    var nodes = focusables(activeModal);
    if (!nodes.length) {
      event.preventDefault();
      activeModal.focus();
      return;
    }

    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || !activeModal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function enhanceSidebarItem(item) {
    if (!item || item.dataset.a11yKeyboard === '1') return;
    var tag = item.tagName.toLowerCase();
    var nativeControl = tag === 'a' || tag === 'button' || tag === 'input';
    if (!nativeControl && !item.hasAttribute('tabindex')) item.tabIndex = 0;
    if (!nativeControl && !item.hasAttribute('role')) item.setAttribute('role', 'button');
    item.dataset.a11yKeyboard = '1';
    item.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.key === ' ') event.preventDefault();
      item.click();
    });
  }

  function syncSidebar() {
    document.querySelectorAll('.sidebar .menu-item,.sidebar [data-page]').forEach(function (item) {
      enhanceSidebarItem(item);
      if (item.classList.contains('active')) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function sync() {
    syncModals();
    syncSidebar();
  }

  document.addEventListener('keydown', onModalKeydown, true);
  document.addEventListener('DOMContentLoaded', sync);
  window.addEventListener('load', sync);
  window.addEventListener('pageshow', sync);

  observer = new MutationObserver(function (mutations) {
    var relevant = mutations.some(function (mutation) {
      if (mutation.type === 'attributes') {
        return mutation.target && mutation.target.matches &&
          mutation.target.matches('.modal-overlay,.sidebar .menu-item,.sidebar [data-page]');
      }
      return mutation.addedNodes && mutation.addedNodes.length > 0;
    });
    if (relevant) window.requestAnimationFrame(sync);
  });

  function observe() {
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
