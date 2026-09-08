import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const footer = await fs.readFile('Footer.html', 'utf8');
const footerScript = footer.match(/<!-- V11 interactions script -->\s*<script>([\s\S]*?)<\/script>/)?.[1];

function setDimensions(image, width, height) {
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height }
  });
}

test('shared footer initializer classifies and reveals late gallery items exactly once', () => {
  assert.ok(footerScript, 'the shared footer interaction script is present');
  const dom = new JSDOM('<div class="asme-gallery-page"><div class="gallery"><figure class="gallery-item"><div class="gallery-icon"><a><img id="native"></a></div></figure></div></div>', { runScripts: 'outside-only', url: 'https://org.osu.edu/asme/pictures/' });
  const { window } = dom;
  const observed = [];
  window.matchMedia = () => ({ matches: false });
  window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(item) { observed.push(item); }
    unobserve() {}
  };
  setDimensions(window.document.getElementById('native'), 800, 1000);
  window.eval(footerScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const imported = window.document.createElement('figure');
  imported.className = 'gallery-item gallery-item--google-photos';
  imported.innerHTML = '<div class="gallery-icon landscape"><a><img></a></div>';
  const image = imported.querySelector('img');
  setDimensions(image, 2400, 1000);
  window.document.querySelector('.gallery').appendChild(imported);
  window.asmeInitializeGalleryItems([imported]);
  window.asmeInitializeGalleryItems([imported]);
  assert.ok(imported.classList.contains('is-panorama'));
  assert.ok(imported.classList.contains('asme-reveal'));
  assert.equal(observed.filter((item) => item === imported).length, 1);
  assert.ok(window.document.querySelector('.gallery-item').classList.contains('is-portrait'), 'native and imported items use the same classifier');
});

test('shared footer makes late gallery items visible without motion or IntersectionObserver', () => {
  const dom = new JSDOM('<div class="asme-gallery-page"><div class="gallery"></div></div>', { runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true });
  window.eval(footerScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const item = window.document.createElement('figure');
  item.className = 'gallery-item';
  item.innerHTML = '<div class="gallery-icon"><a><img></a></div>';
  window.document.querySelector('.gallery').appendChild(item);
  window.asmeInitializeGalleryItems([item]);
  assert.ok(item.classList.contains('is-visible'));
});
