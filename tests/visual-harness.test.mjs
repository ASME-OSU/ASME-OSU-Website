import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { jobs } from './visual/jobs.mjs';
import { keyFor, localFile, ROOT } from './visual/harness.mjs';

test('snapshot keys ignore cache-busting and JSONP callback names', () => {
  assert.equal(keyFor('https://example.com/a.json?_=123&b=2#x'), keyFor('https://example.com/a.json?b=2'));
  const sheet = name => `https://docs.google.com/spreadsheets/d/x/gviz/tq?sheet=Export&tqx=${encodeURIComponent(`out:json;responseHandler:${name}`)}&_=9`;
  assert.equal(keyFor(sheet('__asmeSheet_1_a')), keyFor(sheet('__asmeSheet_2_b')));
  assert.notEqual(keyFor('https://example.com/a.css?v=1'), keyFor('https://example.com/a.css?v=2'));
});

test('published code and styles come from the working tree; data feeds stay frozen', () => {
  const pages = 'https://asme-osu.github.io/ASME-OSU-Website/';
  assert.equal(localFile(pages + 'ASME%20Custom%20CSS.min.css?v=1'), path.join(ROOT, 'ASME Custom CSS.min.css'));
  assert.equal(localFile('https://cdn.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/Footer%20Integration.js'), path.join(ROOT, 'Footer Integration.js'));
  assert.equal(localFile(pages + 'data/calendar-events.json'), null);
  assert.equal(localFile(pages + 'assets/gearly/gearly-data.json'), null);
  assert.equal(localFile(pages + '..%2Fpackage.json'), null);
  assert.equal(localFile('https://org.osu.edu/asme/'), null);
});

test('every page is covered at each width in light and dark', () => {
  const ids = jobs().map(job => job.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const width of [375, 768, 1280, 1920]) for (const scheme of ['light', 'dark']) {
    assert.ok(ids.includes(`home--${width}--${scheme}`));
    assert.ok(ids.includes(`member-points--${width}--${scheme}`));
  }
  assert.ok(jobs('menu-open').every(job => job.state && job.width === 375));
});
