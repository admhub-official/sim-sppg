from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

css = r'''
/* Notification Center Refresh */
.notif-item{position:relative;display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--slate-100);background:var(--white);transition:.2s ease;cursor:pointer}
.notif-item:hover{background:var(--slate-50)}
.notif-item.unread{background:linear-gradient(90deg,#eff8ff 0%,#fff 70%);box-shadow:inset 3px 0 0 var(--primary)}
.notif-item.unread:after{content:'';position:absolute;right:12px;top:15px;width:7px;height:7px;border-radius:50%;background:var(--primary)}
.notif-item-icon{width:40px;height:40px;min-width:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px}
.notif-item-icon.action-add{background:#dcfce7;color:#15803d}.notif-item-icon.action-edit{background:#fef3c7;color:#b45309}.notif-item-icon.action-delete{background:#ffe4e6;color:#be123c}
.notif-item-content{min-width:0;flex:1}.notif-item-head{display:flex;align-items:center;gap:8px;padding-right:14px;margin-bottom:5px}.notif-item-title{font-weight:700;color:var(--slate-800);font-size:13px;line-height:1.35;flex:1}.notif-action-chip{font-size:9px;font-weight:800;letter-spacing:.35px;text-transform:uppercase;padding:3px 7px;border-radius:999px;white-space:nowrap}.notif-action-chip.add{background:#dcfce7;color:#166534}.notif-action-chip.edit{background:#fef3c7;color:#92400e}.notif-action-chip.delete{background:#ffe4e6;color:#9f1239}
.notif-item-desc{font-size:12px;line-height:1.5;color:var(--slate-600);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}.notif-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:10px;color:var(--slate-400)}.notif-item-meta span{display:inline-flex;align-items:center;gap:4px}.notif-item-arrow{margin-left:auto;color:var(--slate-300)}
.notif-empty{padding:34px 18px;text-align:center;color:var(--slate-400)}.notif-empty i{font-size:28px;margin-bottom:10px}.notif-empty strong{display:block;color:var(--slate-600);font-size:13px;margin-bottom:3px}
@media(max-width:600px){#notifPanel{position:fixed!important;left:10px!important;right:10px!important;top:calc(var(--header-height) + 8px)!important;width:auto!important;max-height:calc(100dvh - var(--header-height) - 24px)!important}.notif-item{padding:13px 14px}.notif-item-icon{width:38px;height:38px;min-width:38px}}
'''
marker = '</style>'
if '/* Notification Center Refresh */' not in s:
    s = s.replace(marker, css + '\n' + marker, 1)

start = s.index('function renderNotifPanel() {')
end = s.index('\nfunction toggleNotifPanel()', start)
new_js = r'''function notifRelativeTime(raw, fallback) {
  if (!raw) return fallback || '-';
  var d = new Date(raw);
  if (isNaN(d.getTime())) return fallback || raw;
  var diff = Math.max(0, Date.now() - d.getTime());
  var min = Math.floor(diff / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return min + ' menit lalu';
  var jam = Math.floor(min / 60);
  if (jam < 24) return jam + ' jam lalu';
  var hari = Math.floor(jam / 24);
  if (hari < 7) return hari + ' hari lalu';
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

function notifActionMeta(type) {
  if (type === 'DELETE') return { cls:'delete', label:'Dihapus', iconCls:'action-delete' };
  if (type === 'EDIT') return { cls:'edit', label:'Diperbarui', iconCls:'action-edit' };
  return { cls:'add', label:'Baru', iconCls:'action-add' };
}

function notifCleanDescription(n) {
  var desc = String(n.deskripsi || '').trim();
  if (!desc || desc === '-') {
    var pageLabel = String(n.label || 'Data');
    return pageLabel + ' oleh ' + String(n.pelaku || 'pengguna');
  }
  return desc.replace(/^(ADD|EDIT|DELETE)\s+/i, '').replace(/\s+/g, ' ');
}

function renderNotifPanel() {
  var listEl = $('notifPanelList');
  if (!listEl) return;
  if (!notifList.length) {
    listEl.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><strong>Belum ada notifikasi</strong><p>Aktivitas terbaru akan muncul di sini.</p></div>';
    return;
  }
  var html = '';
  notifList.forEach(function(n, idx) {
    var meta = notifActionMeta(n.actionType);
    var actor = n.pelaku || 'Sistem';
    var timeText = notifRelativeTime(n.waktuRaw, n.waktu);
    html += '<div class="notif-item ' + (n.isRead ? '' : 'unread') + '" onclick="handleNotifClick(' + idx + ')" role="button" tabindex="0">' +
      '<div class="notif-item-icon ' + meta.iconCls + '"><i class="fas ' + esc(n.icon || 'fa-bell') + '"></i></div>' +
      '<div class="notif-item-content">' +
        '<div class="notif-item-head">' +
          '<div class="notif-item-title">' + esc(n.label || 'Aktivitas Baru') + '</div>' +
          '<span class="notif-action-chip ' + meta.cls + '">' + meta.label + '</span>' +
        '</div>' +
        '<div class="notif-item-desc">' + esc(notifCleanDescription(n)) + '</div>' +
        '<div class="notif-item-meta">' +
          '<span><i class="fas fa-user-circle"></i>' + esc(actor) + '</span>' +
          '<span title="' + esc(n.waktu || '') + '"><i class="fas fa-clock"></i>' + esc(timeText) + '</span>' +
          '<i class="fas fa-chevron-right notif-item-arrow"></i>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  listEl.innerHTML = html;
}
'''
s = s[:start] + new_js + s[end:]
p.write_text(s, encoding='utf-8')
