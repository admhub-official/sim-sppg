(function () {
  'use strict';

  var MAX_DIMENSION = 1600;
  var JPEG_QUALITY = 0.72;
  var MIN_COMPRESS_BYTES = 350 * 1024;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Jangan unduh bukti/nota/TTD otomatis setiap modal detail dibuka.
  // File baru dimuat ketika pengguna menekan tombol Lihat File.
  window.renderFilePreview = function (url, label, icon) {
    if (!url) return '';
    var safeUrl = esc(url);
    var safeLabel = esc(label || 'File');
    var safeIcon = esc(icon || 'fa-file');
    return '<div class="file-preview-card egress-lazy-preview" style="padding:12px;border:1px solid var(--slate-200);border-radius:10px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<i class="fas ' + safeIcon + '" style="color:var(--primary)"></i>' +
        '<span style="flex:1;font-weight:600">' + safeLabel + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-egress-preview-url="' + safeUrl + '">' +
          '<i class="fas fa-eye"></i> Lihat File' +
        '</button>' +
      '</div>' +
      '<div class="egress-preview-target" style="display:none;margin-top:10px"></div>' +
    '</div>';
  };

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-egress-preview-url]');
    if (!button) return;
    var target = button.closest('.egress-lazy-preview').querySelector('.egress-preview-target');
    if (!target) return;
    if (target.dataset.loaded === '1') {
      target.style.display = target.style.display === 'none' ? '' : 'none';
      return;
    }
    var url = button.getAttribute('data-egress-preview-url') || '';
    var clean = url.split('?')[0].toLowerCase();
    var image = /\.(png|jpe?g|webp|gif|bmp)$/i.test(clean);
    target.innerHTML = image
      ? '<img src="' + esc(url) + '" loading="lazy" decoding="async" style="display:block;max-width:100%;max-height:70vh;margin:auto;border-radius:8px" alt="Preview file">'
      : '<iframe src="' + esc(url) + '" loading="lazy" style="width:100%;height:65vh;border:0;border-radius:8px" title="Preview file"></iframe>';
    target.dataset.loaded = '1';
    target.style.display = '';
    button.innerHTML = '<i class="fas fa-eye-slash"></i> Tutup File';
  });

  function compressImage(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//i.test(file.type) || file.size < MIN_COMPRESS_BYTES || /gif|svg/i.test(file.type)) {
        resolve(file); return;
      }
      var image = new Image();
      var objectUrl = URL.createObjectURL(file);
      image.onload = function () {
        URL.revokeObjectURL(objectUrl);
        var scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
        var width = Math.max(1, Math.round(image.width * scale));
        var height = Math.max(1, Math.round(image.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        var ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          var base = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], base + '.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', JPEG_QUALITY);
      };
      image.onerror = function () { URL.revokeObjectURL(objectUrl); resolve(file); };
      image.src = objectUrl;
    });
  }

  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file' || input.dataset.egressCompressing === '1') return;
    var file = input.files && input.files[0];
    if (!file || !/^image\//i.test(file.type)) return;
    input.dataset.egressCompressing = '1';
    compressImage(file).then(function (compressed) {
      if (compressed !== file && typeof DataTransfer !== 'undefined') {
        var transfer = new DataTransfer();
        transfer.items.add(compressed);
        input.files = transfer.files;
      }
    }).finally(function () {
      input.dataset.egressCompressing = '0';
    });
  }, true);

  // Atribut ringan untuk gambar storage yang memang harus tampil.
  function tuneImage(img) {
    if (!img || img.dataset.egressTuned === '1') return;
    var src = img.getAttribute('src') || '';
    if (src.indexOf('.supabase.co/storage/') === -1) return;
    img.dataset.egressTuned = '1';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.fetchPriority = 'low';
  }
  Array.prototype.forEach.call(document.images || [], tuneImage);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') tuneImage(node);
        Array.prototype.forEach.call(node.querySelectorAll ? node.querySelectorAll('img') : [], tuneImage);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
