// Shared rendering for the visual regression suite.
//
// capture: loads the live site once and records every response into .snapshot/.
// replay:  serves the recorded responses offline, except this repository's own
//          CSS/JS/images, which come from the working tree. Data feeds (calendar,
//          Instagram, Google Photos, points sheet, Social Hub archive) stay frozen,
//          so only local code changes can alter a screenshot.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const VISUAL_DIR = path.join(ROOT, 'tests/visual');
export const SNAPSHOT_DIR = path.join(VISUAL_DIR, '.snapshot');
const BODY_DIR = path.join(SNAPSHOT_DIR, 'bodies');
const MANIFEST = path.join(SNAPSHOT_DIR, 'manifest.json');

// Analytics and tracking never affect layout; skip them in both modes.
const BLOCKED = /(googletagmanager\.com|google-analytics\.com|doubleclick\.net|stats\.wp\.com|pixel\.wp\.com)/;
const LOCAL_EXTENSIONS = new Set(['.css', '.js', '.mjs', '.html', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2']);
const KEEP_HEADERS = ['content-type', 'access-control-allow-origin', 'access-control-allow-credentials'];
const BLANK_FRAME = '<!doctype html><html><body style="margin:0;background:#d9dee5"></body></html>';

export function keyFor(raw) {
  const url = new URL(raw);
  url.hash = '';
  url.searchParams.delete('_');
  if (url.hostname === 'docs.google.com') {
    const tqx = url.searchParams.get('tqx');
    if (tqx) url.searchParams.set('tqx', tqx.replace(/responseHandler:[^;]+/, 'responseHandler:*'));
  }
  url.searchParams.sort();
  return url.href;
}

function photoBase(raw) {
  const url = new URL(raw);
  return url.origin + url.pathname.replace(/-\d+x\d+(?=\.[a-z]+$)/i, '').replace(/\.[a-z]+$/i, '');
}

// Every image URL the page could ask for: all srcset candidates and links to
// full-size photos (the gallery lightbox loads those on click).
async function imageCandidates(page) {
  return page.evaluate(() => {
    const urls = new Set();
    const add = value => { try { const url = new URL(value, location.href); if (/^https?:$/.test(url.protocol)) urls.add(url.href); } catch {} };
    document.querySelectorAll('img[srcset], source[srcset]').forEach(el => el.srcset.split(',').forEach(part => add(part.trim().split(/\s+/)[0])));
    document.querySelectorAll('img[src]').forEach(img => add(img.getAttribute('src')));
    document.querySelectorAll('a[href]').forEach(a => { if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.getAttribute('href'))) add(a.getAttribute('href')); });
    return [...urls];
  });
}

async function recordCandidates(page, snapshot) {
  const urls = (await imageCandidates(page)).filter(url => !localFile(url) && !BLOCKED.test(url) && !snapshot.lookup(url));
  for (const url of urls) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await page.context().request.get(url, { timeout: 90_000 });
        if (response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
        snapshot.record(url, response.status(), response.headers(), await response.body());
        break;
      } catch (error) {
        if (attempt === 3) snapshot.missing.add(`${keyFor(url)} (${error.message.split('\n')[0]})`);
        else await new Promise(resolve => setTimeout(resolve, 5000 * attempt * attempt));
      }
    }
  }
}

function jsonpHandler(raw) {
  const tqx = new URL(raw).searchParams.get('tqx') || '';
  const match = tqx.match(/responseHandler:([^;]+)/);
  return match ? match[1] : null;
}

// Map a request for this repository's published files to the working tree.
// JSON stays frozen in the snapshot because bots rewrite it hourly.
export function localFile(raw) {
  const url = new URL(raw);
  let rel = null;
  if (url.hostname === 'asme-osu.github.io' && url.pathname.startsWith('/ASME-OSU-Website/')) {
    rel = url.pathname.slice('/ASME-OSU-Website/'.length);
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    const match = url.pathname.match(/^\/gh\/ASME-OSU\/ASME-OSU-Website@[^/]+\/(.+)$/);
    if (match) rel = match[1];
  }
  if (!rel) return null;
  rel = decodeURIComponent(rel);
  if (!LOCAL_EXTENSIONS.has(path.extname(rel).toLowerCase())) return null;
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  return file;
}

const TYPES = {
  '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

export class Snapshot {
  constructor() {
    this.entries = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { capturedAt: null, responses: {} };
    this.missing = new Set();
  }
  get capturedAt() { return this.entries.capturedAt; }
  // A fresh capture replaces everything; otherwise new responses are merged in
  // and the original capture time is kept so frozen dates stay the same.
  start({ fresh = false } = {}) {
    fs.mkdirSync(BODY_DIR, { recursive: true });
    if (fresh || !this.entries.capturedAt) this.entries = { capturedAt: new Date().toISOString(), responses: {} };
  }
  save() { fs.writeFileSync(MANIFEST, JSON.stringify(this.entries, null, 1)); }
  // Pages recorded as HTTP errors (e.g. a 429 rate-limit page) would silently
  // become baselines of an error screen.
  errorPages(urls) {
    return urls.filter(url => {
      const entry = this.entries.responses[keyFor(url)];
      return !entry || entry.status >= 400;
    });
  }
  forget(urls) { for (const url of urls) delete this.entries.responses[keyFor(url)]; }
  record(raw, status, headers, body) {
    const hash = crypto.createHash('sha1').update(body).digest('hex');
    const file = path.join(BODY_DIR, hash);
    if (!fs.existsSync(file)) fs.writeFileSync(file, body);
    const kept = Object.fromEntries(KEEP_HEADERS.filter(name => headers[name]).map(name => [name, headers[name]]));
    this.entries.responses[keyFor(raw)] = { status, headers: kept, body: hash, jsonp: jsonpHandler(raw) };
  }
  lookup(raw, { sibling = false } = {}) {
    let entry = this.entries.responses[keyFor(raw)];
    // WordPress serves one photo at several sizes (-768x768, -1536x1152, original).
    // Which size the browser picks can vary with timing, so fall back to any
    // recorded size of the same photo rather than showing a broken image.
    if (!entry && sibling && /\.(png|jpe?g|webp|gif)$/i.test(new URL(raw).pathname)) {
      const base = photoBase(raw);
      const match = Object.keys(this.entries.responses).filter(key => photoBase(key) === base).sort()[0];
      if (match) entry = this.entries.responses[match];
    }
    if (!entry) return null;
    let body = fs.readFileSync(path.join(BODY_DIR, entry.body));
    const handler = jsonpHandler(raw);
    if (entry.jsonp && handler) body = Buffer.from(body.toString('utf8').split(entry.jsonp).join(handler));
    return { status: entry.status, headers: entry.headers, body };
  }
}

// Deterministic Math.random so shuffles and random greetings repeat exactly.
const SEEDED_RANDOM = `(() => {
  let s = 0x2f6b1d3;
  Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
})();`;

// Software rendering with a fixed color profile keeps photo pixels identical
// from run to run; GPU rasterization varies slightly between runs.
export function launch(chromium) {
  return chromium.launch({
    args: ['--disable-gpu', '--force-color-profile=srgb', '--disable-partial-raster', '--disable-skia-runtime-opts',
      '--disable-lcd-text', '--font-render-hinting=none', '--disable-threaded-animation', '--disable-threaded-scrolling']
  });
}

export async function render(browser, snapshot, { mode, url, width, scheme, state, injectCss }) {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: 'reduce',
    locale: 'en-US', timezoneId: 'America/New_York', serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.addInitScript(SEEDED_RANDOM);
  // Gearly offers a tour 4s after a visitor scrolls past 300px, so whether the
  // invitation is on screen depends on timing. Start as a visitor who chose
  // "Maybe later" so it never appears.
  await page.addInitScript(() => { try { localStorage.setItem('asme-gearly-tour-dismissed', 'dismissed'); } catch {} });
  const time = mode === 'replay' && snapshot.capturedAt ? new Date(snapshot.capturedAt) : new Date();
  await page.clock.install({ time });

  await page.route('**/*', async route => {
    const request = route.request();
    const raw = request.url();
    if (!/^https?:/.test(raw) || BLOCKED.test(raw)) return route.abort();
    if (state?.blockHeader && /Header(%20| )Integration\.js|Header\.css/.test(raw)) return route.abort();
    // Third-party embeds (Google Calendar) render outside our CSS; keep them blank.
    if (request.resourceType() === 'document' && request.frame() !== page.mainFrame()) {
      return route.fulfill({ contentType: 'text/html', body: BLANK_FRAME });
    }
    const local = localFile(raw);
    if (local) {
      let body = fs.readFileSync(local);
      if (injectCss && local.endsWith('.css') && local.includes('ASME Custom CSS')) body = Buffer.concat([body, Buffer.from('\n' + injectCss)]);
      return route.fulfill({ contentType: TYPES[path.extname(local).toLowerCase()] || 'application/octet-stream', body, headers: { 'access-control-allow-origin': '*' } });
    }
    const known = snapshot.lookup(raw, { sibling: mode === 'replay' });
    if (mode === 'capture' && !known) {
      // Large original photos can be slow, and org.osu.edu answers bursts with
      // 429 Too Many Requests. Back off and retry; never record an error page.
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          const response = await route.fetch({ timeout: 90_000 });
          const body = await response.body();
          if (response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
          snapshot.record(raw, response.status(), response.headers(), body);
          return route.fulfill({ response, body });
        } catch (error) {
          if (attempt === 4) { snapshot.missing.add(`${keyFor(raw)} (${error.message.split('\n')[0]})`); return route.abort(); }
          await new Promise(resolve => setTimeout(resolve, 5000 * attempt * attempt));
        }
      }
    }
    if (!known) { snapshot.missing.add(keyFor(raw)); return route.abort(); }
    return route.fulfill({ status: known.status, headers: known.headers, body: known.body });
  });

  const inflight = new Set();
  page.on('request', request => inflight.add(request));
  page.on('requestfinished', request => inflight.delete(request));
  page.on('requestfailed', request => inflight.delete(request));
  page.quiet = () => waitQuiet(page, inflight);

  await page.goto(url, { waitUntil: 'load', timeout: 150_000 });
  await settle(page);
  if (mode === 'capture') await recordCandidates(page, snapshot);
  if (state) { await state.run(page); await page.quiet(); }
  if (mode === 'capture' && state) await recordCandidates(page, snapshot);
  return { page, context };
}

// Wait until no request has been in flight for 600ms and every image has
// finished, so late-loading photos cannot land in one run but not another.
async function waitQuiet(page, inflight) {
  const deadline = Date.now() + 20_000;
  let quietSince = 0;
  while (Date.now() < deadline) {
    const imagesDone = await page.evaluate(() => [...document.images].every(img => img.complete));
    if (inflight.size === 0 && imagesDone) {
      quietSince ||= Date.now();
      if (Date.now() - quietSince >= 600) break;
    } else quietSince = 0;
    await page.waitForTimeout(100);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => null)));
  });
  await page.waitForTimeout(300);
}

async function settle(page) {
  // Load lazy images, then return to the top so fixed headers sit in place.
  // Full-page captures can skip painting off-screen images decoded asynchronously.
  await page.evaluate(() => document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; img.decoding = 'sync'; }));
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.quiet();
  // Scripts that lay out from image sizes (the gallery's justified rows) use
  // whichever images had loaded on their last pass, so results follow load
  // order. One resize after everything has loaded makes them lay out again
  // from final inputs.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.quiet();
}
