const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anon = String(process.env.SUPABASE_ANON_KEY || '');

if (!base || !anon) {
  throw new Error('SUPABASE_URL dan SUPABASE_ANON_KEY wajib tersedia.');
}

async function request(body, authorization) {
  const headers = {
    apikey: anon,
    'Content-Type': 'application/json'
  };
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(`${base}/functions/v1/document-upload-action`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return response;
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

const anonJwt = await request(preparePayload, `Bearer ${anon}`);
if (![401, 403].includes(anonJwt.status)) {
  throw new Error(`Direct upload menerima anon key sebagai JWT user: HTTP ${anonJwt.status}`);
}
console.log(`✓ Direct upload menolak anon key sebagai JWT user — HTTP ${anonJwt.status}`);

console.log('Document direct-upload auth smoke: passed.');
