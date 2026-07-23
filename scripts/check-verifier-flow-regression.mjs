import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const worker = fs.readFileSync('_worker.js', 'utf8');
const serviceWorkerVersion = serviceWorker.match(/const CACHE_VERSION = '([^']+)'/);
const indexAppVersion = index.match(/<script src="\.\/app\.js\?v=([^"]+)"><\/script>/);
const assetVersionPattern = /^\d{8}-[a-z0-9-]+-v\d+$/;
const serviceWorkerVersionPattern = /^sim-sppg-v\d{8}-[a-z0-9-]+-v\d+$/;

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const submitStart = app.indexOf('function submitVerifikasiPembayaran()');
const submitEnd = app.indexOf('function doSubmitVerifikasiPembayaran()', submitStart);
const doSubmitStart = submitEnd;
const doSubmitEnd = app.indexOf('// ============================================================\n// 12. MASTER BAHAN BAKU', doSubmitStart);

requireMatch(submitStart >= 0 && submitEnd > submitStart, 'submitVerifikasiPembayaran block must exist');
requireMatch(doSubmitStart >= 0 && doSubmitEnd > doSubmitStart, 'doSubmitVerifikasiPembayaran block must exist');

const submitBlock = app.slice(submitStart, submitEnd);
const doSubmitBlock = app.slice(doSubmitStart, doSubmitEnd);

requireMatch(app.includes("var verifTtdBase64Temp = '';"), 'temporary verifier signature state must exist');
requireMatch(submitBlock.includes("verifTtdBase64Temp = ttdCanvas.toDataURL('image/png').split(',')[1];"), 'signature must be snapshotted before nominal confirmation');
requireMatch(submitBlock.indexOf('verifTtdBase64Temp =') < submitBlock.indexOf("openModal('modalPin')"), 'signature snapshot must happen before opening nominal modal');
requireMatch(doSubmitBlock.includes("var ttdBase64 = verifTtdBase64Temp || '';"), 'submit must use preserved signature snapshot');
requireMatch(!doSubmitBlock.includes("isCanvasBlank('verifTtdCanvas')"), 'submit must not revalidate modal canvas');
requireMatch(!doSubmitBlock.includes("$('verifTtdCanvas')"), 'submit must not reread verifier canvas');
requireMatch(doSubmitBlock.includes("callApi('verifyUserPayment'"), 'submit must call verifyUserPayment');
requireMatch(doSubmitBlock.includes("verifTtdBase64Temp = '';"), 'signature snapshot must reset after success');
requireMatch(indexAppVersion && assetVersionPattern.test(indexAppVersion[1]), 'base index must retain a versioned canonical app script');
requireMatch(serviceWorkerVersion && serviceWorkerVersionPattern.test(serviceWorkerVersion[1]), 'service worker cache version must follow the release format');
requireMatch(serviceWorker.includes("fetch(request, { cache: 'no-store' })"), 'navigation and JavaScript must bypass browser cache');
requireMatch(!serviceWorker.includes('networkFirstAppWithCompatibility'), 'service worker must not patch app.js');
requireMatch(!serviceWorker.includes('uiux-fixes.js'), 'service worker must not inject retired compatibility script');
requireMatch(!serviceWorker.includes('Bukti dan TTD wajib tersedia'), 'retired combined validation must not exist');
requireMatch(!worker.includes('`<script src="./approval-flow-hotfix.js'), 'Cloudflare must not override verifier handlers');
requireMatch(!worker.includes('submitVerifikasiPembayaran =') && !worker.includes('doSubmitVerifikasiPembayaran ='), 'direct Approval runtime must not alter verifier handlers');

if (!process.exitCode) console.log('Verifier payment flow regression check passed.');
