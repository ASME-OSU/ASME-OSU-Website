import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const markup = fs.readFileSync('Calendar Page.html', 'utf8');
const script = fs.readFileSync('Calendar Integration.js', 'utf8');
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 20)); };
function page(fetch) {
  const dom = new JSDOM(markup, { url: 'https://org.osu.edu/asme/calendar/', runScripts: 'outside-only' });
  dom.window.matchMedia = () => ({ matches: false }); dom.window.fetch = fetch;
  dom.window.eval(script); dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}
const feed = { generatedAt: '2026-10-07T22:00:00Z', checkedAt: '2026-10-07T22:15:00Z', events: [
  { title: 'Fall official fixture', start: '2027-09-15T22:00:00Z', end: '2027-09-15T23:00:00Z' },
  { title: 'Spring official fixture', start: '2028-01-15T23:00:00Z', end: '2028-01-16T00:00:00Z' },
  { title: 'Previous academic year', start: '2027-08-01T03:30:00Z' },
  { title: 'All day August 1', start: '2027-08-01T00:00:00Z', allDay: true },
  { title: 'Next academic year', start: '2028-08-01T04:00:00Z' },
] };
const click = (window, id) => window.document.getElementById(id).click();

test('actual website Calendar script filters Eastern and all-day dates, rehearses Fall/Spring, removes and refreshes without publishing', async () => {
  let requests = 0;
  const dom = page(async () => { requests++; return { ok: true, json: async () => feed }; });
  const { window } = dom;
  try {
    await flush();
    window.document.getElementById('asmeCalendarYear').value = '2027-2028'; click(window, 'asmeCalendarPreview');
    const cards = window.document.getElementById('asmeCalendarUpcoming').textContent;
    assert.match(cards, /All day August 1/); assert.match(cards, /Fall official fixture/); assert.match(cards, /Spring official fixture/);
    assert.doesNotMatch(cards, /Previous academic year|Next academic year/);
    const frame = window.document.getElementById('asmeCalendarFrame');
    assert.match(new URL(frame.src).searchParams.get('dates'), /20270801\/20280731/);
    assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /source checked.*Refresh rereads JSON/);
    const before = requests; click(window, 'asmeCalendarFictional');
    assert.equal(requests, before); assert.equal(frame.hidden, true);
    assert.match(window.document.getElementById('asmeCalendarUpcoming').textContent, /TEST ONLY.*Fall.*TEST ONLY.*Spring/);
    assert.equal((window.document.getElementById('asmeCalendarUpcoming').textContent.match(/6:00 PM/g) || []).length, 2);
    assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /FICTIONAL REHEARSAL/);
    click(window, 'asmeCalendarClearFictional'); assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /0 event/);
    click(window, 'asmeCalendarRefresh'); await flush();
    assert.equal(requests, before + 1); assert.equal(frame.hidden, false);
    assert.match(window.document.getElementById('asmeCalendarUpcoming').textContent, /Fall official fixture/);
    assert.doesNotMatch(window.document.getElementById('asmeCalendarStatus').textContent, /FICTIONAL/);
    window.document.getElementById('asmeCalendarYear').value = '2028-2029'; click(window, 'asmeCalendarPreview');
    assert.match(window.document.getElementById('asmeCalendarUpcoming').textContent, /Next academic year/);
    assert.doesNotMatch(window.document.getElementById('asmeCalendarUpcoming').textContent, /Fall official fixture/);
    window.document.getElementById('asmeCalendarYear').value = '2028-2030'; click(window, 'asmeCalendarPreview');
    assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /consecutive academic years/);
    assert.match(window.document.getElementById('asmeCalendarUpcoming').textContent, /Next academic year/);
    click(window, 'asmeCalendarRefresh'); await flush();
    assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /Chapter generated snapshot.*2028-2029/);
  } finally { window.close(); }
});

test('late generated snapshot cannot overwrite browser fictional source; failed refresh shows honest cached fallback', async () => {
  let answer;
  const dom = page(() => new Promise(resolve => { answer = resolve; }));
  const { window } = dom;
  try {
    window.document.getElementById('asmeCalendarYear').value = '2027-2028'; click(window, 'asmeCalendarFictional');
    answer({ ok: true, json: async () => feed }); await flush();
    assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /FICTIONAL/);
    window.localStorage.setItem('asmeCalendarEventsV3', JSON.stringify({ feed }));
    window.fetch = async () => ({ ok: false }); click(window, 'asmeCalendarRefresh'); await flush();
    assert.match(window.document.getElementById('asmeCalendarStatus').textContent, /failed.*cached chapter events/);
    assert.doesNotMatch(window.document.getElementById('asmeCalendarUpcoming').textContent, /TEST ONLY/);
  } finally { window.close(); }
});
