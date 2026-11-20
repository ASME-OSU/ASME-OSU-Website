// Record the live site into tests/visual/.snapshot/ (git-ignored).
//   (default)  add anything missing to the existing snapshot
//   --fresh    discard the snapshot and record current live content; baselines
//              must then be rewritten with `npm run visual:baseline`
// org.osu.edu rate-limits bursts (HTTP 429), so the default is two workers.
import { chromium } from 'playwright';
import { ORIGIN, PAGES } from './config.mjs';
import { launch, render, Snapshot } from './harness.mjs';
import { jobs, option, pool } from './jobs.mjs';

const snapshot = new Snapshot();
snapshot.start({ fresh: process.argv.includes('--fresh') });
// Drop anything previously recorded as an error so it is fetched again.
snapshot.forget(Object.entries(snapshot.entries.responses).filter(([, entry]) => entry.status >= 400).map(([url]) => url));
const browser = await launch(chromium);
const list = jobs(option('only'));
let done = 0;
const failures = [];
await pool(list, Number(option('workers', '2')), async job => {
  try {
    const { context } = await render(browser, snapshot, { mode: 'capture', ...job });
    await context.close();
  } catch (error) {
    failures.push(`${job.id}: ${error.message.split('\n')[0]}`);
  }
  done += 1;
  if (process.stdout.isTTY) process.stdout.write(`\rCaptured ${done}/${list.length}`);
});
await browser.close();
snapshot.save();
console.log(`\nRecorded ${Object.keys(snapshot.entries.responses).length} responses at ${snapshot.capturedAt}.`);
if (snapshot.missing.size) console.log(`Could not record ${snapshot.missing.size} responses:\n  ${[...snapshot.missing].join('\n  ')}`);
const badPages = snapshot.errorPages(PAGES.map(page => ORIGIN + page.path));
if (badPages.length) failures.push(`pages not recorded successfully (run capture again later): ${badPages.join(', ')}`);
if (failures.length) {
  console.error('Failed:\n  ' + failures.join('\n  '));
  process.exitCode = 1;
}
