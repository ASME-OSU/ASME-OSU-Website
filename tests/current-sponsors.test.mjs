import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('TSMC appears once in Company Partners with its supplied logo and official destination', () => {
  const html = fs.readFileSync('Current Sponsors Page.html', 'utf8');
  const { document } = new JSDOM(html).window;
  const cards = [...document.querySelectorAll('.sponsors-grid-partners > .sponsor-card-partner')];
  const matches = cards.filter(card => card.querySelector('h3')?.textContent.trim() === 'TSMC');
  assert.equal(matches.length, 1);
  const card = matches[0];
  assert.equal(card.querySelector('img').getAttribute('src'), 'https://org.osu.edu/asme/files/2026/09/TSMC-Logo.png');
  assert.equal(card.querySelector('img').getAttribute('alt'), 'TSMC logo');
  assert.deepEqual([...card.querySelectorAll('a')].map(a => a.href), ['https://www.tsmc.com/english', 'https://www.tsmc.com/english']);
});
