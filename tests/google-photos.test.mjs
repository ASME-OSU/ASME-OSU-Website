import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseAlbumHtml, reconcile, requestedImageUrl, validateEnumeration } from '../scripts/sync-google-photos.mjs';

const url = 'https://photos.google.com/share/demo?key=x';
const fixture = (name) => fs.readFile(path.join('tests/fixtures', name), 'utf8');

test('collector accepts bootstrap identity and an advertised complete media count', async () => {
  const album = parseAlbumHtml(await fixture('google-photos-full.html'), url);
  assert.equal(album.expectedCount, 2);
  assert.equal(album.initialCount, 2);
  const items = validateEnumeration(album, [
    { uid: 'first', posterUrl: 'https://lh3.googleusercontent.com/demo/first', width: 640, height: 480 },
    { uid: 'second', posterUrl: 'https://lh3.googleusercontent.com/demo/second', width: 640, height: 480 }
  ]);
  assert.deepEqual(items.map((item) => item.id), ['first', 'second']);
});

test('collector rejects incomplete enumeration and unavailable public responses', async () => {
  const partial = parseAlbumHtml(await fixture('google-photos-partial.html'), url);
  assert.throws(() => validateEnumeration(partial, [{ uid: 'first', posterUrl: 'https://lh3.googleusercontent.com/demo/first', width: 640, height: 480 }]), /enumerated 1 media item/);
  assert.equal(validateEnumeration(partial, [
    { uid: 'first', posterUrl: 'https://lh3.googleusercontent.com/demo/first', width: 640, height: 480 },
    { uid: 'second-page-one', posterUrl: 'https://lh3.googleusercontent.com/demo/second', width: 640, height: 480 },
    { uid: 'second-page-two', posterUrl: 'https://lh3.googleusercontent.com/demo/third', width: 640, height: 480 }
  ]).length, 3, 'a continuation result is accepted only once it reaches the bootstrap total');
  const unavailable = await fixture('google-photos-unavailable.html');
  assert.throws(() => parseAlbumHtml(unavailable, url), /expected album/);
});

test('explicit bootstrap count confirms an empty album without a synthetic marker', async () => {
  const empty = parseAlbumHtml(await fixture('google-photos-empty.html'), url);
  assert.equal(empty.expectedCount, 0);
  assert.deepEqual(validateEnumeration(empty, []), []);
});

test('reconciliation is stable by source ID and only removes managed records', async () => {
  const full = parseAlbumHtml(await fixture('google-photos-full.html'), url);
  const changed = parseAlbumHtml(await fixture('google-photos-changed.html'), url);
  const fullItems = validateEnumeration(full, [{ uid: 'first', posterUrl: 'https://lh3.googleusercontent.com/demo/first', width: 640, height: 480 }, { uid: 'second', posterUrl: 'https://lh3.googleusercontent.com/demo/second', width: 640, height: 480 }]);
  const changedItems = validateEnumeration(changed, [{ uid: 'first', posterUrl: 'https://lh3.googleusercontent.com/demo/first-new', width: 640, height: 480 }]);
  assert.deepEqual(reconcile({ items: fullItems }, fullItems), { additions: [], removals: [], unchanged: ['first', 'second'] });
  assert.deepEqual(reconcile({ items: fullItems }, changedItems), { additions: [], removals: ['second'], unchanged: ['first'] });
});

test('downloader requests a bounded full-size representation instead of the default preview', () => {
  const base = 'https://lh3.googleusercontent.com/pw/example';
  assert.equal(requestedImageUrl(base, 4000, 3000), `${base}=w2000-h2000`);
  assert.equal(requestedImageUrl(base, 512, 384), `${base}=w512-h384`);
  assert.throws(() => requestedImageUrl('https://example.com/not-google', 4000, 3000), /safe sized image URL/);
});
