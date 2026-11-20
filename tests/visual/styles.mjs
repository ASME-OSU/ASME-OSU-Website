// Computed-style fingerprints: every element's (and ::before/::after's) final
// style values, so a CSS refactor can be shown to produce the same cascade
// result even where screenshots cannot tell (hidden elements, transitions,
// cursor, z-index ties, states with no visible effect).

const GROUPS = [
  ['box', /^(width|height|min-|max-|margin|padding|box-sizing|inset|top$|right$|bottom$|left$|aspect-ratio|block-size|inline-size)/],
  ['layout', /^(display|position|float|clear|flex|grid|gap|row-gap|column-gap|align|justify|place|order|overflow|z-index|vertical-align|contain|content-visibility|columns?|table-layout|isolation)/],
  ['text', /^(font|line-height|letter-spacing|word-spacing|text-|white-space|word-break|overflow-wrap|hyphens|color$|-webkit-text|list-style|tab-size|direction|writing-mode|quotes)/],
  ['visual', /^(background|border|outline|box-shadow|opacity|filter|backdrop-filter|mix-blend|clip|mask|object-|visibility|accent-color|caret-color|color-scheme|fill|stroke)/],
  ['motion', /^(transition|animation|transform|translate|rotate|scale|will-change|perspective|offset)/]
];
export const GROUP_NAMES = [...GROUPS.map(([name]) => name), 'other'];

// Runs in the page. Returns { elements: {key: {group: hash}}, values: {hash: "prop:value;..."} }.
export function captureStyles(page) {
  return page.evaluate(groups => {
    const patterns = groups.map(([name, source]) => [name, new RegExp(source)]);
    const groupOf = new Map();
    const values = {};
    const hash = text => {
      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      const key = (h >>> 0).toString(36) + text.length.toString(36);
      values[key] = text;
      return key;
    };
    const fingerprint = style => {
      const parts = {};
      for (let i = 0; i < style.length; i += 1) {
        const prop = style[i];
        // Set from JavaScript by the scroll-reveal script, which staggers the
        // delay by when each element enters view; not a stylesheet result.
        if (prop === '--asme-delay') continue;
        // Browsers report these as layout results (auto margins and sizes
        // become pixels), which vary with load timing. Screenshots and
        // photo boxes already check layout.
        if (/^(width|height|inline-size|block-size|margin|inset|top|right|bottom|left|perspective-origin|transform-origin)/.test(prop)) continue;
        let group = groupOf.get(prop);
        if (!group) {
          group = (patterns.find(([, pattern]) => pattern.test(prop)) || ['other'])[0];
          groupOf.set(prop, group);
        }
        (parts[group] ||= []).push(prop + ':' + style.getPropertyValue(prop));
      }
      return Object.fromEntries(Object.entries(parts).map(([group, list]) => [group, hash(list.join(';'))]));
    };
    const keys = new Map();
    const keyOf = el => {
      if (keys.has(el)) return keys.get(el);
      let key;
      if (el === document.body) key = 'body';
      else if (el === document.documentElement) key = 'html';
      else {
        const parent = el.parentElement;
        const index = parent ? Array.prototype.indexOf.call(parent.children, el) + 1 : 1;
        key = (parent ? keyOf(parent) + '>' : '') + el.tagName.toLowerCase() + ':' + index;
      }
      keys.set(el, key);
      return key;
    };
    const elements = {};
    for (const el of [document.documentElement, ...document.querySelectorAll('body, body *')]) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const key = keyOf(el);
      elements[key] = fingerprint(getComputedStyle(el));
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(el, pseudo);
        if (style.content && style.content !== 'none' && style.content !== 'normal') elements[key + pseudo] = fingerprint(style);
      }
    }
    return { elements, values };
  }, GROUPS.map(([name, pattern]) => [name, pattern.source]));
}

// Differences between two captures: [{ key, props: ["color: a → b", ...] }]
export function compareStyles(before, after, limit = 25) {
  const changes = [];
  const keys = new Set([...Object.keys(before.elements), ...Object.keys(after.elements)]);
  let total = 0;
  for (const key of keys) {
    const a = before.elements[key]; const b = after.elements[key];
    if (!a || !b) { total += 1; if (changes.length < limit) changes.push({ key, props: [a ? 'element removed' : 'element added'] }); continue; }
    const props = [];
    for (const group of GROUP_NAMES) {
      if (a[group] === b[group]) continue;
      const left = Object.fromEntries((before.values[a[group]] || '').split(';').filter(Boolean).map(pair => [pair.slice(0, pair.indexOf(':')), pair.slice(pair.indexOf(':') + 1)]));
      const right = Object.fromEntries((after.values[b[group]] || '').split(';').filter(Boolean).map(pair => [pair.slice(0, pair.indexOf(':')), pair.slice(pair.indexOf(':') + 1)]));
      for (const prop of new Set([...Object.keys(left), ...Object.keys(right)])) {
        // A newly defined custom property changes nothing until something
        // uses it; changed or removed ones are still reported.
        if (prop.startsWith('--') && !(prop in left)) continue;
        if (left[prop] !== right[prop]) props.push(`${prop}: ${left[prop] ?? '—'} → ${right[prop] ?? '—'}`);
      }
    }
    if (props.length) { total += 1; if (changes.length < limit) changes.push({ key, props }); }
  }
  return { total, changes };
}
