const APP_SCRIPT = '<script defer src="/assets/js/app.js?v=20260715-1"></script>';

const LEGACY_RUNTIME_PATTERN = /\s*<script\b[^>]*src=["'][^"']*\/(?:session-fix|report-download|report-runtime-fix|auth-ui-v2|auth-responsive-fix|laporan-fix)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi;

function withSafeHtmlHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  return headers;
}

function injectBeforeClosingBody(html, script) {
  const insertAt = html.toLowerCase().lastIndexOf('</body>');
  if (insertAt === -1) return html + '\n' + script + '\n';
  return html.slice(0, insertAt) + script + '\n' + html.slice(insertAt);
}

function sanitizeLegacyHtml(html) {
  return html
    .replace(LEGACY_RUNTIME_PATTERN, '\n')
    .replace(/accept=["']image<!--/gi, 'accept="image/*')
    .replace(/}\s*28px;\s*text-align:\s*center;\s*}/gi, '}');
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    let html = sanitizeLegacyHtml(await response.text());
    if (!html.includes('/assets/js/app.js')) html = injectBeforeClosingBody(html, APP_SCRIPT);

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: withSafeHtmlHeaders(response)
    });
  }
};