// Record which classes and ids appear on each page after its scripts run, at
// phone and desktop widths and in every interaction state the suite covers.
// Output: tests/visual/.output/classes.json  { page: { classes: [...], ids: [...] } }
// Used by scripts/css-inventory.mjs --reach to see which pages a rule can match.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PAGES } from './config.mjs';
import { launch, render, Snapshot, VISUAL_DIR } from './harness.mjs';
import { jobs, pool } from './jobs.mjs';

const snapshot = new Snapshot();
const pageName = new Map(PAGES.map(page => ['https://org.osu.edu' + page.path, page.name]));
const list = jobs().filter(job => job.state || [375, 1280].includes(job.width)).filter(job => job.scheme === 'light');
const found = {};
const browser = await launch(chromium);
await pool(list, 4, async job => {
  const { page, context } = await render(browser, snapshot, { mode: 'replay', ...job });
  const seen = await page.evaluate(() => {
    const classes = new Set(); const ids = new Set();
    for (const el of document.querySelectorAll('*')) {
      el.classList.forEach(cls => classes.add(cls));
      if (el.id) ids.add(el.id);
    }
    classes.add('__html:' + document.documentElement.className);
    return { classes: [...classes], ids: [...ids] };
  });
  const name = pageName.get(job.url);
  found[name] ||= { classes: new Set(), ids: new Set() };
  seen.classes.forEach(cls => found[name].classes.add(cls));
  seen.ids.forEach(id => found[name].ids.add(id));
  await context.close();
});
await browser.close();
const out = Object.fromEntries(Object.entries(found).map(([name, s]) => [name, { classes: [...s.classes].sort(), ids: [...s.ids].sort() }]));
fs.mkdirSync(path.join(VISUAL_DIR, '.output'), { recursive: true });
fs.writeFileSync(path.join(VISUAL_DIR, '.output', 'classes.json'), JSON.stringify(out));
console.log(Object.entries(out).map(([name, s]) => `${name}: ${s.classes.length} classes`).join('\n'));
