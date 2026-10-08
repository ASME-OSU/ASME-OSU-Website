import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ical from 'node-ical';

const scriptUrl = new URL('../scripts/sync-calendar.mjs', import.meta.url);
const source = fs.readFileSync(scriptUrl, 'utf8').replace(/^import .*;\n/gm, '').replaceAll('import.meta.url', JSON.stringify(scriptUrl.href)).replace('await main();', 'globalThis.runCalendarGenerator = main;');
const fixture = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:fall-test-only
DTSTART;TZID=America/New_York:20270915T180000
DTEND;TZID=America/New_York:20270915T190000
SUMMARY:TEST ONLY Fall workshop
END:VEVENT
BEGIN:VEVENT
UID:spring-test-only
DTSTART;TZID=America/New_York:20280115T180000
DTEND;TZID=America/New_York:20280115T190000
SUMMARY:TEST ONLY Spring workshop
END:VEVENT
BEGIN:VEVENT
UID:canceled-test-only
DTSTART:20271015T220000Z
DTEND:20271015T230000Z
SUMMARY:TEST ONLY Canceled workshop
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

async function generate(ics, previous) {
  let written, requested;
  const sandbox = { path, fileURLToPath, Date, console: { log() {}, warn() {} }, fs: { readFile: async () => JSON.stringify(previous), mkdir: async () => {}, writeFile: async (_path, text) => { written = JSON.parse(text); } }, ical: { ...ical, async: { fromURL: async url => { requested = url; return ical.sync.parseICS(ics); } } } };
  vm.runInNewContext(source, sandbox);
  await sandbox.runCalendarGenerator();
  return { written, requested };
}

test('production generator uses official public iCal, expands next Fall/Spring with DST, removes canceled/removed events and publishes check/coverage metadata', async () => {
  const result = await generate(fixture, { events: [] });
  assert.match(result.requested, /calendar\/ical\/c93730cdacb567b0f010d1367080e3028ec5c7657d9713b675ac9e5c437b9fba%40group.calendar.google.com\/public\/basic.ics/);
  assert.equal(result.written.timeZone, 'America/New_York');
  assert.equal(result.written.events.length, 2);
  assert.equal(result.written.events[0].start, '2027-09-15T22:00:00.000Z');
  assert.equal(result.written.events[1].start, '2028-01-15T23:00:00.000Z');
  assert.ok(result.written.windowEnd >= '2028-08-01T00:00:00.000Z');
  assert.ok(result.written.checkedAt);
  const removed = await generate('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR', result.written);
  assert.equal(removed.written.events.length, 0);
  const unchanged = await generate('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR', { events: [], generatedAt: '2025-01-01T00:00:00Z' });
  assert.equal(unchanged.written.generatedAt, '2025-01-01T00:00:00Z');
  assert.ok(unchanged.written.checkedAt > unchanged.written.generatedAt, 'unchanged events still record the actual successful Google check');
});
