const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const anon = process.env.SUPABASE_ANON_KEY || '';

if (!base || !anon) {
  throw new Error('SUPABASE_URL dan SUPABASE_ANON_KEY wajib tersedia.');
}

const env = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
};

const fixtures = {
  userEmail: env('SECURITY_TEST_USER_EMAIL', 'TEST_USER_EMAIL'),
  userPassword: env('SECURITY_TEST_USER_PASSWORD', 'TEST_USER_PASSWORD'),
  adminEmail: env('SECURITY_TEST_ADMIN_EMAIL', 'TEST_ADMIN_EMAIL'),
  adminPassword: env('SECURITY_TEST_ADMIN_PASSWORD', 'TEST_ADMIN_PASSWORD'),
  adminSppg: env('SECURITY_TEST_ADMIN_SPPG', 'TEST_ADMIN_SPPG'),
  adminYayasan: env('SECURITY_TEST_ADMIN_YAYASAN', 'TEST_ADMIN_YAYASAN'),
  superEmail: env('SECURITY_TEST_SUPER_ADMIN_EMAIL'),
  superPassword: env('SECURITY_TEST_SUPER_ADMIN_PASSWORD'),
  otherUserEmail: env('SECURITY_TEST_OTHER_USER_EMAIL'),
  otherUserPassword: env('SECURITY_TEST_OTHER_USER_PASSWORD'),
  otherSppg: env('SECURITY_TEST_OTHER_SPPG'),
  otherYayasan: env('SECURITY_TEST_OTHER_YAYASAN'),
  paymentTransactionId: env('SECURITY_TEST_PAYMENT_TRANSACTION_ID'),
  paymentProofId: env('SECURITY_TEST_PAYMENT_PROOF_ID')
};

const results = [];

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  console.log(`${status === 'PASS' ? '✓' : status === 'SKIP' ? '○' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { res, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function login(email, password) {
  const { res, body } = await jsonFetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok || !body.access_token) {
    throw new Error(`Login gagal untuk ${email}: HTTP ${res.status}`);
  }
  return body.access_token;
}

async function authProfile(token) {
  const { res, body } = await jsonFetch(`${base}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }
  });
  assert(res.ok && body.id, `Auth profile gagal: HTTP ${res.status}`);
  return body;
}

async function callEdge(slug, token, fn, parameters = []) {
  return jsonFetch(`${base}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      apikey: anon,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ function: fn, parameters })
  });
}

function payload(body) {
  return Object.prototype.hasOwnProperty.call(body || {}, 'result') ? body.result : body;
}

function rows(body) {
  const value = payload(body);
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && value.result && Array.isArray(value.result.data)) return value.result.data;
  return [];
}

async function test(name, fn) {
  try {
    await fn();
    record(name, 'PASS');
  } catch (error) {
    record(name, 'FAIL', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function skip(name, reason) {
  record(name, 'SKIP', reason);
}

// Baseline tests: tidak membutuhkan akun fixture.
await test('Endpoint privat menolak request tanpa JWT', async () => {
  const { res } = await callEdge('transaction-action', '', 'getTransactions', [{}]);
  assert([401, 403].includes(res.status), `Diterima dengan HTTP ${res.status}`);
});

await test('Unknown route ditolak', async () => {
  const { res } = await callEdge('transaction-action', anon, '__security_unknown_function__', []);
  assert([401, 403, 404].includes(res.status), `Unknown route merespons HTTP ${res.status}`);
});

await test('RPC atomik tidak dapat dipanggil langsung oleh authenticated/anon client', async () => {
  const { res } = await jsonFetch(`${base}/rest/v1/rpc/verify_transaction_payment_atomic`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_transaksi_id: 'SECURITY-SMOKE-NONEXISTENT',
      p_proof_id: '00000000-0000-0000-0000-000000000000',
      p_accepted: true,
      p_verified_by: 'security-smoke@example.invalid',
      p_verified_name: 'Security Smoke',
      p_verification_notes: '',
      p_verifier_signature_path: null
    })
  });
  assert([401, 403, 404].includes(res.status), `RPC tidak diblokir: HTTP ${res.status}`);
});

const haveUser = fixtures.userEmail && fixtures.userPassword;
const haveAdmin = fixtures.adminEmail && fixtures.adminPassword && fixtures.adminSppg && fixtures.adminYayasan;

let userToken = '';
let adminToken = '';
let superToken = '';

if (haveUser) {
  await test('Login fixture USER', async () => {
    userToken = await login(fixtures.userEmail, fixtures.userPassword);
    const profile = await authProfile(userToken);
    assert(String(profile.email || '').toLowerCase() === fixtures.userEmail.toLowerCase(), 'Email token USER tidak cocok.');
  });

  await test('USER hanya melihat transaksi miliknya', async () => {
    const { res, body } = await callEdge('transaction-action', userToken, 'getTransactions', [{ page: 1, pageSize: 100 }]);
    assert(res.ok, `HTTP ${res.status}`);
    const bad = rows(body).filter((row) => String(row.user || '').toLowerCase() !== fixtures.userEmail.toLowerCase());
    assert(bad.length === 0, `USER melihat ${bad.length} transaksi milik user lain.`);
  });

  if (fixtures.adminEmail) {
    await test('USER tidak dapat menargetkan notifikasi ke email lain', async () => {
      const { res } = await callEdge('notification-dispatch-action', userToken, 'dispatchNotification', [{
        mode: 'email',
        email: fixtures.adminEmail,
        title: 'Security smoke',
        body: 'Pesan ini harus ditolak.'
      }]);
      assert([400, 403].includes(res.status), `Target lintas user diterima: HTTP ${res.status}`);
    });
  } else {
    skip('USER tidak dapat menargetkan notifikasi ke email lain', 'SECURITY_TEST_ADMIN_EMAIL belum tersedia.');
  }
} else {
  skip('Login dan isolasi USER', 'Fixture SECURITY_TEST_USER_EMAIL/PASSWORD belum tersedia.');
}

if (haveAdmin) {
  await test('Login fixture ADMIN', async () => {
    adminToken = await login(fixtures.adminEmail, fixtures.adminPassword);
    await authProfile(adminToken);
  });

  await test('ADMIN hanya melihat exact-pair assignment', async () => {
    const { res, body } = await callEdge('transaction-action', adminToken, 'getTransactions', [{ page: 1, pageSize: 100 }]);
    assert(res.ok, `HTTP ${res.status}`);
    const bad = rows(body).filter((row) =>
      String(row.sppg || '') !== fixtures.adminSppg ||
      String(row.yayasan || '') !== fixtures.adminYayasan
    );
    assert(bad.length === 0, `ADMIN melihat ${bad.length} transaksi di luar exact-pair.`);
  });

  if (fixtures.otherSppg && fixtures.otherYayasan) {
    await test('ADMIN tidak dapat mengirim notifikasi ke pair lain', async () => {
      const { res } = await callEdge('notification-dispatch-action', adminToken, 'dispatchNotification', [{
        mode: 'pair',
        sppg: fixtures.otherSppg,
        yayasan: fixtures.otherYayasan,
        title: 'Security smoke',
        body: 'Pesan lintas assignment harus ditolak.'
      }]);
      assert([400, 403].includes(res.status), `Pair lintas assignment diterima: HTTP ${res.status}`);
    });
  } else {
    skip('ADMIN tidak dapat mengirim notifikasi ke pair lain', 'Fixture OTHER_SPPG/OTHER_YAYASAN belum tersedia.');
  }
} else {
  skip('Login dan exact-pair ADMIN', 'Fixture SECURITY_TEST_ADMIN_* belum lengkap.');
}

if (fixtures.superEmail && fixtures.superPassword) {
  await test('Login fixture SUPER_ADMIN', async () => {
    superToken = await login(fixtures.superEmail, fixtures.superPassword);
    await authProfile(superToken);
  });

  await test('SUPER_ADMIN dapat membaca daftar user', async () => {
    const { res } = await callEdge('operations-action', superToken, 'getAllUsers', [{ page: 1, pageSize: 5 }]);
    assert(res.ok, `HTTP ${res.status}`);
  });
} else {
  skip('Login dan akses SUPER_ADMIN', 'Fixture SECURITY_TEST_SUPER_ADMIN_* belum tersedia.');
}

if (fixtures.otherUserEmail && fixtures.otherUserPassword) {
  await test('Login fixture USER pair lain', async () => {
    const token = await login(fixtures.otherUserEmail, fixtures.otherUserPassword);
    await authProfile(token);
  });
} else {
  skip('Fixture USER pair lain', 'SECURITY_TEST_OTHER_USER_* belum tersedia.');
}

if (adminToken && fixtures.paymentTransactionId && fixtures.paymentProofId) {
  await test('Verifikasi pembayaran ganda ditolak', async () => {
    const args = [fixtures.paymentTransactionId, fixtures.paymentProofId, true, 'Security smoke', '', null];
    const first = await callEdge('transaction-action', adminToken, 'verifyUserPayment', args);
    const second = await callEdge('transaction-action', adminToken, 'verifyUserPayment', args);
    assert(first.res.ok || [400, 409].includes(first.res.status), `Percobaan pertama tak terduga: HTTP ${first.res.status}`);
    assert([400, 409].includes(second.res.status), `Verifikasi ganda tidak ditolak: HTTP ${second.res.status}`);
  });
} else {
  skip('Verifikasi pembayaran ganda ditolak', 'Fixture transaction/proof ID belum tersedia.');
}

const failed = results.filter((item) => item.status === 'FAIL');
const passed = results.filter((item) => item.status === 'PASS');
const skipped = results.filter((item) => item.status === 'SKIP');
console.log(`\nSecurity smoke summary: ${passed.length} passed, ${skipped.length} skipped, ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
