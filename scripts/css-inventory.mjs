// Read-only report on the main stylesheet: where its rules apply, how many
// declarations use !important, which colors and breakpoints it uses.
//   node scripts/css-inventory.mjs            summary table
//   node scripts/css-inventory.mjs --json     machine-readable output
//   node scripts/css-inventory.mjs --scope=global --list   list rules in a scope
import fs from 'node:fs';
import { generate, parse, walk } from 'css-tree';

const FILE = 'ASME Custom CSS.css';
const MARKER = '/* ASME SHARED DESIGN SYSTEM START */';
export const FOUNDATION_END = '/* ASME FOUNDATION END */';

// Each page's markup is wrapped in one of these classes.
export const PAGE_SCOPES = {
  home: ['asme-home'],
  about: ['asme-about-page'],
  join: ['asme-join-page'],
  calendar: ['asme-cal-page'],
  gallery: ['asme-gallery-page'],
  leadership: ['asme-leadership', 'leadership-board'],
  'sponsor-asme': ['asme-sponsor-page'],
  'current-sponsors': ['asme-sponsors-page'],
  'member-resources': ['asme-member-resources-page'],
  'member-points': ['asme-members-page', 'asme-points-page-v2'],
  privacy: ['asme-privacy-page']
};
const CHROME = {
  header: /#asme-site-header|\.asme-hd-|\.site-header|#masthead|\.main-navigation|\.inside-header|\.menu-toggle|\.main-title|\.site-branding|\.site-logo/,
  footer: /\.asme-footer|\.site-footer|\.footer-widgets|\.site-info/,
  gearly: /\.gearly/,
  lightbox: /\.asme-lightbox/
};
// Selectors that can reach page content when no page scope is present.
const CONTENT = /\.entry-content|#page|#content|#main|\.site-main|\.inside-article|article|\.wp-block|\bbody\b|\bhtml\b|^:root|\*/;

export function scopeOf(selector) {
  const pages = Object.entries(PAGE_SCOPES).filter(([, classes]) => classes.some(cls => new RegExp(`\\.${cls}(?![\\w-])`).test(selector))).map(([name]) => name);
  if (pages.length === 1) return `page:${pages[0]}`;
  if (pages.length > 1) return 'multi-page';
  for (const [name, pattern] of Object.entries(CHROME)) if (pattern.test(selector)) return name;
  return CONTENT.test(selector) ? 'global-content' : 'global-other';
}

export function inventory(css) {
  const ast = parse(css, { positions: true });
  const rules = [];
  walk(ast, {
    visit: 'Rule',
    enter(node) {
      const media = this.atrule && this.atrule.name === 'media' ? generate(this.atrule.prelude) : '';
      const selectors = node.prelude.children ? node.prelude.children.toArray().map(s => generate(s)) : [generate(node.prelude)];
      const scopes = [...new Set(selectors.map(scopeOf))];
      const scope = scopes.length === 1 ? scopes[0] : (scopes.every(s => s.startsWith('page:') || s === 'multi-page') ? 'multi-page' : 'mixed');
      let decls = 0; let important = 0;
      node.block.children.forEach(d => { if (d.type === 'Declaration') { decls += 1; if (d.important) important += 1; } });
      rules.push({ line: node.loc.start.line, start: node.loc.start.offset, end: node.loc.end.offset, scope, scopes, media, atrule: this.atrule ? this.atrule.name : "", atrulePrelude: this.atrule && this.atrule.prelude ? generate(this.atrule.prelude) : "", selectors, decls, important, bytes: generate(node).length });
    }
  });
  return rules;
}

// Classes and ids a selector requires. Anything inside :not(), :is(), :where()
// or :has() is ignored, which can only make a rule look reachable on more
// pages, never fewer.
export function requirements(selector) {
  const needs = { classes: new Set(), ids: new Set() };
  try {
    walk(parse(selector, { context: 'selector' }), {
      enter(node) {
        if (node.type === 'PseudoClassSelector' && node.children) return this.skip;
        if (node.type === 'ClassSelector') needs.classes.add(node.name);
        if (node.type === 'IdSelector') needs.ids.add(node.name);
      }
    });
  } catch {}
  return needs;
}

// Pages whose rendered DOM contains every class and id the selector needs.
// "unrendered": the names exist in this repo's HTML/JS (a state the suite does
// not render, such as an error message). "unused": names found nowhere.
export function reach(rules, rendered, sourceTokens) {
  const pages = Object.entries(rendered).map(([name, s]) => [name, new Set(s.classes), new Set(s.ids)]);
  for (const rule of rules) {
    const hit = new Set(); let inSource = false;
    for (const selector of rule.selectors) {
      const needs = requirements(selector);
      for (const [name, classes, ids] of pages) {
        if ([...needs.classes].every(c => classes.has(c)) && [...needs.ids].every(i => ids.has(i))) hit.add(name);
      }
      if ([...needs.classes, ...needs.ids].every(token => sourceTokens.has(token))) inSource = true;
    }
    rule.pages = [...hit].sort();
    rule.reach = hit.size === 1 ? `page:${rule.pages[0]}` : hit.size > 1 ? (hit.size >= pages.length - 1 ? 'every-page' : 'several-pages') : inSource ? 'unrendered' : 'unused';
  }
  return rules;
}

export function sourceTokens(files) {
  const tokens = new Set();
  for (const file of files) for (const m of fs.readFileSync(file, 'utf8').matchAll(/[A-Za-z_][\w-]*/g)) tokens.add(m[0]);
  return tokens;
}

// WordPress/GeneratePress can produce these in states the suite never renders
// (sidebars, archives, search, pagination, the toggled theme menu, page-id
// body classes), so rules naming them are kept even when nothing matched.
const THEME_NAMES = /site-title|site-description|sidebar|#secondary|widget|posts-navigation|pagination|nav-links|comment|page-id-|postid-|\.archive|\.search|\.single|entry-meta|entry-header|page-header|wp-block|menu-item|main-nav|site-navigation|toggled|menu-toggle|generate|\.blog\b|\.home\b|\.error404/;

// Delete legacy rules that match no rendered page and whose class/id names
// appear nowhere in this repo or the recorded site. Empty @media groups left
// behind are removed too. Writes a CSV of what was removed.
// Remove rules (by source offsets) and any @media/@supports left empty.
function cut(text, rules) {
  for (const r of [...rules].sort((a, b) => b.start - a.start)) text = text.slice(0, r.start) + text.slice(r.end);
  for (let pass = 0; pass < 3; pass += 1) {
    const empties = [];
    walk(parse(text, { positions: true }), {
      visit: 'Atrule',
      enter(node) { if (node.block && node.block.children.isEmpty) empties.push([node.loc.start.offset, node.loc.end.offset]); }
    });
    if (!empties.length) break;
    for (const [start, end] of empties.sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + text.slice(end);
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// The legacy layer sits between the foundation block and the design-system marker.
export function splitStylesheet(full) {
  const start = full.includes(FOUNDATION_END) ? full.indexOf(FOUNDATION_END) + FOUNDATION_END.length : 0;
  const end = full.includes(MARKER) ? full.indexOf(MARKER) : full.length;
  return { start, end, legacy: full.slice(start, end), shared: full.slice(end) };
}

function writeLegacy(full, split, legacy) {
  fs.writeFileSync(FILE, full.slice(0, split.start) + '\n' + legacy + '\n\n' + full.slice(split.end));
}

function removeUnused(full, split, rules, write) {
  const doomed = rules.filter(r => r.reach === 'unused' && !r.selectors.some(s => THEME_NAMES.test(s)));
  const kept = rules.filter(r => r.reach === 'unused').length - doomed.length;
  const text = cut(split.legacy, doomed);
  const bytes = doomed.reduce((t, r) => t + r.bytes, 0);
  console.log(`${doomed.length} unused rules (${Math.round(bytes / 1024)} KB minified, ${doomed.reduce((t, r) => t + r.important, 0)} !important) ${write ? 'removed' : 'would be removed'}; ${kept} kept because they name WordPress theme states.`);
  if (!write) return;
  writeLegacy(full, split, text);
  const date = new Date().toISOString().slice(0, 10);
  const csv = ['line,media,selectors'].concat(doomed.map(r => [r.line, r.media, r.selectors.join(', ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));
  fs.writeFileSync(`docs/css-unused-removals-${date}.csv`, csv.join('\n') + '\n');
  console.log(`Wrote docs/css-unused-removals-${date}.csv. Run npm run build:styles next.`);
}

// Site-wide selectors: theme containers, base elements and the scroll-reveal
// classes. A rule moves to the foundation only if every selector in it uses
// nothing but these, so no page component is pulled out of its page.
const GLOBAL_CLASSES = new Set(['site', 'site-content', 'wrap', 'content-sidebar-wrap', 'content-area', 'site-main', 'inside-article', 'entry-content', 'page-content', 'page', 'site-inner', 'asme-reveal', 'asme-animate', 'is-visible', 'entry-title']);
const GLOBAL_IDS = new Set(['page', 'content', 'primary', 'main']);

// Site-wide rules that must stay in the legacy layer because they win only by
// coming after another legacy rule. Found by the computed-style check:
// `.page article.page` resets the article background that a light-mode rule
// earlier in the legacy layer sets to the page gray.
const KEEP_IN_LEGACY = new Set(['.page article.page']);

function isFoundation(rule) {
  if (rule.reach !== 'every-page' || !['', 'media', 'supports'].includes(rule.atrule)) return false;
  if (KEEP_IN_LEGACY.has(rule.selectors.join(', '))) return false;
  return rule.selectors.every(selector => {
    if (/:has\(|::?-webkit|::?-moz/.test(selector)) return false;
    let ok = true;
    walk(parse(selector, { context: 'selector' }), {
      enter(node) {
        if (node.type === 'ClassSelector' && !GLOBAL_CLASSES.has(node.name)) ok = false;
        if (node.type === 'IdSelector' && !GLOBAL_IDS.has(node.name)) ok = false;
        if (node.type === 'AttributeSelector') ok = false;
      }
    });
    return ok;
  });
}

// Move site-wide rules out of the legacy layer into styles/foundation.css,
// keeping their original relative order and @media/@supports wrappers.
function extractFoundation(full, split, rules, write) {
  const moving = rules.filter(isFoundation);
  const blocks = moving.map(r => {
    const source = split.legacy.slice(r.start, r.end).trim();
    return r.atrule ? `@${r.atrule} ${r.atrulePrelude} {\n  ${source.replace(/\n/g, '\n  ')}\n}` : source;
  });
  console.log(`${moving.length} site-wide rules (${Math.round(moving.reduce((t, r) => t + r.bytes, 0) / 1024)} KB) ${write ? 'moved' : 'would move'} to styles/foundation.css:`);
  for (const r of moving) console.log(`  ${r.line}\t${r.atrule ? '@' + r.atrule + ' ' + r.atrulePrelude + ' ' : ''}${r.selectors.join(', ').slice(0, 120)}`);
  if (!write) return;
  const header = '/* Site-wide base: CSS variables, element defaults, theme containers and the\n   scroll-reveal animation. Built ahead of the legacy layer by build-styles.mjs.\n   Page and component styles do not belong here. */\n';
  fs.writeFileSync('styles/foundation.css', header + '\n' + blocks.join('\n\n') + '\n');
  writeLegacy(full, split, cut(split.legacy, moving));
  console.log('Run npm run build:styles next.');
}

function colors(css) {
  const counts = new Map();
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)) {
    let value = m[0].toLowerCase().replace(/\s+/g, ' ');
    if (/^#[0-9a-f]{3}$/.test(value)) value = '#' + [...value.slice(1)].map(c => c + c).join('');
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function breakpoints(css) {
  const counts = new Map();
  for (const m of css.matchAll(/\((max|min)-width:\s*(\d+)px\)/g)) counts.set(`${m[1]}-${m[2]}`, (counts.get(`${m[1]}-${m[2]}`) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const full = fs.readFileSync(FILE, 'utf8');
  const split = splitStylesheet(full);
  const { legacy, shared } = split;
  const part = process.argv.includes('--shared') ? shared : legacy;
  const rules = inventory(part);
  // --reach groups by the pages each rule can match (needs
  // `node tests/visual/collect-classes.mjs` first) instead of by selector text.
  const useReach = process.argv.includes('--reach');
  if (useReach) {
    const rendered = JSON.parse(fs.readFileSync('tests/visual/.output/classes.json', 'utf8'));
    // Names this repo's pages and scripts can produce, plus anything in the
    // recorded WordPress HTML, theme CSS and theme JS (states such as the
    // toggled theme menu or pagination that the suite does not render).
    const files = fs.readdirSync('.').filter(f => /\.(html|js)$/.test(f)).concat(fs.readdirSync('assets/gearly').filter(f => f.endsWith('.js')).map(f => 'assets/gearly/' + f));
    const manifest = 'tests/visual/.snapshot/manifest.json';
    if (fs.existsSync(manifest)) {
      for (const entry of Object.values(JSON.parse(fs.readFileSync(manifest, 'utf8')).responses)) {
        if (/html|css|javascript/.test(entry.headers['content-type'] || '')) files.push('tests/visual/.snapshot/bodies/' + entry.body);
      }
    }
    reach(rules, rendered, sourceTokens(files));
  }
  const key = r => (useReach ? r.reach : r.scope);
  if (process.argv.includes('--remove-unused')) {
    if (!useReach) throw new Error('--remove-unused needs --reach');
    removeUnused(full, split, rules, process.argv.includes('--write'));
    process.exit(0);
  }
  if (process.argv.includes('--extract-foundation')) {
    if (!useReach) throw new Error('--extract-foundation needs --reach');
    extractFoundation(full, split, rules, process.argv.includes('--write'));
    process.exit(0);
  }
  const scopeArg = (process.argv.find(a => a.startsWith('--scope=')) || '').slice(8);
  if (process.argv.includes('--list')) {
    for (const r of rules.filter(r => !scopeArg || key(r) === scopeArg)) console.log(`${r.line}\t${r.media ? '@media ' + r.media + ' ' : ''}${r.selectors.join(', ').slice(0, 220)}`);
    process.exit(0);
  }
  const by = new Map();
  for (const r of rules) {
    const s = by.get(key(r)) || { rules: 0, decls: 0, important: 0, bytes: 0 };
    s.rules += 1; s.decls += r.decls; s.important += r.important; s.bytes += r.bytes;
    by.set(key(r), s);
  }
  const summary = [...by].sort((a, b) => b[1].bytes - a[1].bytes);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ summary: Object.fromEntries(summary), colors: colors(part), breakpoints: breakpoints(part) }, null, 1));
  } else {
    const total = rules.reduce((t, r) => ({ decls: t.decls + r.decls, important: t.important + r.important, bytes: t.bytes + r.bytes }), { decls: 0, important: 0, bytes: 0 });
    console.log(`${process.argv.includes('--shared') ? 'Design-system' : 'Legacy'} part: ${rules.length} rules, ${total.decls} declarations, ${total.important} !important (${Math.round(total.important / total.decls * 100)}%), ${Math.round(total.bytes / 1024)} KB minified`);
    console.log('scope'.padEnd(26) + 'rules'.padStart(7) + 'decls'.padStart(8) + '!imp'.padStart(8) + 'KB'.padStart(7));
    for (const [scope, s] of summary) console.log(scope.padEnd(26) + String(s.rules).padStart(7) + String(s.decls).padStart(8) + String(s.important).padStart(8) + String(Math.round(s.bytes / 1024)).padStart(7));
    const c = colors(part);
    console.log(`\n${c.length} distinct colors; top 12: ${c.slice(0, 12).map(([v, n]) => `${v}×${n}`).join('  ')}`);
    const b = breakpoints(part);
    console.log(`${b.length} distinct width breakpoints; top 12: ${b.slice(0, 12).map(([v, n]) => `${v}×${n}`).join('  ')}`);
  }
}
