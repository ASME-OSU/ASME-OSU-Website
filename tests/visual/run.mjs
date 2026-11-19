// Screenshot every page/state from the recorded snapshot.
//   --update          write baselines to tests/visual/.baseline/
//   (default)         compare against baselines; report in tests/visual/.output/
//   --only=a,b        limit to job ids containing any of these terms
//   --inject-css=...  append CSS to the main stylesheet (harness self-test)
//   --max-pixels=N    allowed changed pixels per screenshot (default 0)
//   --pixels-only     ignore computed-style differences (for intended redesigns)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { launch, render, Snapshot, VISUAL_DIR } from './harness.mjs';
import { captureStyles, compareStyles } from './styles.mjs';
import { ORIGIN, PAGES } from './config.mjs';
import { jobs, option, pool } from './jobs.mjs';

const update = process.argv.includes('--update');
const BASELINE = path.join(VISUAL_DIR, '.baseline');
const OUTPUT = path.join(VISUAL_DIR, '.output');
const CURRENT = path.join(OUTPUT, 'current');
const DIFF = path.join(OUTPUT, 'diff');
const maxPixels = Number(option('max-pixels', '0'));
const PHOTO_THRESHOLD = 48; // per-pixel change drawn on the diff image inside photos
const PHOTO_MEAN = Number(option('photo-mean', '12'));
const injectCss = option('inject-css') || undefined;
const pixelsOnly = process.argv.includes('--pixels-only');

const snapshot = new Snapshot();
if (!snapshot.capturedAt) {
  console.error('No snapshot found. Run `npm run visual:capture` first.');
  process.exit(1);
}
const badPages = snapshot.errorPages(PAGES.map(page => ORIGIN + page.path));
if (badPages.length) {
  console.error(`These pages were not recorded successfully: ${badPages.join(', ')}\nRun \`npm run visual:capture\` again (it retries only what is missing).`);
  process.exit(1);
}
const list = jobs(option('only'));
const target = update ? BASELINE : CURRENT;
fs.mkdirSync(target, { recursive: true });
if (!update) { fs.rmSync(DIFF, { recursive: true, force: true }); fs.mkdirSync(DIFF, { recursive: true }); }
fs.rmSync(path.join(OUTPUT, 'missing.txt'), { force: true });

const browser = await launch(chromium);
const results = [];
let done = 0;
await pool(list, Number(option('workers', '3')), async job => {
  const file = path.join(target, job.id + '.png');
  try {
    const { page, context } = await render(browser, snapshot, { mode: 'replay', injectCss, ...job });
    fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(await photoBoxes(page)));
    fs.writeFileSync(file.replace(/\.png$/, '.styles.json'), JSON.stringify(await captureStyles(page)));
    await page.screenshot({ path: file, fullPage: !job.state?.viewportOnly, animations: 'disabled', caret: 'hide', timeout: 150_000 });
    await context.close();
    results.push(update ? { id: job.id, status: 'baseline' } : await compare(job.id));
  } catch (error) {
    results.push({ id: job.id, status: 'error', message: error.message.split('\n')[0] });
  }
  done += 1;
  if (process.stdout.isTTY) process.stdout.write(`\r${update ? 'Baseline' : 'Compared'} ${done}/${list.length}`);
});
await browser.close();
process.stdout.write('\n');

// Boxes of raster photos (img elements and CSS background photos), in screenshot
// coordinates. Chromium may rescale large photos with a slightly different
// filter from run to run, so inside these boxes only large color changes count;
// the boxes themselves must match exactly.
function photoBoxes(page) {
  return page.evaluate(() => {
    const raster = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;
    const boxes = [];
    const add = (el, rect) => {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || Number(style.opacity) === 0 || rect.width < 4 || rect.height < 4) return;
      boxes.push([rect.left + scrollX, rect.top + scrollY, rect.width, rect.height].map(Math.round));
    };
    document.querySelectorAll('img').forEach(img => {
      if (img.complete && img.naturalWidth && raster.test(img.currentSrc || img.src)) add(img, img.getBoundingClientRect());
    });
    document.querySelectorAll('body *').forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && raster.test(bg)) add(el, el.getBoundingClientRect());
    });
    return boxes.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2] || a[3] - b[3]);
  });
}

function readBoxes(file) {
  const json = file.replace(/\.png$/, '.json');
  return fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : [];
}


async function rgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function compare(id) {
  const baseFile = path.join(BASELINE, id + '.png');
  if (!fs.existsSync(baseFile)) return { id, status: 'no-baseline' };
  const currentFile = path.join(CURRENT, id + '.png');
  const [a, b] = await Promise.all([rgba(baseFile), rgba(currentFile)]);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const out = Buffer.alloc(width * height * 4);
  const baseBoxes = readBoxes(baseFile);
  const currentBoxes = readBoxes(currentFile);
  const photosMoved = JSON.stringify(baseBoxes) !== JSON.stringify(currentBoxes);
  // Pad each photo box by a pixel: box edges fall on fractional pixels and
  // their anti-aliased rows vary with the photo's resampling.
  const boxes = [...baseBoxes, ...currentBoxes].map(([x, y, w, h]) => [Math.max(0, x - 1), Math.max(0, y - 1), Math.min(width, x + w + 1), Math.min(height, y + h + 1)]);
  const photo = new Uint8Array(width * height);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y += 1) photo.fill(1, y * width + x0, y * width + x1);
  const photoHit = new Uint8Array(width * height);
  const photoDelta = new Uint8Array(width * height);
  let changed = 0;
  let box = null;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      const inA = x < a.width && y < a.height;
      const inB = x < b.width && y < b.height;
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      let differs = inA !== inB;
      if (inA && inB) {
        const delta = Math.max(Math.abs(a.data[ia] - b.data[ib]), Math.abs(a.data[ia + 1] - b.data[ib + 1]), Math.abs(a.data[ia + 2] - b.data[ib + 2]));
        if (photo[y * width + x]) {
          // Photo pixels are judged per photo below; strong changes are drawn
          // on the diff image either way.
          photoDelta[y * width + x] = delta;
          if (delta > PHOTO_THRESHOLD) photoHit[y * width + x] = 1;
          differs = false;
        } else differs = delta > 2;
      }
      if (differs || photoHit[y * width + x]) {
        out[o] = 230; out[o + 1] = 0; out[o + 2] = 40; out[o + 3] = 255;
      }
      if (differs) {
        changed += 1;
        box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
      } else if (inA && !photoHit[y * width + x]) {
        const gray = Math.round((a.data[ia] + a.data[ia + 1] + a.data[ia + 2]) / 3);
        const faded = Math.round(255 - (255 - gray) * 0.25);
        out[o] = faded; out[o + 1] = faded; out[o + 2] = faded; out[o + 3] = 255;
      }
    }
  }
  // A photo fails when its average color change exceeds PHOTO_MEAN. Measured on
  // this site: resampling noise peaks near 9 (text-heavy flyers), a 3px content
  // shift scores about 15, and a missing or swapped photo scores over 100.
  // Shifts of 1–2px inside an unchanged frame can fall below the limit; the
  // frame's position and size are compared exactly above.
  // A 3px edge band is skipped because rounded-corner anti-aliasing varies.
  const photosChanged = boxes.filter(([x0, y0, x1, y1]) => {
    const [ix0, iy0, ix1, iy1] = [x0 + 3, y0 + 3, x1 - 3, y1 - 3];
    if (ix1 <= ix0 || iy1 <= iy0) return false;
    let sum = 0;
    for (let y = iy0; y < iy1; y += 1) for (let x = ix0; x < ix1; x += 1) sum += photoDelta[y * width + x];
    return sum / ((ix1 - ix0) * (iy1 - iy0)) > PHOTO_MEAN;
  }).length;
  const sizeChanged = a.width !== b.width || a.height !== b.height;
  const pixelsFailed = changed > maxPixels || photosMoved || photosChanged > 0;
  const styles = compareStylesFor(id);
  const failed = pixelsFailed || (!pixelsOnly && styles.total > 0);
  if (pixelsFailed) await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(path.join(DIFF, id + '.png'));
  return {
    id, status: pixelsFailed ? 'changed' : failed ? 'styles' : 'same', changed, styles,
    size: sizeChanged ? `${a.width}x${a.height} → ${b.width}x${b.height}` : undefined,
    region: box ? `x ${box.x0}–${box.x1}, y ${box.y0}–${box.y1}` : undefined,
    photos: [photosMoved && `photo boxes differ (${baseBoxes.length} → ${currentBoxes.length})`, photosChanged && `${photosChanged} photo(s) changed`].filter(Boolean).join(', ') || undefined
  };
}

function compareStylesFor(id) {
  const read = dir => {
    const file = path.join(dir, id + '.styles.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  };
  const before = read(BASELINE); const after = read(CURRENT);
  return before && after ? compareStyles(before, after) : { total: 0, changes: [] };
}

results.sort((x, y) => x.id.localeCompare(y.id));
const bad = results.filter(r => !['same', 'baseline'].includes(r.status));
if (!update) writeReport(results);
if (snapshot.missing.size) {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, 'missing.txt'), [...snapshot.missing].sort().join('\n') + '\n');
  console.log(`${snapshot.missing.size} requests were not in the snapshot (listed in tests/visual/.output/missing.txt). Run \`npm run visual:capture\` to add them.`);
}
for (const r of bad) {
  console.log(`${r.status.toUpperCase().padEnd(11)} ${r.id}${r.changed ? `  ${r.changed} px` : ''}${r.size ? `  size ${r.size}` : ''}${r.region ? `  (${r.region})` : ''}${r.photos ? `  ${r.photos}` : ''}${r.styles?.total ? `  ${r.styles.total} element style(s) differ` : ''}${r.message ? `  ${r.message}` : ''}`);
  for (const change of (r.styles?.changes || []).slice(0, 3)) console.log(`            ${change.key.slice(-70)}  ${change.props.slice(0, 2).join('; ').slice(0, 140)}`);
}
console.log(update
  ? `Wrote ${results.length - bad.length} baselines${bad.length ? `, ${bad.length} failed` : ''}.`
  : `${results.length - bad.length}/${results.length} screenshots match. Report: tests/visual/.output/report.html`);
if (bad.length) process.exitCode = 1;

function writeReport(rows) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const changed = rows.filter(r => r.status !== 'same');
  const body = changed.length ? changed.map(r => `
    <section><h2>${esc(r.id)} <small>${esc(r.status)}${r.changed ? ` · ${r.changed} px` : ''}${r.size ? ` · ${esc(r.size)}` : ''}${r.region ? ` · ${esc(r.region)}` : ''}</small></h2>
    ${r.status === 'changed' ? `<div class="row"><figure><img src="../.baseline/${esc(r.id)}.png"><figcaption>Baseline</figcaption></figure>
    <figure><img src="current/${esc(r.id)}.png"><figcaption>Current</figcaption></figure>
    <figure><img src="diff/${esc(r.id)}.png"><figcaption>Changed pixels</figcaption></figure></div>` : `<p>${esc(r.message || '')}</p>`}
    ${r.styles?.total ? `<details${r.status === 'styles' ? ' open' : ''}><summary>${r.styles.total} element(s) with different computed styles</summary><ul>${r.styles.changes.map(c => `<li><code>${esc(c.key)}</code><br>${c.props.map(esc).join('<br>')}</li>`).join('')}</ul></details>` : ''}</section>`).join('')
    : '<p>All screenshots match the baseline.</p>';
  fs.writeFileSync(path.join(OUTPUT, 'report.html'), `<!doctype html><meta charset="utf-8"><title>Visual diff</title>
  <style>body{font:14px system-ui;margin:24px;background:#f4f5f7}h2{font-size:15px}small{color:#666;font-weight:400}
  .row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}figure{margin:0}img{width:100%;border:1px solid #ccc;background:#fff}
  figcaption{color:#555;margin-top:4px}section{margin-bottom:32px}</style>
  <h1>Visual diff: ${rows.length - changed.length}/${rows.length} match</h1>${body}`);
}
