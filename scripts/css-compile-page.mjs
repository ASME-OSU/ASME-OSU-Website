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
import { generate, parse, walk } from 'css-tree';
import { chromium } from 'playwright';
import { ORIGIN, PAGES } from '../tests/visual/config.mjs';
import { pool } from '../tests/visual/jobs.mjs';
import { launch, render, Snapshot } from '../tests/visual/harness.mjs';
import { PAGE_SCOPES, requirements } from './css-inventory.mjs';

const name = process.argv[2];
const target = PAGES.find(page => page.name === name);
if (!target || !PAGE_SCOPES[name]) throw new Error(`Usage: node scripts/css-compile-page.mjs <${Object.keys(PAGE_SCOPES).join('|')}> [--write]`);
const wrapperClass = PAGE_SCOPES[name][0];
const write = process.argv.includes('--write');

// Views and the width ranges they stand for (mobile-first breakpoints).
const WIDTHS = [375, 768, 1280, 1920];
const BOUNDS = [0, 768, 980, 1800];
const SCHEMES = ['light', 'dark'];
const VIEWS = WIDTHS.flatMap((width, w) => SCHEMES.map(scheme => ({ width, w, scheme, id: `${width}-${scheme}` })));

// ---- Selector ownership ---------------------------------------------------
const rendered = JSON.parse(fs.readFileSync('tests/visual/.output/classes.json', 'utf8'));
const pageSets = Object.entries(rendered).map(([page, s]) => [page, new Set(s.classes), new Set(s.ids)]);
const ownedCache = new Map();
function owned(selector) {
  if (ownedCache.has(selector)) return ownedCache.get(selector);
  const needs = requirements(selector);
  const pages = pageSets.filter(([, classes, ids]) => [...needs.classes].every(c => classes.has(c)) && [...needs.ids].every(i => ids.has(i))).map(([page]) => page);
  const result = needs.classes.size + needs.ids.size > 0 && pages.length === 1 && pages[0] === name;
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
function sourceDeclarations(rule) {
  const media = (rule.media || []).filter(m => m.source === 'mediaRule').map(m => m.text.replace(/\s+/g, '')).reverse();
  const key = media.join('&') + '|' + rule.selectorList.selectors.map(sel => normalize(sel.text).replace(/\*(?=::?[a-z])/g, '')).join(',');
  const found = SOURCE.get(key);
  if (!found) { sourceStats.missing.add(key.slice(0, 120)); return null; }
  const distinct = new Set(found.map(d => JSON.stringify(d)));
  if (distinct.size > 1) sourceStats.ambiguous.add(key.slice(0, 120));
  sourceStats.used += 1;
  return found[found.length - 1].map(d => ({ name: d.name, value: d.value, important: d.important }));
}

function winners(matched, inline, ourSheets) {
  // Returns Map(prop -> { value, important, owned, spec, sheet, kept: [competitors] })
  const decls = new Map();
  const push = (prop, entry) => { if (!decls.has(prop)) decls.set(prop, []); decls.get(prop).push(entry); };
  matched.forEach((m, order) => {
    const rule = m.rule;
    if (rule.origin !== 'regular') return;
    const selectors = rule.selectorList.selectors;
    const matching = m.matchingSelectors.map(i => selectors[i]);
    const spec = matching.map(s => s.specificity || zero).sort(cmp).pop() || zero;
    const isOurs = ourSheets.has(rule.styleSheetId);
    const isOwned = isOurs && matching.length > 0 && matching.every(s => owned(normalize(s.text)));
    const selectorText = matching.map(s => s.text).join(', ');
    const seen = new Set();
    const fallback = isOurs && !rule.style.range ? sourceDeclarations(rule) : null;
    const properties = fallback
      ? fallback.map(d => ({ name: d.name, value: d.value + (d.important ? ' !important' : ''), important: d.important, longhandProperties: /var\(/i.test(d.value) || !LONGHANDS.has(d.name) ? undefined : expandLonghands(d.name, d.value) }))
      : rule.style.cssProperties;
    for (const p of properties) {
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
        push(part.name, { value, important: !!p.important, owned: isOwned, spec, sheet: rule.styleSheetId, ours: isOurs, order, selectorText, src });
      }
    }
  });
  for (const p of (inline && inline.cssProperties) || []) {
    if (p.disabled || p.parsedOk === false || p.implicit) continue;
    push(p.name, { value: p.value.replace(/\s*!\s*important\s*$/i, '').trim(), important: !!p.important, owned: false, inline: true, spec: { a: 9, b: 0, c: 0 }, order: 1e9 });
  }
  const out = new Map();
  for (const [prop, list] of decls) {
    const important = list.filter(d => d.important);
    const win = important.length ? important[important.length - 1] : list[list.length - 1];
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
  return out;
}

// Shorthand -> longhands, read from Chrome on the first view.
const LONGHANDS = new Map();
// Expansions of shorthands from fallback rules, filled in from the page.
const EXPANSIONS = new Map();
function expandLonghands(name, value) {
  return EXPANSIONS.get(name + ':' + value);
}
const SHORTHANDS = ['margin', 'padding', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-width', 'border-style', 'border-color', 'border-radius', 'border-image', 'border-block', 'border-inline', 'background', 'font', 'flex', 'flex-flow', 'grid', 'grid-template', 'grid-area', 'grid-row', 'grid-column', 'gap', 'inset', 'outline', 'transition', 'animation', 'list-style', 'overflow', 'place-items', 'place-content', 'place-self', 'text-decoration', 'columns', 'mask', 'margin-block', 'margin-inline', 'padding-block', 'padding-inline', 'inset-block', 'inset-inline', 'scroll-margin', 'scroll-padding', 'font-variant', 'white-space', 'container', 'text-emphasis'];

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
const CONTENT = '.entry-content, .entry-content *';
const started = Date.now();
await pool(VIEWS, 4, async view => {
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + target.path, width: view.width, scheme: view.scheme });
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
  const keys = await page.evaluate(([wrapper, content]) => {
    const dynamic = new Set(['asme-animate', 'asme-reveal', 'is-visible', 'asme-page-last-block', 'asme-page-bottom-frame', 'asme-footer-spacer']);
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
      key: keyOf(el), id: pathOf(el), empty: !el.firstChild, nth: Array.prototype.indexOf.call(el.parentElement.children, el) + 1,
      ancestors: (() => { const list = []; for (let node = el.parentElement; node && el.closest('.' + wrapper) && node !== el.closest('.' + wrapper); node = node.parentElement) { const o = own(node); if (o) list.push(o); } return list; })(),
      exact: (() => { const wrap = el.closest('.' + wrapper); if (!wrap || el === wrap) return null; const parts = []; for (let node = el; node !== wrap; node = node.parentElement) parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + (Array.prototype.indexOf.call(node.parentElement.children, node) + 1) + ')'); return '.' + wrapper + ' > ' + parts.join(' > '); })(),
      interactive: el.matches('a[href], button, summary, input, select, textarea') && !!el.closest('.' + wrapper)
    }));
  }, [wrapperClass, CONTENT]);

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
      props.get(prop).set(view.id, { value: win.value, req: requirement(win), from: win.selectorText, src: win.src, rank: win.rank + (stateKey ? 0 : 0) });
    }
  };

  for (let i = 0; i < nodeIds.length; i += 1) {
    const nodeId = nodeIds[i];
    const info = keys[i];
    const result = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    const base = winners(result.matchedCSSRules, result.inlineStyle, ourSheets);
    const hasOwned = [...base.values()].some(w => w.owned) || (result.pseudoElements || []).some(p => p.matches.some(m => m.rule.styleSheetId && ourSheets.has(m.rule.styleSheetId)));
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
    if (!perElement.has(identity)) perElement.set(identity, { key, outside: !info.key, empty: info.empty, nth: info.nth, ancestors: info.ancestors, exact: info.exact, states: new Map() });
    const el = perElement.get(identity);
    record(el, '', base);
    for (const pseudo of result.pseudoElements || []) {
      if (!['before', 'after', 'placeholder', 'marker'].includes(pseudo.pseudoType)) continue;
      record(el, '::' + pseudo.pseudoType, winners(pseudo.matches, null, ourSheets));
    }
    if (info.interactive) {
      for (const state of ['hover', 'focus-visible']) {
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] });
        const forced = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        const map = winners(forced.matchedCSSRules, forced.inlineStyle, ourSheets);
        // Keep only what differs from the element's normal state.
        for (const [prop, win] of [...map]) {
          const normal = base.get(prop);
          if (normal && normal.value === win.value && normal.owned === win.owned) map.delete(prop);
        }
        record(el, ':' + state, map);
        for (const pseudo of forced.pseudoElements || []) {
          if (!['before', 'after'].includes(pseudo.pseudoType)) continue;
          record(el, ':' + state + '::' + pseudo.pseudoType, winners(pseudo.matches, null, ourSheets));
        }
      }
    }
  }
  await context.close();
  console.log(`Compiled ${view.id}: ${nodeIds.length} elements (${Math.round((Date.now() - started) / 1000)}s elapsed)`);
});

// ---- Give every element a selector that matches it and nothing else --------
// Elements sharing a key must end up with identical styles; otherwise the key
// is refined with :empty / :not(:empty), or :nth-child() as a last resort.
// Entries are compatible when they agree wherever both have a value (an
// element may hold a selector only at some widths, e.g. while is-active).
const compatible = list => {
  const seen = new Map();
  for (const el of list) for (const [state, props] of el.states) for (const [prop, views] of props) for (const [view, d] of views) {
    const k = state + '|' + prop + '|' + view;
    if (seen.has(k) && seen.get(k) !== d.value) return false;
    seen.set(k, d.value);
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
  const byContext = depth => el => (el.ancestors.length >= depth ? '.' + wrapperClass + ' ' + el.ancestors.slice(0, depth).reverse().join(' ') + ' ' + own : null);
  const strategy = [byEmpty, byContext(1), byContext(2)].find(consistent) || (el => el.exact || key + `:nth-child(${el.nth})`);
  for (const el of members) el.key = strategy(el);
}
// A key like ".page .card" also matches ".page .card.card--wide". Exclude
// elements that belong to other keys with :not(.class).
{
  const view = VIEWS.find(v => v.id === '1280-light');
  const { page, context } = await render(browser, snapshot, { mode: 'replay', url: ORIGIN + target.path, width: view.width, scheme: view.scheme });
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
      const matched = [...document.querySelectorAll(key)];
      const extras = matched.filter(el => !members.has(pathOf(el)));
      if (!extras.length) return null;
      const memberEls = matched.filter(el => members.has(pathOf(el)));
      const memberClasses = new Set(memberEls.flatMap(el => [...el.classList]));
      const exclude = [...new Set(extras.flatMap(el => [...el.classList]))].filter(c => !memberClasses.has(c));
      const covered = extras.every(el => [...el.classList].some(c => exclude.includes(c)));
      return [key, covered ? exclude : null, extras.length];
    }).filter(Boolean);
  }, [...keyed].map(([key, ids]) => [key, [...ids]]));
  for (const [key, exclude, count] of fixes) {
    if (!exclude) { console.warn(`Selector ${key} also matches ${count} other element(s) that no class separates; check the visual diff.`); continue; }
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
  'html body #page#page .entry-content '
];
const PREFIX_SPEC = [zero, { a: 1, b: 0, c: 0 }, { a: 1, b: 1, c: 2 }, { a: 2, b: 1, c: 2 }];
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
const universalPattern = new RegExp('\\.' + wrapperClass + '\\s+\\*(::?(before|after))?\\s*$');
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
        const important = reqs.some(r => r.important);
        const need = reqs.filter(r => r.important === important).reduce((m, r) => {
          const c = cmp(r.spec, m.spec);
          return c > 0 || (c === 0 && r.strict) ? { spec: r.spec, strict: r.strict || m.strict } : m;
        }, { spec: zero, strict: false });
        const fromUniversal = !outside && [...views.values()].every(d => universal(d.from));
        const selector = fromUniversal ? '.' + wrapperClass + ' *' + stateKey.replace(/^:(hover|focus-visible)/, '') : key + stateKey;
        let level = 0;
        if (!outside) {
          const own = baseSpec(selector);
          while (level < prefixes.length - 1) {
            const c = cmp(add(own, PREFIX_SPEC[level]), need.spec);
            if (c > 0 || (c === 0 && !need.strict)) break;
            level += 1;
          }
        }
        for (const media of mediaFor(set)) {
          const group = `${outside ? 'x' : level}|${important}|${media}`;
          if (!out.has(group)) out.set(group, new Map());
          const sel = outside ? selector : prefixes[level] + selector;
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
function stripOwned(text) {
  let removedRules = 0; let removedSelectors = 0;
  const ast = parse(text, { positions: true });
  const edits = [];
  walk(ast, {
    visit: 'Rule',
    enter(node) {
      if (this.atrule && /keyframes/.test(this.atrule.name)) return;
      if (!node.prelude.children) return;
      const selectors = node.prelude.children.toArray();
      const keep = selectors.filter(s => !owned(generate(s)));
      if (keep.length === selectors.length) return;
      removedSelectors += selectors.length - keep.length;
      if (!keep.length) { removedRules += 1; edits.push([node.loc.start.offset, node.loc.end.offset, '']); }
      else edits.push([node.prelude.loc.start.offset, node.prelude.loc.end.offset, keep.map(s => generate(s)).join(',\n')]);
    }
  });
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

console.log(`${name}: ${decls} declarations in ${[...byMedia.values()].reduce((t, r) => t + r.length, 0)} rules (${importantCount} !important); specificity levels used ${levelCount.join('/')} (plain / #page / html body #page .entry-content / doubled id)`);
console.log(`Removes ${legacy.removedRules} legacy rules + ${legacy.removedSelectors - legacy.removedRules} selectors from mixed rules; ${shared.reduce((t, [, s]) => t + s.removedRules, 0)} shared rules + ${shared.reduce((t, [, s]) => t + s.removedSelectors - s.removedRules, 0)} selectors.`);
console.log(`Compiled CSS: ${Math.round(Buffer.byteLength(css) / 1024)} KB`);
if (sourceStats.used) console.log(`Read ${sourceStats.used} rule matches from the stylesheet source (DevTools gave no source data)${sourceStats.ambiguous.size ? `; ${sourceStats.ambiguous.size} ambiguous` : ''}${sourceStats.missing.size ? `; ${sourceStats.missing.size} not found` : ''}.`);
for (const key of sourceStats.missing) console.warn('  not found in source:', key);
for (const key of sourceStats.ambiguous) console.warn('  ambiguous in source (used the last):', key);
if (!write) {
  fs.mkdirSync('tests/visual/.output', { recursive: true });
  fs.writeFileSync(`tests/visual/.output/${name}.compiled.css`, css);
  console.log(`Preview: tests/visual/.output/${name}.compiled.css (dry run; nothing changed)`);
} else {
  fs.mkdirSync('styles/pages', { recursive: true });
  fs.writeFileSync(`styles/pages/${name}.css`, css);
  fs.writeFileSync(FILE, full.slice(0, startAt) + legacy.text + full.slice(endAt));
  for (const [file, s] of shared) fs.writeFileSync(file, s.text);
  console.log(`Wrote styles/pages/${name}.css and removed owned selectors. Run npm run build:styles next.`);
}
