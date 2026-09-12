import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCurrentSnapshot, isLiveSystemStatus, nextSnapshot, parseResponse, publishSnapshot } from '../scripts/publish-leaderboard-rank-snapshot.mjs';

function row(rank, name, period, version) {
  return { c: [{ v: rank }, { v: name }, { v: period }, { v: version, f: version }] };
}

test('shared snapshot retains the last published version within a period', () => {
  const first = buildCurrentSnapshot([row(5, 'Alex A.', 'Fall 2026', '2026-09-01 09:00'), row(2, 'Blair B.', 'Fall 2026', '2026-09-01 09:00')]);
  const second = buildCurrentSnapshot([row(3, 'Alex A.', 'Fall 2026', '2026-09-08 09:00'), row(5, 'Blair B.', 'Fall 2026', '2026-09-08 09:00')]);
  const initial = nextSnapshot({ schemaVersion: 1, current: null, previous: null }, first);
  const advanced = nextSnapshot(initial, second);

  assert.equal(initial.previous, null);
  assert.equal(advanced.previous.ranks['alex a.'], 5);
  assert.equal(advanced.current.ranks['alex a.'], 3);
  assert.equal(advanced.previous.ranks['blair b.'], 2);
});

test('same version does not advance the comparison baseline and period rollover clears it', () => {
  const current = buildCurrentSnapshot([row(4, 'Alex A.', 'Fall 2026', '2026-09-08 09:00')]);
  const prior = { schemaVersion: 1, current, previous: { version: '2026-09-01 09:00', period: 'Fall 2026', ranks: { 'alex a.': 5 } } };
  assert.deepEqual(nextSnapshot(prior, current), prior);

  const spring = buildCurrentSnapshot([row(1, 'Alex A.', 'Spring 2027', '2027-01-10 09:00')]);
  assert.equal(nextSnapshot(prior, spring).previous, null);
});

test('duplicate public names are excluded instead of being matched by row index', () => {
  const snapshot = buildCurrentSnapshot([
    row(1, 'Alex A.', 'Fall 2026', '2026-09-08 09:00'),
    row(2, 'Alex A.', 'Fall 2026', '2026-09-08 09:00'),
    row(3, 'Blair B.', 'Fall 2026', '2026-09-08 09:00')
  ]);
  assert.deepEqual(snapshot.ranks, { 'blair b.': 3 });
});

test('publisher accepts only an explicit LIVE public-system status', () => {
  assert.equal(isLiveSystemStatus([{ c: [{ v: 'system_status' }, { v: 'LIVE' }] }]), true);
  assert.equal(isLiveSystemStatus([{ c: [{ v: 'system_status' }, { v: 'PAUSED' }] }]), false);
  assert.equal(isLiveSystemStatus([{ c: [{ v: 'other_status' }, { v: 'LIVE' }] }]), false);
  assert.equal(isLiveSystemStatus([]), false);
});

function response(rows) {
  return { ok: true, text: async () => `google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table: { rows } })});` };
}

test('missing or malformed status never writes a snapshot', async () => {
  const existing = '{"schemaVersion":1,"current":{"version":"old","period":"Fall 2026","ranks":{}},"previous":null}\n';
  let writes = 0;
  const common = { readFile: async () => existing, writeFile: async () => { writes += 1; } };
  const missing = await publishSnapshot({ ...common, fetchFn: async () => response([{ c: [{ v: 'last_updated_et' }, { v: '2026-09-12' }] }]) });
  assert.deepEqual(missing, { published: false, reason: 'not-live' });
  await assert.rejects(() => publishSnapshot({ ...common, fetchFn: async () => ({ ok: true, text: async () => 'not a visualization response' }) }), /visualization response/);
  assert.equal(writes, 0);
});

test('non-LIVE status and a malformed leaderboard preserve the last valid snapshot', async () => {
  const existing = '{"schemaVersion":1,"current":{"version":"old","period":"Fall 2026","ranks":{}},"previous":null}\n';
  let writes = 0;
  const nonLive = await publishSnapshot({
    fetchFn: async () => response([{ c: [{ v: 'system_status' }, { v: 'PAUSED' }] }]),
    readFile: async () => existing,
    writeFile: async () => { writes += 1; }
  });
  assert.equal(nonLive.reason, 'not-live');
  let calls = 0;
  await assert.rejects(() => publishSnapshot({
    fetchFn: async () => (++calls === 1
      ? response([{ c: [{ v: 'system_status' }, { v: 'LIVE' }] }])
      : { ok: true, text: async () => 'malformed leaderboard response' }),
    readFile: async () => existing,
    writeFile: async () => { writes += 1; }
  }), /visualization response/);
  assert.equal(writes, 0);
});

test('explicit LIVE dry run returns a public-only baseline without writing it', async () => {
  let writes = 0;
  let calls = 0;
  const result = await publishSnapshot({
    fetchFn: async () => (++calls === 1
      ? response([{ c: [{ v: 'system_status' }, { v: 'LIVE' }] }])
      : response([row(1, 'Alex A.', 'Fall 2026', '2026-09-12 10:00')])),
    readFile: async () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; },
    writeFile: async () => { writes += 1; },
    dryRun: true
  });
  assert.equal(result.reason, 'dry-run');
  assert.deepEqual(result.snapshot.current.ranks, { 'alex a.': 1 });
  assert.equal(writes, 0);
});
