/* SIM-SPPG Cloudflare Pages asset delivery layer. */
const version = '20260905-document-center-v6';
const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SITEKEY_FALLBACK = '0x4AAAAAAEmHZ4E7lb0zchck';

const RUNTIME_STYLES = [
  ['/assets/css/auth-modern.css', '20260904-v1'],
  ['/assets/css/ui-modern.css', '20260904-v1']
];

const NO_CACHE_SUFFIXES = [
  '/app.js',
  '/reset-password.html',
  '/assets/css/auth-modern.css',
  '/assets/css/ui-modern.css',
  '/assets/css/documents.css',
  '/assets/js/auth-recovery.js',
  '/assets/js/turnstile-login.js',
  '/assets/js/documents.js',
  '/supplier-dropdown.js',
  '/yayasan-dropdown-hotfix.js',
  '/transaction-category-supplier-rules.js',
  '/sidebar-menu-structure.js'
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store'
    }
  });
}

function injectStylesheet(html, href, assetVersion) {
  if (html.includes(href)) return html;
  return html.replace(
    '</head>',
    '<link rel="stylesheet" href="' + href + '?v=' + assetVersion + '">\n</head>'
  );
}

function isAllowedTurnstileHostname(value) {
  const hostname = String(value || '').trim().toLowerCase();
  return hostname === 'sim-sppg.pages.dev' ||
    hostname.endsWith('.sim-sppg.pages.dev') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';
}

async function readTurnstileToken(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    return String(
      body?.['cf-turnstile-response'] || body?.turnstileToken || body?.token || ''
    ).trim();
  }

  const formData = await request.formData();
  return String(
    formData.get('cf-turnstile-response') || formData.get('turnstileToken') || formData.get('token') || ''
  ).trim();
}

async function verifyLoginTurnstile(request, env) {
  if (!env.TURNSTILE_SECRET) {
    console.warn('TURNSTILE_SECRET tidak tersedia pada Cloudflare Pages environment.');
    return json({ success: false, error: 'Konfigurasi server tidak lengkap.' }, 500);
  }

  let token = '';
  try {
    token = await readTurnstileToken(request);
  } catch (error) {
    console.warn('Payload Turnstile tidak dapat dibaca:', error);
  }

  if (!token || token.length > 2048) {
    return json({
      success: false,
      error: 'Verifikasi keamanan gagal. Silakan refresh halaman dan coba lagi.'
    }, 403);
  }

  try {
    const verifyResponse = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token
      })
    });
    const result = await verifyResponse.json();

    if (!verifyResponse.ok ||
        result?.success !== true ||
        result?.action !== 'login' ||
        !isAllowedTurnstileHostname(result?.hostname)) {
      console.warn('Turnstile validation rejected:', {
        success: result?.success === true,
        action: result?.action || '',
        hostname: result?.hostname || '',
        errorCodes: Array.isArray(result?.['error-codes']) ? result['error-codes'] : []
      });
      return json({
        success: false,
        error: 'Verifikasi keamanan gagal. Silakan refresh halaman dan coba lagi.'
      }, 403);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Turnstile Siteverify gagal:', error);
    return json({
      success: false,
      error: 'Verifikasi keamanan gagal. Silakan refresh halaman dan coba lagi.'
    }, 403);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/login/turnstile') {
      if (request.method !== 'POST') {
        return json({ success: false, error: 'Method tidak didukung.' }, 405);
      }
      return verifyLoginTurnstile(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    if (!response || request.method !== 'GET') return response;

    const isHtml = url.pathname === '/' || url.pathname.endsWith('/index.html');
    const noCache = isHtml || NO_CACHE_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix));

    if (!isHtml) {
      if (!noCache) return response;
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.set('x-sim-sppg-version', version);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    const html = await response.text();
    let injected = RUNTIME_STYLES.reduce(
      (current, entry) => injectStylesheet(current, entry[0], entry[1]),
      html
    );

    if (!injected.includes('/assets/js/turnstile-login.js')) {
      const sitekey = String(env.TURNSTILE_SITEKEY || TURNSTILE_SITEKEY_FALLBACK);
      const turnstileBootstrap =
        '<script>window.__TURNSTILE_SITEKEY__=' + JSON.stringify(sitekey) + ';</script>\n' +
        '<script src="/assets/js/turnstile-login.js?v=20260904-v1"></script>\n';
      injected = injected.replace('</body>', turnstileBootstrap + '</body>');
    }

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('x-sim-sppg-version', version);
    return new Response(injected, { status: response.status, statusText: response.statusText, headers });
  }
};
