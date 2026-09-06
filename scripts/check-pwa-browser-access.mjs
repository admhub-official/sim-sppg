import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../assets/js/pwa-browser-access.js', import.meta.url), 'utf8');

for (const [name, source] of [['index.html', indexSource], ['app.js', appSource], ['PWA runtime', runtimeSource]]) {
  assert.doesNotMatch(source, /pwaRequirementGate|pwa-requirement-gate|handlePwaGatePrimary|recheckPwaRequirements/, `${name} must not contain the mandatory PWA gate`);
}
assert.match(indexSource, /id="btnInstallPWA"/, 'browser install action must remain in the top bar');

function runRuntime(standalone) {
  const classes = new Set(['hidden']);
  const label = { textContent: '' };
  const button = {
    classList: {
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
    },
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) { return selector === 'span' ? label : null; },
    tabIndex: 0,
    title: ''
  };
  const listeners = new Map();
  const displayMode = { matches: standalone, addEventListener() {} };
  const document = {
    hidden: false,
    referrer: '',
    addEventListener(name, handler) { listeners.set(name, handler); },
    getElementById(id) { return id === 'btnInstallPWA' ? button : null; }
  };
  const window = {
    navigator: { standalone: false },
    matchMedia() { return displayMode; },
    addEventListener(name, handler) { listeners.set(name, handler); },
    setTimeout(handler) { handler(); }
  };
  vm.runInNewContext(runtimeSource, { document, window });
  return { button, classes, label };
}

const browser = runRuntime(false);
assert.ok(browser.classes.has('show'), 'install action must be visible in a browser');
assert.ok(!browser.classes.has('hidden'), 'browser install action must not remain hidden');
assert.equal(browser.button['aria-hidden'], 'false');
assert.equal(browser.button.tabIndex, 0);

const installed = runRuntime(true);
assert.ok(installed.classes.has('hidden'), 'install action must be hidden in standalone mode');
assert.ok(!installed.classes.has('show'), 'standalone install action must not remain visible');
assert.equal(installed.button['aria-hidden'], 'true');
assert.equal(installed.button.tabIndex, -1);

const initStart = appSource.indexOf('function initApp(');
const initEnd = appSource.indexOf('\n}', initStart);
const initSource = appSource.slice(initStart, initEnd + 2);
assert.doesNotMatch(initSource, /loadUsers\(true\)|loadSuppliers\(true\)/, 'admin lists must load only when their page opens');
assert.match(appSource, /page === 'users'[\s\S]{0,180}loadUsers\(true\)/, 'users page must still load its data');
assert.match(appSource, /page === 'master-supplier'[\s\S]{0,180}loadSuppliers\(true\)/, 'supplier page must still load its data');

console.log('PWA browser access passed: no mandatory gate, browser install action visible, standalone action hidden, and admin lists deferred.');
