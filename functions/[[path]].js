const REPLACEMENT = `function exportApprovalPDF(data, metodeSummary, grandTotal, grandCount, pageLabel) {
  if (typeof showToast === 'function') {
    showToast('warning', 'Export PDF', 'Fitur export PDF sedang dinonaktifkan sementara setelah perbaikan parser. Gunakan export CSV.');
  }
}

function openApprovalModal(`;

function repair(source) {
  let html = source
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    .replace('<base target="_top">', '<base href="./" target="_top">')
    .replace(/<base\s+target=["']_blank["']\s*\/?>/i, '')
    .replace('href="/manifest.json"', 'href="manifest.json"')
    .replace("navigator.serviceWorker.register('/sw.js')", "navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' })")
    .replace('.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; } 28px; text-align: center; }', '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; }');

  const brokenExport = /function\s+exportApprovalPDF\s*\([\s\S]*?\n}\s*\n\s*function\s+openApprovalModal\s*\(/;
  html = html.replace(brokenExport, REPLACEMENT);

  if (!/src=["']app\.js/i.test(html)) {
    html = html.replace(/<\/body>/i, '<script src="app.js?v=12" defer><\/script></body>');
  }
  return html;
}

export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');
  headers.set('x-sim-sppg-repair', 'v12');
  return new Response(repair(await response.text()), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
