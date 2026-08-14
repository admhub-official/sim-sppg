import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(file, 'utf8');
const app = read('app.js');
const html = read('index.html');

function tsFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const functionRoots = [
  'transaction-action',
  'transaction-edit-action',
  'approval-payment-action',
  'operations-action',
  'reporting-action',
  'master-action',
  'file-access-action',
  'push-action',
  'push-public-action',
  'geocode-action',
  'register-user-v2',
  'auth-public-action'
].map(name => path.join('supabase', 'functions', name));

const edgeFiles = functionRoots.flatMap(tsFiles);
const source = edgeFiles.map(read).join('\n');
const registerSource = fs.existsSync('supabase/functions/register-user-v2/index.ts')
  ? read('supabase/functions/register-user-v2/index.ts')
  : '';
const authPublicSource = fs.existsSync('supabase/functions/auth-public-action/index.ts')
  ? read('supabase/functions/auth-public-action/index.ts')
  : '';

const assert = (ok, msg) => {
  if (!ok) throw new Error(msg);
};

// Canonical API routing: explicit routes only, no dynamic fallback.
assert(app.includes("'geocode-action': { geocodeAlamat:1 }"), 'geocode route is missing from API_ROUTES');
assert(app.includes("'register-user-v2': { createUserBySuperAdmin:1 }"), 'SUPER_ADMIN user creation route is missing');
assert(app.includes('API_ROUTE_BY_FUNCTION[fn] = slug'), 'central API route map is missing');
assert(app.includes('var requestUrl = API_BASE_URL + slug;'), 'callApi does not use the central route map');
assert(app.includes('Fungsi API tidak terdaftar'), 'unknown routes are not denied');
assert(!/requestUrl[^;]*SUPABASE_FN_URL/.test(app), 'request resolver still references a dynamic fallback');

// Public signup must remain physically removed, not hidden by runtime overrides.
for (const token of ['registerUser:1', 'verifyRegistrationOtp', 'resendRegistrationOtp', 'function showRegister(', 'function doRegister(']) {
  assert(!app.includes(token), `legacy public-registration token remains in app.js: ${token}`);
}
assert(!html.includes('id="registerForm"'), 'public registration form still exists in index.html');
assert(!html.includes('id="otpForm"'), 'registration OTP form still exists in index.html');
assert(html.includes('id="page-add-user"'), 'SUPER_ADMIN Add User page is missing');
assert(registerSource.includes("fn !== 'createUserBySuperAdmin'"), 'register-user-v2 accepts an unexpected action');
assert(!registerSource.includes("fn === 'registerUser'"), 'register-user-v2 still contains public registration compatibility');
assert(!authPublicSource.includes('verifyRegistrationOtp'), 'auth-public-action still contains registration OTP verification');
assert(!authPublicSource.includes('resendRegistrationOtp'), 'auth-public-action still contains registration OTP resend');

// Role/authorization guardrails.
assert(!/ROLE_MAP[\s\S]{0,500}PIC\s*:\s*['"]PIC/.test(source), 'operational position is still mapped into ROLE');
const unsafe = [...source.matchAll(/\.in\(['"]SPPG['"][^\n]*\)\.in\(['"](?:YAYASAN|NAMA YAYASAN|\\"NAMA YAYASAN\\")['"]/g)];
assert(unsafe.length === 0, `found ${unsafe.length} unsafe SPPG IN + Yayasan IN exact-pair pattern(s)`);

// Export/pagination/storage guardrails.
assert(/preparePrintDataset|_printDatasetOverride/.test(app), 'full print/export helper missing');
assert(/pageSize/.test(app) && /hasMore/.test(app), 'server pagination markers missing');
assert(/\.storage\.from\([^\)]*\)\.remove|storage\.from\([^\)]*\)\.remove|removeFiles\(/.test(source), 'storage cleanup implementation missing');

console.log(`Final hardening audit passed across ${edgeFiles.length} Edge Function source files.`);
