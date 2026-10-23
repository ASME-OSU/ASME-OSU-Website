import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const markup = fs.readFileSync('Calendar Page.html', 'utf8');
const script = fs.readFileSync('Calendar Integration.js', 'utf8');
const first = { id: 'weekly::2090-10-22T21:30:00.000Z', title: 'ASME session', start: '2090-10-22T21:30:00.000Z' };
const second = { id: 'weekly::2090-10-29T21:30:00.000Z', title: 'ASME session', start: '2090-10-29T21:30:00.000Z' };
const third = { id: 'social::2090-10-30T21:30:00.000Z', title: 'ASME social', start: '2090-10-30T21:30:00.000Z' };
const campaign = { id: 'asme-session', year: '2090-91', title: first.title, start: first.start, source: { uid: first.id } };
async function page(campaigns, { offline = false, delayed = false } = {}) {
  const dom = new JSDOM(markup, { url: 'https://org.osu.edu/asme/calendar/', runScripts: 'outside-only' });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.fetch = async url => {
    if (url.includes('/archive-index.json')) {
      if (offline) throw Error('Offline');
      if (delayed) await new Promise(resolve => setTimeout(resolve, 20));
      return { ok: true, json: async () => ({ campaigns }) };
    }
    return { ok: true, json: async () => ({ events: [first, second, third] }) };
  };
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise(resolve => setTimeout(resolve, 70));
  return dom;
}
test('only matching published campaign links, including a delayed archive, open in a new tab', async () => {
  const dom = await page([campaign], { delayed: true });
  try {
    const cards = [...dom.window.document.querySelectorAll('#asmeCalendarUpcoming .acp-event-card')];
    assert.equal(cards.length, 3);
    assert.equal(cards[0].tagName, 'A');
    assert.equal(cards[0].href, 'https://asme-osu.github.io/ASME-Social-Hub/event.html?year=2090-91&id=asme-session');
    assert.equal(cards[0].target, '_blank');
    assert.equal(cards[0].rel, 'noopener noreferrer');
    assert.match(cards[0].getAttribute('aria-label'), /opens in a new tab/);
    assert.match(cards[0].textContent, /Click on the event to find out more/);
    for (const card of cards.slice(1)) {
      assert.equal(card.tagName, 'ARTICLE');
      assert.equal(card.querySelector('.acp-event-more'), null);
      assert.equal(card.hasAttribute('tabindex'), false);
    }
  } finally { dom.window.close(); }
});
test('deleted, cancelled, demo, unsafe, ambiguous, missing, and unavailable campaigns leave cards inert', async () => {
  const cases = [[], [{ ...campaign, deletedAt: '2090-10-01' }], [{ ...campaign, cancelled: true }], [{ ...campaign, demo: true }], [{ ...campaign, id: '../elsewhere' }], [campaign, { ...campaign, id: 'duplicate' }], [{ ...campaign, start: second.start }]];
  for (const campaigns of cases) {
    const dom = await page(campaigns);
    try { assert.equal(dom.window.document.querySelectorAll('#asmeCalendarUpcoming a').length, 0); }
    finally { dom.window.close(); }
  }
  const dom = await page([campaign], { offline: true });
  try {
    assert.equal(dom.window.document.querySelectorAll('#asmeCalendarUpcoming article').length, 3);
    assert.equal(dom.window.document.querySelector('.acp-event-more'), null);
  } finally { dom.window.close(); }
});
test('manual campaigns require exact title and time; linked campaigns cannot fall back to another calendar ID', async () => {
  for (const [candidate, expected] of [
    [{ ...campaign, source: { kind: 'manual' } }, 1],
    [{ ...campaign, source: { calendarUid: 'weekly' } }, 1],
    [{ ...campaign, source: { uid: 'other-calendar-event' } }, 0],
    [{ ...campaign, source: {}, title: 'Another title' }, 0],
    [{ ...campaign, source: {}, allDay: true }, 0]
  ]) {
    const dom = await page([candidate]);
    try { assert.equal(dom.window.document.querySelectorAll('#asmeCalendarUpcoming a').length, expected); }
    finally { dom.window.close(); }
  }
});
