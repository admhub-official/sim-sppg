import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

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
requireMatch(
  submitBlock.includes("verifTtdBase64Temp = ttdCanvas.toDataURL('image/png').split(',')[1];"),
  'signature must be snapshotted before nominal confirmation'
);
requireMatch(
  submitBlock.indexOf('verifTtdBase64Temp =') < submitBlock.indexOf("openModal('modalPin')"),
  'signature snapshot must happen before opening nominal modal'
);
requireMatch(
  doSubmitBlock.includes("var ttdBase64 = verifTtdBase64Temp || '';"),
  'submit must use the preserved signature snapshot'
);
requireMatch(
  !doSubmitBlock.includes("isCanvasBlank('verifTtdCanvas')"),
  'submit must not revalidate the modal canvas after nominal confirmation'
);
requireMatch(
  !doSubmitBlock.includes("$('verifTtdCanvas')"),
  'submit must not reread verifier canvas after modal transition'
);
requireMatch(
  doSubmitBlock.includes("callApi('verifyUserPayment'"),
  'submit must call verifyUserPayment'
);
requireMatch(
  doSubmitBlock.includes("verifTtdBase64Temp = '';"),
  'signature snapshot must reset after successful verification'
);
requireMatch(
  /<script src="\.\/app\.js\?v=20260722-approval-responsive-v5"><\/script>/.test(index),
  'index must use the current frontend cache-bust key'
);

requireMatch(
  serviceWorker.includes("const CACHE_VERSION = 'sim-sppg-v20260722-approval-data-v10';"),
  'service worker cache version must invalidate stale approval bundles'
);
requireMatch(
  serviceWorker.includes("fetch(request, { cache: 'no-store' })"),
  'navigation and JavaScript must bypass the browser HTTP cache'
);
requireMatch(
  !serviceWorker.includes('networkFirstAppWithCompatibility'),
  'service worker must not patch app.js with a compatibility bundle'
);
requireMatch(
  !serviceWorker.includes('uiux-fixes.js'),
  'service worker must not inject the retired approval compatibility script'
);
requireMatch(
  !serviceWorker.includes('Bukti dan TTD wajib tersedia'),
  'retired combined proof/signature validation must not exist in the service worker path'
);

if (!process.exitCode) console.log('Verifier payment flow regression check passed.');
