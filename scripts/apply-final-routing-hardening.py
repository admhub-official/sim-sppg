from pathlib import Path

source = Path('app.js').read_text(encoding='utf-8')
required = [
    'var API_ROUTES = {',
    "'geocode-action': { geocodeAlamat:1 }",
    'var API_ROUTE_BY_FUNCTION = {};',
    'API_ROUTE_BY_FUNCTION[fn] = slug',
    'var requestUrl = API_BASE_URL + slug;',
    'Fungsi API tidak terdaftar',
]

missing = [token for token in required if token not in source]
if missing:
    raise SystemExit('central API router is incomplete: ' + ', '.join(missing))

for retired in ('var GEOCODE_FN_URL', 'var GEOCODE_FN =', 'SUPABASE_FN_URL'):
    if retired in source:
        raise SystemExit(f'retired route token is still present: {retired}')

print('central API routing is already hardened; no source patch required')
