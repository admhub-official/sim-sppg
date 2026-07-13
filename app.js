(function () {
  'use strict';

  var style = document.createElement('style');
  style.id = 'sim-sppg-runtime-fixes';
  style.textContent = [
    '.auth-container .auth-sub{color:var(--slate-400);font-size:13px;margin-bottom:24px;text-align:center;line-height:1.5}',
    '.quick-access-section{margin-bottom:24px}',
    '.stat-card{background:#fff;border-radius:20px;padding:18px 16px;display:flex;flex-direction:column;align-items:center;text-align:center}',
    '.stat-icon{width:56px;height:56px;min-width:56px;display:flex;align-items:center;justify-content:center}',
    '.notif-item{position:relative;display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--slate-100);background:var(--white);transition:.2s ease;cursor:pointer}',
    '.notif-item:hover,.notif-item:focus-visible{background:var(--slate-50);outline:none}',
    '.notif-item.unread{background:linear-gradient(90deg,#eff8ff 0%,#fff 70%);box-shadow:inset 3px 0 0 var(--primary)}',
    '.notif-item.unread:after{content:"";position:absolute;right:12px;top:15px;width:7px;height:7px;border-radius:50%;background:var(--primary)}',
    '.notif-item-icon{width:40px;height:40px;min-width:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px}',
    '.notif-item-icon.action-add{background:#dcfce7;color:#15803d}.notif-item-icon.action-edit{background:#fef3c7;color:#b45309}.notif-item-icon.action-delete{background:#ffe4e6;color:#be123c}',
    '.notif-item-content{min-width:0;flex:1}.notif-item-head{display:flex;align-items:center;gap:8px;padding-right:14px;margin-bottom:5px}',
    '.notif-item-title{font-weight:700;color:var(--slate-800);font-size:13px;line-height:1.35;flex:1}',
    '.notif-action-chip{font-size:9px;font-weight:800;letter-spacing:.35px;text-transform:uppercase;padding:3px 7px;border-radius:999px;white-space:nowrap}',
    '.notif-action-chip.add{background:#dcfce7;color:#166534}.notif-action-chip.edit{background:#fef3c7;color:#92400e}.notif-action-chip.delete{background:#ffe4e6;color:#9f1239}',
    '.notif-item-desc{font-size:12px;line-height:1.5;color:var(--slate-600);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}',
    '.notif-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:10px;color:var(--slate-400)}.notif-item-meta span{display:inline-flex;align-items:center;gap:4px}.notif-item-arrow{margin-left:auto;color:var(--slate-300)}',
    '.notif-empty{padding:34px 18px;text-align:center;color:var(--slate-400)}.notif-empty i{font-size:28px;margin-bottom:10px}.notif-empty strong{display:block;color:var(--slate-600);font-size:13px;margin-bottom:3px}',
    '@media(max-width:600px){#notifPanel{position:fixed!important;left:10px!important;right:10px!important;top:calc(var(--header-height) + 8px)!important;width:auto!important;max-height:calc(100dvh - var(--header-height) - 24px)!important}.notif-item{padding:13px 14px}.notif-item-icon{width:38px;height:38px;min-width:38px}}'
  ].join('');
  document.head.appendChild(style);

  function relativeTime(raw, fallback) {
    if (!raw) return fallback || '-';
    var date = new Date(raw);
    if (isNaN(date.getTime())) return fallback || raw;
    var diff = Math.max(0, Date.now() - date.getTime());
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return minutes + ' menit lalu';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' jam lalu';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + ' hari lalu';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function actionMeta(type) {
    if (type === 'DELETE') return { cls: 'delete', label: 'Dihapus', iconClass: 'action-delete' };
    if (type === 'EDIT') return { cls: 'edit', label: 'Diperbarui', iconClass: 'action-edit' };
    return { cls: 'add', label: 'Baru', iconClass: 'action-add' };
  }

  function actorLabel(actor) {
    var value = String(actor || 'Sistem').trim();
    return value || 'Sistem';
  }

  function description(item) {
    var value = String(item.deskripsi || '').trim();
    if (value && value !== '-') return value.replace(/^(ADD|EDIT|DELETE)\s+/i, '').replace(/\s+/g, ' ');
    return (item.label || 'Aktivitas aplikasi') + ' oleh ' + actorLabel(item.pelaku) + '.';
  }

  function setExternalLinkTargets() {
    var currentOrigin = location.origin;
    document.querySelectorAll('a[href]').forEach(function (link) {
      try {
        var url = new URL(link.getAttribute('href'), location.href);
        if (/^(https?:)$/.test(url.protocol) && url.origin !== currentOrigin) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch (_) {}
    });
  }

  function normalizeAllUsersCall() {
    if (typeof window.callApi !== 'function' || window.callApi.__allUsersFixed) return;
    var original = window.callApi;
    function wrapped(action, args) {
      var forwarded = Array.prototype.slice.call(arguments);
      if (action === 'getAllUsers' && (!Array.isArray(args) || args.length === 0)) {
        var role = window.currentUser && window.currentUser.role ? window.currentUser.role : '';
        forwarded[1] = role ? [role] : [];
      }
      return original.apply(this, forwarded);
    }
    wrapped.__allUsersFixed = true;
    window.callApi = wrapped;
  }

  function populateSppgDatalist() {
    var datalist = document.getElementById('sppgDatalist');
    if (!datalist || !Array.isArray(window.sppgList)) return;
    datalist.innerHTML = '';
    window.sppgList.forEach(function (item) {
      var value = typeof item === 'string' ? item : (item && (item.SPPG || item.nama || item.name));
      if (!value) return;
      var option = document.createElement('option');
      option.value = String(value).trim();
      datalist.appendChild(option);
    });
  }

  function validateEditUserSppg() {
    if (typeof window.saveEditUser !== 'function' || window.saveEditUser.__sppgValidated) return;
    var original = window.saveEditUser;
    function wrapped() {
      var input = document.getElementById('editUserSPPG');
      var value = input ? input.value.trim().toUpperCase() : '';
      var master = Array.isArray(window.SPPG_MASTER) ? window.SPPG_MASTER.map(function (item) { return String(item).trim().toUpperCase(); }) : [];
      if (value && master.length && master.indexOf(value) === -1) {
        if (typeof window.showToast === 'function') window.showToast('SPPG tidak terdaftar. Pilih dari daftar yang tersedia.', 'warning');
        if (input) input.focus();
        return;
      }
      return original.apply(this, arguments);
    }
    wrapped.__sppgValidated = true;
    window.saveEditUser = wrapped;
  }

  function fixNominalRaw() {
    if (typeof window.getNominalRaw !== 'function' || window.getNominalRaw.__mobileFixed) return;
    var original = window.getNominalRaw;
    function wrapped(inputOrId) {
      var result = Number(original.apply(this, arguments)) || 0;
      var input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
      if (!input && arguments.length === 0) input = document.getElementById('addTxNominal');
      if (input) {
        var parsed = Number(String(input.value || '').replace(/[^0-9]/g, '')) || 0;
        if (parsed > 0 && result !== parsed) {
          input.dataset.raw = String(parsed);
          result = parsed;
        }
      }
      return result;
    }
    wrapped.__mobileFixed = true;
    window.getNominalRaw = wrapped;
  }

  function resetVerificationMode() {
    try { verifikasiPembayaranMode = false; } catch (_) {}
  }

  function fixModalLifecycle() {
    if (typeof window.closeModal === 'function' && !window.closeModal.__verificationFixed) {
      var originalClose = window.closeModal;
      function closeWrapped(id) {
        var modalId = typeof id === 'string' ? id : (id && id.id);
        if (modalId === 'modalPin') resetVerificationMode();
        var result = originalClose.apply(this, arguments);
        requestAnimationFrame(syncBodyOverflow);
        return result;
      }
      closeWrapped.__verificationFixed = true;
      window.closeModal = closeWrapped;
    }

    if (typeof window.switchPage === 'function' && !window.switchPage.__modalFixed) {
      var originalSwitch = window.switchPage;
      function switchWrapped() {
        document.querySelectorAll('.modal').forEach(function (modal) {
          if (getComputedStyle(modal).display !== 'none' && typeof window.closeModal === 'function' && modal.id) {
            window.closeModal(modal.id);
          }
        });
        var result = originalSwitch.apply(this, arguments);
        requestAnimationFrame(syncBodyOverflow);
        return result;
      }
      switchWrapped.__modalFixed = true;
      window.switchPage = switchWrapped;
    }

    var modalPin = document.getElementById('modalPin');
    if (modalPin && !modalPin.dataset.resetBound) {
      modalPin.dataset.resetBound = '1';
      modalPin.addEventListener('click', function (event) {
        if (event.target === modalPin || event.target.closest('[data-close-modal],.modal-close,.close-modal')) resetVerificationMode();
      });
    }
  }

  function syncBodyOverflow() {
    var visibleModal = Array.prototype.some.call(document.querySelectorAll('.modal'), function (modal) {
      return getComputedStyle(modal).display !== 'none' && !modal.classList.contains('hidden');
    });
    document.body.style.overflow = visibleModal ? 'hidden' : '';
    try { _openModalCount = visibleModal ? Math.max(1, Number(_openModalCount) || 0) : 0; } catch (_) {}
  }

  function installNotificationOverride() {
    var panel = document.getElementById('notifPanelList');
    if (!panel || typeof window.$ !== 'function' || !Array.isArray(window.notifList) || typeof window.esc !== 'function') return false;
    window.renderNotifPanel = function () {
      var listEl = window.$('notifPanelList');
      if (!listEl) return;
      if (!window.notifList.length) {
        listEl.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><strong>Belum ada notifikasi</strong><p>Aktivitas penting aplikasi akan muncul di sini.</p></div>';
        return;
      }
      var html = '';
      window.notifList.forEach(function (item, index) {
        var meta = actionMeta(item.actionType);
        html += '<div class="notif-item ' + (item.isRead ? '' : 'unread') + '" onclick="handleNotifClick(' + index + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();handleNotifClick(' + index + ')}" role="button" tabindex="0" aria-label="' + window.esc(item.label || 'Notifikasi') + '">' +
          '<div class="notif-item-icon ' + meta.iconClass + '"><i class="fas ' + window.esc(item.icon || 'fa-bell') + '"></i></div>' +
          '<div class="notif-item-content"><div class="notif-item-head"><div class="notif-item-title">' + window.esc(item.label || 'Aktivitas Baru') + '</div><span class="notif-action-chip ' + meta.cls + '">' + meta.label + '</span></div>' +
          '<div class="notif-item-desc">' + window.esc(description(item)) + '</div><div class="notif-item-meta"><span><i class="fas fa-user-circle"></i>' + window.esc(actorLabel(item.pelaku)) + '</span><span title="' + window.esc(item.waktu || '') + '"><i class="fas fa-clock"></i>' + window.esc(relativeTime(item.waktuRaw, item.waktu)) + '</span><i class="fas fa-chevron-right notif-item-arrow"></i></div></div></div>';
      });
      listEl.innerHTML = html;
    };
    window.renderNotifPanel();
    return true;
  }

  var attempts = 0;
  function installFixes() {
    attempts += 1;
    setExternalLinkTargets();
    normalizeAllUsersCall();
    populateSppgDatalist();
    validateEditUserSppg();
    fixNominalRaw();
    fixModalLifecycle();
    installNotificationOverride();
    if (attempts < 40 && (typeof window.callApi !== 'function' || typeof window.switchPage !== 'function')) {
      setTimeout(installFixes, 250);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFixes, { once: true });
  else installFixes();

  new MutationObserver(function () {
    setExternalLinkTargets();
    populateSppgDatalist();
    fixModalLifecycle();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();