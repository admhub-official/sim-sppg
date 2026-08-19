/* SIM-SPPG Cloudflare Pages asset delivery layer. */
const version = '20260819-stable-recovery-v1';

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (!response || request.method !== 'GET') return response;

    const url = new URL(request.url);
    const isHtml = url.pathname === '/' || url.pathname.endsWith('/index.html');
    const noCache =
      isHtml ||
      url.pathname.endsWith('/app.js') ||
      url.pathname.endsWith('/reset-password.html') ||
      url.pathname.endsWith('/assets/js/auth-recovery.js') ||
      url.pathname.endsWith('/assets/js/registration-flow.js') ||
      url.pathname.endsWith('/supplier-dropdown.js') ||
      url.pathname.endsWith('/yayasan-dropdown-hotfix.js') ||
      url.pathname.endsWith('/transaction-category-supplier-rules.js') ||
      url.pathname.endsWith('/sidebar-menu-structure.js');

    if (!noCache) return response;
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('x-sim-sppg-version', version);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
