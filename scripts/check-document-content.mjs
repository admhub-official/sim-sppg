import assert from 'node:assert/strict';
import { validateDocumentContent as validate, readDocumentPrefix } from '../supabase/functions/_shared/document-content-validation.mjs';
const bytes = value => typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value);
for (const [name, mime, content] of [
  ['report.pdf', 'application/pdf', '%PDF-1.7\n'],
  ['photo.png', 'image/png', [137,80,78,71,13,10,26,10]],
  ['photo.jpg', 'image/jpeg', [255,216,255,224]],
  ['sheet.xlsx', 'application/octet-stream', [80,75,3,4]],
  ['notes.txt', 'text/plain', 'Catatan kegiatan'],
  ['old.doc', 'application/msword', [208,207,17,224,161,177,26,225]]
]) assert.doesNotThrow(() => validate(name, mime, bytes(content)), name);
for (const [name, mime, content] of [
  ['report.pdf', 'application/pdf', 'not a PDF'],
  ['picture.png', 'image/png', '%PDF-1.7'],
  ['fake.pdf', 'application/pdf', 'MZ executable'],
  ['notes.txt', 'text/plain', [127,69,76,70]],
  ['notes.txt', 'text/plain', '<!DOCTYPE html><html>'],
  ['notes.txt', 'text/plain', '#!/bin/sh'],
  ['photo.svg', 'image/svg+xml', '<svg/>'],
  ['notes.txt', 'text/plain', '<?xml version="1.0"?><svg/>'],
  ['sheet.xlsx', 'application/octet-stream', 'not a zip container'],
  ['empty.txt', 'text/plain', '']
]) assert.throws(() => validate(name, mime, bytes(content)), undefined, name);
let cancelled = false;
let calls = 0;
const prefix = await readDocumentPrefix('https://example.invalid/signed', async (url, options) => {
  assert.equal(options.headers.Range, 'bytes=0-4095');
  return { ok: true, body: { getReader: () => ({
    read: async () => { calls++; return { value: new Uint8Array(8192).fill(65), done: false }; },
    cancel: async () => { cancelled = true; }
  }) } };
});
assert.equal(prefix.length, 4096);
assert.equal(calls, 1, 'stop even if server ignores Range');
assert.ok(cancelled);
await assert.rejects(readDocumentPrefix('https://example.invalid/signed', async () => ({ ok: false })));
console.log('Content screening passed: valid signatures, disguised files, bounded reads and failed downloads.');
