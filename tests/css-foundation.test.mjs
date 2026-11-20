import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'css-tree';

const built = fs.readFileSync(new URL('../ASME Custom CSS.min.css', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../ASME Custom CSS.css', import.meta.url), 'utf8');

test('the font @import stays the first rule, where browsers honor it', () => {
  const first = parse(built).children.first;
  assert.equal(first.type, 'Atrule');
  assert.equal(first.name, 'import');
  assert.match(built.slice(0, 200), /DM\+Serif\+Display/);
});

test('the stylesheet is built as foundation, legacy, then shared layers', () => {
  const order = ['/* ASME FOUNDATION START */', '/* ASME FOUNDATION END */', '/* ASME SHARED DESIGN SYSTEM START */', '/* ASME SHARED DESIGN SYSTEM END */'].map(marker => source.indexOf(marker));
  assert.ok(order.every(index => index > 0), 'all layer markers present');
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const foundation = source.slice(order[0], order[1]);
  assert.match(foundation, /--asme-c-accent:\s*#bb0000/);
  assert.match(foundation, /prefers-color-scheme:\s*dark/);
});

test('tokens define a dark value for every color that changes in dark mode', () => {
  const tokens = fs.readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const names = new Set([...tokens.matchAll(/(--asme-c-[a-z-]+):/g)].map(m => m[1]));
  const dark = tokens.slice(tokens.indexOf('prefers-color-scheme: dark'));
  for (const name of ['--asme-c-text', '--asme-c-heading', '--asme-c-surface', '--asme-c-page', '--asme-c-border', '--asme-c-focus']) {
    assert.ok(names.has(name), name + ' defined');
    assert.match(dark, new RegExp(name + ':'), name + ' has a dark-mode value');
  }
});

test('rebuilt page styles come last and keep !important rare', () => {
  const pages = fs.readdirSync(new URL('../styles/pages/', import.meta.url)).filter(f => f.endsWith('.css'));
  assert.ok(pages.includes('about.css'));
  const start = source.indexOf('/* ASME PAGES START */');
  assert.ok(start > source.indexOf('/* ASME SHARED DESIGN SYSTEM END */'), 'pages layer follows the shared layer');
  for (const file of pages) {
    const full = fs.readFileSync(new URL('../styles/pages/' + file, import.meta.url), 'utf8');
    // Rules carried over verbatim (motion preference, orientation,
    // ::placeholder) keep their original !important; only derived rules count.
    const cut = full.indexOf('/* Carried over unchanged');
    const css = cut === -1 ? full : full.slice(0, cut);
    const declarations = (css.match(/:[^;{}]+;/g) || []).length;
    const important = (css.match(/!important/g) || []).length;
    // Derived rules need !important only to beat shared rules not yet rebuilt
    // (site-wide button and form-field lists). Sponsor pages sit near 8-9%,
    // down from almost every declaration; the budget falls as shared rules go.
    assert.ok(important / declarations < 0.10, `${file}: ${important} of ${declarations} derived declarations use !important`);
  }
});
