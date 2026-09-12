import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped comparison functions, without network or browser history.
const script = fs.readFileSync(new URL('../Member Points Integration.js', import.meta.url), 'utf8');
const functions = script.slice(script.indexOf('    function rankSnapshotMemberKey('), script.indexOf('    function loadSharedRankSnapshot('));
const compare = vm.runInNewContext(`${functions}; getPreviousRankSnapshot`);
const member = (name, rank, updated = '2026-09-12 14:00') => ({ name, rank, updated, period: 'Fall 2026' });
const snapshot = (ranks, previous = null) => ({ schemaVersion: 1, current: { version: '2026-09-12 13:45', period: 'Fall 2026', ranks }, previous });

test('live sheet newer than the publisher uses its shared baseline for up/down/unchanged', () => {
  const rows = [member('Alex', 3), member('Blair', 5), member('Casey', 4)];
  const published = snapshot({ alex: 5, blair: 2, casey: 4 });
  const baseline = compare(rows, published);
  assert.deepEqual(rows.map(m => baseline[m.name.toLowerCase()] - m.rank), [2, -3, 0]);
});

test('timestamp-only sheet refresh keeps the previous rank comparison', () => {
  const previous = { version: '2026-09-12 12:00', period: 'Fall 2026', ranks: { alex: 5 } };
  assert.equal(compare([member('Alex', 3)], snapshot({ alex: 3 }, previous)).alex, 5);
});

test('an initial baseline can truthfully show unchanged after a later observation', () => {
  assert.equal(compare([member('Alex', 3)], snapshot({ alex: 3 })).alex, 3);
  assert.equal(compare([member('Alex', 3, '2026-09-12 13:45')], snapshot({ alex: 3 })), null);
});

test('missing, future, mismatched same-version and rollover snapshots do not fabricate movement', () => {
  const rows = [member('Alex', 3)];
  assert.equal(compare(rows, null), null);
  assert.equal(compare([member('Alex', 3, '2026-09-12 12:00')], snapshot({ alex: 5 })), null);
  assert.equal(compare([member('Alex', 3, '2026-09-12 13:45')], snapshot({ alex: 5 })), null);
  const rolled = snapshot({ alex: 5 }); rolled.current.period = 'Spring 2026';
  assert.equal(compare(rows, rolled), null);
});

test('ambiguous names and invalid historical ranks are excluded', () => {
  const rows = [member('Alex', 3), member('Alex', 6), member('Blair', 5), member('Casey', 4)];
  const baseline = compare(rows, snapshot({ alex: 1, blair: 2, casey: -1 }));
  assert.equal(baseline.alex, undefined);
  assert.equal(baseline.blair, 2);
  assert.equal(baseline.casey, undefined);
});
