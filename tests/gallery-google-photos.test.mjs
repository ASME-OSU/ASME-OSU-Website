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
  assert.equal(items[0].dataset.galleryId, 'stable-photo');
  assert.equal(items[1].dataset.gallerySource, 'wordpress');
  assert.ok(items[0].querySelector(':scope > .gallery-icon > a > img'), 'imported photo uses the same wrapper contract as a WordPress gallery item');
  assert.equal(window.document.querySelector('[data-gallery-filter="general"]').textContent, 'General');
  window.document.querySelector('[data-gallery-filter="general"]').click();
  assert.equal(window.document.querySelectorAll('.gallery-item:not(.is-filtered-out)').length, 1);
  assert.match(window.document.getElementById('galleryArchiveStatus').textContent, /1 general photo/);
});

test('delayed Google Photos insertion is wrapper-correct and initializes each new item once', async () => {
  const dom = new JSDOM('<div class="asme-gallery-page"><div class="gallery"><figure class="gallery-item"><div class="gallery-icon"><a href="https://example.org/old.jpg"><img></a></div></figure></div><div><button data-gallery-filter="all">All</button></div></div>', { runScripts: 'outside-only', url: 'https://org.osu.edu/asme/pictures/' });
  const { window } = dom;
  let initialized = [];
  window.asmeInitializeGalleryItems = (items) => { initialized = initialized.concat(items); };
  window.fetch = async (url) => ({ ok: true, json: async () => String(url).includes('google-photos-feed') ? {
    schemaVersion: 1,
    items: [{ id: 'new', thumbnailUrl: 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/google-photos-auto/new-thumb.webp', imageUrl: 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/google-photos-auto/new-large.webp', width: 1600, height: 900, category: 'general' }]
  } : { items: [] } });
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const imported = window.document.querySelector('[data-gallery-id="new"]');
  assert.equal(imported.querySelectorAll(':scope > .gallery-icon').length, 1);
  assert.equal(imported.querySelectorAll(':scope > .gallery-icon > a > img').length, 1);
  assert.equal(initialized.length, 1);
  assert.equal(window.document.querySelector('.gallery-item').dataset.galleryId, 'new', 'newer album images lead the archive while the Instagram sections remain outside it');
  assert.equal(window.document.querySelectorAll('[data-gallery-id="new"]').length, 1, 'a repeated insertion never duplicates the source ID');
});
