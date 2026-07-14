const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'session-fix.js'), 'utf8');

function makeJwt(expSeconds) {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ exp: expSeconds, sub: 'u1' })}.sig`;
}

function createEnv(initial = {}, apiImpl) {
  const store = new Map(Object.entries(initial));
  const classList = () => ({ add() {}, remove() {} });
  const elements = {
    appContainer: { classList: classList() },
    authOverlay: { classList: classList() },
    appLoadingOverlay: { classList: classList() },
    loginError: { classList: classList(), querySelector: () => ({ textContent: '' }) }
  };
  const window = {
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    callApi: apiImpl || function (_fn, _params, ok) { ok({ success: true }); },
    checkSession: () => true,
    showLogin() {},
    currentUser: null,
    sessionExpiry: 0
  };
  const context = {
    window,
    localStorage: {
      getItem: (k) => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    document: {
      readyState: 'complete',
      addEventListener() {},
      getElementById: (id) => elements[id] || null
    },
    console,
    Error,
    Date,
    JSON,
    Math,
    String,
    Number,
    Array,
    Object,
    RegExp,
    decodeURIComponent,
    setTimeout: (fn) => { fn(); return 1; },
    setInterval: () => 1,
    clearInterval() {}
  };
  window.window = window;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, window, store };
}

const now = Math.floor(Date.now() / 1000);

// Expired JWT must never restore the dashboard session.
{
  const env = createEnv({
    sppg_jwt: makeJwt(now - 60),
    sppg_session: JSON.stringify({ user: { email: 'a@b.com' }, expiry: Date.now() + 8 * 3600000 })
  });
  assert.strictEqual(env.store.has('sppg_jwt'), false);
  assert.strictEqual(env.store.has('sppg_session'), false);
  assert.strictEqual(env.window.checkSession(), false);
}

// Valid JWT and app session remain usable, but expiry is clamped to JWT expiry.
{
  const jwtExp = now + 3600;
  const env = createEnv({
    sppg_jwt: makeJwt(jwtExp),
    sppg_session: JSON.stringify({ user: { email: 'a@b.com' }, expiry: Date.now() + 8 * 3600000 })
  });
  assert.strictEqual(env.window.checkSession(), true);
  const saved = JSON.parse(env.store.get('sppg_session'));
  assert(saved.expiry <= jwtExp * 1000 - 60000);
  assert.strictEqual(env.window.getJwtToken(), env.store.get('sppg_jwt'));
}

// Successful login response is preserved and its UI expiry is bounded by the JWT.
{
  const jwtExp = now + 3600;
  const token = makeJwt(jwtExp);
  const env = createEnv({}, function (fn, _params, ok) {
    assert.strictEqual(fn, 'loginUser');
    ok({ success: true, token, sessionExpiry: Date.now() + 8 * 3600000, user: { email: 'a@b.com' } });
  });
  let result;
  env.window.callApi('loginUser', ['a@b.com', 'secret'], (r) => { result = r; }, (e) => { throw e; });
  assert(result && result.success);
  assert(result.sessionExpiry <= jwtExp * 1000 - 60000);
  assert.strictEqual(env.store.get('sppg_jwt'), token);
}

// Authenticated API failure caused by expired JWT clears local auth state.
{
  const token = makeJwt(now + 3600);
  const env = createEnv({
    sppg_jwt: token,
    sppg_session: JSON.stringify({ user: { email: 'a@b.com' }, expiry: Date.now() + 3600000 })
  }, function (_fn, _params, _ok, fail) {
    fail(new Error('Token tidak valid atau sudah kedaluwarsa. Silakan login ulang.'));
  });
  let failed = false;
  env.window.callApi('getTransactions', [{}], () => {}, () => { failed = true; });
  assert.strictEqual(failed, true);
  assert.strictEqual(env.store.has('sppg_jwt'), false);
  assert.strictEqual(env.store.has('sppg_session'), false);
}

console.log('session-fix smoke tests: PASS');
