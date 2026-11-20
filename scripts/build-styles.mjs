import fs from 'node:fs';
import { parse, generate } from 'css-tree';

// ASME Custom CSS.css is assembled in three layers:
//   1. foundation: styles/tokens.css + styles/foundation.css (site-wide base)
//   2. legacy:     the hand-edited rules kept in this file between the markers
//   3. shared:     styles/design-system.css and the other styles/*.css files
// Only the legacy layer is edited in place; the other two are regenerated.
const sourcePath = 'ASME Custom CSS.css';
const FOUNDATION_START = '/* ASME FOUNDATION START */';
const FOUNDATION_END = '/* ASME FOUNDATION END */';
const marker = '/* ASME SHARED DESIGN SYSTEM START */';
const end = '/* ASME SHARED DESIGN SYSTEM END */';
const read = path => fs.readFileSync(path, 'utf8').trim();
const existing = fs.readFileSync(sourcePath, 'utf8');
let legacy = existing.split(marker)[0];
// Keep what sits above the generated foundation block (hoisted @imports) and
// everything after it; the block itself is regenerated below.
if (legacy.includes(FOUNDATION_END)) legacy = legacy.slice(0, legacy.indexOf(FOUNDATION_START)) + legacy.slice(legacy.indexOf(FOUNDATION_END) + FOUNDATION_END.length);
legacy = legacy.trim();
// @charset and @import only work at the very start of a stylesheet (the DM Sans
// and DM Serif Display fonts load through an @import), so they are hoisted above
// the foundation block. Comments between them are kept in place.
const hoisted = [];
legacy = legacy.replace(/^\s*(@charset\s+"[^"]*";|@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;\n]*;)\s*$/gm, (_, rule) => { hoisted.push(rule); return ''; }).trim();
const foundation = ['styles/tokens.css', 'styles/foundation.css'].filter(path => fs.existsSync(path)).map(read).join('\n\n');
const shared = ['styles/design-system.css', 'styles/widescreen.css', 'styles/home-hero.css', 'styles/tablet.css', 'styles/home-event.css'].map(read).join('\n\n');
// 4. pages: styles/pages/<page>.css, rebuilt page by page (Phase 2). They come
//    last so they win ties against anything left in the layers above.
const pageDir = 'styles/pages';
const pages = fs.existsSync(pageDir) ? fs.readdirSync(pageDir).filter(f => f.endsWith('.css')).sort().map(f => read(`${pageDir}/${f}`)).join('\n\n') : '';
const PAGES_START = '/* ASME PAGES START */';
const PAGES_END = '/* ASME PAGES END */';
const source = (hoisted.length ? hoisted.join('\n') + '\n\n' : '') + (foundation ? FOUNDATION_START + '\n' + foundation + '\n' + FOUNDATION_END + '\n\n' : '') + legacy + '\n\n' + marker + '\n' + shared + '\n' + end + '\n' + (pages ? '\n' + PAGES_START + '\n' + pages + '\n' + PAGES_END + '\n' : '');
// Browsers silently ignore an @import that follows any other rule.
let sawRule = false;
for (const node of parse(source).children) {
  if (node.type === 'Atrule' && ['import', 'charset'].includes(node.name)) {
    if (sawRule) throw new Error('@' + node.name + ' after other rules would be ignored by browsers; keep it at the top of the legacy layer');
  } else sawRule = true;
}
// Preserve every rule and its order; no selector merging or cascade rewrites.
const minified = generate(parse(source)) + '\n';
if (generate(parse(minified)) !== generate(parse(source))) throw new Error('CSS round-trip mismatch');
const files = new Map([[sourcePath, source], ['ASME Custom CSS.min.css', minified]]);
for (const [path, content] of files) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(path) || fs.readFileSync(path, 'utf8') !== content) throw new Error(path + ' is stale; run npm run build:styles');
  } else fs.writeFileSync(path, content);
}
console.log(`Styles verified: ${Buffer.byteLength(source)} source bytes → ${Buffer.byteLength(minified)} minified bytes.`);
