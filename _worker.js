/* SIM-SPPG Cloudflare Pages edge compatibility layer.
 * Ensures legacy cached HTML/app bundles receive critical approval fixes.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    if (!response || !response.ok || request.method !== 'GET') {
      return response;
    }

    // Patch the generated application bundle at delivery time. Declaring with
    // `var` is safe for classic scripts and prevents ReferenceError before the
    // Approval V2 handlers execute.
    if (url.pathname.endsWith('/app.js')) {
      const source = await response.text();
      const runtimeState = [
        'var currentTrxId = null;',
        'var pendingConfirmNominal = 0;',
        ''
      ].join('\n');
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/javascript; charset=UTF-8');
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(runtimeState + source, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    // Ensure the verification modal compatibility module is loaded even when
    // an older index.html remains in the browser or CDN cache.
    if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
      let html = await response.text();
      if (!html.includes('uiux-fixes.js')) {
        html = html.replace(
          /<script\s+src=["']\.\/app\.js[^>]*><\/script>/i,
          '<script src="./uiux-fixes.js?v=20260720-approval-runtime-fix3"></script>\n<script src="./app.js?v=20260720-approval-runtime-fix3"></script>'
        );
      }
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return response;
  }
};