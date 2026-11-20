// Rebuilds page stylesheets from the frozen Phase 1 stylesheet.
//
//   node scripts/css-rebuild.mjs                 every page, in parallel
//   node scripts/css-rebuild.mjs gallery join    only these (others keep their files)
//   add --verify to screenshot the rebuilt pages afterwards (standard and
//   in-between widths) and run the browser tests.
//
// Every page compiles against the same input, the Phase 1 stylesheet with no
// page files, so pages do not depend on each other: they run at the same time
// and one page can be redone alone. Removing the rules each page took over
// from the shared layers is a separate quick step (--strip renders nothing),
// done for every page at the end, followed by one build.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const BASE = '5cb11bb'; // Phase 1: foundation laid, no page files yet.
const LAYERS = ['ASME Custom CSS.css', 'ASME Custom CSS.min.css', 'styles/design-system.css', 'styles/widescreen.css', 'styles/home-hero.css', 'styles/tablet.css', 'styles/home-event.css'];
// Units compile together; a group shares ownership of selectors across its pages.
const UNITS = [
  ['about'], ['calendar'], ['privacy'], ['sponsor-asme', 'current-sponsors'], ['gallery'], ['leadership'],
  ['join'], ['member-resources', 'member-points'], ['footer'], ['home']
];
const ALL = UNITS.flat();

const args = process.argv.slice(2);
const verify = args.includes('--verify');
const asked = args.filter(a => !a.startsWith('--'));
for (const name of asked) if (!ALL.includes(name)) throw new Error(`Unknown page ${name}. Pages: ${ALL.join(', ')}`);
const selected = asked.length ? ALL.filter(name => asked.includes(name) || UNITS.find(u => u.includes(name)).some(n => asked.includes(n))) : ALL;
const jobs = Number(process.env.JOBS) || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));
const LOGS = 'tests/visual/.output/rebuild';
fs.mkdirSync(LOGS, { recursive: true });

const run = (cmd, argv, log) => new Promise((resolve, reject) => {
  const out = log ? fs.openSync(log, 'w') : 'inherit';
  const child = spawn(cmd, argv, { stdio: ['ignore', out, out] });
  child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${cmd} ${argv.join(' ')} exited ${code}${log ? ` (see ${log})` : ''}`))));
});
const build = () => execFileSync('node', ['scripts/build-styles.mjs'], { stdio: 'ignore' });
const groupOf = name => UNITS.find(u => u.includes(name));
const started = Date.now();
const elapsed = () => `${Math.round((Date.now() - started) / 60000)} min`;

// 1. Phase 1 layers, with no page files, as every compile's input. Page files
//    of pages not being rebuilt are kept aside and put back afterwards.
const keep = fs.mkdtempSync(path.join(os.tmpdir(), 'asme-pages-'));
for (const file of fs.existsSync('styles/pages') ? fs.readdirSync('styles/pages') : []) fs.renameSync(path.join('styles/pages', file), path.join(keep, file));
for (const file of LAYERS) fs.writeFileSync(file, execFileSync('git', ['show', `${BASE}:${file}`]));
build();
console.log(`Rebuilding ${selected.join(', ')} from Phase 1 (${jobs} at a time).`);

// 2. Compile the selected pages in parallel. Each writes only its page file.
let failed = false;
const queue = [...selected];
await Promise.all(Array.from({ length: jobs }, async () => {
  while (queue.length) {
    const name = queue.shift();
    const log = `${LOGS}/${name}.log`;
    console.log(`  [building]  ${name}`);
    try {
      await run('node', ['scripts/css-compile-page.mjs', name, `--group=${groupOf(name).join(',')}`, '--emit', '--tokens'], log);
      const summary = fs.readFileSync(log, 'utf8').split('\n').find(line => line.startsWith(`${name}: `)) || '';
      console.log(`  [done]      ${summary.replace(/; specificity.*/, '')} (${elapsed()})`);
    } catch (error) { failed = true; console.error(`  [failed]    ${name}: ${error.message}`); }
  }
}));
for (const file of fs.readdirSync(keep)) if (!selected.includes(file.replace(/\.css$/, ''))) fs.renameSync(path.join(keep, file), path.join('styles/pages', file));
fs.rmSync(keep, { recursive: true, force: true });
if (failed) { console.error('Some pages failed; the layers were left at Phase 1. Fix and rerun those pages.'); process.exit(1); }

// 3. Remove every page's rules from the shared layers (quick), then build.
for (const unit of UNITS) await run('node', ['scripts/css-compile-page.mjs', unit[0], `--group=${unit.join(',')}`, '--strip'], `${LOGS}/strip-${unit[0]}.log`);
build();
console.log(`Stylesheet built (${elapsed()}).`);

// 4. Optional checks, limited to the rebuilt pages. The footer is on every page.
if (verify) {
  const pages = selected.includes('footer') ? [] : selected;
  const only = pages.length ? [`--only=${pages.map(p => `${p}--`).join(',')}`] : [];
  console.log('Screenshots (standard widths)…');
  await run('node', ['tests/visual/run.mjs', ...only], `${LOGS}/verify-standard.log`).catch(() => {});
  console.log('Screenshots (in-between widths)…');
  const widths = ['480', '640', '900', '1100', '1440', '1700'];
  const between = pages.length ? pages.flatMap(p => widths.map(w => `${p}--${w}--`)) : widths.map(w => `--${w}--`);
  process.env.VISUAL_WIDTHS = widths.join(',');
  await run('node', ['tests/visual/run.mjs', `--only=${between.join(',')}`], `${LOGS}/verify-widths.log`).catch(() => {});
  delete process.env.VISUAL_WIDTHS;
  console.log('Browser tests…');
  await run('node', ['tests/browser-smoke.mjs'], `${LOGS}/verify-browser.log`).catch(() => {});
  for (const file of ['verify-standard', 'verify-widths', 'verify-browser']) {
    const text = fs.readFileSync(`${LOGS}/${file}.log`, 'utf8');
    for (const line of text.split('\n')) if (/^(CHANGED|STYLES|ERROR)|screenshots match|^# (pass|fail)|^not ok/.test(line)) console.log('  ' + line.slice(0, 170));
  }
}
console.log(`Finished in ${elapsed()}.`);
