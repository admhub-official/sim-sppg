const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anon = String(process.env.SUPABASE_ANON_KEY || '');

if (!base) {
  throw new Error('SUPABASE_URL wajib tersedia.');
}

async function request(body, authorization) {
  const headers = { 'Content-Type': 'application/json' };
  if (anon) headers.apikey = anon;
  if (authorization) headers.Authorization = authorization;
  return fetch(`${base}/functions/v1/document-upload-action`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

const preparePayload = {
  parameters: [{
    mode: 'prepare',
    name: 'security-smoke.txt',
    mimeType: 'text/plain',
    sizeBytes: 32
  }]
};

const noJwt = await request(preparePayload, '');
if (![401, 403].includes(noJwt.status)) {
  throw new Error(`Direct upload menerima request tanpa JWT: HTTP ${noJwt.status}`);
}
console.log(`✓ Direct upload menolak request tanpa JWT — HTTP ${noJwt.status}`);

if (anon) {
  const anonJwt = await request(preparePayload, `Bearer ${anon}`);
  if (![401, 403].includes(anonJwt.status)) {
    throw new Error(`Direct upload menerima anon key sebagai JWT user: HTTP ${anonJwt.status}`);
  }
  console.log(`✓ Direct upload menolak anon key sebagai JWT user — HTTP ${anonJwt.status}`);
} else {
  console.log('○ Uji anon key sebagai JWT dilewati — SUPABASE_ANON_KEY belum dikonfigurasi.');
}

console.log('Document direct-upload auth smoke: passed.');
