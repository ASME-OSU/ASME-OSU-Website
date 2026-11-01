import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { selectPointsSource, syncPointsSource } from '../scripts/sync-points-source.mjs';
import { publishSnapshot } from '../scripts/publish-leaderboard-rank-snapshot.mjs';
const old = JSON.parse(await fs.readFile(new URL('../data/points-source.json', import.meta.url), 'utf8'));
const nextID = 'Reviewed_Public_Export_2027_2028';
const row = (...values) => ({ c: values.map(v => ({ v })) });
const annual = (year, id, active, current, tab = 'Leaderboard_Public') => row(year, `https://docs.google.com/spreadsheets/d/${id}/edit`, tab, active, current);
const reply = rows => ({ ok: true, text: async () => `google.visualization.Query.setResponse(${JSON.stringify({status:'ok',table:{rows}})});` });

test('current year stays selected while future drafts and active archives exist', async () => {
  const rows = [annual('2025-2026', 'Archived_Public_Export_2025_2026', true, false), annual(old.academicYear, old.exportId, true, true), annual('2027-2028', nextID, false, false)];
  assert.deepEqual(selectPointsSource(rows), old);
  let calls = 0;
  const result = await syncPointsSource({ fetchFn: async () => { calls++; return reply(rows); }, readFile: async () => JSON.stringify(old), writeFile: async () => assert.fail('must preserve current file') });
  assert.equal(result.changed, false);
  assert.equal(calls, 1);
});
test('ambiguous, inactive, malformed and private-tab selections fail closed', () => {
  const valid = annual(old.academicYear, old.exportId, true, true);
  for (const rows of [[], [valid, annual('2027-2028', nextID, true, true)], [valid, valid], [annual('2027-2028', nextID, false, true)], [annual('2027-2028', nextID, true, true, 'Roster')], [annual('2027-2029', nextID, true, true)], [annual('2027-2028', nextID, '', true)]]) assert.throws(() => selectPointsSource(rows));
  const wrongHost = annual('2027-2028', nextID, true, true); wrongHost.c[1].v = `https://example.com/spreadsheets/d/${nextID}/edit`;
  assert.throws(() => selectPointsSource([wrongHost]));
});
test('rollover requires LIVE status and accessible public tabs; failure preserves old source', async () => {
  for (const mode of ['TESTING', 'PAUSED', 'missing', 'bad-tab', 'network']) {
    let calls = 0;
    await assert.rejects(() => syncPointsSource({ readFile: async () => JSON.stringify(old), writeFile: async () => assert.fail('must not write'), fetchFn: async () => {
      calls++;
      if (calls === 1) return reply([annual('2027-2028', nextID, true, true)]);
      if (mode === 'network') throw new Error('offline');
      if (calls === 2) return reply(mode === 'missing' ? [] : [row('system_status', mode === 'bad-tab' ? 'LIVE' : mode)]);
      return { ok: true, text: async () => 'invalid public tab' };
    }}));
  }
});
test('approved LIVE rollover publishes only year and public export identity', async () => {
  const urls = []; let written;
  const result = await syncPointsSource({ readFile: async () => JSON.stringify(old), writeFile: async (_, data) => { written = JSON.parse(data); }, fetchFn: async url => {
    urls.push(url);
    return reply(urls.length === 1 ? [annual('2027-2028', nextID, true, true)] : urls.length === 2 ? [row('system_status', 'LIVE')] : []);
  }});
  assert.equal(result.changed, true);
  assert.deepEqual(written, { schemaVersion:1, academicYear:'2027-2028', exportId:nextID });
  assert.equal(urls.length, 4);
  assert.ok(urls.slice(1).every(url => url.includes(nextID)));
  assert.equal(old.exportId, '1otAJV_pDkj6xWCVBHbhXPq99sT9L33ZFOdQU59uKXLg');
});
test('new export clears rank comparison even if periods and versions happen to match', async () => {
  let calls = 0;
  const result = await publishSnapshot({ source: {schemaVersion:1,exportId:nextID}, dryRun:true,
    readFile: async () => JSON.stringify({schemaVersion:1,exportId:old.exportId,current:{period:'Fall 2027',version:'2027-09-01',ranks:{alex:9}}}),
    fetchFn: async url => {
      assert.ok(url.includes(nextID));
      return reply(++calls === 1 ? [row('system_status','LIVE')] : [row(1,'Alex','Fall 2027','2027-09-01')]);
    }});
  assert.equal(result.snapshot.previous, null);
  assert.equal(result.snapshot.exportId, nextID);
});

async function browser(source, failed = false) {
  const page = await fs.readFile(new URL('../Member Points Page.html', import.meta.url), 'utf8');
  const script = await fs.readFile(new URL('../Member Points Integration.js', import.meta.url), 'utf8');
  const dom = new JSDOM(page, {runScripts:'outside-only', pretendToBeVisual:true, url:'https://org.osu.edu/asme/member-points-page/'});
  const w = dom.window; const requests = [];
  w.matchMedia = () => ({matches:false});
  w.fetch = async url => ({ok: !failed, json: async () => String(url).includes('points-source.json') ? source : {exportId:old.exportId}});
  const append = w.document.head.appendChild.bind(w.document.head);
  w.document.head.appendChild = el => {
    if (el.tagName === 'SCRIPT' && el.src.includes('/gviz/')) {
      requests.push(el.src);
      const url = new URL(el.src);
      const handler = url.searchParams.get('tqx').split('responseHandler:')[1];
      queueMicrotask(() => w[handler]({table:{rows: url.searchParams.get('sheet') === 'System_Status' ? [row('system_status','TESTING')] : []}}));
    }
    return append(el);
  };
  w.eval(script);
  await new Promise(resolve => setTimeout(resolve, 60));
  return {dom, requests};
}
test('shipped browser loads current-year and next-year data exclusively from the manifest', async () => {
  for (const source of [old, {schemaVersion:1,academicYear:'2027-2028',exportId:nextID}]) {
    const {dom,requests} = await browser(source);
    try { assert.equal(requests.length,2); assert.ok(requests.every(url => url.includes(source.exportId))); }
    finally { dom.window.close(); }
  }
});
test('unavailable or invalid manifest makes no sheet requests and shows unavailable state', async () => {
  for (const [source, failed] of [[old,true],[{schemaVersion:1,academicYear:'2027-2028',exportId:'bad/host'},false]]) {
    const {dom,requests} = await browser(source,failed);
    try { assert.equal(requests.length,0); assert.match(dom.window.document.getElementById('asmeLeaderboardRows').textContent,/temporarily unavailable/); }
    finally { dom.window.close(); }
  }
});

test('Gearly follows the approved export and preserves all unrelated configuration', async () => {
  const {projectGearlySource} = await import('../scripts/sync-gearly-points-source.mjs');
  const data = {meta:{sheetID:old.exportId,contactEmail:'chapter@example.com'},intents:[{id:'calendar'}]};
  const next = projectGearlySource(data,{schemaVersion:1,exportId:nextID});
  assert.equal(next.meta.sheetID,nextID);
  assert.equal(next.meta.contactEmail,data.meta.contactEmail);
  assert.deepEqual(next.intents,data.intents);
  assert.equal(data.meta.sheetID,old.exportId);
  assert.throws(() => projectGearlySource(data,{schemaVersion:1,exportId:'invalid/path'}));
});
