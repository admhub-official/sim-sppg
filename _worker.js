export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return response;
    }

    const html = await response.text();
    if (html.includes('/laporan-fix.js')) {
      return new Response(html, response);
    }

    const script = '<script src="/laporan-fix.js?v=20260714-1"></script>';
    const injected = html.includes('</body>')
      ? html.replace('</body>', script + '\n</body>')
      : html + script;

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');

    return new Response(injected, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
