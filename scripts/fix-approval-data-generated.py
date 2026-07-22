from pathlib import Path

app_path = Path('app.js')
app = app_path.read_text(encoding='utf-8')

bad = "return normalized.id ? normalized : null;\n}\n}\n\n\nfunction isApprovalQueueTransaction(tx) {"
good = "return normalized.id ? normalized : null;\n}\n\nfunction isApprovalQueueTransaction(tx) {"

if bad in app:
    app = app.replace(bad, good, 1)
elif good not in app:
    raise SystemExit('Approval normalizer boundary not found')

app_path.write_text(app, encoding='utf-8')
