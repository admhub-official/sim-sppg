(function () {
  'use strict';

  var LABEL = 'Supplier/ Penjual/ a.n Trx';
  var PATTERN = /Supplier\s*\/\s*Penjual(?!\s*\/\s*a\.n\s*Trx)/gi;

  function replaceText(value) {
    return typeof value === 'string' ? value.replace(PATTERN, LABEL) : value;
  }

  function replaceNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      var updatedText = replaceText(node.nodeValue || '');
      if (updatedText !== node.nodeValue) node.nodeValue = updatedText;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    if (node.nodeType === Node.ELEMENT_NODE) {
      ['placeholder', 'title', 'aria-label', 'data-label'].forEach(function (attribute) {
        if (!node.hasAttribute(attribute)) return;
        var current = node.getAttribute(attribute) || '';
        var updated = replaceText(current);
        if (updated !== current) node.setAttribute(attribute, updated);
      });
    }

    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    var textNode;
    while ((textNode = walker.nextNode())) replaceNode(textNode);
  }

  function patchPrintWindows() {
    if (window.open && !window.open.__supplierLabelUpdate) {
      var originalOpen = window.open;
      window.open = function () {
        var child = originalOpen.apply(this, arguments);
        if (!child || !child.document) return child;

        ['write', 'writeln'].forEach(function (method) {
          if (typeof child.document[method] !== 'function' || child.document[method].__supplierLabelUpdate) return;
          var original = child.document[method].bind(child.document);
          var wrapped = function () {
            var args = Array.prototype.slice.call(arguments).map(replaceText);
            return original.apply(child.document, args);
          };
          wrapped.__supplierLabelUpdate = true;
          child.document[method] = wrapped;
        });
        return child;
      };
      window.open.__supplierLabelUpdate = true;
    }
  }

  function patchBlobDownloads() {
    if (!window.Blob || window.Blob.__supplierLabelUpdate) return;
    var NativeBlob = window.Blob;
    var WrappedBlob = function (parts, options) {
      var updatedParts = Array.isArray(parts)
        ? parts.map(function (part) { return typeof part === 'string' ? replaceText(part) : part; })
        : parts;
      return new NativeBlob(updatedParts, options);
    };
    WrappedBlob.prototype = NativeBlob.prototype;
    Object.setPrototypeOf(WrappedBlob, NativeBlob);
    WrappedBlob.__supplierLabelUpdate = true;
    window.Blob = WrappedBlob;
  }

  function replaceSheetInput(data) {
    if (!Array.isArray(data)) return data;
    return data.map(function (row) {
      return Array.isArray(row) ? row.map(replaceText) : row;
    });
  }

  function patchSpreadsheetExports() {
    var utils = window.XLSX && window.XLSX.utils;
    if (!utils || utils.__supplierLabelUpdate) return false;

    ['aoa_to_sheet', 'sheet_add_aoa'].forEach(function (method) {
      if (typeof utils[method] !== 'function') return;
      var original = utils[method];
      utils[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        args[method === 'aoa_to_sheet' ? 0 : 1] = replaceSheetInput(args[method === 'aoa_to_sheet' ? 0 : 1]);
        return original.apply(this, args);
      };
    });

    utils.__supplierLabelUpdate = true;
    return true;
  }

  function patchJsPdf() {
    var JsPdf = window.jspdf && window.jspdf.jsPDF;
    if (!JsPdf || !JsPdf.API || JsPdf.API.__supplierLabelUpdate || typeof JsPdf.API.text !== 'function') return false;
    var originalText = JsPdf.API.text;
    JsPdf.API.text = function () {
      var args = Array.prototype.slice.call(arguments);
      if (typeof args[0] === 'string') args[0] = replaceText(args[0]);
      if (Array.isArray(args[0])) args[0] = args[0].map(replaceText);
      return originalText.apply(this, args);
    };
    JsPdf.API.__supplierLabelUpdate = true;
    return true;
  }

  function install() {
    replaceNode(document.documentElement);
    patchPrintWindows();
    patchBlobDownloads();
    patchSpreadsheetExports();
    patchJsPdf();

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'characterData') replaceNode(mutation.target);
        Array.prototype.forEach.call(mutation.addedNodes || [], replaceNode);
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      patchSpreadsheetExports();
      patchJsPdf();
      replaceNode(document.documentElement);
      if (attempts >= 120) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
