(function () {
  'use strict';

  var state = { view: 'files', folderId: '', scope: null, data: null, layout: 'grid', currentFile: null, loading: false, dropBound: false };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (value) { var node = document.createElement('span'); node.textContent = String(value == null ? '' : value); return node.innerHTML; };
  var attr = function (value) { return esc(value).replace(/"/g, '&quot;'); };

  function api(name, payload) {
    return new Promise(function (resolve, reject) { callApi(name, [payload || {}], resolve, reject); });
  }
  function notify(type, title, message) { if (window.showToast) showToast(type, title, message); }
  function scopePayload() { return state.scope ? { sppg: state.scope.sppg, yayasan: state.scope.yayasan } : {}; }
  function payload(extra) { return Object.assign({}, scopePayload(), extra || {}); }
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

  async function load() {
    if (state.loading) return;
    state.loading = true;
    $('docLoading').classList.remove('hidden');
    $('docItems').classList.add('hidden');
    $('docEmpty').classList.add('hidden');
    try {
      var search = ($('docSearchInput').value || '').trim();
      state.data = await api('listDocuments', payload({ view: state.view, folderId: state.folderId, search: search }));
      if (!state.scope && state.data.currentScope) state.scope = state.data.currentScope;
      renderScope(); renderBreadcrumbs(); renderItems(); updateActions();
    } catch (error) {
      notify('error', 'Dokumen gagal dimuat', error.message || 'Silakan coba lagi.');
      $('docEmpty').classList.remove('hidden');
      $('docEmpty').querySelector('h3').textContent = 'Dokumen belum dapat dimuat';
      $('docEmpty').querySelector('p').textContent = error.message || 'Silakan coba lagi.';
    } finally {
      state.loading = false;
      $('docLoading').classList.add('hidden');
      $('docItems').classList.remove('hidden');
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
    $('docScopeCaption').textContent = current && current.sppg ? 'Ruang kerja ' + current.sppg + (current.yayasan ? ' — ' + current.yayasan : '') : 'Kelola file kerja SPPG secara aman.';
  }

  function renderBreadcrumbs() {
    var crumbs = state.data && state.data.breadcrumbs || [];
    var rootLabel = state.view === 'templates' ? 'Template' : 'Dokumen SPPG';
    var html = '<button onclick="openDocumentFolder(\'\')"><i class="fas fa-house"></i> ' + esc(rootLabel) + '</button>';
    crumbs.forEach(function (crumb) { html += '<i class="fas fa-chevron-right"></i><button onclick="openDocumentFolder(\'' + attr(crumb.id) + '\')">' + esc(crumb.name) + '</button>'; });
    $('docBreadcrumbs').innerHTML = html;
    $('docBreadcrumbs').classList.toggle('hidden', ['recent', 'favorites', 'trash'].indexOf(state.view) >= 0);
  }

  function itemActions(item, type) {
    if (state.view === 'trash') return '<button class="doc-item-action primary" title="Pulihkan" onclick="event.stopPropagation();restoreDocumentItem(\'' + type + '\',\'' + attr(item.id) + '\')"><i class="fas fa-rotate-left"></i></button>';
    var useTemplate = type === 'FILE' && item.is_template ? '<button class="doc-item-action primary" title="Gunakan template" onclick="event.stopPropagation();useDocumentTemplate(\'' + attr(item.id) + '\',\'' + attr(item.name) + '\')"><i class="fas fa-copy"></i></button>' : '';
    var favorite = type === 'FILE' ? '<button class="doc-item-action' + (item.favorite ? ' active' : '') + '" title="Favorit" onclick="event.stopPropagation();toggleDocumentFavorite(\'' + attr(item.id) + '\')"><i class="fas fa-star"></i></button>' : '';
    var immutableTemplate = item.is_template && state.data && !state.data.canManageTemplates;
    if (immutableTemplate) return useTemplate + favorite;
    return useTemplate + favorite + '<button class="doc-item-action" title="Ubah nama" onclick="event.stopPropagation();renameDocumentItem(\'' + type + '\',\'' + attr(item.id) + '\',\'' + attr(item.name) + '\')"><i class="fas fa-pen"></i></button><button class="doc-item-action danger" title="Pindahkan ke Sampah" onclick="event.stopPropagation();trashDocumentItem(\'' + type + '\',\'' + attr(item.id) + '\')"><i class="fas fa-trash"></i></button>';
  }

  function renderItems() {
    var folders = state.data && state.data.folders || [];
    var files = state.data && state.data.files || [];
    var html = '';
    folders.forEach(function (folder) {
      html += '<article class="doc-item doc-folder" tabindex="0" onclick="openDocumentFolder(\'' + attr(folder.id) + '\')" onkeydown="if(event.key===\'Enter\')openDocumentFolder(\'' + attr(folder.id) + '\')"><div class="doc-item-icon"><i class="fas fa-folder"></i></div><div class="doc-item-info"><strong>' + esc(folder.name) + '</strong><span>Folder' + (folder.is_template ? ' template' : '') + '</span></div><div class="doc-item-actions">' + itemActions(folder, 'FOLDER') + '</div></article>';
    });
    files.forEach(function (file) {
      html += '<article class="doc-item doc-file" tabindex="0" onclick="previewDocument(\'' + attr(file.id) + '\')" onkeydown="if(event.key===\'Enter\')previewDocument(\'' + attr(file.id) + '\')"><div class="doc-item-icon"><i class="fas ' + iconFor(file) + '"></i></div><div class="doc-item-info"><strong title="' + attr(file.name) + '">' + esc(file.name) + '</strong><span>' + esc(formatSize(file.size_bytes)) + ' · ' + esc(formatDate(file.updated_at)) + '</span><small>' + esc(file.classification === 'PERSONAL_DATA' ? 'Data pribadi' : file.is_template ? 'Template' : 'Dokumen internal') + '</small></div><div class="doc-item-actions">' + itemActions(file, 'FILE') + '</div></article>';
    });
    $('docItems').innerHTML = html;
    $('docItems').className = 'doc-items ' + state.layout;
    $('docEmpty').classList.toggle('hidden', !!html);
    if (!html) {
      $('docEmpty').querySelector('h3').textContent = state.view === 'favorites' ? 'Belum ada favorit' : state.view === 'trash' ? 'Sampah kosong' : 'Belum ada dokumen';
      $('docEmpty').querySelector('p').textContent = state.view === 'files' || state.view === 'templates' ? 'Buat folder atau upload file untuk memulai.' : 'Dokumen akan tampil di sini saat tersedia.';
    }
  }

  function updateActions() {
    var templateLocked = state.view === 'templates' && state.data && !state.data.canManageTemplates;
    document.querySelectorAll('.doc-toolbar-actions .btn').forEach(function (button) { button.classList.toggle('hidden', templateLocked || ['recent', 'favorites', 'trash'].indexOf(state.view) >= 0); });
  }

  function bindDropZone() {
    if (state.dropBound) return;
    var zone = document.querySelector('.doc-main'); if (!zone) return;
    state.dropBound = true;
    ['dragenter', 'dragover'].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); if (state.view === 'files' || (state.view === 'templates' && state.data && state.data.canManageTemplates)) zone.classList.add('drag-over'); }); });
    ['dragleave', 'drop'].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove('drag-over'); }); });
    zone.addEventListener('drop', function (event) {
      if (state.view !== 'files' && state.view !== 'templates') return;
      if (state.view === 'templates' && state.data && !state.data.canManageTemplates) return;
      window.uploadDocumentFiles(event.dataTransfer && event.dataTransfer.files);
    });
  }
  window.initDocumentCenter = function () { bindDropZone(); load(); };
  window.openDocumentView = function (view, button) {
    state.view = view; state.folderId = ''; $('docSearchInput').value = '';
    document.querySelectorAll('.doc-nav').forEach(function (item) { item.classList.remove('active'); });
    if (button) button.classList.add('active');
    load();
  };
  window.openDocumentFolder = function (id) { state.folderId = id || ''; load(); };
  window.changeDocumentScope = function (value) {
    try { state.scope = JSON.parse(decodeURIComponent(value)); state.folderId = ''; load(); }
    catch (_) { notify('error', 'Cakupan tidak valid', 'Silakan pilih SPPG kembali.'); }
  };
  window.searchDocuments = function () { load(); };
  window.toggleDocumentLayout = function () {
    state.layout = state.layout === 'grid' ? 'list' : 'grid';
    $('docLayoutIcon').className = 'fas ' + (state.layout === 'grid' ? 'fa-list' : 'fa-border-all');
    renderItems();
  };
  window.openDocumentCreateMenu = function () {
    $('docCreateForm').classList.add('hidden'); document.querySelector('.doc-create-choices').classList.remove('hidden');
    $('docCreateTemplate').checked = state.view === 'templates'; openModal('modalDocumentCreate');
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
      closeModal('modalDocumentCreate'); notify('success', 'Berhasil', result.message); await load();
    } catch (error) { notify('error', 'Gagal menyimpan', error.message); }
    finally { button.disabled = false; }
  };
  window.uploadDocumentFiles = async function (fileList) {
    var files = Array.prototype.slice.call(fileList || []); if (!files.length) return;
    var progress = $('docUploadProgress'); progress.classList.remove('hidden');
    for (var i = 0; i < files.length; i += 1) {
      var file = files[i]; progress.textContent = 'Mengunggah ' + (i + 1) + ' dari ' + files.length + ': ' + file.name;
      try {
        if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran ' + file.name + ' melebihi 15 MB.');
        var base64 = await new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(String(reader.result).split(',')[1]); }; reader.onerror = reject; reader.readAsDataURL(file); });
        await api('uploadDocument', payload({ folderId: state.folderId, name: file.name, mimeType: file.type || 'application/octet-stream', base64: base64, isTemplate: state.view === 'templates' }));
      } catch (error) { notify('error', 'Upload gagal', error.message); }
    }
    $('docUploadInput').value = ''; progress.classList.add('hidden'); notify('success', 'Upload selesai', files.length + ' file telah diproses.'); load();
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
    } catch (error) { $('docPreviewBody').innerHTML = '<div class="doc-preview-fallback"><i class="fas fa-triangle-exclamation"></i><h3>File tidak dapat dibuka</h3><p>' + esc(error.message) + '</p></div>'; }
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
    if (!window.confirm('Pindahkan item ini ke Sampah?')) return;
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
      state.view = 'files'; state.folderId = ''; $('docSearchInput').value = '';
      document.querySelectorAll('.doc-nav').forEach(function (item) { item.classList.toggle('active', item.getAttribute('data-doc-view') === 'files'); });
      load();
    } catch (error) { notify('error', 'Template gagal digunakan', error.message); }
  };
})();
