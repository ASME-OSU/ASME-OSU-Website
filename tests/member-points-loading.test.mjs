import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const page = fs.readFileSync(new URL('../Member Points Page.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../Member Points Integration.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(oldMarkup = false) {
  const dom = new JSDOM(page, { runScripts: 'outside-only', url: 'https://example.com/member-points/' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.requestAnimationFrame = () => 0;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = async () => ({ ok: true, json: async () => ({}) });
  if (oldMarkup) {
    w.document.querySelector('#asmeLeaderboardRows').textContent = 'Loading leaderboard…';
    w.document.querySelector('#asmeMemberDashboardState').outerHTML = '<p class="asme-member-dashboard-state" id="asmeMemberDashboardState" role="status">Loading dashboard…</p>';
  }
  w.eval(script);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  function reply(sheet, rows) {
    const request = [...w.document.head.querySelectorAll('script')].find(el => new URL(el.src).searchParams.get('sheet') === sheet);
    assert.ok(request, `request for ${sheet}`);
    const callback = new URL(request.src).searchParams.get('tqx').split('responseHandler:')[1];
    w[callback]({ table: { rows: rows.map(values => ({ c: values.map(v => ({ v })) })) } });
  }
  return { dom, w, reply };
}

for (const oldMarkup of [false, true]) {
  test(`skeletons survive status loading and clear when members arrive (${oldMarkup ? 'legacy' : 'current'} markup)`, async () => {
    const { dom, w, reply } = setup(oldMarkup);
    try {
      const d = w.document;
      assert.equal(d.querySelectorAll('.asme-points-skeleton-row').length, 10);
      assert.ok(d.querySelector('.asme-points-summary-skeleton'));
      assert.equal(d.querySelectorAll('.asme-points-skeleton-row[tabindex]').length, 0);
      reply('System_Status', [['system_status', 'LIVE']]);
      reply('Point_Values_Public', []);
      await tick();
      assert.equal(d.querySelector('#asmeMemberSearch').disabled, true);
      assert.ok(d.querySelector('.asme-points-summary-skeleton'));
      reply('Leaderboard_Public', [[1, 'Alex A.', 'Fall 2026', 50, 2, 'Active', '2026-10-14', 2, 0, 0, 0, 0, 0, 0, 'Meetings']]);
      await tick();
      assert.equal(d.querySelectorAll('.asme-points-skeleton-bar').length, 0);
      assert.equal(d.querySelector('#asmeMemberDashboardState').getAttribute('aria-busy'), 'false');
      assert.equal(d.querySelector('#asmeMemberSearch').disabled, false);
      d.querySelector('.asme-leaderboard-row').click();
      assert.equal(d.querySelector('#asmeDashboardName').textContent, 'Alex A.');
      assert.equal(d.querySelector('#asmeMemberDashboardPanel').hidden, false);
    } finally { dom.window.close(); }
  });
}
for (const outcome of ['empty', 'paused', 'error']) {
  test(`${outcome} clears both skeletons and busy states`, async () => {
    const { dom, w, reply } = setup();
    try {
      if (outcome === 'error') w.document.head.querySelector('script').dispatchEvent(new w.Event('error'));
      else {
        reply('System_Status', [['system_status', outcome === 'paused' ? 'PAUSED' : 'LIVE']]);
        reply('Point_Values_Public', []);
        await tick();
        if (outcome === 'empty') reply('Leaderboard_Public', []);
      }
      await tick();
      assert.equal(w.document.querySelectorAll('.asme-points-skeleton-bar').length, 0);
      for (const id of ['asmeLeaderboardRows', 'asmeMemberDashboardState', 'asmeMemberDashboardPanel']) {
        assert.equal(w.document.getElementById(id).getAttribute('aria-busy'), 'false');
      }
    } finally { dom.window.close(); }
  });
}
