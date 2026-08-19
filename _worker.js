/* SIM-SPPG Cloudflare Pages asset delivery layer. */
const version = '20260819-registration-otp6-v1';

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

    if (!isHtml) {
      if (!noCache) return response;
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.set('x-sim-sppg-version', version);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    // The registration flow is maintained as one dedicated module. Inject it once
    // so the legacy inline add-user form cannot remain the active implementation.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    const html = await response.text();
    if (html.includes('assets/js/registration-flow.js')) {
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.set('x-sim-sppg-version', version);
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    }
    const injected = html.replace('</body>', '<script src="/assets/js/registration-flow.js?v=20260819-otp6"></script>\n</body>');
    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('x-sim-sppg-version', version);
    return new Response(injected, { status: response.status, statusText: response.statusText, headers });
  }
};
