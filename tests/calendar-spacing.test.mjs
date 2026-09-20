import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync('Calendar Integration.js', 'utf8');

test('Calendar cleanup hides only WordPress formatting paragraphs in information cards', () => {
  const dom = new JSDOM(`<!doctype html><body><div class="asme-cal-page">
    <div class="acp-info-item"><span>icon</span><p> </p><div><div>Title</div><p><br></p><div>Email <a href="mailto:asme@osu.edu">ASME</a></div><p> </p><p>Important note</p></div><p>&nbsp;</p></div>
  </div></body>`, { url: 'https://org.osu.edu/asme/calendar/', runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  const paragraphs = [...window.document.querySelectorAll('.acp-info-item p')];
  const blanks = paragraphs.filter((paragraph) => !paragraph.textContent.trim());
  assert.equal(blanks.length, 4);
  assert.equal(blanks.every((paragraph) => paragraph.hidden), true);
  assert.equal(blanks.every((paragraph) => paragraph.style.getPropertyValue('display') === 'none' && paragraph.style.getPropertyPriority('display') === 'important'), true);
  assert.equal(paragraphs.find((paragraph) => paragraph.textContent === 'Important note').hidden, false);
  assert.equal(window.document.querySelector('a[href="mailto:asme@osu.edu"]').hidden, false);
  dom.window.close();
});
