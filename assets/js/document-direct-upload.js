(function () {
  'use strict';

  var MAX_BYTES = 15 * 1024 * 1024;
  var DIRECT_UPLOAD_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co/functions/v1/document-upload-action';
  var forbiddenName = /\.(exe|msi|apk|bat|cmd|com|scr|ps1|vbs|js|mjs|cjs|jar|sh|php|py|rb|pl|cgi|dll)$/i;
  var forbiddenMime = /application\/(x-msdownload|x-msdos-program|x-sh|x-executable)/i;
  var failedUploads = [];

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    var node = document.createElement('span');
    node.textContent = String(value == null ? '' : value);
    return node.innerHTML;
  }
  function notify(type, title, message) {
    if (typeof window.showToast === 'function') window.showToast(type, title, message);
  }
  function jwt() {
    if (typeof window.getJwtToken === 'function') return window.getJwtToken();
    try { return localStorage.getItem('sppg_jwt') || ''; } catch (_) { return ''; }
  }
  function anonKey() { return String(window._supabaseKey || ''); }

  function api(mode, data) {
    var token = jwt();
    if (!token) return Promise.reject(new Error('Sesi login tidak tersedia. Silakan login kembali.'));
    var headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
    if (anonKey()) headers.apikey = anonKey();
    return fetch(DIRECT_UPLOAD_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ parameters: [Object.assign({ mode: mode }, data || {})] })
    }).then(function (response) {
      return response.text().then(function (raw) {
        var body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = {}; }
        var result = body && body.result ? body.result : body;
        if (!response.ok || !result || result.success === false) {
          throw new Error((result && result.message) || body.error || ('Upload gagal (HTTP ' + response.status + ').'));
        }
        return result;
      });
    });
  }

  function currentScope() {
    var select = $('docScopeSelect');
    if (select && select.value) {
      try {
        var parsed = JSON.parse(decodeURIComponent(select.value));
        if (parsed && parsed.sppg) return { sppg: parsed.sppg, yayasan: parsed.yayasan || '' };
      } catch (_) {}
    }
    return {};
  }

  function currentView() {
    var active = document.querySelector('.doc-nav.active[data-doc-view]');
    return active ? String(active.getAttribute('data-doc-view') || 'files') : 'files';
  }

  function currentFolderId() {
    var buttons = document.querySelectorAll('#docBreadcrumbs [data-doc-folder-id]');
    if (!buttons.length) return '';
    return String(buttons[buttons.length - 1].getAttribute('data-doc-folder-id') || '');
  }

  function currentContext() {
    var scope = currentScope();
    var view = currentView();
    return {
      folderId: currentFolderId(),
      sppg: scope.sppg || '',
      yayasan: scope.yayasan || '',
      isTemplate: view === 'templates'
    };
  }

  function contextLabel(context) {
    return (context && context.isTemplate ? 'Template' : 'Dokumen') +
      (context && context.sppg ? ' · ' + context.sppg : '');
  }

  function validateFile(file) {
    if (!file || !file.name) throw new Error('File tidak valid.');
    if (!file.size) throw new Error('File kosong tidak dapat diunggah.');
    if (file.size > MAX_BYTES) throw new Error('Ukuran file maksimal 15 MB.');
    if (forbiddenName.test(file.name)) throw new Error('Jenis file ini tidak diizinkan demi keamanan.');
    if (forbiddenMime.test(file.type || '')) throw new Error('Jenis file ini tidak diizinkan demi keamanan.');
  }

  function progressMarkup(message, percent) {
    var safe = Math.max(0, Math.min(100, Number(percent) || 0));
    return '<div role="status" aria-live="polite"><strong>' + esc(message) + '</strong>' +
      '<div style="height:6px;margin-top:7px;border-radius:999px;background:rgba(148,163,184,.3);overflow:hidden">' +
      '<span style="display:block;height:100%;width:' + safe + '%;background:currentColor;transition:width .15s ease"></span></div></div>';
  }

  function showProgress(message, percent) {
    var host = $('docUploadProgress');
    if (!host) return;
    host.classList.remove('hidden');
    host.innerHTML = progressMarkup(message, percent);
  }

  function uploadToSignedUrl(entry, label) {
    return new Promise(function (resolve, reject) {
      if (!entry.prepared || !entry.prepared.signedUrl) return reject(new Error('URL upload aman tidak tersedia.'));
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', entry.prepared.signedUrl, true);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.timeout = 120000;
      xhr.upload.onprogress = function (event) {
        if (!event.lengthComputable) return;
        var percent = 12 + Math.round((event.loaded / event.total) * 76);
        showProgress(label + ' — mengunggah langsung ' + Math.round((event.loaded / event.total) * 100) + '%', percent);
      };
      xhr.onload = function () {
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 409) {
          resolve();
          return;
        }
        var message = 'Storage menolak upload (HTTP ' + xhr.status + ').';
        try {
          var body = JSON.parse(xhr.responseText || '{}');
          message = body.message || body.error || message;
        } catch (_) {}
        reject(new Error(message));
      };
      xhr.onerror = function () { reject(new Error('Koneksi upload terputus.')); };
      xhr.ontimeout = function () { reject(new Error('Upload melewati batas waktu.')); };
      var form = new FormData();
      form.append('cacheControl', '3600');
      form.append('', entry.file);
      xhr.send(form);
    });
  }

  function prepare(entry, label) {
    if (entry.prepared) return Promise.resolve(entry.prepared);
    showProgress(label + ' — menyiapkan jalur upload aman', 6);
    var payload = Object.assign({}, entry.context, {
      name: entry.file.name,
      mimeType: entry.file.type || 'application/octet-stream',
      sizeBytes: entry.file.size
    });
    return api('prepare', payload).then(function (result) {
      if (!result.upload || !result.upload.signedUrl || !result.upload.intent) throw new Error('Server tidak mengembalikan intent upload.');
      entry.prepared = result.upload;
      return entry.prepared;
    });
  }

  function finalize(entry, label) {
    showProgress(label + ' — memverifikasi dan mencatat metadata', 94);
    return api('finalize', { intent: entry.prepared.intent }).then(function (result) {
      entry.finalized = true;
      showProgress(label + ' — selesai', 100);
      return result;
    }).catch(function (error) {
      if (/belum tersedia untuk difinalisasi/i.test(String(error && error.message || ''))) entry.uploaded = false;
      throw error;
    });
  }

  function perform(entry, index, total) {
    validateFile(entry.file);
    var label = 'File ' + (index + 1) + ' / ' + total + ' · ' + entry.file.name;
    return prepare(entry, label)
      .then(function () {
        if (entry.uploaded) return null;
        showProgress(label + ' — mulai upload langsung', 12);
        return uploadToSignedUrl(entry, label).then(function () { entry.uploaded = true; });
      })
      .then(function () { return finalize(entry, label); });
  }

  function renderFailures() {
    var host = $('docUploadProgress');
    if (!host) return;
    if (!failedUploads.length) {
      host.classList.add('hidden');
      host.innerHTML = '';
      return;
    }
    host.classList.remove('hidden');
    host.innerHTML = '<div role="alert"><strong>' + failedUploads.length + ' file belum selesai diunggah.</strong>' +
      '<div style="display:grid;gap:8px;margin-top:8px">' + failedUploads.map(function (entry, index) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
          '<span style="min-width:0"><b>' + esc(entry.file.name) + '</b><br><small>' + esc(entry.error || 'Upload gagal') +
          ' · Tujuan: ' + esc(contextLabel(entry.context)) + '</small></span>' +
          '<button type="button" class="btn btn-outline btn-sm" data-doc-retry="' + index + '">' +
          '<i class="fas fa-rotate-right"></i> Coba lagi</button></div>';
      }).join('') + '</div></div>';
  }

  function refreshList() {
    if (typeof window.clearApiReadCache === 'function') window.clearApiReadCache();
    if (typeof window.searchDocuments === 'function') window.searchDocuments();
  }

  window.uploadDocumentFiles = async function (fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var context = currentContext();
    failedUploads = [];
    var successes = 0;

    for (var i = 0; i < files.length; i += 1) {
      var entry = { file: files[i], context: Object.assign({}, context), prepared: null, uploaded: false, finalized: false, error: '' };
      try {
        await perform(entry, i, files.length);
        successes += 1;
      } catch (error) {
        entry.error = String(error && error.message || 'Upload gagal.');
        failedUploads.push(entry);
        notify('error', 'Upload gagal', entry.file.name + ' — ' + entry.error);
      }
    }

    if ($('docUploadInput')) $('docUploadInput').value = '';
    if (successes) {
      notify('success', 'Upload selesai', successes + ' file berhasil diunggah langsung ke penyimpanan aman' + (failedUploads.length ? ', ' + failedUploads.length + ' perlu dicoba lagi.' : '.'));
      refreshList();
    }
    renderFailures();
  };

  window.retryDocumentUpload = async function (index) {
    var entry = failedUploads[index];
    if (!entry || !entry.file) return;
    var host = $('docUploadProgress');
    if (host) host.querySelectorAll('[data-doc-retry]').forEach(function (button) { button.disabled = true; });
    try {
      await perform(entry, 0, 1);
      failedUploads.splice(index, 1);
      notify('success', 'Upload berhasil', entry.file.name + ' berhasil disimpan ke tujuan awal.');
      refreshList();
    } catch (error) {
      entry.error = String(error && error.message || 'Upload gagal.');
      notify('error', 'Retry gagal', entry.file.name + ' — ' + entry.error);
    } finally {
      renderFailures();
    }
  };

  window.__documentDirectUpload = {
    enabled: true,
    version: '20260906-v1',
    maxBytes: MAX_BYTES
  };
})();
