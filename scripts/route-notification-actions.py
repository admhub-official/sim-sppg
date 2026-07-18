from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
old = "getFilterOptions:1, getAuditLog:1, getNotifications:1"
new = "getFilterOptions:1, getAuditLog:1, getNotifications:1,\n  markNotificationRead:1, markAllNotificationsRead:1"

if new in text:
    print('Notification action routes already present.')
elif old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print('Notification action routes added.')
else:
    raise SystemExit('REPORTING_FN route anchor not found.')
