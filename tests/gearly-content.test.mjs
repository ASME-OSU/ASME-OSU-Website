import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../assets/gearly/gearly-content.js';
const api = globalThis.GearlyContent;
const roles = [{ id: 'president', aliases: ['president'] }, { id: 'vice-president', aliases: ['vice president', 'corporate liaison'] }, { id: 'treasurer', aliases: ['treasurer'] }];
const html = await fs.readFile(new URL('./fixtures/gearly-leadership.html', import.meta.url), 'utf8');
const snapshot = api.parseLeadership(new JSDOM(html).window.document, roles);
const answer = (question, value = snapshot) => api.resolveLeadership(value, question, { roles });

test('shared parser follows current markup, maps specific aliases, and strips historic contact fields', () => {
  assert.equal(snapshot.current.label, '2026–2027');
  assert.equal(snapshot.current.officers[1].roleId, 'robotics-coordinator');
  assert.equal(snapshot.current.officers[1].email, '');
  assert.equal(snapshot.current.officers[1].photo, '');
  assert.equal(snapshot.past[0].officers[0].roleId, 'vice-president');
  assert.ok(snapshot.past.every(board => board.officers.every(officer => !('email' in officer) && !('photo' in officer))));
  const window = new JSDOM().window;
  globalThis.DOMParser = window.DOMParser;
  assert.deepEqual(api.parseLeadership(html, roles), snapshot);
  delete globalThis.DOMParser;
});

test('leadership questions support roles, new titles, people, two matching years, ranges, and missing roles', () => {
  assert.match(answer('who is president').text, /Alex Example.*2026–2027/);
  assert.match(answer('who is Robotics Coordinator').text, /River Example/);
  assert.match(answer('who is Alex Example').text, /Vice President.*2025–2026/);
  assert.match(answer('who is Alex Example').text, /Public email: alex@example.org/);
  const year = answer('who was president in 2026');
  assert.match(year.text, /2025–2026/);
  assert.match(year.text, /2026–2027/);
  assert.doesNotMatch(answer('president 2025–26').text, /email|@/);
  assert.match(answer('who are the officers').text, /Robotics Coordinator/);
  assert.equal(answer('who is Unknown Person').matched, false);
  assert.equal(answer('who is treasurer').matched, false);
});

test('rollover changes current answers and last year with no code/config edits', async () => {
  const value = api.parseLeadership(new JSDOM(await fs.readFile(new URL('./fixtures/gearly-leadership-rollover.html', import.meta.url), 'utf8')).window.document, roles);
  assert.match(answer('who is president', value).text, /River Example.*2027–2028/);
  const previous = answer("last year's board", value);
  assert.match(previous.text, /Alex Example.*2026–2027/);
  assert.doesNotMatch(previous.text, /email|@/);
});

test('live leadership uses bounded same-origin fetch, caches, and malformed live pages use snapshot', async () => {
  api.clearCache();
  let count = 0;
  const options = { siteBase: 'https://example.org/chapter/', origin: 'https://example.org', roles, DOMParser: new JSDOM().window.DOMParser,
    fetch: async (url, init) => { count++; assert.equal(url, 'https://example.org/chapter/leadership/'); assert.equal(init.credentials, 'same-origin'); return { ok: true, text: async () => html }; } };
  assert.deepEqual(await api.loadLeadership(options), snapshot);
  await api.loadLeadership(options);
  assert.equal(count, 1);
  api.clearCache();
  assert.deepEqual(await api.loadLeadership({ ...options, snapshot, fetch: async () => ({ ok: true, text: async () => '<h1>Not a board</h1>' }) }), snapshot);
  api.clearCache();
  assert.deepEqual(await api.loadLeadership({ ...options, origin: 'https://other.example', snapshot, fetch: async () => { throw new Error('must not fetch live off-origin'); } }), snapshot);
  api.clearCache();
  assert.deepEqual(await api.loadLeadership({ ...options, snapshot, fetch: async () => ({ ok: true, headers: { get: () => String(2 * 1024 * 1024 + 1) }, text: async () => { throw new Error('must reject before read'); } }) }), snapshot);
});


test('officer builder shares parser and check mode rejects a stale snapshot', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gearly-officers-'));
  try {
    await fs.mkdir(path.join(directory, 'scripts'));
    await fs.mkdir(path.join(directory, 'assets/gearly'), { recursive: true });
    await fs.writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    await fs.symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(directory, 'node_modules'));
    await fs.copyFile(new URL('../scripts/build-gearly-officers.mjs', import.meta.url), path.join(directory, 'scripts/build-gearly-officers.mjs'));
    await fs.copyFile(new URL('../assets/gearly/gearly-content.js', import.meta.url), path.join(directory, 'assets/gearly/gearly-content.js'));
    await fs.writeFile(path.join(directory, 'Leadership Page.html'), html);
    await fs.writeFile(path.join(directory, 'assets/gearly/gearly-data.json'), JSON.stringify({ entities: { roles } }));
    const run = (...args) => spawnSync(process.execPath, [path.join(directory, 'scripts/build-gearly-officers.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'assets/gearly/gearly-officers.json'), 'utf8')), snapshot);
    await fs.writeFile(path.join(directory, 'assets/gearly/gearly-officers.json'), '{}');
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /snapshot is stale/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
