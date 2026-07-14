const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const sourceHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workerSource = fs.readFileSync(path.join(root, '_worker.js'), 'utf8');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-sppg-worker-'));
  const workerPath = path.join(tempDir, 'worker.mjs');
  fs.writeFileSync(workerPath, workerSource);

  const workerModule = await import(pathToFileURL(workerPath).href);
  const env = {
    ASSETS: {
      async fetch() {
        return new Response(sourceHtml, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=UTF-8',
            'content-length': String(Buffer.byteLength(sourceHtml)),
            'content-encoding': 'gzip',
            'etag': 'test-etag'
          }
        });
      }
    }
  };

  const response = await workerModule.default.fetch(
    new Request('https://example.test/?page=transaksi'),
    env
  );
  const rewritten = await response.text();

  const reportScript = '<script src="/laporan-fix.js?v=20260714-3"></script>';
  const sessionScript = '<script src="/session-fix.js?v=20260714-3"></script>';
  const reportAt = rewritten.indexOf(reportScript);
  const realBodyAt = rewritten.toLowerCase().lastIndexOf('</body>');
  const printHtmlStringAt = rewritten.indexOf("'</body></html>';");

  assert(rewritten.includes(sessionScript), 'Session guard tidak diinjeksi.');
  assert(reportAt >= 0, 'Laporan hotfix tidak diinjeksi.');
  assert(realBodyAt >= 0, 'Tag </body> dokumen tidak ditemukan.');
  assert(reportAt > printHtmlStringAt, 'Laporan hotfix masuk ke string JavaScript dokumen cetak.');
  assert(reportAt < realBodyAt, 'Laporan hotfix tidak berada sebelum </body> dokumen sebenarnya.');
  assert(response.headers.get('content-length') === null, 'content-length lama masih dipertahankan.');
  assert(response.headers.get('content-encoding') === null, 'content-encoding lama masih dipertahankan.');
  assert(response.headers.get('etag') === null, 'etag lama masih dipertahankan.');

  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let inlineIndex = 0;
  while ((match = scriptPattern.exec(rewritten))) {
    if (/\bsrc\s*=/i.test(match[1] || '')) continue;
    inlineIndex += 1;
    const scriptPath = path.join(tempDir, `inline-${inlineIndex}.js`);
    fs.writeFileSync(scriptPath, match[2]);
    const checked = spawnSync(process.execPath, ['--check', scriptPath], {
      encoding: 'utf8'
    });
    assert(
      checked.status === 0,
      `Inline script ${inlineIndex} tidak valid:\n${checked.stderr || checked.stdout}`
    );
  }

  assert(inlineIndex >= 3, 'Jumlah inline script yang diperiksa tidak sesuai.');
  console.log(`Worker injection smoke test passed; ${inlineIndex} inline scripts valid.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
