import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fetchPhotoDescriptions, parseAlbumHtml, parsePhotoHtml, photoTitle, reconcile, requestedImageUrl, validateEnumeration } from '../scripts/sync-google-photos.mjs';

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

test('collector sorts by photo date rather than album order or add date', () => {
  const photo = (uid, imageUpdateDate, albumAddDate = 1790000000000) => ({ uid, imageUpdateDate, albumAddDate, posterUrl: `https://lh3.googleusercontent.com/${uid}`, width: 640, height: 480 });
  const items = validateEnumeration({ expectedCount: 5 }, [
    photo('undated', NaN), photo('older-new-upload', Date.parse('2026-09-02T21:36:11Z')),
    photo('newest', Date.parse('2026-09-03T21:43:15Z'), 1700000000000),
    photo('same-date', Date.parse('2026-09-03T21:43:15Z')), photo('invalid', Infinity)
  ]);
  assert.deepEqual(items.map(item => item.id), ['newest', 'same-date', 'older-new-upload', 'undated', 'invalid']);
  assert.equal(items[0].takenAt, '2026-09-03T21:43:15.000Z');
  assert.equal(items[3].takenAt, null);
  assert.deepEqual(items.map(item => item.order), [1, 2, 3, 4, 5]);
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

test('photo descriptions take precedence over stable-ID title overrides and generic fallback', () => {
  const photo = { id: 'first', description: '  Honda company visit  ' };
  assert.equal(photoTitle(photo, { first: 'Old title' }), 'Honda company visit');
  assert.equal(photoTitle({ id: 'first' }, { first: 'Bridge building' }), 'Bridge building');
  assert.equal(photoTitle({ id: 'second' }), 'ASME OSU chapter photo');
  const [item] = validateEnumeration({ expectedCount: 1 }, [{ uid: 'first', posterUrl: 'https://lh3.googleusercontent.com/demo/first', width: 640, height: 480, description: '  Chapter picnic  ' }]);
  assert.equal(item.description, 'Chapter picnic');
  assert.equal(photoTitle({ id: 'second', descriptionUnavailable: true }, {}, 'Previously published title'), 'Previously published title');
  assert.equal(photoTitle({ id: 'second', descriptionUnavailable: true }, { second: 'Older override' }, 'Previously published title'), 'Previously published title');
  assert.equal(photoTitle({ id: 'second', descriptionUnavailable: false }, {}, 'Previously published title'), 'ASME OSU chapter photo');
});

test('public photo detail description is tied to the requested album, key, and photo ID', () => {
  const album = { albumId: 'demo', authKey: 'x' };
  const detailUrl = 'https://photos.google.com/share/demo/photo/first?key=x';
  const record = Array(11).fill(null);
  record[0] = 'first';
  record[10] = { '396644657': ['  Casino Night  '] };
  const html = `<html><script>AF_initDataCallback({key: 'ds:0', data:${JSON.stringify([record, '', [], [], {}])}});</script></html>`;
  assert.equal(parsePhotoHtml(html, detailUrl, album, 'first'), 'Casino Night');
  assert.throws(() => parsePhotoHtml(html, detailUrl.replace('key=x', 'key=wrong'), album, 'first'), /expected public album/);
  assert.throws(() => parsePhotoHtml(html, detailUrl, album, 'second'), /expected public album/);
  assert.throws(() => parsePhotoHtml(html.replace('"first"', '"other"'), detailUrl, album, 'first'), /did not match/);
  delete record[10]['396644657'];
  assert.equal(parsePhotoHtml(`<script>AF_initDataCallback({key: 'ds:0', data:${JSON.stringify([record])}});</script>`, detailUrl, album, 'first'), '');
  assert.throws(() => parsePhotoHtml('<html>Sign in</html>', detailUrl, album, 'first'), /ds:0/);
});

test('description fetch keeps prior labels available after a page failure', async () => {
  const album = { albumUrl: url, albumId: 'demo', authKey: 'x' };
  const record = Array(11).fill(null);
  record[0] = 'first';
  record[10] = { '396644657': ['Casino Night'] };
  const html = `<script>AF_initDataCallback({key: 'ds:0', data:${JSON.stringify([record])}});</script>`;
  const warnings = [];
  const items = await fetchPhotoDescriptions(album, [{ id: 'first', description: '' }, { id: 'second', description: '' }], {
    fetchFn: async (page) => {
      if (page.pathname.endsWith('/second')) throw new Error('temporary outage');
      return { ok: true, url: page.href, headers: { get: () => 'text/html' }, text: async () => html };
    },
    warn: (message) => warnings.push(message)
  });
  assert.equal(items[0].description, 'Casino Night');
  assert.equal(items[0].descriptionUnavailable, false);
  assert.equal(items[1].descriptionUnavailable, true);
  assert.equal(photoTitle(items[1], {}, 'Earlier caption'), 'Earlier caption');
  assert.equal(warnings.length, 1);
});
