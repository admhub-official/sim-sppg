export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    let html = await response.text();

    html = html.replace(/[\u2028\u2029\u200B\u200C\u200D\u2060\uFEFF]/g, '');

    html = html
      .replace('<base target="_top">', '<base href="./" target="_top">')
      .replace(/<base\s+target=["']_blank["']\s*\/?>/i, '')
      .replace('href="/manifest.json"', 'href="manifest.json"')
      .replace(
        "navigator.serviceWorker.register('/sw.js')",
        "navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' })"
      )
      .replace(
        '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; } 28px; text-align: center; }',
        '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; }'
      );

    if (!html.includes('src="app.js')) {
      html = html.replace(/<\/body>/i, '<script src="app.js?v=10" defer></script></body>');
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    headers.set('x-sim-sppg-html-sanitized', 'v10');

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
