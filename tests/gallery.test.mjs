import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const page = fs.readFileSync('Gallery Page.html', 'utf8');
const script = fs.readFileSync('Gallery Integration.js', 'utf8');
const latestPost = {
  permalink: 'https://www.instagram.com/p/latest/',
  imageUrl: 'https://example.test/latest.jpg',
  imageWidth: 640,
  imageHeight: 800,
  timestamp: '2026-09-04T19:33:19.000Z',
  title: 'The newest chapter update',
  summary: 'The current post from ASME OSU.',
  alt: 'Latest ASME OSU Instagram post'
};

function setup(fetchResult, { legacy = false, configure } = {}) {
  const dom = new JSDOM('<!doctype html><body><main class="asme-gallery-page">' + page + '</main></body>', {
    url: 'https://org.osu.edu/asme/pictures/',
    runScripts: 'outside-only'
  });
  const { window } = dom;
  const nativeImageSrc = Object.getOwnPropertyDescriptor(window.HTMLImageElement.prototype, 'src');
  if (legacy) {
    const feature = window.document.querySelector('[data-gallery-instagram-feed]');
    const image = window.document.getElementById('galleryInstagramFeaturedImage');
    feature.classList.remove('is-loading');
    feature.removeAttribute('aria-busy');
    feature.querySelector('.gallery-instagram-loading-art').remove();
    image.src = 'https://example.test/stale-post.jpg';
    image.alt = 'Stale Instagram post';
  }
  window.fetch = fetchResult;
  window.Image = class {
    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  };
  Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() { return nativeImageSrc.get.call(this); },
    set(value) {
      nativeImageSrc.set.call(this, value);
      queueMicrotask(() => this.dispatchEvent(new window.Event('load')));
    }
  });
  if (configure) configure(window);
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { dom, window, document: window.document };
}

test('replaces legacy static content with a loading placeholder until the current Instagram image is ready', async () => {
  const view = setup(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [latestPost] }) }), { legacy: true });
  const feature = view.document.querySelector('[data-gallery-instagram-feed]');
  const image = view.document.getElementById('galleryInstagramFeaturedImage');

  assert.equal(feature.classList.contains('is-loading'), true);
  assert.equal(image.getAttribute('src'), null);
  assert.equal(feature.querySelectorAll('.gallery-instagram-loading-art').length, 1);
  assert.match(view.document.getElementById('gallery-instagram-title').textContent, /Loading the latest post/);

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(feature.classList.contains('is-loading'), false);
  assert.equal(feature.getAttribute('aria-busy'), 'false');
  assert.equal(image.src, latestPost.imageUrl);
  assert.equal(view.document.getElementById('gallery-instagram-title').textContent, latestPost.title);
  assert.equal(view.document.getElementById('galleryInstagramFeaturedLink').href, latestPost.permalink);
  view.window.close();
});

test('uses an Instagram account link when the feed cannot load', async () => {
  const view = setup(() => Promise.reject(new Error('network unavailable')));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const feature = view.document.querySelector('[data-gallery-instagram-feed]');

  assert.equal(feature.classList.contains('is-unavailable'), true);
  assert.equal(feature.getAttribute('aria-busy'), 'false');
  assert.equal(view.document.getElementById('galleryInstagramFeaturedImage').getAttribute('src'), null);
  assert.equal(view.document.getElementById('galleryInstagramFeaturedLink').href, 'https://www.instagram.com/asmeohiostate/');
  assert.equal(view.document.getElementById('galleryInstagramFeaturedButton').textContent, 'Visit @asmeohiostate');
  view.window.close();
});

test('carousel stays paused across focus moves, control clicks, and explicit pause',async()=>{
 const timers=new Map();let id=0;
 const post={...latestPost,carouselImages:[{imageUrl:'https://example.test/one.jpg'},{imageUrl:'https://example.test/two.jpg'}]};
 const v=setup(async()=>({ok:true,json:async()=>({items:[post]})}),{configure(w){w.matchMedia=()=>({matches:false});w.setInterval=fn=>{timers.set(++id,fn);return id};w.clearInterval=id=>timers.delete(id);}});
 await new Promise(r=>setTimeout(r,20));
 const shell=v.document.querySelector('.gallery-instagram-media-shell');
 const controls=shell.querySelectorAll('button'); controls[0].focus();assert.equal(timers.size,0);
 controls[1].focus();controls[1].click();assert.equal(timers.size,0);
 const pause=shell.querySelector('.gallery-instagram-carousel-pause');pause.click();assert.equal(pause.getAttribute('aria-pressed'),'true');
 v.document.body.tabIndex=-1;v.document.body.focus();shell.dispatchEvent(new v.window.MouseEvent('mouseleave'));
 await new Promise(r=>setTimeout(r,1));assert.equal(timers.size,0);v.window.close();
});
