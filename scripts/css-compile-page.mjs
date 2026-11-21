// Compile one page's styling out of the legacy and shared stylesheet layers into
// styles/pages/<page>.css, letting Chrome do the cascade.
//
// For every element on the page, at every suite width and color scheme (plus
// :hover and :focus-visible on interactive elements), Chrome's DevTools protocol
// reports the matched rules in cascade order. A declaration is "owned" when the
// selector that matched is page-only (its classes and ids exist on no other
// rendered page). Where an owned declaration wins, the compiler re-emits that
// value for the element in the page file, with the media conditions that cover
// exactly the views where it won and only as much specificity / !important as
// the remaining (kept) competitors require. With --write it then deletes the
// owned selectors from the legacy layer and the shared styles/*.css files.
//
//   node scripts/css-compile-page.mjs about            dry run: stats + preview
//   node scripts/css-compile-page.mjs about --write    write and remove
//
// Run npm run build:styles and npm run visual:compare afterwards.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { generate, parse, walk } from 'css-tree';
import { chromium } from 'playwright';
import { ORIGIN, PAGES } from '../tests/visual/config.mjs';
import { pool } from '../tests/visual/jobs.mjs';
import { launch, render, Snapshot } from '../tests/visual/harness.mjs';
import { PAGE_SCOPES, requirements } from './css-inventory.mjs';

const name = process.argv[2];
// Fingerprints of compiled page files (styles/pages/.compiled.json). A page
// file that no longer matches was edited by hand; scripts/css-rebuild.mjs
// refuses to recompile it without --force, so hand edits are not lost.
const recordCompiled = (page, css) => {
  const file = 'styles/pages/.compiled.json';
  let record = {};
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  record[page] = createHash('sha256').update(css).digest('hex');
  fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(record).sort()), null, 1) + '\n');
};
// Shared components appear on every page. They are compiled like a page, but
// rooted at their own element: a selector is owned when it needs a class found
// only inside the component (on every page), and the component is rendered on
// one representative page.
const COMPONENTS = {
  footer: { root: 'asme-footer-inner', page: 'home' },
  // The original theme header: hidden while the custom header (Header.css,
  // not part of this bundle) is loaded, shown if it fails to load.
  header: { root: 'site-header', page: 'home' }
};
const component = COMPONENTS[name] || null;
const target = PAGES.find(page => page.name === (component ? component.page : name));
if (!target || (!component && !PAGE_SCOPES[name])) throw new Error(`Usage: node scripts/css-compile-page.mjs <${[...Object.keys(PAGE_SCOPES), ...Object.keys(COMPONENTS)].join('|')}> [--write]`);
const wrapperClass = component ? component.root : PAGE_SCOPES[name][0];
const write = process.argv.includes('--write');
// Pages that share styles (the two sponsor pages) are compiled as a group: a
// selector is owned when every rendered page it can match is in the group.
// Compile each page with --emit (writes only its page file), then run once
// with --strip to remove the group's selectors from the layers.
const groupArg = (process.argv.find(a => a.startsWith('--group=')) || '').slice(8);
const group = new Set(groupArg ? groupArg.split(',') : [name]);
if (!group.has(name)) group.add(name);
const emitOnly = process.argv.includes('--emit');
const stripOnly = process.argv.includes('--strip');
// Pages are rendered with motion on. With reduced motion, the site's
// prefers-reduced-motion rules (transition: none, animation: none) win in
// every view, so the normal transitions and animations were never derived and
// disappeared for everyone else (the hero photo zoom, hover transitions on
// about 1,400 elements). Reduced-motion rules are carried over verbatim.
const MOTION = 'no-preference';
// --live-only lists the owned selectors reaching live widgets (styles/live/)
// and stops: a few minutes instead of a full compile.
const liveOnly = process.argv.includes('--live-only');

// Views and the width ranges they stand for (mobile-first breakpoints). Ten
// widths keep the layouts the legacy CSS had between phone, tablet and
// desktop (iPads, small laptops); each sampled width applies from itself up
// to the next one.
// Each page is also sampled at its own original switch points: every
// min-width / max-width used by a rule naming the page's (or group's, or
// component's) classes. With only the ten fixed widths, a page that switched
// at 901 or 981px used its 900px layout up to 1099px, which broke portrait
// iPads (Join's step bar overlapped; most pages differed). Sampling at the
// switch points makes every range exact. max-width: X switches at X + 1.
const FIXED_WIDTHS = [375, 480, 640, 768, 900, 1100, 1280, 1440, 1700, 1920];
const SWITCH_POINTS = (() => {
  const classes = component ? [component.root.replace(/-inner$/, '')] : [...group].flatMap(page => PAGE_SCOPES[page] || []);
  const points = new Set();
  const visit = (list, media) => list.forEach(node => {
    if (node.type === 'Atrule' && node.block) { visit(node.block.children.toArray(), media.concat(node.prelude ? generate(node.prelude) : '')); return; }
    if (node.type !== 'Rule' || !media.length) return;
    const selector = generate(node.prelude);
    if (!classes.some(c => selector.includes('.' + c))) return;
    for (const m of media.join(' ').matchAll(/(min|max)-width:\s*(\d+(?:\.\d+)?)px/g)) {
      const point = m[1] === 'max' ? Math.floor(Number(m[2])) + 1 : Math.ceil(Number(m[2]));
      if (point > 375 && point < 1920) points.add(point);
    }
  });
  visit(parse(fs.readFileSync('ASME Custom CSS.min.css', 'utf8')).children.toArray(), []);
  return points;
})();
const WIDTHS = [...new Set([...FIXED_WIDTHS, ...SWITCH_POINTS])].sort((x, y) => x - y);
const BOUNDS = [0, ...WIDTHS.slice(1)];
if (!stripOnly) console.log(`Sampling ${WIDTHS.length} widths: ${WIDTHS.join(', ')}`);
const SCHEMES = ['light', 'dark'];
// --strip only removes owned selectors from the layers, which needs no
// rendering: it skips every view and finishes in seconds.
const VIEWS = stripOnly ? [] : WIDTHS.flatMap((width, w) => SCHEMES.map(scheme => ({ width, w, scheme, id: `${width}-${scheme}` })));

// ---- Selector ownership ---------------------------------------------------
const rendered = JSON.parse(fs.readFileSync('tests/visual/.output/classes.json', 'utf8'));
const pageSets = Object.entries(rendered).map(([page, s]) => [page, new Set(s.classes), new Set(s.ids)]);
// Component mode: which classes and ids occur inside the component and which
// occur anywhere else, across every page.
const componentSets = component ? await (async () => {
  const pre = await launch(chromium); const snap = new Snapshot();
  const inside = new Set(); const outside = new Set(); const ids = new Set(); const pageClassLists = [];
  await pool(PAGES, 4, async pg => {
    const { page, context } = await render(pre, snap, { mode: 'replay', url: ORIGIN + pg.path, width: 1280, scheme: 'light', motion: MOTION });
    const r = await page.evaluate(root => {
      const roots = [...document.querySelectorAll('.' + root)];
      const ins = new Set(); const out = new Set(); const idList = new Set(); const byPath = {};
      const pathOf = el => { const parts = []; for (let n = el; n && n.parentElement; n = n.parentElement) parts.unshift(n.tagName + (Array.prototype.indexOf.call(n.parentElement.children, n) + 1)); return parts.join('>'); };
      for (const el of document.querySelectorAll('*')) {
        const within = roots.some(node => node.contains(el));
        el.classList.forEach(c => (within ? ins : out).add(c));
        if (within && el.id) idList.add(el.id);
        if (within) byPath[pathOf(el)] = [...el.classList];
      }
      return { ins: [...ins], out: [...out], ids: [...idList], byPath };
    }, component.root);
    r.ins.forEach(c => inside.add(c)); r.out.forEach(c => outside.add(c)); r.ids.forEach(i => ids.add(i));
    pageClassLists.push(r.byPath);
    await context.close();
  });
  await pre.close();
  // Classes an element has on some pages but not others (the theme menu's
  // current-menu-item) are page state: kept out of keys, and rules needing
  // them are carried verbatim.
  const varying = new Set();
  const paths = new Set(pageClassLists.flatMap(list => Object.keys(list)));
  for (const path of paths) {
    const lists = pageClassLists.map(list => new Set(list[path] || []));
    const all = new Set(lists.flatMap(l => [...l]));
    for (const c of all) if (!lists.every(l => l.has(c))) varying.add(c);
  }
  return { inside, exclusive: new Set([...inside].filter(c => !outside.has(c) && !varying.has(c))), ids, varying };
})() : null;

const ownedCache = new Map();
function owned(selector) {
  if (ownedCache.has(selector)) return ownedCache.get(selector);
  const needs = requirements(selector);
  if (componentSets) {
    const result = needs.classes.size + needs.ids.size > 0
      && [...needs.classes].every(c => componentSets.inside.has(c)) && [...needs.ids].every(i => componentSets.ids.has(i))
      && ([...needs.classes].some(c => componentSets.exclusive.has(c)) || needs.ids.size > 0);
    ownedCache.set(selector, result);
    return result;
  }
  const pages = pageSets.filter(([, classes, ids]) => [...needs.classes].every(c => classes.has(c)) && [...needs.ids].every(i => ids.has(i))).map(([page]) => page);
  const result = needs.classes.size + needs.ids.size > 0 && pages.length >= 1 && pages.every(page => group.has(page));
  ownedCache.set(selector, result);
  return result;
}
const normalize = selector => { try { return generate(parse(selector, { context: 'selector' })); } catch { return selector; } };

// ---- Cascade per element via Chrome DevTools --------------------------------
const cmp = (a, b) => (a.a - b.a) || (a.b - b.b) || (a.c - b.c);
const zero = { a: 0, b: 0, c: 0 };

// Chrome's DevTools protocol sometimes returns a rule without source data (no
// range, empty text). It then lists only longhands it has expanded itself, and
// a var() shorthand such as "background: var(--x)" comes back as empty
// placeholders, losing the value. For those rules, the declarations are read
// from our own parse of the built stylesheet, matched by @media and selectors.
const SOURCE = (() => {
  const index = new Map();
  const visit = (list, media) => list.forEach(node => {
    if (node.type === 'Atrule' && node.block) { if (!/keyframes/.test(node.name)) visit(node.block.children, media.concat(node.name === 'media' ? [generate(node.prelude)] : [])); return; }
    if (node.type !== 'Rule') return;
    const key = media.map(m => m.replace(/\s+/g, '')).join('&') + '|' + node.prelude.children.toArray().map(sel => generate(sel).replace(/\*(?=::?[a-z])/g, '')).join(',');
    const decls = node.block.children.toArray().filter(d => d.type === 'Declaration').map(d => ({ name: d.property, value: generate(d.value).trim(), important: !!d.important }));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(decls);
  });
  visit(parse(fs.readFileSync('ASME Custom CSS.min.css', 'utf8')).children, []);
  return index;
})();
const sourceStats = { used: 0, ambiguous: new Set(), missing: new Set() };
function sourceDeclarations(rule, occurrence = 0) {
  const media = (rule.media || []).filter(m => m.source === 'mediaRule').map(m => m.text.replace(/\s+/g, '')).reverse();
  const key = media.join('&') + '|' + rule.selectorList.selectors.map(sel => normalize(sel.text).replace(/\*(?=::?[a-z])/g, '')).join(',');
  const found = SOURCE.get(key);
  if (!found) { sourceStats.missing.add(key.slice(0, 120)); return null; }
  sourceStats.used += 1;
  // The same selector and media can occur several times with different
  // declarations. Identical selectors match the same elements with the same
  // specificity, and DevTools lists them in source order, so the n-th such
  // rule matched for an element is the n-th occurrence in the source.
  if (occurrence >= found.length) sourceStats.ambiguous.add(key.slice(0, 120));
  const decls = found[Math.min(occurrence, found.length - 1)];
  return decls.map(d => ({ name: d.name, value: d.value, important: d.important }));
}

// Media the compiler can reproduce: widths and color scheme. Rules under any
// other condition (motion preference, orientation, print, hover capability)
// are never re-derived from the test views; they are carried over verbatim.
const MODELED_PART = /^(screen|all)?$|^\((max|min)-width:\d+(\.\d+)?px\)$|^\(prefers-color-scheme:(dark|light)\)$/;
const modeled = media => !media.includes(',') && media.replace(/\s+/g, '').split(/and/).every(part => MODELED_PART.test(part));

// Classes found inside the page content, per view and in total. A selector
// that needs a class found only outside it (the lightbox overlay appended to
// <body>, body-level state classes) targets states the compiler never renders,
// so it is carried verbatim instead of derived.
const contentClasses = new Set();
// Owned selectors that matched an element in at least one view. One that never
// matches targets a state the suite does not render (a later sign-up step,
// an open dialog), so it is carried verbatim instead of being dropped.
const OWNED_SELECTORS = (() => {
  const list = new Set();
  const visit = nodes => nodes.forEach(node => {
    if (node.type === 'Atrule' && node.block) { if (!/keyframes/.test(node.name)) visit(node.block.children); return; }
    if (node.type === 'Rule' && node.prelude.children) node.prelude.children.forEach(sel => { const text = generate(sel); if (owned(text)) list.add(text); });
  });
  visit(parse(fs.readFileSync('ASME Custom CSS.min.css', 'utf8')).children);
  return [...list];
})();
const matchedSelectors = new Set();
const liveMatched = new Set();
if (stripOnly) for (const page of group) { try { JSON.parse(fs.readFileSync(`styles/live/${page}.json`, 'utf8')).forEach(sel => liveMatched.add(sel)); } catch {} }
const withinContent = (selector, classes) => [...requirements(selector).classes].every(c => classes.has(c));

// Selectors whose match depends on state that changes while the page is used
// (a [hidden] status message, [aria-expanded], :empty, :checked). Their values
// hold only in the state the compiler happened to render, so they are never
// derived; the rules are carried verbatim.
const DYNAMIC_ATTRIBUTE = /\[\s*(hidden|open|disabled|checked|selected|readonly|required|inert|style|aria-[\w-]+|data-[\w-]+)\b/i;
const DYNAMIC_PSEUDO = /:(empty|has|checked|disabled|enabled|invalid|valid|user-invalid|user-valid|placeholder-shown|target|focus-within|open|closed|read-only|read-write|indeterminate|defined|popover-open|modal|playing|paused)(?![\w-])/i;
// Classes the site's scripts switch on and off (is-active on the Home
// spotlight card, is-current on Join's steps) and classes of lists built from
// live data (leaderboard rows and their loading skeleton, calendar cards,
// gallery photos). The compiler sees one state and one data set, so rules
// naming these classes are carried verbatim too. Deriving them broke the
// spotlight's second slide and the leaderboard skeleton: the rows were pinned
// by position (div:nth-child(6)) and the slide had no rule for its active
// state. Page wrapper classes never count, or the whole page would be carried.
// Scripts in the WordPress footer and page HTML count too: the hero slideshow
// toggles .active from Footer.html, and missing it let the outgoing photo lose
// its framing during each switch (the "sky" flash).
const SCRIPT_TOGGLED = new Set(fs.readdirSync('.').filter(f => f.endsWith('.js') || f.endsWith('.html'))
  .flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/classList\.(?:add|toggle|remove|replace)\(([^)]*)\)/g)])
  .flatMap(m => [...m[1].matchAll(/['"]([\w -]+)['"]/g)].flatMap(q => q[1].split(/\s+/)))
  .filter(c => /^[a-z][\w-]*$/.test(c)));
const LIVE_DATA = [/^asme-leaderboard-/, /^asme-points-skeleton/, /^asme-points-loading/, /^asme-rank-trend/, /^asme-data-enter$/, /^asme-live-/,
  /^acp-event-/, /^gallery-instagram-/, /^gallery-item--google-photos$/, /^asme-gallery-justified/];
const WRAPPERS = new Set([...Object.values(PAGE_SCOPES).flat(), ...Object.values(COMPONENTS).map(c => c.root)]);
// Classes scripts add once and keep (scroll reveal, page-level markers, the
// header) are steady states the compiler already renders; they are not live.
const STEADY = new Set(['asme-animate', 'asme-reveal', 'is-visible', 'asme-page-last-block', 'asme-page-bottom-frame', 'asme-footer-spacer',
  'asme-home-refined', 'asme-motion-static', 'asme-compact-header', 'asme-header-hidden', 'asme-header-pending', 'asme-footer-custom-page',
  'asme-footer-spacing-ready', 'asme-empty-theme-footer', 'screen-reader-text', 'sfHover', 'dropdown-hover']);
const liveClass = c => !WRAPPERS.has(c) && !STEADY.has(c) && !c.startsWith('asme-hd-') && (SCRIPT_TOGGLED.has(c) || [...SCRIPT_TOGGLED].some(t => t.endsWith('-') && c.startsWith(t)) || LIVE_DATA.some(p => p.test(c)));
const selectorClasses = selector => [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]);
const dynamic = selector => DYNAMIC_ATTRIBUTE.test(selector) || DYNAMIC_PSEUDO.test(selector)
  || selectorClasses(selector).some(liveClass) || liveMatched.has(selector)
  || (componentSets ? [...requirements(selector).classes].some(c => componentSets.varying.has(c)) : false);

function winners(matched, inline, ourSheets, viewClasses = contentClasses) {
  // Returns Map(prop -> { value, important, owned, spec, sheet, kept: [competitors] })
  const decls = new Map();
  const occurrences = new Map();
  const push = (prop, entry) => { if (!decls.has(prop)) decls.set(prop, []); decls.get(prop).push(entry); };
  matched.forEach((m, order) => {
    const rule = m.rule;
    if (rule.origin !== 'regular') return;
    const selectors = rule.selectorList.selectors;
    const matching = m.matchingSelectors.map(i => selectors[i]);
    const spec = matching.map(s => s.specificity || zero).sort(cmp).pop() || zero;
    const isOurs = ourSheets.has(rule.styleSheetId);
    const inModeledMedia = (rule.media || []).filter(m => m.source === 'mediaRule').every(m => modeled(m.text));
    const isOwned = isOurs && inModeledMedia && matching.length > 0 && matching.every(s => owned(normalize(s.text)) && withinContent(normalize(s.text), viewClasses) && !dynamic(normalize(s.text)));
    const selectorText = matching.map(s => s.text).join(', ');
    const seen = new Set();
    // Count every matched copy of a duplicated rule, with or without source
    // data, so the n-th match always pairs with the n-th copy in the source.
    let fallback = null;
    if (isOurs) {
      const occurrenceKey = (rule.media || []).map(m => m.text).join('&') + '|' + rule.selectorList.text;
      const n = occurrences.get(occurrenceKey) || 0;
      occurrences.set(occurrenceKey, n + 1);
      if (!rule.style.range) fallback = sourceDeclarations(rule, n);
    }
    const properties = fallback
      ? fallback.map(d => ({ name: d.name, value: d.value + (d.important ? ' !important' : ''), important: d.important, longhandProperties: /var\(/i.test(d.value) || !LONGHANDS.has(d.name) ? undefined : expandLonghands(d.name, d.value) }))
      : rule.style.cssProperties;
    // Within one rule, later declarations win; their position breaks ties
    // between a shorthand and a later longhand (border, then border-left).
    let position = 0;
    for (const p of properties) {
      position += 1;
      if (process.env.DEBUG_RAW && selectorText.includes(process.env.DEBUG_RAW) && /^background$/.test(p.name)) console.log('[raw]', JSON.stringify({ sel: selectorText.slice(0, 50), name: p.name, value: p.value, imp: p.important, implicit: p.implicit, disabled: p.disabled, parsedOk: p.parsedOk, lh: p.longhandProperties }));
      if (p.disabled || p.parsedOk === false || p.implicit) continue;
      // Shorthands containing var() are kept whole: Chrome expands them only
      // into the longhands it can resolve and drops the rest (border colors).
      const expand = p.longhandProperties && p.longhandProperties.length && !/var\(/i.test(p.value) && p.longhandProperties.every(l => l.value !== '');
      const parts = expand ? p.longhandProperties.map(l => ({ name: l.name, value: l.value })) : [{ name: p.name, value: p.value }];
      // Longhands remember their shorthand so it can be written back whole.
      const src = expand ? { name: p.name, value: p.value.replace(/\s*!\s*important\s*$/i, '').trim(), longhands: parts.map(l => l.name), id: `${order}:${p.name}:${p.value}` } : null;
      for (const part of parts) {
        const value = part.value.replace(/\s*!\s*important\s*$/i, '').trim();
        // Chrome lists placeholder longhands with no value when a shorthand
        // uses var(); the shorthand itself carries the declaration.
        if (value === '') continue;
        const key = part.name + '|' + value + '|' + p.important;
        if (seen.has(key)) continue; seen.add(key);
        // Owned selectors under unmodeled media are carried to the end of the
        // page file, so they compete as later rules: beating them needs more.
        const carriedRule = isOurs && matching.length > 0 && matching.every(sel => owned(normalize(sel.text))) && (!inModeledMedia || matching.some(sel => dynamic(normalize(sel.text))));
        push(part.name, { value, important: !!p.important, owned: isOwned, carried: carriedRule, spec, sheet: rule.styleSheetId, ours: isOurs && !carriedRule, order: order + position / 10000, selectorText, src });
      }
    }
  });
  for (const p of (inline && inline.cssProperties) || []) {
    if (p.disabled || p.parsedOk === false || p.implicit) continue;
    push(p.name, { value: p.value.replace(/\s*!\s*important\s*$/i, '').trim(), important: !!p.important, owned: false, inline: true, spec: { a: 9, b: 0, c: 0 }, order: 1e9 });
  }
  const out = new Map();
  const pick = list => { const important = list.filter(d => d.important); return important.length ? important[important.length - 1] : list[list.length - 1]; };
  for (const [prop, list] of decls) {
    let win = pick(list);
    // When a carried rule wins (a state such as [hidden] or the current menu
    // item), keep the value that wins without it as the element's base
    // style. The carried rule comes later in the file and still overrides it
    // whenever the state applies.
    // Base values beneath carried state rules were tried (see the docs) but
    // could outrank state rules that apply on other pages or after
    // interaction, so they stay off: a carried winner records nothing.
    if (win.carried && !process.env.BASE_BENEATH_STATE) continue;
    if (win.carried) {
      const carriedWin = win;
      const rest = list.filter(d => !d.carried);
      if (!rest.length) continue;
      win = pick(rest);
      // The base must stay weaker than the carried state rule above it.
      out.set(prop, { ...win, kept: rest.filter(d => !d.owned && d !== win), ceiling: { important: carriedWin.important, spec: carriedWin.spec } });
      continue;
    }
    out.set(prop, { ...win, kept: list.filter(d => !d.owned && d !== win) });
  }
  // A shorthand kept whole (it uses var()) and its longhands compete: the one
  // with higher cascade priority wins. Drop longhands the shorthand overrides;
  // surviving longhands are emitted after it.
  // Any declaration fully covered by a later (higher-priority) shorthand is
  // gone, including smaller shorthands (border-top under border).
  const rank = d => (d.important ? 2e9 : 0) + d.order;
  const parts = prop => LONGHANDS.get(prop) || [prop];
  // A declaration is dropped when every longhand it sets is set again by
  // higher-priority declarations, whether by one shorthand or several
  // longhands together. Otherwise it could resurface from another media block.
  for (const [prop, win] of [...out].sort((a, b) => rank(a[1]) - rank(b[1]))) {
    if (!out.has(prop)) continue;
    const later = [...out].filter(([other, d]) => other !== prop && rank(d) > rank(win));
    if (parts(prop).every(l => later.some(([other]) => parts(other).includes(l)))) out.delete(prop);
  }
  for (const [prop, win] of out) win.rank = rank(win);
  // Competitors written as a shorthand kept whole (var()) are filed under the
  // shorthand, so a longhand winner must also face them: a shared
  // "border-radius: var(--x) !important" competes with border-*-radius.
  // And the reverse: a shorthand winner kept whole faces competitors filed
  // under its longhands (a theme's background-color against background).
  for (const [prop, win] of out) {
    for (const [other, list] of decls) {
      if (other === prop) continue;
      const related = (LONGHANDS.get(other) || []).includes(prop) || (LONGHANDS.get(prop) || []).includes(other);
      if (!related) continue;
      // Only competitors the winner actually beat (lower cascade priority).
      // A later rule that overrides part of it (an active state's
      // background-image over a base background) must keep winning.
      for (const d of list) if (!d.owned && !win.kept.includes(d) && rank(d) < rank(win)) win.kept.push(d);
    }
  }
  return out;
}

// Shorthand -> longhands, read from Chrome on the first view.
const LONGHANDS = new Map();
// Expansions of shorthands from fallback rules, filled in from the page.
const EXPANSIONS = new Map();
function expandLonghands(name, value) {
  return EXPANSIONS.get(name + ':' + value);
}
const SHORTHANDS = ['margin', 'padding', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-width', 'border-style', 'border-color', 'border-radius', 'border-image', 'border-block', 'border-inline', 'background', 'font', 'flex', 'flex-flow', 'grid', 'grid-template', 'grid-area', 'grid-row', 'grid-column', 'gap', 'inset', 'outline', 'transition', 'animation', 'list-style', 'overflow', 'place-items', 'place-content', 'place-self', 'text-decoration', 'columns', 'mask', 'margin-block', 'margin-inline', 'padding-block', 'padding-inline', 'inset-block', 'inset-inline', 'scroll-margin', 'scroll-padding', 'font-variant', 'white-space', 'container', 'text-emphasis', 'background-position', 'background-repeat', 'mask-position', 'overscroll-behavior', 'text-wrap', 'border-spacing'];

// What the re-emitted declaration needs to beat every kept competitor.
function requirement(winner) {
  const needImportant = winner.kept.some(d => d.important);
  const tier = winner.kept.filter(d => d.important === needImportant);
  let spec = zero; let strict = false;
  for (const d of tier) {
    const c = cmp(d.spec, spec);
    if (c > 0 || (c === 0 && !d.ours)) { spec = d.spec; strict = strict || !d.ours || d.inline; }
  }
  return { important: needImportant, spec, strict };
}

const snapshot = new Snapshot();
const browser = await launch(chromium);
// entries: key -> { selector info, states: Map(stateKey -> Map(prop -> Map(viewId -> {value, req}))) }
const entries = new Map();
const keyInfo = new Map();
// Per element (keyed by its position path): { key, outside, empty, nth, states }.
const perElement = new Map();

// Only the page content is examined: page-owned selectors cannot reach the
// shared header and footer. Views run in parallel.
const CONTENT = component ? `.${component.root}, .${component.root} *` : '.entry-content, .entry-content *';
const started = Date.now();
// Pre-pass: find every owned selector that reaches a live widget in any view.
// Those rules are carried verbatim, so the main pass must treat them like
// dynamic selectors (competitors, never derived); otherwise a carried generic
// rule (".hero h1") would land after the derived rules and override them on
// elements outside the widget.
// Every page of a group is scanned, so grouped pages agree on what is carried.
const prePages = component ? [target] : [...group].map(page => PAGES.find(p => p.name === page)).filter(Boolean);
await pool(prePages.flatMap(pg => VIEWS.map(view => ({ pg, view }))), 4, async ({ pg, view }) => {
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + pg.path, width: view.width, scheme: view.scheme, motion: MOTION });
  const cdp = await context.newCDPSession(page);
  const sheets = new Map();
  cdp.on('CSS.styleSheetAdded', ({ header }) => sheets.set(header.styleSheetId, header.sourceURL || ''));
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const ourSheets = new Set([...sheets].filter(([, url]) => /ASME(%20| )Custom(%20| )CSS/.test(url)).map(([id]) => id));
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: CONTENT });
  const chains = await page.evaluate(content => [...document.querySelectorAll(content)].map(el => {
    const list = []; for (let node = el; node && node !== document.body; node = node.parentElement) list.push(...node.classList); return list;
  }), CONTENT);
  for (let i = 0; i < nodeIds.length; i += 1) {
    if (!chains[i] || !chains[i].some(liveClass)) continue;
    const result = await cdp.send('CSS.getMatchedStylesForNode', { nodeId: nodeIds[i] });
    for (const m of result.matchedCSSRules) {
      if (!m.rule.styleSheetId || !ourSheets.has(m.rule.styleSheetId)) continue;
      for (const index of m.matchingSelectors) { const sel = normalize(m.rule.selectorList.selectors[index].text); if (owned(sel)) liveMatched.add(sel); }
    }
    for (const pseudo of result.pseudoElements || []) for (const m of pseudo.matches) {
      if (!m.rule.styleSheetId || !ourSheets.has(m.rule.styleSheetId)) continue;
      for (const index of m.matchingSelectors) { const sel = normalize(m.rule.selectorList.selectors[index].text); if (owned(sel)) liveMatched.add(sel); }
    }
  }
  await context.close();
});
console.log(`Live widgets: ${liveMatched.size} owned selectors stay in place in the shared layers.`);
// Saved so --strip (which renders nothing) keeps the same selectors in place.
if (!stripOnly) {
  fs.mkdirSync('styles/live', { recursive: true });
  fs.writeFileSync(`styles/live/${name}.json`, JSON.stringify([...liveMatched].sort(), null, 1) + '\n');
}
if (liveOnly) { await browser.close(); process.exit(0); }
await pool(VIEWS, 4, async view => {
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + target.path, width: view.width, scheme: view.scheme, motion: MOTION });
  if (!LONGHANDS.size) {
    const map = await page.evaluate(list => Object.fromEntries(list.map(shorthand => {
      const style = document.createElement('div').style;
      style.setProperty(shorthand, 'inherit');
      return [shorthand, [...style].filter(name => name !== shorthand)];
    })), SHORTHANDS);
    for (const [shorthand, longhands] of Object.entries(map)) if (longhands.length) LONGHANDS.set(shorthand, longhands);
    // Expand every var()-free shorthand declaration in the stylesheet once, so
    // fallback rules split into longhands exactly as Chrome would.
    const pairs = [...new Set([...SOURCE.values()].flat(2).filter(d => LONGHANDS.has(d.name) && !/var\(/i.test(d.value)).map(d => d.name + '\u0000' + d.value))].map(x => x.split('\u0000'));
    const expanded = await page.evaluate(list => list.map(([name, value]) => {
      const style = document.createElement('div').style;
      style.setProperty(name, value);
      return [...style].filter(n => n !== name).map(n => ({ name: n, value: style.getPropertyValue(n) }));
    }), pairs);
    pairs.forEach(([name, value], i) => { if (expanded[i].length) EXPANSIONS.set(name + ':' + value, expanded[i]); });
  }
  const cdp = await context.newCDPSession(page);
  const sheets = new Map();
  cdp.on('CSS.styleSheetAdded', ({ header }) => sheets.set(header.styleSheetId, header.sourceURL || ''));
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const ourSheets = new Set([...sheets].filter(([, url]) => /ASME(%20| )Custom(%20| )CSS/.test(url)).map(([id]) => id));
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: CONTENT });
  // Element keys: a selector describing each element, computed in the page.
  const viewClasses = new Set(await page.evaluate(content => [...new Set([...document.querySelectorAll(content)].flatMap(el => [...el.classList]))], CONTENT));
  (await page.evaluate(list => list.filter(sel => {
    const bare = sel.replace(/::?(before|after|placeholder|marker|selection|first-line|first-letter|backdrop|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g, '')
      .replace(/:(hover|focus|focus-visible|focus-within|active|visited|checked|disabled|target|placeholder-shown)(?![\w-])/g, '').trim() || '*';
    try { return !!document.querySelector(bare); } catch { return true; }
  }), OWNED_SELECTORS)).forEach(sel => matchedSelectors.add(sel));
  viewClasses.forEach(c => contentClasses.add(c));
  const keys = await page.evaluate(([wrapper, content, varying]) => {
    const dynamic = new Set(['asme-animate', 'asme-reveal', 'is-visible', 'asme-page-last-block', 'asme-page-bottom-frame', 'asme-footer-spacer', ...varying]);
    const esc = cls => CSS.escape(cls);
    // Class compounds are made exact: if another element on the page carries
    // the same classes plus more (a --variant), exclude those extras.
    const classLists = [...document.querySelectorAll('.' + wrapper + ' [class]')].map(el => [...el.classList].filter(c => !dynamic.has(c)));
    const own = el => {
      const classes = [...el.classList].filter(c => !dynamic.has(c));
      if (!classes.length) return null;
      const extras = new Set();
      for (const list of classLists) if (list.length > classes.length && classes.every(c => list.includes(c))) list.forEach(c => { if (!classes.includes(c)) extras.add(c); });
      return classes.map(c => '.' + esc(c)).join('') + [...extras].sort().map(c => ':not(.' + esc(c) + ')').join('');
    };
    const keyOf = el => {
      const wrap = el.closest('.' + wrapper);
      if (!wrap) return null;
      if (el === wrap) return '.' + wrapper;
      const mine = own(el);
      if (mine) return '.' + wrapper + ' ' + mine;
      const parts = [el.tagName.toLowerCase()];
      let node = el.parentElement;
      while (node && node !== wrap && !own(node)) { parts.unshift(node.tagName.toLowerCase()); node = node.parentElement; }
      const anchor = node === wrap ? '.' + wrapper : '.' + wrapper + ' ' + own(node);
      return anchor + ' > ' + parts.join(' > ');
    };
    const pathOf = el => {
      const parts = [];
      for (let node = el; node && node !== document.body; node = node.parentElement) parts.unshift(node.tagName.toLowerCase() + ':' + (Array.prototype.indexOf.call(node.parentElement.children, node) + 1));
      return parts.join('>');
    };
    return [...document.querySelectorAll(content)].map(el => ({
      key: keyOf(el), id: pathOf(el), empty: !el.firstChild,
      chain: (() => { const list = []; for (let node = el; node && node !== document.body; node = node.parentElement) list.push(...node.classList); return list; })(), nth: Array.prototype.indexOf.call(el.parentElement.children, el) + 1,
      ancestors: (() => { const list = []; for (let node = el.parentElement; node && el.closest('.' + wrapper) && node !== el.closest('.' + wrapper); node = node.parentElement) { const o = own(node); if (o) list.push(o); } return list; })(),
      exact: (() => { const wrap = el.closest('.' + wrapper); if (!wrap || el === wrap) return null; const parts = []; for (let node = el; node !== wrap; node = node.parentElement) parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + (Array.prototype.indexOf.call(node.parentElement.children, node) + 1) + ')'); return '.' + wrapper + ' > ' + parts.join(' > '); })(),
      interactive: el.matches('a[href], button, summary, input, select, textarea') && !!el.closest('.' + wrapper)
    }));
  }, [wrapperClass, CONTENT, [...(componentSets ? componentSets.varying : []), ...[...SCRIPT_TOGGLED].filter(liveClass)]]);

  const record = (el, stateKey, map) => {
    if (process.env.DEBUG_KEY && el.key.includes(process.env.DEBUG_KEY) && !stateKey) {
      for (const [prop, win] of map) if (new RegExp(process.env.DEBUG_PROP || '.').test(prop)) console.log(`[debug] ${view.id} ${el.key} ${prop}: ${win.value} owned=${win.owned} rank=${win.rank} from=${(win.selectorText || '').slice(0, 60)}`);
    }
    for (const [prop, win] of map) {
      if (!win.owned) continue;
      const states = el.states;
      if (!states.has(stateKey)) states.set(stateKey, new Map());
      const props = states.get(stateKey);
      if (!props.has(prop)) props.set(prop, new Map());
      props.get(prop).set(view.id, { value: win.value, req: requirement(win), from: win.selectorText, src: win.src, rank: win.rank, ceiling: win.ceiling });
    }
  };

  for (let i = 0; i < nodeIds.length; i += 1) {
    const nodeId = nodeIds[i];
    const info = keys[i];
    const result = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    // Inside a live widget, every owned rule reaching the element is carried
    // verbatim as well, so the widget keeps its styles in states not rendered.
    if (info.chain.some(liveClass)) for (const m of result.matchedCSSRules) {
      if (!m.rule.styleSheetId || !ourSheets.has(m.rule.styleSheetId)) continue;
      for (const index of m.matchingSelectors) { const sel = normalize(m.rule.selectorList.selectors[index].text); if (owned(sel)) liveMatched.add(sel); }
    }
    // Live elements get no derived rules (their rules are all carried), and
    // are not registered: derived keys that also match them are narrowed
    // with :not() below, so a derived value never lands on a live element.
    if (info.chain.some(liveClass)) continue;
    const base = winners(result.matchedCSSRules, result.inlineStyle, ourSheets, viewClasses);
    const hasOwned = [...base.values()].some(w => w.owned) || (result.pseudoElements || []).some(p => p.matches.some(m => m.rule.styleSheetId && ourSheets.has(m.rule.styleSheetId)));
    // Every element inside the page is registered with the views it appears
    // in, even without owned styles, so selectors shared with it are checked.
    if (info.key) {
      const identity = info.id + '|' + info.key;
      if (!perElement.has(identity)) perElement.set(identity, { key: info.key, outside: false, empty: info.empty, nth: info.nth, ancestors: info.ancestors, exact: info.exact, states: new Map(), views: new Set() });
      perElement.get(identity).views.add(view.id);
    }
    if (!hasOwned && !info.interactive) continue;
    // Elements outside the page wrapper (rare) are keyed by the owned selector text.
    const keyFor = map => info.key || [...map.values()].find(w => w.owned)?.selectorText || null;
    const key = keyFor(base);
    if (!key) {
      if ([...base.values()].some(w => w.owned)) console.warn('Unkeyed element with owned styles at', view.id, i);
      continue;
    }
    // Classes can change with width or state (scripts toggle is-active), so an
    // element is tracked per selector it has: each entry only holds the views
    // where the element carried that selector.
    const identity = info.id + '|' + key;
    if (!perElement.has(identity)) perElement.set(identity, { key, outside: !info.key, empty: info.empty, nth: info.nth, ancestors: info.ancestors, exact: info.exact, states: new Map(), views: new Set() });
    const el = perElement.get(identity);
    el.views.add(view.id);
    record(el, '', base);
    for (const pseudo of result.pseudoElements || []) {
      // DevTools calls ::placeholder "input-placeholder".
      const pseudoName = { 'input-placeholder': 'placeholder' }[pseudo.pseudoType] || pseudo.pseudoType;
      if (!['before', 'after', 'placeholder', 'marker'].includes(pseudoName)) continue;
      record(el, '::' + pseudoName, winners(pseudo.matches, null, ourSheets, viewClasses));
    }
    // Hover and focus effects are not limited to links and buttons (cards lift
    // on hover), so every element with owned styles is probed.
    if (info.interactive || hasOwned) {
      for (const state of ['hover', 'focus-visible']) {
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] });
        const forced = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        const map = winners(forced.matchedCSSRules, forced.inlineStyle, ourSheets, viewClasses);
        // Keep only what differs from the element's normal state.
        for (const [prop, win] of [...map]) {
          const normal = base.get(prop);
          if (normal && normal.value === win.value && normal.owned === win.owned) map.delete(prop);
        }
        record(el, ':' + state, map);
        for (const pseudo of forced.pseudoElements || []) {
          if (!['before', 'after'].includes(pseudo.pseudoType)) continue;
          record(el, ':' + state + '::' + pseudo.pseudoType, winners(pseudo.matches, null, ourSheets, viewClasses));
        }
      }
    }
  }
  await context.close();
  console.log(`Compiled ${view.id}: ${nodeIds.length} elements (${Math.round((Date.now() - started) / 1000)}s elapsed)`);
});

// In a group, a selector that matches on another group page is derived by that
// page's compile, so it must not be carried here (the carried copy would land
// in the shared bundle and override the derived one). Test the other pages too.
for (const other of group) {
  if (stripOnly) break;
  if (other === name) continue;
  const otherPage = PAGES.find(page => page.name === other);
  await pool(VIEWS, 4, async view => {
    const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + otherPage.path, width: view.width, scheme: view.scheme, motion: MOTION });
    (await page.evaluate(list => list.filter(sel => {
      const bare = sel.replace(/::?(before|after|placeholder|marker|selection|first-line|first-letter|backdrop|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g, '')
        .replace(/:(hover|focus|focus-visible|focus-within|active|visited|checked|disabled|target|placeholder-shown)(?![\w-])/g, '').trim() || '*';
      try { return !!document.querySelector(bare); } catch { return true; }
    }), OWNED_SELECTORS)).forEach(sel => matchedSelectors.add(sel));
    await context.close();
  });
  console.log(`Checked owned selectors against ${other} too.`);
}

// ---- Give every element a selector that matches it and nothing else --------
// Elements sharing a key must end up with identical styles; otherwise the key
// is refined with :empty / :not(:empty), or :nth-child() as a last resort.
// Entries are compatible when they agree wherever both have a value (an
// element may hold a selector only at some widths, e.g. while is-active).
// Entries are compatible when, in every view both appear in, they carry the
// same value for every property; a value one has and the other lacks counts
// as a difference (the shared selector would impose it on the other).
const valueAt = (el, state, prop, view) => el.states.get(state)?.get(prop)?.get(view)?.value;
const compatible = list => {
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const [a, b] = [list[i], list[j]];
    for (const [x, y] of [[a, b], [b, a]]) {
      for (const [state, props] of x.states) for (const [prop, views] of props) for (const [view, d] of views) {
        if (y.views.has(view) && valueAt(y, state, prop, view) !== d.value) return false;
      }
    }
  }
  return true;
};
const keyGroups = new Map();
for (const el of perElement.values()) { if (!keyGroups.has(el.key)) keyGroups.set(el.key, []); keyGroups.get(el.key).push(el); }
let refined = 0;
for (const [key, members] of keyGroups) {
  if (members.length < 2 || members[0].outside || compatible(members)) continue;
  refined += 1;
  // A split works when every resulting key's members are compatible.
  const consistent = keyOf => {
    const byKey = new Map();
    for (const el of members) { const k = keyOf(el); if (k == null) return false; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(el); }
    return [...byKey.values()].every(compatible);
  };
  const byEmpty = el => key + (el.empty ? ':empty' : ':not(:empty)');
  // Context: the nearest one or two classed ancestors (".card .label").
  const own = key.slice(key.indexOf(' ') + 1);
  // Ancestors already in the selector (the anchor of "card > p") are skipped,
  // or the result would require the anchor nested inside itself.
  const byContext = depth => el => {
    const extra = el.ancestors.filter(a => !own.split(/\s+>\s+|\s+/).includes(a));
    return extra.length >= depth ? '.' + wrapperClass + ' ' + extra.slice(0, depth).reverse().join(' ') + ' ' + own : null;
  };
  const strategy = [byEmpty, byContext(1), byContext(2)].find(consistent) || (el => el.exact || key + `:nth-child(${el.nth})`);
  for (const el of members) el.key = strategy(el);
}
// A key like ".page .card" also matches ".page .card.card--wide". Exclude
// elements that belong to other keys with :not(.class).
if (!stripOnly) {
  const view = VIEWS.find(v => v.id === '1280-light');
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + target.path, width: view.width, scheme: view.scheme, motion: MOTION });
  const keyed = new Map();
  for (const [identity, el] of perElement) if (!el.outside && el.states.size) { if (!keyed.has(el.key)) keyed.set(el.key, new Set()); keyed.get(el.key).add(identity.split('|')[0]); }
  const fixes = await page.evaluate(list => {
    const pathOf = el => {
      const parts = [];
      for (let node = el; node && node !== document.body; node = node.parentElement) parts.unshift(node.tagName.toLowerCase() + ':' + (Array.prototype.indexOf.call(node.parentElement.children, node) + 1));
      return parts.join('>');
    };
    return list.map(([key, ids]) => {
      const members = new Set(ids);
      let matched;
      try { matched = [...document.querySelectorAll(key)]; } catch { return [key, null, 0, 'invalid selector']; }
      const hits = new Set(matched.map(pathOf));
      const missing = [...members].filter(id => !hits.has(id)).length;
      if (missing) return [key, null, 0, `matches only ${members.size - missing} of its ${members.size} element(s)`];
      const extras = matched.filter(el => !members.has(pathOf(el)));
      if (!extras.length) return null;
      const memberEls = matched.filter(el => members.has(pathOf(el)));
      const memberClasses = new Set(memberEls.flatMap(el => [...el.classList]));
      const exclude = [...new Set(extras.flatMap(el => [...el.classList]))].filter(c => !memberClasses.has(c));
      const covered = extras.every(el => [...el.classList].some(c => exclude.includes(c)));
      return [key, covered ? exclude : null, extras.length];
    }).filter(Boolean);
  }, [...keyed].map(([key, ids]) => [key, [...ids]]));
  for (const [key, exclude, count, problem] of fixes) {
    if (problem) { console.warn(`Selector ${key} ${problem}; check the visual diff.`); continue; }
    if (!exclude) {
      // No class separates them. Components pin each member to its exact
      // position (the footer's Connect links). On pages, pinned selectors
      // became specific enough to beat state rules (Member Points' active
      // jump link), so pages only warn, as verified before.
      if (component) {
        console.warn(`Selector ${key} also matches ${count} other element(s) that no class separates; using exact positions.`);
        for (const el of perElement.values()) if (el.key === key && el.exact) el.key = el.exact;
      } else console.warn(`Selector ${key} also matches ${count} other element(s) that no class separates; check the visual diff.`);
      continue;
    }
    const suffix = exclude.map(c => `:not(.${c})`).join('');
    for (const el of perElement.values()) if (el.key === key) el.key = key + suffix;
  }
  if (fixes.length || refined) console.log(`Refined ${refined} shared keys; narrowed ${fixes.filter(f => f[1]).length} selectors with :not().`);
  await context.close();
}
await browser.close();

// Merge elements into their final keys (members of a key now agree).
for (const el of perElement.values()) {
  if (!el.states.size) continue;
  if (!entries.has(el.key)) { entries.set(el.key, new Map()); keyInfo.set(el.key, { outside: el.outside }); }
  // Union the views of compatible entries that share the key.
  const into = entries.get(el.key);
  for (const [state, props] of el.states) {
    if (!into.has(state)) into.set(state, new Map());
    for (const [prop, views] of props) {
      if (!into.get(state).has(prop)) into.get(state).set(prop, new Map());
      for (const [view, d] of views) {
        // Elements sharing a selector can face different competitors (an
        // <article> meets "body article" rules a link does not): keep the
        // strictest requirement.
        const prev = into.get(state).get(prop).get(view);
        if (prev) {
          const a = prev.req; const b = d.req;
          const important = a.important || b.important;
          const tier = [a, b].filter(r => r.important === important);
          const top = tier.reduce((m, r) => { const c = cmp(r.spec, m.spec); return c > 0 || (c === 0 && r.strict) ? r : m; }, { spec: zero, strict: false });
          into.get(state).get(prop).set(view, { ...d, req: { important, spec: top.spec, strict: tier.some(r => r.strict && cmp(r.spec, top.spec) === 0) } });
        } else into.get(state).get(prop).set(view, d);
      }
    }
  }
}

// ---- Turn view sets into media conditions ------------------------------------
function mediaFor(viewIds) {
  // For each width, which schemes are covered; group consecutive widths with the same scheme set.
  const byWidth = WIDTHS.map((width, w) => SCHEMES.filter(s => viewIds.has(`${width}-${s}`)));
  const blocks = [];
  let start = 0;
  for (let w = 1; w <= WIDTHS.length; w += 1) {
    if (w === WIDTHS.length || byWidth[w].join() !== byWidth[start].join()) {
      if (byWidth[start].length) blocks.push({ from: start, to: w - 1, schemes: byWidth[start] });
      start = w;
    }
  }
  return blocks.map(({ from, to, schemes }) => {
    const parts = [];
    if (schemes.length === 1) parts.push(`(prefers-color-scheme: ${schemes[0]})`);
    if (from > 0) parts.push(`(min-width: ${BOUNDS[from]}px)`);
    if (to < WIDTHS.length - 1) parts.push(`(max-width: ${BOUNDS[to + 1] - 1}px)`);
    return parts.join(' and ');
  });
}

const specOf = s => `${s.a},${s.b},${s.c}`;
const prefixes = [
  '', // .wrapper ...
  '#page ',
  'html body #page .entry-content ',
  'html body #page#page .entry-content ',
  // Two more steps for rules from page-level <style> blocks that load after
  // the bundle (Join's inline three-step styles at 901-1199px).
  'html body #page#page .entry-content.entry-content ',
  'html body #page#page#page .entry-content '
];
const PREFIX_SPEC = [zero, { a: 1, b: 0, c: 0 }, { a: 1, b: 1, c: 2 }, { a: 2, b: 1, c: 2 }, { a: 2, b: 2, c: 2 }, { a: 3, b: 1, c: 2 }];
// Components sit outside #page, so they gain specificity by repeating their
// own root class instead (".footer.footer ...").
if (component) {
  prefixes.length = 0; PREFIX_SPEC.length = 0;
  for (let n = 0; n < 6; n += 1) { prefixes.push(n); PREFIX_SPEC.push({ a: 0, b: n, c: 0 }); }
}
const applyPrefix = (level, selector) => (component
  ? selector.replace(new RegExp('^\\.' + wrapperClass + '(?![\\w-])'), '.' + wrapperClass + ('.' + wrapperClass).repeat(level))
  : prefixes[level] + selector);
const add = (a, b) => ({ a: a.a + b.a, b: a.b + b.b, c: a.c + b.c });
function baseSpec(selector) {
  // Approximate specificity of the generated key selector (no :is/:not used).
  let a = 0; let b = 0; let c = 0;
  walk(parse(selector, { context: 'selector' }), {
    enter(node) {
      if (node.type === 'IdSelector') a += 1;
      else if (node.type === 'ClassSelector' || node.type === 'AttributeSelector' || node.type === 'PseudoClassSelector') b += 1;
      else if (node.type === 'TypeSelector' || node.type === 'PseudoElementSelector') c += 1;
    }
  });
  return { a, b, c };
}

// rules: Map("level|important|media" -> Map(selector -> [decl]))
// Write shorthands back: where every longhand of one original shorthand won
// together, emit the shorthand instead of its longhands.
for (const states of entries.values()) {
  for (const [stateKey, props] of states) {
    const viewIds = new Set([...props.values()].flatMap(v => [...v.keys()]));
    for (const viewId of viewIds) {
      const bySrc = new Map();
      for (const [prop, views] of props) {
        const d = views.get(viewId);
        if (d && d.src) { if (!bySrc.has(d.src.id)) bySrc.set(d.src.id, { src: d.src, props: [] }); bySrc.get(d.src.id).props.push(prop); }
      }
      for (const { src, props: got } of bySrc.values()) {
        if (got.length !== src.longhands.length) continue;
        const first = props.get(got[0]).get(viewId);
        // The shorthand must beat every competitor any of its longhands faced.
        const reqs = got.map(prop => props.get(prop).get(viewId).req);
        const important = reqs.some(r => r.important);
        const top = reqs.filter(r => r.important === important).reduce((m, r) => { const c = cmp(r.spec, m.spec); return c > 0 || (c === 0 && r.strict) ? r : m; }, { spec: zero, strict: false });
        for (const prop of got) props.get(prop).delete(viewId);
        if (!props.has(src.name)) props.set(src.name, new Map());
        props.get(src.name).set(viewId, { ...first, value: src.value, src: null, req: { important, spec: top.spec, strict: top.strict } });
      }
    }
    for (const [prop, views] of [...props]) if (!views.size) props.delete(prop);
  }
}

// Declarations won by the page's universal rule (".page *") are written once
// as a universal rule instead of on every element.
// Only a true descendant universal (".page *"), never "> *" (direct children).
// Any wrapper class of a page in the group counts (".asme-members-page *" is
// shared by both member pages); the rule is written once for this page.
const wrapperClasses = [...new Set([wrapperClass, ...[...group].flatMap(page => PAGE_SCOPES[page] || [])])].map(c => c.replace(/[-]/g, '\\-'));
const universalPattern = new RegExp('\\.(' + wrapperClasses.join('|') + ')\\s+\\*(::?(before|after))?\\s*$');
const universal = from => (from || '').split(',').some(part => universalPattern.test(part.trim()));

const out = new Map();
let decls = 0; let importantCount = 0;
const levelCount = [0, 0, 0, 0];
// ---- Tokens (--tokens) --------------------------------------------------------
// Rewrite values onto styles/tokens.css: legacy variables get their token name,
// and a light/dark pair of literal colors that equals a token's pair becomes
// that token, which removes the separate dark-mode declaration.
const useTokens = process.argv.includes('--tokens');
const TOKENS = (() => {
  const text = fs.readFileSync('styles/tokens.css', 'utf8');
  const light = new Map(); const dark = new Map();
  const base = text.slice(0, text.indexOf('@media'));
  const darkBlock = text.slice(text.indexOf('prefers-color-scheme: dark'));
  for (const [, name, value] of base.matchAll(/(--asme-c-[a-z-]+):\s*([^;]+);/g)) light.set(name, value.trim());
  for (const [, name, value] of darkBlock.matchAll(/(--asme-c-[a-z-]+):\s*([^;]+);/g)) dark.set(name, value.trim());
  return [...light].map(([name, value]) => ({ name, light: value, dark: dark.get(name) || value }));
})();
// Legacy variable -> token with the same light and dark values.
const LEGACY_VARS = { '--asme-line': '--asme-c-border', '--asme-navy': '--asme-c-heading', '--asme-muted': '--asme-c-muted', '--asme-soft': '--asme-c-subtle', '--asme-text': '--asme-c-text', '--asme-card': '--asme-c-surface', '--asme-bg': '--asme-c-page', '--osu-scarlet': '--asme-c-accent', '--asme-readable-muted': '--asme-c-readable-muted', '--asme-focus': '--asme-c-focus', '--asme-chip': '--asme-c-chip' };
function rgb(value) {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) { const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(','); }
  m = v.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*(?:[,/]\s*(1|1\.0+|100%))?\s*\)$/);
  if (m) return [m[1], m[2], m[3]].join(',');
  if (v === 'white') return '255,255,255';
  return null;
}
function tokenize(views) {
  for (const d of views.values()) {
    d.value = d.value.replace(/var\((--[a-z-]+)(?:\s*,[^()]*(?:\([^()]*\)[^()]*)*)?\)/gi, (whole, name) => (LEGACY_VARS[name] ? `var(${LEGACY_VARS[name]})` : whole));
  }
  for (const width of WIDTHS) {
    const l = views.get(`${width}-light`); const d = views.get(`${width}-dark`);
    if (!l || !d) continue;
    const pair = [rgb(l.value), rgb(d.value)];
    if (!pair[0] || !pair[1]) continue;
    const token = TOKENS.find(t => rgb(t.light) === pair[0] && rgb(t.dark) === pair[1]);
    if (token) { l.value = d.value = `var(${token.name})`; }
  }
}

for (const [key, states] of entries) {
  const outside = keyInfo.get(key)?.outside;
  for (const [stateKey, props] of states) {
    for (const [prop, views] of props) {
      if (useTokens) tokenize(views);
      // Group views by value.
      const byValue = new Map();
      for (const [viewId, d] of views) {
        if (!byValue.has(d.value)) byValue.set(d.value, { views: new Set(), reqs: [] });
        byValue.get(d.value).views.add(viewId); byValue.get(d.value).reqs.push(d.req);
      }
      for (const [value, { views: set, reqs }] of byValue) {
        const needsImportant = reqs.some(r => r.important);
        const need = reqs.filter(r => r.important === needsImportant).reduce((m, r) => {
          const c = cmp(r.spec, m.spec);
          return c > 0 || (c === 0 && r.strict) ? { spec: r.spec, strict: r.strict || m.strict } : m;
        }, { spec: zero, strict: false });
        const fromUniversal = !outside && [...views.values()].every(d => universal(d.from));
        const selector = fromUniversal ? '.' + wrapperClass + ' *' + stateKey.replace(/^:(hover|focus-visible)/, '') : key + stateKey;
        let level = 0;
        let important = needsImportant;
        // A base value under a carried state rule must stay weaker than it:
        // not !important when the state rule is not, and no more specific.
        const ceilings = [...views.values()].filter(d => d.value === value && d.ceiling).map(d => d.ceiling);
        if (ceilings.length && important && ceilings.some(c => !c.important)) continue;
        if (!outside) {
          const own = baseSpec(selector);
          const enough = l => { const c = cmp(add(own, PREFIX_SPEC[l]), need.spec); return c > 0 || (c === 0 && !need.strict); };
          while (level < prefixes.length - 1 && !enough(level)) level += 1;
          const tooStrong = l => ceilings.some(c => c.important === important && cmp(add(own, PREFIX_SPEC[l]), c.spec) > 0);
          if (tooStrong(level)) continue;
          // Repeated classes cannot outrank an id (components sit outside
          // #page). Against normal competitors, !important wins instead.
          if (!enough(level)) {
            if (!important) { important = true; level = 0; }
            else console.warn(`Cannot outrank a competitor for ${prop} on ${selector}; check the visual diff.`);
          }
          if (ceilings.length && important && ceilings.some(c => !c.important)) continue;
        }
        for (const media of mediaFor(set)) {
          const group = `${outside ? 'x' : level}|${important}|${media}`;
          if (!out.has(group)) out.set(group, new Map());
          const sel = outside ? selector : applyPrefix(level, selector);
          if (!out.get(group).has(sel)) out.get(group).set(sel, []);
          out.get(group).get(sel).push({ text: `${prop}: ${value}${important ? ' !important' : ''}`, rank: Math.min(...[...views.values()].filter(d => d.value === value).map(d => d.rank ?? 0)) });
          decls += 1; if (important) importantCount += 1; if (!outside) levelCount[level] += 1;
        }
      }
    }
  }
}

// ---- Emit -----------------------------------------------------------------
const order = media => (media.includes('dark') ? 2 : media.includes('light') ? 1 : 0) * 10 + (media.match(/min-width: (\d+)/) ? Number(RegExp.$1) / 1000 : 0);
const groups = [...out].sort(([a], [b]) => {
  const [la, ia, ma] = a.split('|'); const [lb, ib, mb] = b.split('|');
  return order(ma) - order(mb) || ma.localeCompare(mb) || la.localeCompare(lb) || ia.localeCompare(ib);
});
let css = `/* ${target.path} page styles, compiled from the legacy and shared layers by
   scripts/css-compile-page.mjs on ${new Date().toISOString().slice(0, 10)}. Each declaration reproduces the value
   that won in the cascade at 375/768/1280/1920px in light and dark mode. Edit
   by hand from here on and verify with npm run visual:compare. */\n`;
const byMedia = new Map();
for (const [group, selectors] of groups) {
  const media = group.split('|')[2];
  if (!byMedia.has(media)) byMedia.set(media, []);
  // Declarations keep their original cascade order, so where a shorthand and
  // an overlapping declaration both survive, the later one still wins.
  for (const [selector, list] of selectors) {
    const ordered = [...new Map([...list].sort((a, b) => a.rank - b.rank).map(d => [d.text, d])).keys()];
    byMedia.get(media).push(`${selector} {\n${ordered.map(d => '  ' + d + ';').join('\n')}\n}`);
  }
}
for (const [media, rules] of byMedia) {
  css += '\n' + (media ? `@media ${media} {\n${rules.map(r => r.replace(/^/gm, '  ')).join('\n\n')}\n}\n` : rules.join('\n\n') + '\n');
}

// Merge identical blocks and recombine longhands (csso restructuring keeps the
// cascade result within the file), then lay it out for hand editing.
// csso's restructuring is not used: it expands shorthands that contain var()
// into longhands it cannot evaluate (border colors became currentcolor).
// Selectors here are exact (no element matches two of them), so rules with
// identical declarations can be merged without changing the cascade.
const header = css.slice(0, css.indexOf('*/') + 2) + '\n';
css = header + pretty(mergeIdentical(css.slice(header.length)));

function mergeIdentical(text) {
  const ast = parse(text);
  const mergeIn = list => {
    const seen = new Map();
    list.forEach((node, item) => {
      if (node.type === 'Atrule' && node.block) { mergeIn(node.block.children); return; }
      if (node.type !== 'Rule') return;
      const body = generate(node.block);
      if (seen.has(body)) {
        const keep = seen.get(body);
        node.prelude.children.forEach(sel => keep.prelude.children.appendData(sel));
        list.remove(item);
      } else seen.set(body, node);
    });
  };
  mergeIn(ast.children);
  return generate(ast);
}

function pretty(text) {
  const lines = [];
  const block = (node, indent) => {
    if (node.type === 'Rule') {
      const selectors = node.prelude.children.toArray().map(s => generate(s));
      lines.push(indent + selectors.join(',\n' + indent) + ' {');
      node.block.children.forEach(d => lines.push(indent + '  ' + generate(d).replace(/^([^:]+):/, '$1: ') + ';'));
      lines.push(indent + '}', '');
    } else if (node.type === 'Atrule') {
      lines.push(indent + '@' + node.name + ' ' + generate(node.prelude).replace(/\band\b/g, ' and ').replace(/\s+/g, ' ').replace(/:(?=\S)/g, ': ') + ' {');
      node.block.children.forEach(child => block(child, indent + '  '));
      lines.push(indent + '}', '');
    } else lines.push(indent + generate(node), '');
  };
  parse(text).children.forEach(node => block(node, ''));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---- Remove owned selectors from the source layers ---------------------------
// Owned selectors in rules under unmodeled media, carried into the page file
// verbatim (with their @media chain) when they can reach this page.
const carried = [];
const pageClasses = new Set(component ? Object.values(rendered).flatMap(r => r.classes) : rendered[name].classes);
const pageIds = new Set(component ? Object.values(rendered).flatMap(r => r.ids) : rendered[name].ids);
const reachesPage = selector => { const needs = requirements(selector); return [...needs.classes].every(c => pageClasses.has(c)) && [...needs.ids].every(i => pageIds.has(i)); };

function stripOwned(text) {
  let removedRules = 0; let removedSelectors = 0;
  const ast = parse(text, { positions: true });
  const edits = [];
  const visit = (list, chain) => list.forEach(node => {
    if (node.type === 'Atrule' && node.block) {
      if (/keyframes/.test(node.name)) return;
      visit(node.block.children, chain.concat([{ name: node.name, prelude: node.prelude ? generate(node.prelude) : '' }]));
      return;
    }
    if (node.type !== 'Rule' || !node.prelude.children) return;
    const selectors = node.prelude.children.toArray();
    // Rules for live widgets stay where they are in the shared layers, so
    // their order against every other rule is exactly the original one.
    // (Moved to the end of a page file, they overrode later site-wide rules:
    // the calendar cards' radius, the sponsor form's select arrow.)
    const stays = sel => !owned(sel) || selectorClasses(sel).some(liveClass) || liveMatched.has(sel);
    const keep = selectors.filter(s => stays(generate(s)));
    if (keep.length === selectors.length) return;
    // Carried verbatim: rules under unmodeled media, and selectors for
    // pseudo-elements DevTools does not report (::placeholder lives in the
    // input's internal shadow DOM; also ::selection, scrollbar parts).
    const unmodeled = chain.some(at => at.name !== 'media' || !modeled(at.prelude));
    const opaquePseudo = sel => /::(?!before\b|after\b)[a-z-]+/i.test(sel);
    const outsideContent = sel => !withinContent(sel, contentClasses);
    const neverMatched = sel => !matchedSelectors.has(sel);
    const mine = selectors.map(s => generate(s)).filter(sel => !stays(sel)).filter(sel => (unmodeled || opaquePseudo(sel) || outsideContent(sel) || neverMatched(sel) || dynamic(sel)) && reachesPage(sel));
    if (mine.length) carried.push({ chain, selectors: mine, block: generate(node.block) });
    removedSelectors += selectors.length - keep.length;
    if (!keep.length) { removedRules += 1; edits.push([node.loc.start.offset, node.loc.end.offset, '']); }
    else edits.push([node.prelude.loc.start.offset, node.prelude.loc.end.offset, keep.map(s => generate(s)).join(',\n')]);
  });
  visit(ast.children, []);
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + replacement + text.slice(end);
  // Drop @media/@supports left empty.
  for (let pass = 0; pass < 3; pass += 1) {
    const empties = [];
    walk(parse(text, { positions: true }), { visit: 'Atrule', enter(n) { if (n.block && n.block.children.isEmpty) empties.push([n.loc.start.offset, n.loc.end.offset]); } });
    if (!empties.length) break;
    for (const [s, e] of empties.sort((a, b) => b[0] - a[0])) text = text.slice(0, s) + text.slice(e);
  }
  return { text: text.replace(/\n{3,}/g, '\n\n'), removedRules, removedSelectors };
}

const FILE = 'ASME Custom CSS.css';
const full = fs.readFileSync(FILE, 'utf8');
const startAt = full.indexOf('/* ASME FOUNDATION END */') + '/* ASME FOUNDATION END */'.length;
const endAt = full.indexOf('/* ASME SHARED DESIGN SYSTEM START */');
const legacy = stripOwned(full.slice(startAt, endAt));
const sharedFiles = ['styles/design-system.css', 'styles/widescreen.css', 'styles/home-hero.css', 'styles/tablet.css', 'styles/home-event.css'];
const shared = sharedFiles.map(file => [file, stripOwned(fs.readFileSync(file, 'utf8'))]);
if (carried.length) {
  const raw = carried.map(({ chain, selectors, block }) => chain.reduceRight((inner, at) => `@${at.name} ${at.prelude}{${inner}}`, `${selectors.join(',')}${block}`)).join('\n');
  css += '\n/* Carried over unchanged: rules for conditions the compiler does not reproduce\n   from its test views (motion preference, orientation, print) and pseudo-elements\n   DevTools does not report (::placeholder), overlays outside the page content\n   such as the gallery lightbox, and state-dependent selectors ([hidden], :empty,\n   [aria-*]) whose values change while the page is used. */\n' + pretty(raw);
}

console.log(`${name}: ${decls} declarations in ${[...byMedia.values()].reduce((t, r) => t + r.length, 0)} rules (${importantCount} !important); specificity levels used ${levelCount.join('/')} (plain / #page / html body #page .entry-content / doubled id)`);
console.log(`Removes ${legacy.removedRules} legacy rules + ${legacy.removedSelectors - legacy.removedRules} selectors from mixed rules; ${shared.reduce((t, [, s]) => t + s.removedRules, 0)} shared rules + ${shared.reduce((t, [, s]) => t + s.removedSelectors - s.removedRules, 0)} selectors.`);
console.log(`Compiled CSS: ${Math.round(Buffer.byteLength(css) / 1024)} KB`);
if (sourceStats.used) console.log(`Read ${sourceStats.used} rule matches from the stylesheet source (DevTools gave no source data)${sourceStats.ambiguous.size ? `; ${sourceStats.ambiguous.size} ambiguous` : ''}${sourceStats.missing.size ? `; ${sourceStats.missing.size} not found` : ''}.`);
for (const key of sourceStats.missing) console.warn('  not found in source:', key);
for (const key of sourceStats.ambiguous) console.warn('  ambiguous in source (used the last):', key);
if (stripOnly) {
  fs.writeFileSync(FILE, full.slice(0, startAt) + legacy.text + full.slice(endAt));
  for (const [file, s] of shared) fs.writeFileSync(file, s.text);
  console.log(`Removed the selectors owned by ${[...group].join(' + ')}. Run npm run build:styles next.`);
} else if (emitOnly) {
  fs.mkdirSync('styles/pages', { recursive: true });
  fs.writeFileSync(`styles/pages/${name}.css`, css);
  recordCompiled(name, css);
  console.log(`Wrote styles/pages/${name}.css (layers untouched; run --strip once every page in the group is emitted).`);
} else if (!write) {
  fs.mkdirSync('tests/visual/.output', { recursive: true });
  fs.writeFileSync(`tests/visual/.output/${name}.compiled.css`, css);
  console.log(`Preview: tests/visual/.output/${name}.compiled.css (dry run; nothing changed)`);
} else {
  fs.mkdirSync('styles/pages', { recursive: true });
  fs.writeFileSync(`styles/pages/${name}.css`, css);
  recordCompiled(name, css);
  fs.writeFileSync(FILE, full.slice(0, startAt) + legacy.text + full.slice(endAt));
  for (const [file, s] of shared) fs.writeFileSync(file, s.text);
  console.log(`Wrote styles/pages/${name}.css and removed owned selectors. Run npm run build:styles next.`);
}
