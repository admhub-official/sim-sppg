/* SIM-SPPG global Yayasan selector interaction fix.
 * Applies to registration, profile, user management, admin assignment,
 * transaction/operational forms, and dynamically rendered modals.
 */
(function () {
  'use strict';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function lower(value) { return text(value).toLowerCase(); }

  function isYayasanInput(node) {
    if (!node || !node.matches || !node.matches('input, select, textarea')) return false;
    var marker = [
      node.id,
      node.name,
      node.getAttribute('placeholder'),
      node.getAttribute('aria-label'),
      node.getAttribute('data-field'),
      node.getAttribute('autocomplete')
    ].map(lower).join(' ');
    if (marker.indexOf('yayasan') >= 0) return true;
    var group = node.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box');
    return !!(group && lower(group.textContent).indexOf('yayasan') >= 0);
  }

  function isSuggestionList(node) {
    if (!node || !node.matches) return false;
    if (node.matches('datalist')) return false;
    if (!node.matches('ul, ol, div, section, [role="listbox"]')) return false;
    var marker = lower([
      node.id,
      node.className,
      node.getAttribute('data-field'),
      node.getAttribute('aria-label')
    ].join(' '));
    if (marker.indexOf('yayasan') >= 0) return true;
    var wrap = node.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box');
    return !!(wrap && Array.prototype.some.call(wrap.querySelectorAll('input, select'), isYayasanInput));
  }

  function findInput(list) {
    var controlledBy = list.getAttribute('data-input') || list.getAttribute('data-input-id') || '';
    if (controlledBy && document.getElementById(controlledBy)) return document.getElementById(controlledBy);

    var listId = list.id || '';
    if (listId) {
      var candidates = document.querySelectorAll('input[aria-controls="' + CSS.escape(listId) + '"], input[list="' + CSS.escape(listId) + '"]');
      for (var i = 0; i < candidates.length; i++) if (isYayasanInput(candidates[i])) return candidates[i];

      var guessedIds = [
        listId.replace(/List$/i, ''),
        listId.replace(/Suggestions?$/i, ''),
        listId.replace(/Dropdown$/i, ''),
        listId.replace(/Options?$/i, '')
      ];
      for (var g = 0; g < guessedIds.length; g++) {
        var guessed = document.getElementById(guessedIds[g]);
        if (isYayasanInput(guessed)) return guessed;
      }
    }

    var wrap = list.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box, form, .modal-body');
    if (wrap) {
      var inputs = wrap.querySelectorAll('input, select, textarea');
      for (var j = 0; j < inputs.length; j++) if (isYayasanInput(inputs[j])) return inputs[j];
    }

    var previous = list.previousElementSibling;
    while (previous) {
      if (isYayasanInput(previous)) return previous;
      var nested = previous.querySelector && previous.querySelector('input, select, textarea');
      if (isYayasanInput(nested)) return nested;
      previous = previous.previousElementSibling;
    }
    return null;
  }

  function optionFromEvent(event, list) {
    var node = event.target;
    while (node && node !== list) {
      if (node.matches && node.matches(
        'li, option, [role="option"], .sppg-suggestion-item, .suggestion-item, .autocomplete-item, .dropdown-item, [data-value], [data-yayasan], [data-name]'
      )) return node;
      node = node.parentElement;
    }
    return null;
  }

  function optionValue(option) {
    if (!option) return '';
    return text(
      option.getAttribute('data-value') ||
      option.getAttribute('data-yayasan') ||
      option.getAttribute('data-name') ||
      option.value ||
      option.textContent
    );
  }

  function hideList(list) {
    list.classList.add('hidden');
    list.setAttribute('aria-hidden', 'true');
    list.style.display = 'none';
  }

  function selectOption(list, option) {
    var input = findInput(list);
    var value = optionValue(option);
    if (!input || !value) return false;

    input.value = value;
    input.setAttribute('value', value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Some legacy forms keep a hidden Yayasan field beside the visible input.
    var wrap = input.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box, form');
    if (wrap) {
      var hidden = wrap.querySelectorAll('input[type="hidden"]');
      for (var i = 0; i < hidden.length; i++) {
        if (lower(hidden[i].id + ' ' + hidden[i].name).indexOf('yayasan') >= 0) {
          hidden[i].value = value;
          hidden[i].dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    hideList(list);
    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    return true;
  }

  function prepareList(list) {
    if (!isSuggestionList(list) || list.dataset.yayasanGlobalFixed === '1') return;
    list.dataset.yayasanGlobalFixed = '1';
    list.style.zIndex = '10050';
    list.style.pointerEvents = 'auto';
    list.style.touchAction = 'manipulation';
    list.style.position = list.style.position || 'absolute';

    function choose(event) {
      var option = optionFromEvent(event, list);
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      selectOption(list, option);
    }

    // These fire before the input's blur handler hides the dropdown.
    list.addEventListener('pointerdown', choose, true);
    list.addEventListener('mousedown', choose, true);
    list.addEventListener('touchstart', choose, { capture: true, passive: false });
  }

  function prepareNativeSelect(select) {
    if (!isYayasanInput(select) || select.tagName !== 'SELECT') return;
    select.disabled = false;
    select.style.pointerEvents = 'auto';
    select.style.touchAction = 'manipulation';
  }

  function prepareAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var lists = scope.querySelectorAll('ul, ol, div, section, [role="listbox"]');
    for (var i = 0; i < lists.length; i++) prepareList(lists[i]);
    var selects = scope.querySelectorAll('select');
    for (var j = 0; j < selects.length; j++) prepareNativeSelect(selects[j]);
  }

  // Global capture fallback also covers lists created between observer cycles.
  document.addEventListener('pointerdown', function (event) {
    var option = event.target && event.target.closest && event.target.closest(
      'li, [role="option"], .sppg-suggestion-item, .suggestion-item, .autocomplete-item, .dropdown-item, [data-value], [data-yayasan], [data-name]'
    );
    if (!option) return;
    var list = option.closest('ul, ol, div[role="listbox"], .sppg-suggestions, .autocomplete-dropdown, .dropdown-menu');
    if (!isSuggestionList(list)) return;
    event.preventDefault();
    event.stopPropagation();
    selectOption(list, option);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { prepareAll(document); }, { once: true });
  } else {
    prepareAll(document);
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      for (var j = 0; j < mutations[i].addedNodes.length; j++) {
        var node = mutations[i].addedNodes[j];
        if (node.nodeType === 1) {
          prepareList(node);
          prepareNativeSelect(node);
          prepareAll(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();