(function () {
  'use strict';

  var ALLOWED_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'];

  function normalizeRole(value) {
    var role = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
    return ALLOWED_ROLES.indexOf(role) >= 0 ? role : 'USER';
  }

  function configureRoleDropdown() {
    var select = document.getElementById('editUserRole');
    var wrapper = document.getElementById('editUserRoleWrap');
    if (!select) return;

    var selected = normalizeRole(select.value);
    select.innerHTML = ALLOWED_ROLES.map(function (role) {
      var label = role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : role;
      return '<option value="' + role + '">' + label + '</option>';
    }).join('');
    select.value = selected;

    var isSuperAdmin = Boolean(window.currentUser && window.currentUser.role === 'SUPER_ADMIN');
    select.disabled = !isSuperAdmin;
    if (wrapper) wrapper.classList.toggle('hidden', !isSuperAdmin);
  }

  function install() {
    configureRoleDropdown();

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('[onclick*="openEditUserModal"], [onclick*="editUserFromDetail"]')) {
        setTimeout(configureRoleDropdown, 0);
      }
    }, true);

    var modal = document.getElementById('modalEditUser');
    if (modal && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () {
        if (!modal.classList.contains('hidden')) configureRoleDropdown();
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
