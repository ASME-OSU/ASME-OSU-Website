import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const script = await fs.readFile('Gallery Integration.js', 'utf8');

test('Google Photos feed joins archive asynchronously without relabeling archive items', async () => {
  const archive = Array.from({ length: 13 }, (_, index) => `<figure class="gallery-item"><a href="https://example.org/${index}.jpg"><img></a></figure>`).join('');
  const dom = new JSDOM(`<div class="asme-gallery-page"><div class="gallery">${archive}</div><div class="gallery-archive-filters"><button data-gallery-filter="all">All</button></div><p id="galleryArchiveStatus"></p></div>`, { runScripts: 'outside-only', url: 'https://org.osu.edu/asme/pictures/' });
  const { window } = dom;
  window.fetch = async (url) => ({ ok: true, json: async () => {
    if (String(url).includes('google-photos-feed')) return { schemaVersion: 1, items: [{ id: 'stable-photo', thumbnailUrl: 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/google-photos-auto/stable-thumb.webp', imageUrl: 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/google-photos-auto/stable-large.webp', width: 640, height: 480, alt: 'New chapter photo', category: 'general' }] };
    return { items: [] };
  }});
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const items = window.document.querySelectorAll('.gallery-item');
  assert.equal(items.length, 14);
  assert.equal(items[0].dataset.gallerySource, 'wordpress');
  assert.equal(items[13].dataset.galleryId, 'stable-photo');
  assert.equal(window.document.querySelector('[data-gallery-filter="general"]').textContent, 'General');
  window.document.querySelector('[data-gallery-filter="general"]').click();
  assert.equal(window.document.querySelectorAll('.gallery-item:not(.is-filtered-out)').length, 1);
  assert.match(window.document.getElementById('galleryArchiveStatus').textContent, /1 general photo/);
});
