import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { parse, generate } from 'css-tree';
const footer = fs.readFileSync('Footer.html', 'utf8');
const script = footer.match(/<!-- V11 interactions script -->\s*<script>([\s\S]*?)<\/script>/)[1];
function setup(html, reducedMotion = true) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: reducedMotion });
  w.IntersectionObserver = class { observe() {} unobserve() {} };
  const intervals = new Map(); let id = 0;
  w.setInterval = fn => { intervals.set(++id, fn); return id; };
  w.clearInterval = key => intervals.delete(key);
  w.eval(script); w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { w, d: w.document, intervals, close: () => w.close() };
}
test('hero loads only the first image initially and keeps reduced motion manual without playback buttons', () => {
  const s = setup('<div class="ah-hero"><div id="ahSlides"></div><div id="ahDots"></div></div>');
  try {
    const slides = [...s.d.querySelectorAll('.ah-hero-slide')];
    assert.equal(slides.filter(x => x.style.backgroundImage).length, 1);
    assert.equal(s.intervals.size, 0);
    assert.equal(s.d.querySelector('.asme-rotation-toggle'), null);
    s.d.querySelectorAll('.ah-hero-dot')[1].click();
    assert.ok(slides[1].style.backgroundImage);
    assert.equal(slides.filter(x => x.style.backgroundImage).length, 2);
    assert.equal(s.d.querySelectorAll('.ah-hero-dot[aria-pressed="true"]').length, 1);
    assert.equal(s.intervals.size, 0);
  } finally { s.close(); }
});
test('hero pauses on keyboard focus and exposes manual controls even when autoplay is stopped', () => {
  const s = setup('<div class="ah-hero"><div id="ahSlides"></div><div id="ahDots"></div></div>', false);
  try {
    assert.equal(s.intervals.size, 1);
    const dot = s.d.querySelectorAll('.ah-hero-dot')[2];
    dot.focus(); dot.click();
    assert.equal(s.intervals.size, 0);
    assert.equal(dot.getAttribute('aria-pressed'), 'true');
    assert.equal(s.d.querySelector('.asme-rotation-toggle'), null);
    s.d.querySelector('.ah-hero').dispatchEvent(new s.w.MouseEvent('mouseleave'));
    assert.equal(s.intervals.size, 0);
  } finally { s.close(); }
});
test('gallery dialog contains Tab focus, closes with Escape, and restores focus', () => {
  const s = setup('<div class="asme-gallery-page"><div class="gallery"><figure class="gallery-item"><div class="gallery-icon"><a href="/photo.jpg"><img src="/thumb.jpg" alt="Chapter event"></a></div></figure></div></div>');
  try {
    const link = s.d.querySelector('.gallery-icon a');
    const dialog = s.d.querySelector('[role="dialog"]');
    assert.equal(dialog.hidden, true);
    link.focus(); link.click();
    assert.equal(dialog.hidden, false);
    const close = dialog.querySelector('.asme-lightbox-close');
    const last = dialog.querySelector('.asme-lightbox-open');
    assert.equal(s.d.activeElement, close);
    close.dispatchEvent(new s.w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(s.d.activeElement, last);
    last.dispatchEvent(new s.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assert.equal(s.d.activeElement, close);
    close.dispatchEvent(new s.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(dialog.hidden, true);
    assert.equal(s.d.activeElement, link);
  } finally { s.close(); }
});
test('production CSS preserves the full ordered stylesheet while reducing bytes', () => {
  const source = fs.readFileSync('ASME Custom CSS.css', 'utf8');
  const production = fs.readFileSync('ASME Custom CSS.min.css', 'utf8');
  assert.equal(generate(parse(source)), generate(parse(production)));
  assert.ok(Buffer.byteLength(production) < Buffer.byteLength(source) * 0.85);
});
test('below-fold homepage calendar uses native lazy loading', () => {
  const dom = new JSDOM(fs.readFileSync('Home Page.html', 'utf8'));
  assert.equal(dom.window.document.querySelector('.ah-calendar-mini iframe').getAttribute('loading'), 'lazy');
  dom.window.close();
});
