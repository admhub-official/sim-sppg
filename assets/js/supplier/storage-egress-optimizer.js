(function () {
  'use strict';

  var MAX_BYTES = 1024 * 1024;
  var MIN_COMPRESS_BYTES = 220 * 1024;
  var INITIAL_DIMENSION = 1600;
  var urlCache = new Map();
  var pendingCompression = 0;
  var originalReadAsDataURL = FileReader.prototype.readAsDataURL;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function toast(type, title, message) {
    if (typeof window.showToast === 'function') window.showToast(type, title, message);
  }
  function fileMeta(file) {
    if (!file) return null;
    if (typeof file === 'string') return { url: file, path: '', bucket: '', name: 'File', mimeType: '' };
    return {
      url: file.signedThumbnailUrl || file.signedUrl || file.url || '',
      path: file.path || file.storage_path || '',
      bucket: file.bucket || file.storage_bucket || '',
      name: file.name || file.originalFileName || file.original_file_name || 'File',
      mimeType: file.mimeType || file.mime_type || ''
    };
  }
  function cacheKey(meta, variant) { return String(meta.bucket || '') + '|' + String(meta.path || '') + '|' + String(variant || 'full'); }
  function readCached(meta, variant) {
    var key = cacheKey(meta, variant), now = Date.now(), memory = urlCache.get(key);
    if (memory && memory.expiresAt > now + 120000) return memory.url;
    try {
      var raw = sessionStorage.getItem('sppg:file-url:' + key);
      if (raw) {
        var value = JSON.parse(raw);
        if (value.expiresAt > now + 120000) { urlCache.set(key, value); return value.url; }
        sessionStorage.removeItem('sppg:file-url:' + key);
      }
    } catch (_) {}
    return '';
  }
  function storeCached(meta, variant, url, seconds) {
    var key = cacheKey(meta, variant);
    var value = { url: url, expiresAt: Date.now() + Math.max(300, Number(seconds) || 3600) * 1000 };
    urlCache.set(key, value);
    try { sessionStorage.setItem('sppg:file-url:' + key, JSON.stringify(value)); } catch (_) {}
  }
  function requestUrl(meta, variant) {
    variant = variant || 'full';
    if (meta.url && variant === 'full') return Promise.resolve(meta.url);
    var cached = readCached(meta, variant);
    if (cached) return Promise.resolve(cached);
    if (!meta.bucket || !meta.path) return Promise.reject(new Error('Metadata file tidak lengkap.'));
    return new Promise(function (resolve, reject) {
      if (typeof window.callApi !== 'function') { reject(new Error('API file tidak tersedia.')); return; }
      window.callApi('getFileUrl', [{ bucket: meta.bucket, path: meta.path, variant: variant }], function (result) {
        var data = result && result.data ? result.data : result;
        var url = data && data.url ? data.url : '';
        if (!url) { reject(new Error('URL file tidak tersedia.')); return; }
        storeCached(meta, variant, url, data.expiresIn || 3600);
        resolve(url);
      }, function (error) { reject(error instanceof Error ? error : new Error('Gagal membuka file.')); });
    });
  }

  function isImageMeta(meta) {
    var clean = String(meta.path || meta.url || '').split('?')[0].toLowerCase();
    return /^image\//i.test(meta.mimeType || '') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(clean);
  }

  var viewportObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      viewportObserver.unobserve(entry.target);
      var raw = entry.target.getAttribute('data-egress-meta') || '';
      var meta; try { meta = JSON.parse(decodeURIComponent(raw)); } catch (_) { return; }
      requestUrl(meta, 'thumbnail').then(function (url) {
        entry.target.src = url;
        entry.target.removeAttribute('data-egress-meta');
      }).catch(function () { entry.target.alt = 'Preview tidak tersedia'; });
    });
  }, { rootMargin: '180px 0px' }) : null;

  window.renderStorageImage = function (file, alt, className) {
    var meta = fileMeta(file);
    if (!meta || (!meta.url && !meta.path)) return '';
    var payload = encodeURIComponent(JSON.stringify(meta));
    return '<img data-egress-meta="' + esc(payload) + '" alt="' + esc(alt || meta.name || 'Gambar') + '" class="' + esc(className || '') + '" loading="lazy" decoding="async">';
  };

  window.renderFilePreview = function (file, label, icon) {
    var meta = fileMeta(file);
    if (!meta || (!meta.url && !meta.path)) return '';
    var payload = encodeURIComponent(JSON.stringify(meta));
    return '<div class="file-preview-card egress-lazy-preview" style="padding:12px;border:1px solid var(--slate-200);border-radius:10px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<i class="fas ' + esc(icon || 'fa-file') + '" style="color:var(--primary)"></i>' +
        '<span style="flex:1;font-weight:600">' + esc(label || meta.name || 'File') + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-egress-file="' + esc(payload) + '"><i class="fas fa-eye"></i> Lihat File</button>' +
      '</div><div class="egress-preview-target" style="display:none;margin-top:10px"></div></div>';
  };

  document.addEventListener('click', function (event) {
    var saveButton = event.target.closest('button[onclick*="save"],button[onclick*="Save"],button[onclick*="submit"],button[onclick*="Submit"]');
    if (saveButton && pendingCompression > 0) {
      event.preventDefault(); event.stopImmediatePropagation();
      toast('warning', 'Sedang Memproses Gambar', 'Tunggu kompresi gambar selesai sebelum menyimpan.');
      return;
    }
    var fullButton = event.target.closest('[data-egress-full]');
    if (fullButton) {
      var fullMeta; try { fullMeta = JSON.parse(decodeURIComponent(fullButton.getAttribute('data-egress-full') || '')); } catch (_) { return; }
      fullButton.disabled = true;
      requestUrl(fullMeta, 'full').then(function (url) { window.open(url, '_blank', 'noopener'); fullButton.disabled = false; })
        .catch(function (error) { fullButton.disabled = false; toast('error', 'Gagal Membuka File', error.message || 'File tidak dapat dibuka.'); });
      return;
    }
    var button = event.target.closest('[data-egress-file]');
    if (!button) return;
    var card = button.closest('.egress-lazy-preview');
    var target = card && card.querySelector('.egress-preview-target');
    if (!target) return;
    if (target.dataset.loaded === '1') {
      target.style.display = target.style.display === 'none' ? '' : 'none';
      button.innerHTML = target.style.display === 'none' ? '<i class="fas fa-eye"></i> Lihat File' : '<i class="fas fa-eye-slash"></i> Tutup File';
      return;
    }
    var meta;
    try { meta = JSON.parse(decodeURIComponent(button.getAttribute('data-egress-file') || '')); }
    catch (_) { toast('error', 'Gagal', 'Metadata file tidak valid.'); return; }
    button.disabled = true; button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Membuka...';
    var image = isImageMeta(meta);
    if (image) {
      var payload = encodeURIComponent(JSON.stringify(meta));
      target.innerHTML = '<div style="min-height:160px;display:flex;align-items:center;justify-content:center;background:var(--slate-50);border-radius:8px">' +
        '<img data-egress-meta="' + esc(payload) + '" loading="lazy" decoding="async" style="display:block;max-width:100%;max-height:55vh;margin:auto;border-radius:8px" alt="Preview file"></div>' +
        '<div style="margin-top:8px;text-align:right"><button type="button" class="btn btn-outline btn-sm" data-egress-full="' + esc(payload) + '"><i class="fas fa-external-link-alt"></i> Buka Ukuran Penuh</button></div>';
      var img = target.querySelector('[data-egress-meta]');
      if (viewportObserver) viewportObserver.observe(img); else requestUrl(meta, 'thumbnail').then(function (url) { img.src = url; });
      target.dataset.loaded = '1'; target.style.display = '';
      button.disabled = false; button.innerHTML = '<i class="fas fa-eye-slash"></i> Tutup File';
    } else {
      requestUrl(meta, 'full').then(function (url) {
        target.innerHTML = '<iframe src="' + esc(url) + '" loading="lazy" style="width:100%;height:65vh;border:0;border-radius:8px" title="Preview file"></iframe>';
        target.dataset.loaded = '1'; target.style.display = '';
        button.disabled = false; button.innerHTML = '<i class="fas fa-eye-slash"></i> Tutup File';
      }).catch(function (error) {
        button.disabled = false; button.innerHTML = '<i class="fas fa-eye"></i> Lihat File';
        toast('error', 'Gagal Membuka File', error && error.message ? error.message : 'File tidak dapat dibuka.');
      });
    }
  }, true);

  function imageToBlob(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//i.test(file.type) || /gif|svg/i.test(file.type) || file.size < MIN_COMPRESS_BYTES) { resolve(file); return; }
      var img = new Image(), objectUrl = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        var dimension = INITIAL_DIMENSION, quality = 0.76, attempts = 0;
        function attempt() {
          var scale = Math.min(1, dimension / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
          var ctx = canvas.getContext('2d', { alpha: false }); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            if (!blob) { resolve(file); return; }
            attempts++;
            if (blob.size <= MAX_BYTES || attempts >= 5) {
              var base = file.name.replace(/\.[^.]+$/, '');
              resolve(blob.size < file.size ? new File([blob], base + '.jpg', { type: 'image/jpeg', lastModified: Date.now() }) : file);
              return;
            }
            dimension = Math.round(dimension * 0.82); quality = Math.max(0.52, quality - 0.08); attempt();
          }, 'image/jpeg', quality);
        }
        attempt();
      };
      img.onerror = function () { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  }

  FileReader.prototype.readAsDataURL = function (blob) {
    var reader = this;
    if (!(blob instanceof File) || !/^image\//i.test(blob.type) || /gif|svg/i.test(blob.type) || blob.size < MIN_COMPRESS_BYTES) return originalReadAsDataURL.call(reader, blob);
    pendingCompression++;
    imageToBlob(blob).then(function (processed) {
      if (processed.size > MAX_BYTES) toast('warning', 'Ukuran Gambar Besar', 'Gambar masih lebih dari 1 MB setelah kompresi. Gunakan gambar yang lebih kecil bila upload gagal.');
      reader.addEventListener('loadend', function done() { pendingCompression = Math.max(0, pendingCompression - 1); reader.removeEventListener('loadend', done); }, { once: true });
      originalReadAsDataURL.call(reader, processed);
    }).catch(function () { pendingCompression = Math.max(0, pendingCompression - 1); originalReadAsDataURL.call(reader, blob); });
  };

  window.SPPGFileAccess = { requestUrl: requestUrl, clearCache: function () { urlCache.clear(); } };
})();