import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const markup = fs.readFileSync('Calendar Page.html', 'utf8');
const script = fs.readFileSync('Calendar Integration.js', 'utf8');
const event = (title, day) => ({ title, start: `2090-10-${day}T21:30:00Z`, end: `2090-10-${day}T22:30:00Z` });
const feed = { events: [event('Third chapter event', '24'), event('First chapter event', '22'), event('Second chapter event', '23'), event('Fourth chapter event', '25'), event('Final exams', '21'), { title: 'Past event', start: '2000-01-01T12:00:00Z' }] };
async function page(fetch, cached = null) {
  const dom = new JSDOM(markup, { url: 'https://org.osu.edu/asme/calendar/', runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false }); window.fetch = fetch;
  window.document.querySelector('.acp-upcoming').insertAdjacentHTML('afterbegin', '<div class="acp-preview-controls"><button id="asmeCalendarFictional">Load fictional Fall/Spring</button></div><p id="asmeCalendarPreviewHelp">Fictional events</p><p id="asmeCalendarStatus">Snapshot diagnostics</p>');
  if (cached) window.localStorage.setItem('asmeCalendarEventsV4', JSON.stringify({ feed: cached }));
  window.localStorage.setItem('asmeCalendarEventsV3', JSON.stringify({ feed: { events: [event('TEST ONLY fictional event', '20')] } }));
  window.eval(script); window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise(resolve => setTimeout(resolve, 20));
  return dom;
}
test('public calendar shows three upcoming chapter events and removes legacy CMS testing controls', async () => {
  const dom = await page(async () => ({ ok: true, json: async () => feed }));
  try {
    const doc = dom.window.document;
    assert.deepEqual([...doc.querySelectorAll('#asmeCalendarUpcoming h3')].map(x => x.textContent), ['First chapter event', 'Second chapter event', 'Third chapter event']);
    assert.equal(doc.querySelector('.acp-preview-controls, #asmeCalendarPreviewHelp, #asmeCalendarStatus'), null);
    assert.equal(doc.querySelector('.acp-live-badge').textContent, 'Chapter events');
    assert.equal(doc.querySelector('#asmeCalendarUpcoming').getAttribute('aria-busy'), 'false');
    assert.equal(doc.querySelector('#asmeCalendarFrame').hidden, false);
    assert.doesNotMatch(doc.body.textContent, /TEST ONLY|fictional|snapshot/i);
  } finally { dom.window.close(); }
});
test('failed feed retains chapter cache and ignores retired rehearsal cache', async () => {
  for (const cached of [feed, null]) {
    const dom = await page(async () => { throw new Error('Offline'); }, cached);
    try {
      const text = dom.window.document.querySelector('#asmeCalendarUpcoming').textContent;
      assert.doesNotMatch(text, /TEST ONLY|fictional/);
      assert.match(text, cached ? /First chapter event/ : /No upcoming events are published yet/);
    } finally { dom.window.close(); }
  }
});
