// Which stylesheet rules style a given page, tested against its rendered DOM at
// every suite width and color scheme (media queries evaluated for real).
//   node scripts/css-page-rules.mjs about            summary
//   node scripts/css-page-rules.mjs about --list     every matching rule
//   node scripts/css-page-rules.mjs about --json > out.json
// Needs the visual snapshot (npm run visual:capture) and
// tests/visual/.output/classes.json (node tests/visual/collect-classes.mjs).
// Interaction states (:hover, :focus…) are stripped before matching, so a rule
// counts if its element exists, whatever state it styles.
import fs from 'node:fs';
import { generate, parse, walk } from 'css-tree';
import { chromium } from 'playwright';
import { ORIGIN, PAGES, SCHEMES, WIDTHS } from '../tests/visual/config.mjs';
import { launch, render, Snapshot } from '../tests/visual/harness.mjs';
import { reach, sourceTokens } from './css-inventory.mjs';

const name = process.argv[2];
const target = PAGES.find(page => page.name === name);
if (!target) throw new Error(`Usage: node scripts/css-page-rules.mjs <${PAGES.map(p => p.name).join('|')}>`);

const css = fs.readFileSync('ASME Custom CSS.css', 'utf8');
const layerAt = offset => {
  const end = css.indexOf('/* ASME FOUNDATION END */');
  const shared = css.indexOf('/* ASME SHARED DESIGN SYSTEM START */');
  return offset < end ? 'foundation' : offset < shared ? 'legacy' : 'shared';
};
const rules = [];
walk(parse(css, { positions: true }), {
  visit: 'Rule',
  enter(node) {
    if (this.atrule && /keyframes/.test(this.atrule.name)) return;
    const conditions = [];
    // Collect every enclosing @media (css-tree exposes only the nearest at-rule).
    for (let at = this.atrule; at; at = null) if (at.name === 'media') conditions.push(generate(at.prelude));
    const selectors = node.prelude.children.toArray().map(s => generate(s));
    let decls = 0; let important = 0;
    node.block.children.forEach(d => { if (d.type === 'Declaration') { decls += 1; if (d.important) important += 1; } });
    rules.push({ line: node.loc.start.line, layer: layerAt(node.loc.start.offset), media: conditions.join(' and '), selectors, decls, important, bytes: generate(node).length });
  }
});

// Which other pages each rule can reach, from the recorded class lists.
const rendered = JSON.parse(fs.readFileSync('tests/visual/.output/classes.json', 'utf8'));
reach(rules, rendered, sourceTokens(fs.readdirSync('.').filter(f => /\.(html|js)$/.test(f))));

const snapshot = new Snapshot();
const browser = await launch(chromium);
const hits = new Map();
for (const width of WIDTHS) for (const scheme of SCHEMES) {
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + target.path, width, scheme });
  const matched = await page.evaluate(list => {
    const strip = sel => sel
      .replace(/::?(before|after|placeholder|marker|selection|first-line|first-letter|backdrop|file-selector-button|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g, '')
      .replace(/:(hover|focus|focus-visible|focus-within|active|visited|checked|disabled|target|placeholder-shown)(?![\w-])/g, '')
      .trim() || '*';
    return list.map(({ media, selectors }, index) => {
      if (media && !matchMedia(media).matches) return null;
      let count = 0; let content = 0;
      for (const selector of selectors) {
        try {
          for (const el of document.querySelectorAll(strip(selector))) { count += 1; if (el.closest('.entry-content')) content += 1; }
        } catch {}
      }
      return count ? [index, count, content] : null;
    }).filter(Boolean);
  }, rules.map(r => ({ media: r.media, selectors: r.selectors })));
  for (const [index, count, content] of matched) {
    const hit = hits.get(index) || { views: new Set(), elements: 0, content: 0 };
    hit.views.add(`${width}-${scheme}`); hit.elements = Math.max(hit.elements, count); hit.content = Math.max(hit.content, content);
    hits.set(index, hit);
  }
  await context.close();
}
await browser.close();

const result = [...hits].map(([index, hit]) => ({ ...rules[index], views: [...hit.views], elements: hit.elements, content: hit.content, only: rules[index].pages.length <= 1 }));
if (process.argv.includes('--json')) { console.log(JSON.stringify(result)); process.exit(0); }
if (process.argv.includes('--list')) {
  for (const r of result) console.log(`${r.layer.padEnd(10)} ${String(r.line).padStart(6)} ${r.only ? 'ONLY ' : r.content ? 'SHARE' : 'CHROM'} ${r.media ? '@media ' + r.media + ' ' : ''}${r.selectors.join(', ').slice(0, 160)}`);
  process.exit(0);
}
const group = {};
for (const r of result) {
  const key = `${r.layer} / ${r.only ? `only ${name}` : r.content ? 'shared, reaches page content' : 'shared, header/footer/chrome only'}`;
  group[key] ||= { rules: 0, important: 0, bytes: 0 };
  group[key].rules += 1; group[key].important += r.important; group[key].bytes += r.bytes;
}
console.log(`Rules styling ${name} at ${WIDTHS.length} widths × light/dark:`);
for (const [key, g] of Object.entries(group).sort()) console.log(`  ${key.padEnd(40)} ${String(g.rules).padStart(5)} rules ${String(g.important).padStart(6)} !important ${String(Math.round(g.bytes / 1024)).padStart(4)} KB`);
