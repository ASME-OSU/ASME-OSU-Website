// Compares animation and transition settings between two stylesheets with
// motion ON. The screenshot suite runs with reduced motion (stable pictures),
// so it cannot see an animation or transition that only plays for visitors
// who have not asked for reduced motion.
//   node tests/visual/motion-check.mjs --save   reference from the current stylesheet
//   node tests/visual/motion-check.mjs          compare the current stylesheet with it
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ORIGIN, PAGES } from './config.mjs';
import { launch, render, Snapshot } from './harness.mjs';
import { pool } from './jobs.mjs';

const FILE = 'tests/visual/.output/motion-reference.json';
const save = process.argv.includes('--save');
const PROPS = ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count', 'animation-direction',
  'animation-delay', 'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay'];
const VIEWS = [375, 1280].flatMap(width => ['light', 'dark'].map(scheme => ({ width, scheme })));

const browser = await launch(chromium);
const snapshot = new Snapshot();
const result = {};
await pool(PAGES.flatMap(page => VIEWS.map(view => ({ page, ...view }))), 3, async ({ page: pg, width, scheme }) => {
  const { page, context } = await render(browser, snapshot, {
    mode: 'replay', url: ORIGIN + pg.path, width, scheme, motion: 'no-preference', holdStartupTimers: true
  });
  result[`${pg.name}--${width}--${scheme}`] = await page.evaluate(props => {
    const captured = [];
    const pathOf = el => { const parts = []; for (let n = el; n && n.parentElement; n = n.parentElement) parts.unshift(n.tagName.toLowerCase() + ':' + (Array.prototype.indexOf.call(n.parentElement.children, n) + 1)); return parts.join('>'); };
    for (const el of document.querySelectorAll('.entry-content, .entry-content *, .asme-footer-inner, .asme-footer-inner *')) {
      for (const pseudo of ['', '::before', '::after']) {
        const s = getComputedStyle(el, pseudo || null);
        if (pseudo && s.content === 'none') continue;
        captured.push({ el, pseudo, key: pathOf(el) + pseudo, values: props.map(p => s.getPropertyValue(p)) });
      }
    }

    // Resolve both delays with the inline reveal input held constant.
    // Literal stylesheet delays and other values in the same list still
    // resolve as authored. Keep the original values for all other properties.
    const overrides = [...document.querySelectorAll('[style*="--asme-delay"]')].map(el => ({
      style: el.style,
      delay: el.style.getPropertyValue('--asme-delay'),
      priority: el.style.getPropertyPriority('--asme-delay')
    })).filter(entry => entry.delay);
    const delayIndexes = ['animation-delay', 'transition-delay'].map(prop => props.indexOf(prop));
    try {
      for (const { style, priority } of overrides) style.setProperty('--asme-delay', '0ms', priority);
      if (overrides.length) {
        for (const { el, pseudo, values } of captured) {
          const style = getComputedStyle(el, pseudo || null);
          for (const index of delayIndexes) values[index] = style.getPropertyValue(props[index]);
        }
      }
    } finally {
      for (const { style, delay, priority } of overrides) style.setProperty('--asme-delay', delay, priority);
    }

    const out = {};
    for (const { key, values } of captured) {
      const signature = values.join(' | ');
      if (/^none \| 0s/.test(signature) && /\| 0s \| all \| 0s \| ease \| 0s$/.test(signature)) continue;
      out[key] = signature;
    }
    return out;
  }, PROPS);
  await context.close();
});
await browser.close();

if (save) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(result));
  const count = Object.values(result).reduce((total, values) => total + Object.keys(values).length, 0);
  console.log(`Saved motion reference: ${count} elements with motion.`);
  process.exit(0);
}
const ref = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let differences = 0;
const byPage = {};
for (const [view, elements] of Object.entries(ref)) {
  const now = result[view] || {};
  for (const key of new Set([...Object.keys(elements), ...Object.keys(now)])) {
    if (elements[key] === now[key]) continue;
    differences += 1;
    const page = view.split('--')[0];
    (byPage[page] ||= []).push(`${view}  ${key.slice(-70)}\n      was: ${elements[key] || '(no motion)'}\n      now: ${now[key] || '(no motion)'}`);
  }
}
for (const [page, list] of Object.entries(byPage)) { console.log(`${page}: ${list.length} differences`); list.slice(0, process.argv.includes('--all') ? Infinity : 6).forEach(line => console.log('  ' + line)); }
console.log(differences ? `${differences} motion differences.` : 'Motion matches.');
