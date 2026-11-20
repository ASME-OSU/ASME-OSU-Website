import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const source = fs.readFileSync('assets/gearly/gearly-bootstrap.js', 'utf8');

// Runs the bootstrap on a fresh page and reports which guide scripts it
// requested. pending: sessionStorage entries left by the previous page.
function boot(pending = {}) {
  const dom = new JSDOM('<main>Chapter</main>', {url: 'https://org.osu.edu/asme/join/', runScripts: 'outside-only'});
  const w = dom.window;
  for (const [key, value] of Object.entries(pending)) w.sessionStorage.setItem(key, value);
  const requested = [];
  const append = w.Node.prototype.appendChild;
  w.document.head.append = (...nodes) => nodes.forEach(node => { if (node.src) requested.push(node.src); append.call(w.document.head, node); });
  Object.defineProperty(w.document, 'currentScript', {value: {src: 'https://asme-osu.github.io/ASME-OSU-Website/assets/gearly/gearly-bootstrap.js?v=test'}});
  w.eval(source);
  return {requested, close: () => w.close()};
}

test('a tour step that opened this page loads the guide at once to resume the tour', () => {
  const page = boot({'asme-gearly-tour-3-session': JSON.stringify({index: 2, direction: 1})});
  assert.ok(page.requested.some(src => src.includes('gearly-tour.js')), 'tour script requested on load');
  page.close();
});

test('a "Show me" section card that opened this page loads the guide at once', () => {
  const page = boot({'asme-gearly-section-v1': JSON.stringify({intent: 'join', index: 0})});
  assert.ok(page.requested.some(src => src.includes('gearly-tour.js')));
  page.close();
});

test('without a tour in progress the guide still waits for a scroll or click', () => {
  const page = boot();
  assert.equal(page.requested.length, 0);
  page.close();
});
