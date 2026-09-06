import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const host = { innerHTML: '', classList: { add() {}, remove() {} }, querySelectorAll: () => [] };
const timers = new Map();
let timerId = 0;
let rejectRequest;
let calls = 0;
const context = vm.createContext({
  window: { getJwtToken: () => 'test-session' }, AbortController,
  setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
  document: { getElementById: id => id === 'docUploadProgress' ? host : null,
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ set textContent(value) { this.innerHTML = value; } }) },
  fetch: (url, options) => {
    calls++;
    return new Promise((resolve, reject) => {
      rejectRequest = reject;
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error(), { name: 'AbortError' })));
    });
  }
});
vm.runInContext(fs.readFileSync(new URL('../assets/js/document-direct-upload.js', import.meta.url), 'utf8'), context);
const file = name => ({ name, type: 'text/plain', size: 10 });
const first = context.window.uploadDocumentFiles([file('first.txt')]);
await context.window.uploadDocumentFiles([file('overlap.txt')]);
assert.equal(calls, 1, 'overlapping uploads cannot reset the retry queue');
rejectRequest(new Error('offline')); await first;
assert.match(host.innerHTML, /first.txt/);
const second = context.window.uploadDocumentFiles([file('second.txt')]);
rejectRequest(new Error('offline')); await second;
assert.match(host.innerHTML, /first.txt/);
assert.match(host.innerHTML, /second.txt/);
const retry = context.window.retryDocumentUpload(0);
await context.window.retryDocumentUpload(0);
assert.equal(calls, 3, 'double retry starts one request');
for (const fn of timers.values()) fn();
await retry;
assert.match(host.innerHTML, /melewati batas waktu/);
assert.match(host.innerHTML, /second.txt/);
assert.equal(timers.size, 0, 'request timer cleared after failure');
console.log('Upload retry passed: retained files, overlap guard, double retry, timeout cleanup.');
