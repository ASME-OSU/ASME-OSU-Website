// Compares animation and transition settings between two stylesheets with
// motion ON. The screenshot suite runs with reduced motion (stable pictures),
// so it cannot see an animation or transition that only plays for visitors
// who have not asked for reduced motion.
//   node tests/visual/motion-check.mjs --save   reference from the current stylesheet
//   node tests/visual/motion-check.mjs          compare the current stylesheet with it
import fs from 'node:fs';
import { chromium } from 'playwright';
import { ORIGIN, PAGES } from './config.mjs';
import { launch, render, Snapshot } from './harness.mjs';
import { pool } from './jobs.mjs';

const FILE = 'tests/visual/.output/motion-reference.json';
const save = process.argv.includes('--save');
const PROPS = ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count', 'animation-direction',
  'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay'];
const VIEWS = [375, 1280].flatMap(width => ['light', 'dark'].map(scheme => ({ width, scheme })));

const browser = await launch(chromium);
const snapshot = new Snapshot();
const result = {};
await pool(PAGES.flatMap(page => VIEWS.map(view => ({ page, ...view }))), 3, async ({ page: pg, width, scheme }) => {
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + pg.path, width, scheme, motion: 'no-preference' });
  result[`${pg.name}--${width}--${scheme}`] = await page.evaluate(props => {
    const out = {};
    const pathOf = el => { const parts = []; for (let n = el; n && n.parentElement; n = n.parentElement) parts.unshift(n.tagName.toLowerCase() + ':' + (Array.prototype.indexOf.call(n.parentElement.children, n) + 1)); return parts.join('>'); };
    for (const el of document.querySelectorAll('.entry-content, .entry-content *, .asme-footer-inner, .asme-footer-inner *')) {
      for (const pseudo of ['', '::before', '::after']) {
        const s = getComputedStyle(el, pseudo || null);
        if (pseudo && s.content === 'none') continue;
        const v = props.map(p => s.getPropertyValue(p)).join(' | ');
        if (/^none \| 0s/.test(v) && /\| all \| 0s \| ease \| 0s$/.test(v)) continue; // no motion at all
        out[pathOf(el) + pseudo] = v;
      }
    }
    return out;
  }, PROPS);
  await context.close();
});
await browser.close();

if (save) { fs.writeFileSync(FILE, JSON.stringify(result)); console.log(`Saved motion reference: ${Object.values(result).reduce((t, v) => t + Object.keys(v).length, 0)} elements with motion.`); process.exit(0); }
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
for (const [page, list] of Object.entries(byPage)) { console.log(`${page}: ${list.length} differences`); list.slice(0, 6).forEach(line => console.log('  ' + line)); }
console.log(differences ? `${differences} motion differences.` : 'Motion matches.');
