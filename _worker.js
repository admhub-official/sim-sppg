const SESSION_SCRIPT = '<script src="/session-fix.js?v=20260714-2"></script>';
const REPORT_SCRIPT = '<script src="/laporan-fix.js?v=20260714-2"></script>';

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

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) return response;

    let html = await response.text();

    // Session guard dimuat sinkron di <head>, sebelum bundle utama mencoba
    // memulihkan sesi lama. Hotfix laporan tetap dimuat paling akhir agar hanya
    // meng-override fungsi laporan setelah fungsi aslinya tersedia.
    if (!html.includes('/session-fix.js')) {
      if (/<head(?:\s[^>]*)?>/i.test(html)) {
        html = html.replace(/<head(?:\s[^>]*)?>/i, function (headTag) {
          return headTag + '\n' + SESSION_SCRIPT;
        });
      } else {
        html = SESSION_SCRIPT + '\n' + html;
      }
    }

    if (!html.includes('/laporan-fix.js')) {
      html = /<\/body>/i.test(html)
        ? html.replace(/<\/body>/i, REPORT_SCRIPT + '\n</body>')
        : html + '\n' + REPORT_SCRIPT;
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: withSafeHtmlHeaders(response)
    });
  }
};
