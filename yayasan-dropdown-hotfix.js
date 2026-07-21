/* SIM-SPPG Yayasan autocomplete interaction fix.
 * The legacy inputs hide their suggestion list on blur. Pointer selection must
 * therefore be completed before blur/click sequencing removes the list.
 */
(function () {
  'use strict';

  var LIST_IDS = ['editYayasanList', 'editUserYayasanList'];

  function byId(id) { return document.getElementById(id); }

  function inputIdForList(listId) {
    if (listId === 'editYayasanList') return 'editYayasan';
    if (listId === 'editUserYayasanList') return 'editUserYayasan';
    return '';
  }

  function optionValue(node) {
    if (!node) return '';
    return String(
      node.getAttribute('data-value') ||
      node.getAttribute('data-yayasan') ||
      node.dataset && (node.dataset.value || node.dataset.yayasan) ||
      node.textContent || ''
    ).trim();
  }

  function selectOption(list, option) {
    var input = byId(inputIdForList(list.id));
    var value = optionValue(option);
    if (!input || !value) return false;

    input.value = value;
    input.setAttribute('value', value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    list.classList.add('hidden');
    list.style.display = 'none';
    input.focus({ preventScroll: true });
    return true;
  }

  function optionFromEvent(event, list) {
    var node = event.target;
    while (node && node !== list) {
      if (node.matches && node.matches('li, [role="option"], .sppg-suggestion-item, .suggestion-item, [data-value], [data-yayasan]')) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function prepareList(list) {
    if (!list || list.dataset.yayasanClickFixed === '1') return;
    list.dataset.yayasanClickFixed = '1';
    list.style.zIndex = '10050';
    list.style.pointerEvents = 'auto';
    list.style.touchAction = 'manipulation';

    // pointerdown occurs before the input blur handler.
    list.addEventListener('pointerdown', function (event) {
      var option = optionFromEvent(event, list);
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      selectOption(list, option);
    }, true);

    // Fallback for browsers/webviews without reliable Pointer Events.
    list.addEventListener('mousedown', function (event) {
      var option = optionFromEvent(event, list);
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      selectOption(list, option);
    }, true);

    list.addEventListener('touchstart', function (event) {
      var option = optionFromEvent(event, list);
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      selectOption(list, option);
    }, { capture: true, passive: false });
  }

  function prepareAll() {
    LIST_IDS.forEach(function (id) { prepareList(byId(id)); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepareAll, { once: true });
  } else {
    prepareAll();
  }

  // Lists are repopulated dynamically; keep their container interactive.
  var observer = new MutationObserver(prepareAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();