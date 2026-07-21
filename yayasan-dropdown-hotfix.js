/* SIM-SPPG safe global Yayasan selector interaction fix.
 * Handles option selection before input blur without changing form layout.
 */
(function () {
  'use strict';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function lower(value) { return text(value).toLowerCase(); }

  function isYayasanInput(node) {
    if (!node || !node.matches || !node.matches('input, select, textarea')) return false;
    var marker = lower([
      node.id,
      node.name,
      node.getAttribute('placeholder'),
      node.getAttribute('aria-label'),
      node.getAttribute('data-field')
    ].join(' '));
    if (marker.indexOf('yayasan') >= 0) return true;

    var group = node.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box');
    if (!group) return false;
    var label = group.querySelector('label, .form-label');
    return !!(label && lower(label.textContent).indexOf('yayasan') >= 0);
  }

  function isRealSuggestionList(node) {
    if (!node || !node.matches || node.matches('datalist')) return false;

    // Only known autocomplete/listbox containers are eligible. Never treat a
    // generic form div or grid wrapper as a suggestion list.
    var knownContainer = node.matches(
      'ul, ol, [role="listbox"], .sppg-suggestions, .autocomplete-dropdown, .suggestions, .suggestion-list, .dropdown-menu, [data-suggestions], [data-field*="yayasan" i]'
    );
    if (!knownContainer) return false;

    var marker = lower([
      node.id,
      typeof node.className === 'string' ? node.className : '',
      node.getAttribute('data-field'),
      node.getAttribute('aria-label')
    ].join(' '));
    if (marker.indexOf('yayasan') >= 0) return true;

    var wrapper = node.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box');
    if (!wrapper) return false;
    var inputs = wrapper.querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      if (isYayasanInput(inputs[i])) return true;
    }
    return false;
  }

  function findInput(list) {
    var explicitId = list.getAttribute('data-input') || list.getAttribute('data-input-id') || '';
    if (explicitId) {
      var explicit = document.getElementById(explicitId);
      if (isYayasanInput(explicit)) return explicit;
    }

    var listId = list.id || '';
    if (listId) {
      var controlled = document.querySelectorAll(
        'input[aria-controls="' + CSS.escape(listId) + '"], input[list="' + CSS.escape(listId) + '"]'
      );
      for (var c = 0; c < controlled.length; c++) {
        if (isYayasanInput(controlled[c])) return controlled[c];
      }

      var guesses = [
        listId.replace(/List$/i, ''),
        listId.replace(/Suggestions?$/i, ''),
        listId.replace(/Dropdown$/i, ''),
        listId.replace(/Options?$/i, '')
      ];
      for (var g = 0; g < guesses.length; g++) {
        var guessed = document.getElementById(guesses[g]);
        if (isYayasanInput(guessed)) return guessed;
      }
    }

    var wrapper = list.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box');
    if (wrapper) {
      var inputs = wrapper.querySelectorAll('input, select, textarea');
      for (var i = 0; i < inputs.length; i++) {
        if (isYayasanInput(inputs[i])) return inputs[i];
      }
    }

    var previous = list.previousElementSibling;
    while (previous) {
      if (isYayasanInput(previous)) return previous;
      if (previous.querySelector) {
        var nested = previous.querySelector('input, select, textarea');
        if (isYayasanInput(nested)) return nested;
      }
      previous = previous.previousElementSibling;
    }
    return null;
  }

  function optionFromTarget(target, list) {
    var node = target;
    while (node && node !== list) {
      if (node.matches && node.matches(
        'li, [role="option"], .sppg-suggestion-item, .suggestion-item, .autocomplete-item, .dropdown-item, [data-value], [data-yayasan], [data-name]'
      )) return node;
      node = node.parentElement;
    }
    return null;
  }

  function optionValue(option) {
    return text(
      option && (
        option.getAttribute('data-value') ||
        option.getAttribute('data-yayasan') ||
        option.getAttribute('data-name') ||
        option.textContent
      )
    );
  }

  function hideList(list) {
    list.classList.add('hidden');
    list.setAttribute('aria-hidden', 'true');
  }

  function selectOption(list, option) {
    var input = findInput(list);
    var value = optionValue(option);
    if (!input || !value) return false;

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    var wrapper = input.closest('.form-group, .field-group, .input-group, .sppg-autocomplete-wrap, .autocomplete-box, form');
    if (wrapper) {
      var hidden = wrapper.querySelectorAll('input[type="hidden"]');
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

  function handleEarlySelection(event) {
    var option = event.target && event.target.closest && event.target.closest(
      'li, [role="option"], .sppg-suggestion-item, .suggestion-item, .autocomplete-item, .dropdown-item, [data-value], [data-yayasan], [data-name]'
    );
    if (!option) return;

    var list = option.closest(
      'ul, ol, [role="listbox"], .sppg-suggestions, .autocomplete-dropdown, .suggestions, .suggestion-list, .dropdown-menu, [data-suggestions], [data-field*="yayasan" i]'
    );
    if (!isRealSuggestionList(list)) return;
    if (!optionFromTarget(option, list)) return;

    event.preventDefault();
    event.stopPropagation();
    selectOption(list, option);
  }

  // Pointer/mouse/touch are captured before legacy onblur hides the list.
  document.addEventListener('pointerdown', handleEarlySelection, true);
  document.addEventListener('mousedown', handleEarlySelection, true);
  document.addEventListener('touchstart', handleEarlySelection, { capture: true, passive: false });

  // Styling is limited strictly to actual Yayasan suggestion lists. No position,
  // width, display, disabled, or parent-layout properties are changed.
  function enhanceLists(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var lists = scope.querySelectorAll(
      'ul, ol, [role="listbox"], .sppg-suggestions, .autocomplete-dropdown, .suggestions, .suggestion-list, .dropdown-menu, [data-suggestions], [data-field*="yayasan" i]'
    );
    for (var i = 0; i < lists.length; i++) {
      if (!isRealSuggestionList(lists[i])) continue;
      lists[i].style.zIndex = '10050';
      lists[i].style.pointerEvents = 'auto';
      lists[i].style.touchAction = 'manipulation';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { enhanceLists(document); }, { once: true });
  } else {
    enhanceLists(document);
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      for (var j = 0; j < mutations[i].addedNodes.length; j++) {
        var node = mutations[i].addedNodes[j];
        if (node.nodeType === 1) enhanceLists(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();