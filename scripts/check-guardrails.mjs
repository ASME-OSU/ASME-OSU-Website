// Repository guardrails, run by `npm run check` (locally and in CI).
// Each check guards a mistake that has happened or is easy to make; the
// messages say how to fix it. See AGENTS.md.
import fs from 'node:fs';

const problems = [];
const read = file => fs.readFileSync(file, 'utf8');

// 1. Instructions for AI tools exist, and CLAUDE.md points at AGENTS.md so
//    the two never drift apart.
if (!fs.existsSync('AGENTS.md')) problems.push('AGENTS.md is missing: it holds the instructions for AI coding tools.');
if (!fs.existsSync('CLAUDE.md') || !/^@AGENTS\.md\b/m.test(read('CLAUDE.md'))) problems.push('CLAUDE.md must import AGENTS.md (a line "@AGENTS.md"); edit the instructions in AGENTS.md.');

// 2. Gearly's two files carry the same ?v= in every copy of the footer code.
//    The bootstrap passes its own ?v= to every file it loads, so a mismatch
//    serves a stale launcher with new styles (or the reverse).
for (const file of ['Footer.html', 'Gearly Embed.html']) {
  const versions = [...read(file).matchAll(/assets\/gearly\/(gearly\.css|gearly-bootstrap\.js)\?v=([\w.-]+)/g)];
  const values = new Set(versions.map(m => m[2]));
  if (versions.length < 2) problems.push(`${file}: expected gearly.css and gearly-bootstrap.js links with ?v= values.`);
  else if (values.size > 1) problems.push(`${file}: gearly.css and gearly-bootstrap.js have different ?v= values (${[...values].join(', ')}); use one value for both.`);
}
const gearlyVersion = file => (read(file).match(/gearly-bootstrap\.js\?v=([\w.-]+)/) || [])[1];
if (gearlyVersion('Footer.html') !== gearlyVersion('Gearly Embed.html')) {
  problems.push(`Footer.html and Gearly Embed.html load Gearly with different ?v= values (${gearlyVersion('Footer.html')} vs ${gearlyVersion('Gearly Embed.html')}); they must match each other and WordPress.`);
}

// 3. Page style files: the compile record only names pages that exist. A page missing from the
//    record was edited by hand (or never compiled) and is protected from
//    being recompiled over.
const pages = fs.readdirSync('styles/pages').filter(f => f.endsWith('.css')).map(f => f.slice(0, -4));
let compiled = {};
try { compiled = JSON.parse(read('styles/pages/.compiled.json')); } catch { problems.push('styles/pages/.compiled.json is missing or not valid JSON.'); }
for (const page of Object.keys(compiled)) if (!pages.includes(page)) problems.push(`styles/pages/.compiled.json names "${page}", which has no page file.`);
// (Whether the built stylesheet matches these files is checked by
// scripts/build-styles.mjs --check, also part of npm run check.)

// 4. Live-widget rule lists, kept so --strip leaves those rules in place.
for (const file of fs.existsSync('styles/live') ? fs.readdirSync('styles/live') : []) {
  try { if (!Array.isArray(JSON.parse(read(`styles/live/${file}`)))) throw new Error(); } catch { problems.push(`styles/live/${file} is not a JSON list of selectors.`); }
}

if (problems.length) {
  console.error('Guardrail checks failed:\n' + problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Guardrails passed (${pages.length} page style files, ${Object.keys(compiled).length} unchanged since compiled).`);
