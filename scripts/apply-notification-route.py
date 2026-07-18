from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
needle = "  'app-config-action': { getAppConfig:1, getDropdownOptions:1 }\n"
replacement = "  'app-config-action': { getAppConfig:1, getDropdownOptions:1 },\n  'notification-dispatch-action': { dispatchNotification:1 }\n"
if "'notification-dispatch-action': { dispatchNotification:1 }" in text:
    print('notification route already present')
elif needle not in text:
    raise SystemExit('app-config route anchor not found')
else:
    path.write_text(text.replace(needle, replacement, 1), encoding='utf-8')
    print('notification route added')
