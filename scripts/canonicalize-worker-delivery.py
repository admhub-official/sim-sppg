from pathlib import Path

index_path = Path('index.html')
worker_path = Path('_worker.js')
index = index_path.read_text(encoding='utf-8')

# Make the still-active compatibility modules explicit in canonical HTML.
app_tag_prefix = '<script src="./app.js?'
pos = index.find(app_tag_prefix)
if pos < 0:
    raise SystemExit('canonical app.js script tag missing')
end = index.find('</script>', pos)
if end < 0:
    raise SystemExit('app.js script closing tag missing')
end += len('</script>')

explicit = (
    '\n<script src="./yayasan-dropdown-hotfix.js?v=20260811-mytrx-v2"></script>'
    '\n<script src="./transaction-category-supplier-rules.js?v=20260811-mytrx-v2"></script>'
    '\n<script src="./sidebar-menu-structure.js?v=20260811-mytrx-v2"></script>'
)
if 'src="./yayasan-dropdown-hotfix.js?' not in index:
    index = index[:end] + explicit + index[end:]

# Cloudflare worker must not rewrite HTML/JS. It only controls freshness of shell assets.
worker = '''/* SIM-SPPG Cloudflare Pages asset delivery layer.\n * Application source is served unchanged; no runtime HTML/JS patching is allowed here.\n */\nexport default {\n  async fetch(request, env) {\n    const response = await env.ASSETS.fetch(request);\n    if (!response || request.method !== 'GET') return response;\n\n    const url = new URL(request.url);\n    const noCache =\n      url.pathname === '/' ||\n      url.pathname.endsWith('/index.html') ||\n      url.pathname.endsWith('/app.js') ||\n      url.pathname.endsWith('/supplier-dropdown.js') ||\n      url.pathname.endsWith('/yayasan-dropdown-hotfix.js') ||\n      url.pathname.endsWith('/transaction-category-supplier-rules.js') ||\n      url.pathname.endsWith('/sidebar-menu-structure.js');\n\n    if (!noCache) return response;\n\n    const headers = new Headers(response.headers);\n    headers.set('cache-control', 'no-cache, no-store, must-revalidate');\n    return new Response(response.body, {\n      status: response.status,\n      statusText: response.statusText,\n      headers\n    });\n  }\n};\n'''

for required in [
    'src="./yayasan-dropdown-hotfix.js?',
    'src="./transaction-category-supplier-rules.js?',
    'src="./sidebar-menu-structure.js?',
]:
    if required not in index:
        raise SystemExit('explicit compatibility script missing: ' + required)

for retired in [
    'approvalCleanup',
    'data-approval-missing-doc-cleanup',
    'html.replace(',
    'response.text()',
    'professional-report-v1',
    'supplier-inline-create',
]:
    if retired in worker:
        raise SystemExit('worker still mutates source: ' + retired)

index_path.write_text(index, encoding='utf-8')
worker_path.write_text(worker, encoding='utf-8')
print('Worker delivery canonicalized: no runtime application source mutation remains.')
