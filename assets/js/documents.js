(function () {
  'use strict';

  var state = {
    view: 'files', folderId: '', scope: null, data: null, layout: 'grid', currentFile: null,
    loading: false, dropBound: false, eventsBound: false, requestSeq: 0, page: 1, pageSize: 50
  };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (value) { var node = document.createElement('span'); node.textContent = String(value == null ? '' : value); return node.innerHTML; };
  var attr = function (value) { return esc(value).replace(/"/g, '&quot;'); };

  function api(name, payload) {
    return new Promise(function (resolve, reject) { callApi(name, [payload || {}], resolve, reject); });
  }
  function notify(type, title, message) { if (window.showToast) showToast(type, title, message); }
  function scopePayload(scope) { return scope ? { sppg: scope.sppg, yayasan: scope.yayasan } : {}; }
  function payload(extra) { return Object.assign({}, scopePayload(state.scope), extra || {}); }
  function formatSize(bytes) {
    var size = Number(bytes) || 0;
    if (size < 1024) return size + ' B';
    if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
    return (size / 1048576).toFixed(1) + ' MB';
  }
  function formatDate(value) {
    if (!value) return '-';
    try { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
    catch (_) { return String(value); }
  }
  function iconFor(file) {
    var mime = String(file.mime_type || '');
    if (mime.indexOf('image/') === 0) return 'fa-file-image doc-icon-image';
    if (mime === 'application/pdf') return 'fa-file-pdf doc-icon-pdf';
    if (mime.indexOf('video/') === 0) return 'fa-file-video doc-icon-video';
    if (mime.indexOf('audio/') === 0) return 'fa-file-audio doc-icon-audio';
    if (/word|document/.test(mime)) return 'fa-file-word doc-icon-word';
    if (/sheet|excel|csv/.test(mime)) return 'fa-file-excel doc-icon-excel';
    if (/presentation|powerpoint/.test(mime)) return 'fa-file-powerpoint doc-icon-powerpoint';
    if (mime.indexOf('text/') === 0) return 'fa-file-lines doc-icon-text';
    if (/zip|compressed|archive/.test(mime)) return 'fa-file-zipper doc-icon-zip';
    return 'fa-file doc-icon-generic';
  }

  function currentItem(type, id) {
    var rows = type === 'FOLDER' ? (state.data && state.data.folders || []) : (state.data && state.data.files || []);
    return rows.find(function (row) { return String(row.id) === String(id); }) || null;
  }

  function setLoading(active) {
    state.loading = active;
    if ($('docLoading')) $('docLoading').classList.toggle('hidden', !active);
    if ($('docItems')) $('docItems').setAttribute('aria-busy', active ? 'true' : 'false');
  }

  async function load() {
    var sequence = ++state.requestSeq;
    var snapshot = {
      view: state.view,
      folderId: state.folderId,
      scope: state.scope ? { sppg: state.scope.sppg, yayasan: state.scope.yayasan } : null,
      search: ($('docSearchInput') && $('docSearchInput').value || '').trim(),
      page: state.page,
      pageSize: state.pageSize
    };

    setLoading(true);
    if ($('docEmpty')) $('docEmpty').classList.add('hidden');

    try {
      var requestPayload = Object.assign({}, scopePayload(snapshot.scope), {
        view: snapshot.view,
        folderId: snapshot.folderId,
        search: snapshot.search,
        page: snapshot.page,
        pageSize: snapshot.pageSize
      });
      var result = await api('listDocuments', requestPayload);
      if (sequence !== state.requestSeq) return;
      state.data = result;
      if (!state.scope && result.currentScope) state.scope = result.currentScope;
      var pagination = result.pagination || {};
      if (Number(pagination.page) > 0) state.page = Number(pagination.page);
      renderScope();
      renderBreadcrumbs();
      renderItems();
      renderPagination();
      updateActions();
    } catch (error) {
      if (sequence !== state.requestSeq) return;
      state.data = null;
      if ($('docItems')) $('docItems').innerHTML = '';
      if ($('docEmpty')) {
        $('docEmpty').classList.remove('hidden');
        $('docEmpty').querySelector('h3').textContent = 'Dokumen belum dapat dimuat';
        $('docEmpty').querySelector('p').textContent = error.message || 'Silakan coba lagi.';
      }
      renderPagination();
      notify('error', 'Dokumen gagal dimuat', error.message || 'Silakan coba lagi.');
    } finally {
      if (sequence === state.requestSeq) setLoading(false);
    }
  }

  function renderScope() {
    var scopes = state.data && state.data.scopes || [];
    var select = $('docScopeSelect');
    if (!select) return;
    select.innerHTML = scopes.map(function (scope) {
      var value = encodeURIComponent(JSON.stringify(scope));
      var selected = state.scope && scope.sppg === state.scope.sppg && scope.yayasan === state.scope.yayasan ? ' selected' : '';
      return '<option value="' + attr(value) + '"' + selected + '>' + esc(scope.sppg + (scope.yayasan ? ' — ' + scope.yayasan : '')) + '</option>';
    }).join('');
    select.classList.toggle('hidden', scopes.length < 2);
    var current = state.scope || state.data.currentScope;
    if ($('docScopeCaption')) $('docScopeCaption').textContent = current && current.sppg
      ? 'Ruang kerja ' + current.sppg + (current.yayasan ? ' — ' + current.yayasan : '')
      : 'Kelola file kerja SPPG secara aman.';
  }

  function renderBreadcrumbs() {
    var host = $('docBreadcrumbs');
    if (!host) return;
    var crumbs = state.data && state.data.breadcrumbs || [];
    var rootLabel = state.view === 'templates' ? 'Template' : 'Dokumen SPPG';
    var html = '<button type="button" data-doc-folder-id=""><i class="fas fa-house"></i> ' + esc(rootLabel) + '</button>';
    crumbs.forEach(function (crumb) {
      html += '<i class="fas fa-chevron-right" aria-hidden="true"></i><button type="button" data-doc-folder-id="' + attr(crumb.id) + '">' + esc(crumb.name) + '</button>';
    });
    host.innerHTML = html;
    host.classList.toggle('hidden', ['recent', 'favorites', 'trash'].indexOf(state.view) >= 0);
  }

  function actionButton(action, item, type, icon, title, extraClass) {
    return '<button type="button" class="doc-item-action' + (extraClass ? ' ' + extraClass : '') + '" data-doc-action="' + action + '" data-doc-id="' + attr(item.id) + '" data-doc-type="' + type + '" title="' + esc(title) + '" aria-label="' + esc(title + ' ' + item.name) + '"><i class="fas ' + icon + '"></i></button>';
  }

  function itemActions(item, type) {
    if (state.view === 'trash') return actionButton('restore', item, type, 'fa-rotate-left', 'Pulihkan', 'primary');
    var useTemplate = type === 'FILE' && item.is_template ? actionButton('use-template', item, type, 'fa-copy', 'Gunakan template', 'primary') : '';
    var favorite = type === 'FILE' ? actionButton('favorite', item, type, 'fa-star', 'Favorit', item.favorite ? 'active' : '') : '';
    var immutableTemplate = item.is_template && state.data && !state.data.canManageTemplates;
    if (immutableTemplate) return useTemplate + favorite;
    return useTemplate + favorite +
      actionButton('rename', item, type, 'fa-pen', 'Ubah nama', '') +
      actionButton('trash', item, type, 'fa-trash', 'Pindahkan ke Sampah', 'danger');
  }

  function renderItems() {
    var host = $('docItems');
    if (!host) return;
    var folders = state.data && state.data.folders || [];
    var files = state.data && state.data.files || [];
    var html = '';
    folders.forEach(function (folder) {
      html += '<article class="doc-item doc-folder" tabindex="0" role="button" data-doc-open="folder" data-doc-id="' + attr(folder.id) + '">' +
        '<div class="doc-item-icon"><i class="fas fa-folder"></i></div>' +
        '<div class="doc-item-info"><strong>' + esc(folder.name) + '</strong><span>Folder' + (folder.is_template ? ' template' : '') + '</span></div>' +
        '<div class="doc-item-actions">' + itemActions(folder, 'FOLDER') + '</div></article>';
    });
    files.forEach(function (file) {
      html += '<article class="doc-item doc-file" tabindex="0" role="button" data-doc-open="file" data-doc-id="' + attr(file.id) + '">' +
        '<div class="doc-item-icon"><i class="fas ' + iconFor(file) + '"></i></div>' +
        '<div class="doc-item-info"><strong title="' + attr(file.name) + '">' + esc(file.name) + '</strong>' +
        '<span>' + esc(formatSize(file.size_bytes)) + ' · ' + esc(formatDate(file.updated_at)) + '</span>' +
        '<small>' + esc(file.classification === 'PERSONAL_DATA' ? 'Data pribadi' : file.is_template ? 'Template' : 'Dokumen internal') + '</small></div>' +
        '<div class="doc-item-actions">' + itemActions(file, 'FILE') + '</div></article>';
    });
    host.innerHTML = html;
    host.className = 'doc-items ' + state.layout;
    if ($('docEmpty')) {
      $('docEmpty').classList.toggle('hidden', !!html);
      if (!html) {
        $('docEmpty').querySelector('h3').textContent = state.view === 'favorites' ? 'Belum ada favorit' : state.view === 'trash' ? 'Sampah kosong' : 'Belum ada dokumen';
        $('docEmpty').querySelector('p').textContent = state.view === 'files' || state.view === 'templates'
          ? 'Buat folder atau upload file untuk memulai.'
          : 'Dokumen akan tampil di sini saat tersedia.';
      }
    }
  }

  function ensurePager() {
    var pager = $('docPager');
    if (pager) return pager;
    var host = $('docItems');
    if (!host || !host.parentNode) return null;
    pager = document.createElement('div');
    pager.id = 'docPager';
    pager.className = 'doc-pager';
    pager.setAttribute('aria-label', 'Navigasi halaman dokumen');
    pager.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px;flex-wrap:wrap;font-size:12px;color:var(--slate-500)';
    host.parentNode.insertBefore(pager, host.nextSibling);
    pager.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-doc-page]');
      if (!button || button.disabled) return;
      state.page = Math.max(1, Number(button.getAttribute('data-doc-page')) || 1);
      load();
    });
    return pager;
  }

  function renderPagination() {
    var pager = ensurePager();
    if (!pager) return;
    var p = state.data && state.data.pagination;
    if (!p || Number(p.totalPages || 1) <= 1) {
      pager.innerHTML = '';
      pager.classList.add('hidden');
      return;
    }
    var page = Number(p.page) || state.page;
    var pages = Math.max(1, Number(p.totalPages) || 1);
    var fileTotal = Number(p.fileTotal) || 0;
    var folderTotal = Number(p.folderTotal) || 0;
    pager.classList.remove('hidden');
    pager.innerHTML = '<span>' + esc(folderTotal + ' folder · ' + fileTotal + ' file') + '</span><div style="display:flex;align-items:center;gap:8px">' +
      '<button type="button" class="btn btn-outline btn-sm" data-doc-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="Halaman sebelumnya"><i class="fas fa-chevron-left"></i></button>' +
      '<strong>Halaman ' + page + ' / ' + pages + '</strong>' +
      '<button type="button" class="btn btn-outline btn-sm" data-doc-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + ' aria-label="Halaman berikutnya"><i class="fas fa-chevron-right"></i></button></div>';
  }

  function updateActions() {
    var templateLocked = state.view === 'templates' && state.data && !state.data.canManageTemplates;
    document.querySelectorAll('.doc-toolbar-actions .btn').forEach(function (button) {
      button.classList.toggle('hidden', templateLocked || ['recent', 'favorites', 'trash'].indexOf(state.view) >= 0);
    });
  }

  function handleItemAction(action, type, id) {
    var item = currentItem(type, id);
    if (!item) return;
    if (action === 'restore') return window.restoreDocumentItem(type, id);
    if (action === 'use-template') return window.useDocumentTemplate(id, item.name);
    if (action === 'favorite') return window.toggleDocumentFavorite(id);
    if (action === 'rename') return window.renameDocumentItem(type, id, item.name);
    if (action === 'trash') return window.trashDocumentItem(type, id);
  }

  function bindItemEvents() {
    if (state.eventsBound) return;
    state.eventsBound = true;
    if ($('docItems')) {
      $('docItems').addEventListener('click', function (event) {
        var action = event.target.closest('[data-doc-action]');
        if (action) {
          event.preventDefault();
          event.stopPropagation();
          handleItemAction(action.getAttribute('data-doc-action'), action.getAttribute('data-doc-type'), action.getAttribute('data-doc-id'));
          return;
        }
        var item = event.target.closest('[data-doc-open]');
        if (!item) return;
        var id = item.getAttribute('data-doc-id');
        if (item.getAttribute('data-doc-open') === 'folder') window.openDocumentFolder(id);
        else window.previewDocument(id);
      });
      $('docItems').addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('[data-doc-action]')) return;
        var item = event.target.closest('[data-doc-open]');
        if (!item) return;
        event.preventDefault();
        var id = item.getAttribute('data-doc-id');
        if (item.getAttribute('data-doc-open') === 'folder') window.openDocumentFolder(id);
        else window.previewDocument(id);
      });
    }
    if ($('docBreadcrumbs')) {
      $('docBreadcrumbs').addEventListener('click', function (event) {
        var button = event.target.closest('button[data-doc-folder-id]');
        if (!button) return;
        window.openDocumentFolder(button.getAttribute('data-doc-folder-id') || '');
      });
    }
  }

  function bindDropZone() {
    if (state.dropBound) return;
    var zone = document.querySelector('.doc-main'); if (!zone) return;
    state.dropBound = true;
    ['dragenter', 'dragover'].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        if (state.view === 'files' || (state.view === 'templates' && state.data && state.data.canManageTemplates)) zone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove('drag-over'); });
    });
    zone.addEventListener('drop', function (event) {
      if (state.view !== 'files' && state.view !== 'templates') return;
      if (state.view === 'templates' && state.data && !state.data.canManageTemplates) return;
      window.uploadDocumentFiles(event.dataTransfer && event.dataTransfer.files);
    });
  }

  window.initDocumentCenter = function () { bindItemEvents(); bindDropZone(); load(); };
  window.openDocumentView = function (view, button) {
    state.view = view; state.folderId = ''; state.page = 1;
    if ($('docSearchInput')) $('docSearchInput').value = '';
    document.querySelectorAll('.doc-nav').forEach(function (item) { item.classList.remove('active'); });
    if (button) button.classList.add('active');
    load();
  };
  window.openDocumentFolder = function (id) { state.folderId = id || ''; state.page = 1; load(); };
  window.changeDocumentScope = function (value) {
    try { state.scope = JSON.parse(decodeURIComponent(value)); state.folderId = ''; state.page = 1; load(); }
    catch (_) { notify('error', 'Cakupan tidak valid', 'Silakan pilih SPPG kembali.'); }
  };
  window.searchDocuments = function () { state.page = 1; load(); };
  window.toggleDocumentLayout = function () {
    state.layout = state.layout === 'grid' ? 'list' : 'grid';
    if ($('docLayoutIcon')) $('docLayoutIcon').className = 'fas ' + (state.layout === 'grid' ? 'fa-list' : 'fa-border-all');
    renderItems();
  };
  window.openDocumentCreateMenu = function () {
    if ($('docCreateForm')) $('docCreateForm').classList.add('hidden');
    var choices = document.querySelector('.doc-create-choices'); if (choices) choices.classList.remove('hidden');
    if ($('docCreateTemplate')) $('docCreateTemplate').checked = state.view === 'templates';
    openModal('modalDocumentCreate');
  };
  window.showDocumentCreateForm = function (type) {
    $('docCreateType').value = type; $('docCreateName').value = ''; $('docTextContent').value = '';
    $('docTextContentWrap').classList.toggle('hidden', type !== 'text');
    $('docTemplateOption').classList.toggle('hidden', !(state.data && state.data.canManageTemplates));
    $('docCreateTemplate').checked = state.view === 'templates';
    $('docCreateTitle').textContent = type === 'folder' ? 'Folder Baru' : 'Dokumen Baru';
    $('docCreateName').placeholder = type === 'folder' ? 'Nama folder' : 'Contoh: Notulen rapat.txt';
    document.querySelector('.doc-create-choices').classList.add('hidden'); $('docCreateForm').classList.remove('hidden'); $('docCreateName').focus();
  };
  window.submitDocumentCreate = async function () {
    var type = $('docCreateType').value; var name = $('docCreateName').value.trim();
    if (!name) return;
    var button = $('docCreateSubmit'); button.disabled = true;
    try {
      var common = payload({ name: name, folderId: state.folderId, parentId: state.folderId, isTemplate: $('docCreateTemplate').checked });
      var result = type === 'folder' ? await api('createDocumentFolder', common) : await api('createTextDocument', Object.assign(common, { content: $('docTextContent').value }));
      closeModal('modalDocumentCreate'); notify('success', 'Berhasil', result.message); state.page = 1; await load();
    } catch (error) { notify('error', 'Gagal menyimpan', error.message); }
    finally { button.disabled = false; }
  };
  window.uploadDocumentFiles = async function (fileList) {
    var files = Array.prototype.slice.call(fileList || []); if (!files.length) return;
    var progress = $('docUploadProgress'); if (progress) progress.classList.remove('hidden');
    var successes = 0; var failures = [];
    for (var i = 0; i < files.length; i += 1) {
      var file = files[i]; if (progress) progress.textContent = 'Mengunggah ' + (i + 1) + ' dari ' + files.length + ': ' + file.name;
      try {
        if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran ' + file.name + ' melebihi 15 MB.');
        var base64 = await new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await api('uploadDocument', payload({ folderId: state.folderId, name: file.name, mimeType: file.type || 'application/octet-stream', base64: base64, isTemplate: state.view === 'templates' }));
        successes += 1;
      } catch (error) {
        failures.push(file.name + ': ' + (error.message || 'gagal'));
        notify('error', 'Upload gagal', file.name + ' — ' + (error.message || 'Silakan coba lagi.'));
      }
    }
    if ($('docUploadInput')) $('docUploadInput').value = '';
    if (progress) progress.classList.add('hidden');
    if (successes) notify('success', 'Upload selesai', successes + ' file berhasil diunggah' + (failures.length ? ', ' + failures.length + ' gagal.' : '.'));
    state.page = 1; load();
  };
  window.previewDocument = async function (id) {
    $('docPreviewBody').innerHTML = '<div class="doc-loading"><i class="fas fa-spinner fa-spin"></i> Menyiapkan preview...</div>'; openModal('modalDocumentPreview');
    try {
      var result = await api('getDocumentUrl', payload({ fileId: id })); var file = result.file; state.currentFile = file;
      $('docPreviewTitle').textContent = file.name; $('docPreviewMeta').textContent = formatSize(file.size_bytes) + ' · tautan aman berlaku 10 menit';
      var url = attr(file.url), mime = String(file.mime_type || '');
      if (mime.indexOf('image/') === 0) $('docPreviewBody').innerHTML = '<img src="' + url + '" alt="' + attr(file.name) + '">';
      else if (mime === 'application/pdf') $('docPreviewBody').innerHTML = '<iframe src="' + url + '" title="' + attr(file.name) + '"></iframe>';
      else if (mime.indexOf('video/') === 0) $('docPreviewBody').innerHTML = '<video src="' + url + '" controls></video>';
      else if (mime.indexOf('audio/') === 0) $('docPreviewBody').innerHTML = '<audio src="' + url + '" controls></audio>';
      else if (mime.indexOf('text/') === 0) { var response = await fetch(file.url); $('docPreviewBody').innerHTML = '<pre>' + esc(await response.text()) + '</pre>'; }
      else $('docPreviewBody').innerHTML = '<div class="doc-preview-fallback"><i class="fas ' + iconFor(file) + '"></i><h3>Preview belum tersedia</h3><p>File tetap aman dan dapat dibuka melalui tombol Unduh.</p></div>';
    } catch (error) {
      $('docPreviewBody').innerHTML = '<div class="doc-preview-fallback"><i class="fas fa-triangle-exclamation"></i><h3>File tidak dapat dibuka</h3><p>' + esc(error.message) + '</p></div>';
    }
  };
  window.closeDocumentPreview = function () { state.currentFile = null; closeModal('modalDocumentPreview'); };
  window.downloadCurrentDocument = async function () {
    if (!state.currentFile) return;
    try { var result = await api('getDocumentUrl', payload({ fileId: state.currentFile.id, download: true })); window.open(result.file.url, '_blank', 'noopener'); }
    catch (error) { notify('error', 'Unduh gagal', error.message); }
  };
  window.renameDocumentItem = async function (type, id, oldName) {
    var name = window.prompt('Nama baru:', oldName); if (!name || name.trim() === oldName) return;
    try { await api('renameDocumentItem', payload({ entityType: type, id: id, name: name.trim() })); notify('success', 'Nama diperbarui', name.trim()); load(); }
    catch (error) { notify('error', 'Gagal mengubah nama', error.message); }
  };
  window.trashDocumentItem = async function (type, id) {
    var message = type === 'FOLDER' ? 'Pindahkan folder ini beserta seluruh file dan subfolder di dalamnya ke Sampah?' : 'Pindahkan file ini ke Sampah?';
    if (!window.confirm(message)) return;
    try { var result = await api('trashDocumentItem', payload({ entityType: type, id: id })); notify('success', 'Dipindahkan', result.message); load(); }
    catch (error) { notify('error', 'Gagal memindahkan', error.message); }
  };
  window.restoreDocumentItem = async function (type, id) {
    try { var result = await api('restoreDocumentItem', payload({ entityType: type, id: id })); notify('success', 'Dipulihkan', result.message); load(); }
    catch (error) { notify('error', 'Gagal memulihkan', error.message); }
  };
  window.toggleDocumentFavorite = async function (id) {
    try { await api('toggleDocumentFavorite', payload({ fileId: id })); load(); }
    catch (error) { notify('error', 'Favorit gagal diperbarui', error.message); }
  };
  window.useDocumentTemplate = async function (id, originalName) {
    var name = window.prompt('Nama salinan dokumen:', originalName); if (!name) return;
    try {
      var result = await api('useDocumentTemplate', payload({ fileId: id, name: name.trim() }));
      notify('success', 'Template siap digunakan', result.message);
      state.view = 'files'; state.folderId = ''; state.page = 1;
      if ($('docSearchInput')) $('docSearchInput').value = '';
      document.querySelectorAll('.doc-nav').forEach(function (item) { item.classList.toggle('active', item.getAttribute('data-doc-view') === 'files'); });
      load();
    } catch (error) { notify('error', 'Template gagal digunakan', error.message); }
  };
})();
