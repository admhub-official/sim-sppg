import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const names = ['getRestorablePage', 'getPageFromUrl', 'syncPageUrl', 'restorePageFromHistory'];
const functions = names.map(name => {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}).join('\n');
const location = { pathname: '/', search: '?source=bookmark', hash: '#documents' };
const entries = [];
const transitions = [];
let closed = 0;
let allowed = ['dashboard', 'documents', 'transaksi'];
const context = vm.createContext({
  window: { location }, currentUser: { role: 'ADMIN' }, currentPage: 'dashboard',
  safeStorage: () => 'transaksi', getLastPageStorageKey: () => 'account',
  isPageAllowedForCurrentUser: page => allowed.includes(page),
  history: Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (state, title, url) => {
    entries.push({ method, state, url }); location.hash = url.slice(url.indexOf('#'));
  }])),
  document: { querySelectorAll: () => [{ id: 'modalEdit' }], getElementById: () => null },
  closeModal: () => closed++, closeLightbox: () => closed++, closeMobileSidebar: () => {},
  switchPage: (page, element, options) => {
    transitions.push(page); context.currentPage = page; context.syncPageUrl(page, options.replace);
  }
});
vm.runInContext(functions, context);
assert.equal(context.getRestorablePage(), 'documents', 'URL wins over saved page on refresh');
location.hash = '#users';
assert.equal(context.getRestorablePage(), 'dashboard', 'forbidden bookmark falls back');
location.hash = '#%broken';
assert.equal(context.getRestorablePage(), 'dashboard', 'malformed bookmark falls back');
location.hash = '';
assert.equal(context.getRestorablePage(), 'transaksi', 'bare URL keeps account-specific preference');
context.syncPageUrl('dashboard', true);
context.syncPageUrl('documents', false);
context.syncPageUrl('documents', false);
assert.equal(entries.length, 2, 'same-page click adds no duplicate');
assert.equal(entries[1].url, '/?source=bookmark#documents', 'query string preserved');
context.currentPage = 'documents';
location.hash = '#transaksi';
context.restorePageFromHistory();
assert.equal(transitions.at(-1), 'transaksi');
assert.equal(entries.at(-1).method, 'replaceState', 'back/forward never pushes another entry');
assert.equal(closed, 1, 'overlay closes on history transition');
context.restorePageFromHistory();
assert.equal(transitions.length, 1, 'popstate plus hashchange loads page once');
allowed = ['dashboard']; location.hash = '#documents';
context.restorePageFromHistory();
assert.equal(context.currentPage, 'dashboard', 'changed role is rechecked');
location.hash = '#access_token=secret&type=recovery';
const before = entries.length;
context.restorePageFromHistory(); context.syncPageUrl('dashboard', true);
assert.equal(entries.length, before, 'auth recovery fragment is not overwritten');
context.currentUser = null; location.hash = '#documents';
context.restorePageFromHistory();
assert.equal(entries.length, before, 'signed-out history cannot initialize protected pages');
assert.ok(source.includes("window.addEventListener('popstate', restorePageFromHistory)"));
assert.ok(source.includes("window.addEventListener('hashchange', restorePageFromHistory)"));
assert.ok(source.includes('syncPageUrl(page, navigation && navigation.replace)'));
console.log('Navigation regression passed: refresh, role access, history, overlays, auth recovery, duplicate events.');
