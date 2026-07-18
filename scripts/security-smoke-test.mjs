const required = ['SUPABASE_URL','SUPABASE_ANON_KEY','TEST_USER_EMAIL','TEST_USER_PASSWORD','TEST_ADMIN_EMAIL','TEST_ADMIN_PASSWORD','TEST_ADMIN_SPPG','TEST_ADMIN_YAYASAN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const base = process.env.SUPABASE_URL.replace(/\/$/, '');
const anon = process.env.SUPABASE_ANON_KEY;

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { throw new Error(`Invalid JSON from ${url}: HTTP ${res.status}`); }
  return { res, body };
}

async function login(email, password) {
  const { res, body } = await jsonFetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok || !body.access_token) throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
  return body.access_token;
}

async function callEdge(slug, token, fn, parameters = []) {
  return jsonFetch(`${base}/functions/v1/${slug}`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: fn, parameters })
  });
}

function unwrap(result) {
  const payload = Object.prototype.hasOwnProperty.call(result, 'result') ? result.result : result;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const userToken = await login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);
const adminToken = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);

// USER hanya boleh melihat transaksi miliknya.
{
  const { res, body } = await callEdge('transaction-action', userToken, 'getTransactions', [{ page: 1, pageSize: 100 }]);
  assert(res.ok, `USER getTransactions failed: HTTP ${res.status}`);
  const rows = unwrap(body);
  const bad = rows.filter(r => String(r.user || '').toLowerCase() !== process.env.TEST_USER_EMAIL.toLowerCase());
  assert(bad.length === 0, `USER can see ${bad.length} transaction(s) owned by another user`);
}

// ADMIN hanya boleh melihat exact pair yang ditugaskan untuk fixture ini.
{
  const { res, body } = await callEdge('transaction-action', adminToken, 'getTransactions', [{ page: 1, pageSize: 100 }]);
  assert(res.ok, `ADMIN getTransactions failed: HTTP ${res.status}`);
  const rows = unwrap(body);
  const bad = rows.filter(r => String(r.sppg || '') !== process.env.TEST_ADMIN_SPPG || String(r.yayasan || '') !== process.env.TEST_ADMIN_YAYASAN);
  assert(bad.length === 0, `ADMIN can see ${bad.length} transaction(s) outside exact SPPG + Yayasan assignment`);
}

// RPC atomik tidak boleh dapat dipanggil langsung oleh authenticated user.
{
  const { res } = await jsonFetch(`${base}/rest/v1/rpc/verify_transaction_payment_atomic`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_transaksi_id: 'SECURITY-SMOKE-NONEXISTENT',
      p_proof_id: '00000000-0000-0000-0000-000000000000',
      p_accepted: true,
      p_verified_by: process.env.TEST_USER_EMAIL,
      p_verified_name: 'Security Smoke',
      p_verification_notes: '',
      p_verifier_signature_path: null
    })
  });
  assert(res.status === 401 || res.status === 403 || res.status === 404, `Direct authenticated RPC call was not blocked: HTTP ${res.status}`);
}

// Edge Function wajib menolak request tanpa JWT.
{
  const { res } = await jsonFetch(`${base}/functions/v1/transaction-action`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getTransactions', parameters: [{}] })
  });
  assert(res.status === 401 || res.status === 403, `transaction-action accepted request without JWT: HTTP ${res.status}`);
}

console.log('Security smoke tests passed.');
