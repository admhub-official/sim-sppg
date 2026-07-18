from pathlib import Path
import re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

state_old = "var notifList = [];\nvar notifPollTimer = null;"
state_new = "var notifList = [];\nvar notifPollTimer = null;\nvar notifPage = 1, notifPageSize = 15, notifServerTotal = 0, notifServerPaged = false, notifHasMore = false;\nvar notifLoadingMore = false;"
if 'notifServerPaged' not in s:
    if state_old not in s:
        raise SystemExit('notification state anchor not found')
    s = s.replace(state_old, state_new, 1)

load_pattern = re.compile(r"function loadNotifications\(\) \{.*?\n\}", re.S)
load_new = r'''function loadNotifications(page, append) {
  if (!currentUser) return;
  page = Math.max(1, Number(page) || 1);
  append = !!append;
  if (append && notifLoadingMore) return;
  if (append) notifLoadingMore = true;
  callApi('getNotifications', [{ page: page, pageSize: notifPageSize }], function(result) {
    notifLoadingMore = false;
    if (result && result.success) {
      var incoming = Array.isArray(result.data) ? result.data : [];
      notifServerPaged = Number(result.page) > 0;
      notifPage = notifServerPaged ? Number(result.page || page) : 1;
      notifServerTotal = notifServerPaged ? Number(result.total || incoming.length) : incoming.length;
      notifHasMore = notifServerPaged ? !!result.hasMore : false;
      if (append) {
        var existing = {};
        notifList.forEach(function(n) { existing[String(n.logId || '')] = true; });
        incoming.forEach(function(n) {
          var key = String(n.logId || '');
          if (!existing[key]) { notifList.push(n); existing[key] = true; }
        });
      } else {
        notifList = incoming;
      }
      var unreadCount = Number(result.unreadCount || 0);
      renderNotifBadge(unreadCount);
      renderNotifPanel();
      if (!append && _lastUnreadCount !== null && unreadCount > _lastUnreadCount) playNotifSound();
      if (!append) _lastUnreadCount = unreadCount;
    }
  }, function() {
    notifLoadingMore = false;
    renderNotifPanel();
  });
}'''
if 'function loadNotifications(page, append)' not in s:
    s, count = load_pattern.subn(load_new, s, count=1)
    if count != 1:
        raise SystemExit('loadNotifications function not found')

# Polling and panel-open always refresh first page.
s = s.replace('notifPollTimer = setInterval(loadNotifications, 60000);', "notifPollTimer = setInterval(function(){ loadNotifications(1, false); }, 60000);")
s = s.replace('  loadNotifications();\n  if (notifPollTimer)', '  loadNotifications(1, false);\n  if (notifPollTimer)', 1)
s = s.replace('  if (willOpen) loadNotifications();', '  if (willOpen) loadNotifications(1, false);')

# Add load-more control at the bottom of the notification panel.
render_anchor = "  listEl.innerHTML = html;\n}\n\nfunction toggleNotifPanel()"
render_replacement = "  if (notifServerPaged && notifHasMore) {\n    html += '<button type=\"button\" class=\"notif-load-more\" onclick=\"event.stopPropagation();loadMoreNotifications()\" ' + (notifLoadingMore ? 'disabled' : '') + '>' +\n      (notifLoadingMore ? '<i class=\"fas fa-circle-notch fa-spin\"></i> Memuat...' : '<i class=\"fas fa-chevron-down\"></i> Muat lebih banyak') +\n      '</button>';\n  }\n  listEl.innerHTML = html;\n}\n\nfunction loadMoreNotifications() {\n  if (!notifHasMore || notifLoadingMore) return;\n  loadNotifications(notifPage + 1, true);\n}\n\nfunction toggleNotifPanel()"
if 'function loadMoreNotifications()' not in s:
    if render_anchor not in s:
        raise SystemExit('renderNotifPanel anchor not found')
    s = s.replace(render_anchor, render_replacement, 1)

# Fallback reloads should refresh first page.
s = s.replace('loadNotifications(); // fallback: reload jika gagal', 'loadNotifications(1, false); // fallback: reload jika gagal')
s = s.replace('      loadNotifications();\n', '      loadNotifications(1, false);\n')

for token in [
    'notifServerPaged',
    "getNotifications', [{ page: page, pageSize: notifPageSize }]",
    'function loadMoreNotifications()',
    'notifHasMore'
]:
    if token not in s:
        raise SystemExit('validation failed: ' + token)

p.write_text(s, encoding='utf-8')
