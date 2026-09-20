import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync(new URL('../Member Points Integration.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../Member Points Page.html', import.meta.url), 'utf8');
const cleanup = vm.runInNewContext(script.slice(script.indexOf('  function removeRedundantPointsCopy('), script.indexOf('  function start()')) + '; removeRedundantPointsCopy');

test('old WordPress points markup loses redundant notes without losing search or dashboard content', () => {
  const dom = new JSDOM('<div id="asmePointsApp"><input id="asmeMemberSearch" aria-describedby="asmeMemberSearchHint"><p id="asmeMemberSearchHint">101 public members searchable.</p><p class="asme-dashboard-privacy">Public totals only.</p><p class="asme-member-dashboard-state">Search your name above.</p></div>');
  const app = dom.window.document.getElementById('asmePointsApp');
  cleanup(app);
  assert.equal(app.querySelector('#asmeMemberSearchHint'), null);
  assert.equal(app.querySelector('.asme-dashboard-privacy'), null);
  assert.equal(app.querySelector('#asmeMemberSearch').hasAttribute('aria-describedby'), false);
  assert.equal(app.querySelector('.asme-member-dashboard-state').textContent, 'Search your name above.');
  dom.window.close();
});

test('new points source and dynamic captions omit nonessential microcopy', () => {
  assert.doesNotMatch(page, /asmeMemberSearchHint|asme-dashboard-privacy|Public totals only/);
  assert.doesNotMatch(script, /public members searchable|No change in the top 10|Tied point totals follow/);
  assert.match(script, /Select a row to view details/);
});
