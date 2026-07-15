const SESSION_SCRIPT = '<script src="/session-fix.js?v=20260715-1"></script>';
const REPORT_DOWNLOAD_SCRIPT = '<script src="/report-download.js?v=20260715-2"></script>';
const REPORT_RUNTIME_SCRIPT = '<script src="/report-runtime-fix.js?v=20260715-1"></script>';

function withSafeHtmlHeaders(response) {
  const headers = new Headers(response.headers);
  // HTML ditulis ulang oleh Worker. Header ukuran/kompresi lama harus dibuang
  // agar browser tidak menerima dokumen terpotong atau gagal diparsing.
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  return headers;
}

function injectAfterOpeningHead(html, script) {
  const match = /<head(?:\s[^>]*)?>/i.exec(html);
  if (!match) return script + '\n' + html;
  const insertAt = match.index + match[0].length;
  return html.slice(0, insertAt) + '\n' + script + '\n' + html.slice(insertAt);
}

function injectBeforeRealClosingBody(html, script) {
  // index.html memiliki teks </body> di dalam string JavaScript untuk dokumen
  // cetak. Karena itu wajib memakai kemunculan terakhir, bukan String.replace().
  const insertAt = html.toLowerCase().lastIndexOf('</body>');
  if (insertAt === -1) return html + '\n' + script + '\n';
  return html.slice(0, insertAt) + script + '\n' + html.slice(insertAt);
}

function removeLegacyReportInjection(html) {
  // Hilangkan tag hotfix Telegram lama bila pernah tertanam pada asset HTML.
  return html.replace(
    /\s*<script\b[^>]*src=["'][^"']*\/laporan-fix\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
    '\n'
  );
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) return response;

    let html = await response.text();
    html = removeLegacyReportInjection(html);

    if (!html.includes('/session-fix.js')) {
      html = injectAfterOpeningHead(html, SESSION_SCRIPT);
    }

    if (!html.includes('/report-download.js')) {
      html = injectBeforeRealClosingBody(html, REPORT_DOWNLOAD_SCRIPT);
    }
    if (!html.includes('/report-runtime-fix.js')) {
      html = injectBeforeRealClosingBody(html, REPORT_RUNTIME_SCRIPT);
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: withSafeHtmlHeaders(response)
    });
  }
};