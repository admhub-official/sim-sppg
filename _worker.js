const SESSION_SCRIPT = '<script src="/session-fix.js?v=20260714-3"></script>';
const REPORT_SCRIPT = '<script src="/laporan-fix.js?v=20260714-3"></script>';

function withSafeHtmlHeaders(response) {
  const headers = new Headers(response.headers);
  // Body sudah dibaca dan ditulis ulang sebagai teks; metadata kompresi/ukuran lama
  // tidak boleh dipakai lagi karena dapat membuat browser gagal mem-parsing HTML.
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  return headers;
}

function injectAfterOpeningHead(html, script) {
  const match = /<head(?:\s[^>]*)?>/i.exec(html);
  if (!match) return script + '\n' + html;
  const insertAt = match.index + match[0].length;
  return html.slice(0, insertAt) + '\n' + script + html.slice(insertAt);
}

function injectBeforeRealClosingBody(html, script) {
  // Jangan memakai String.replace(/<\/body>/i, ...): index.html mempunyai teks
  // "</body>" di dalam string JavaScript untuk dokumen cetak. replace() akan
  // memilih kemunculan pertama itu dan menyisipkan tag <script> ke tengah kode JS.
  // Kemunculan terakhir adalah tag penutup dokumen HTML yang sebenarnya.
  const lower = html.toLowerCase();
  const insertAt = lower.lastIndexOf('</body>');
  if (insertAt === -1) return html + '\n' + script;
  return html.slice(0, insertAt) + script + '\n' + html.slice(insertAt);
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) return response;

    let html = await response.text();

    // Session guard dimuat sinkron di <head>, sebelum bundle utama mencoba
    // memulihkan sesi lama. Hotfix laporan dimuat tepat sebelum </body> dokumen
    // sebenarnya, bukan pada teks </body> yang berada di dalam string JavaScript.
    if (!html.includes('/session-fix.js')) {
      html = injectAfterOpeningHead(html, SESSION_SCRIPT);
    }

    if (!html.includes('/laporan-fix.js')) {
      html = injectBeforeRealClosingBody(html, REPORT_SCRIPT);
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: withSafeHtmlHeaders(response)
    });
  }
};
