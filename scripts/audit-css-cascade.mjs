import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, generate, lexer } from 'css-tree';

export const cssSources = ['ASME Custom CSS.css', 'Header.css', 'celebration.css', 'join-three-step.css', 'styles/design-system.css', 'assets/gearly/gearly.css', 'assets/gearly/gearly-tour.css'];

// This intentionally proves only exact-selector/property shadowing. Different
// specificity, shorthands, keyframes, layers and unknown conditions stay intact.
export function cleanCascade(source, { protectedFrom = Infinity } = {}) {
  const ast = parse(source, { positions: true });
  const declarations = [];
  function collect(list, conditions = []) {
    list.forEach(node => {
      if (node.type === 'Rule' && node.prelude.type === 'SelectorList') {
        const selectors = node.prelude.children.toArray().map(item => generate(item));
        const selectorText = generate(node.prelude);
        node.block.children.forEach(declaration => {
          if (declaration.type !== 'Declaration') return;
          declarations.push({ selectors, selectorText, conditions, property: declaration.property.toLowerCase(), important: Boolean(declaration.important), value: generate(declaration.value), start: declaration.loc.start.offset, end: declaration.loc.end.offset, line: declaration.loc.start.line });
        });
      } else if (node.type === 'Atrule' && node.block?.children && ['media', 'supports'].includes(node.name.toLowerCase())) {
        collect(node.block.children, [...conditions, `@${node.name.toLowerCase()} ${generate(node.prelude)}`]);
      }
    });
  }
  collect(ast.children);
  const validity = new Map();
  function trustworthy(row) {
    // A comma list containing an unsupported vendor selector can invalidate the
    // whole rule in another engine. Do not use it to erase a portable fallback.
    if (/::?-(?:webkit|moz|ms|o)-/.test(row.selectorText)) return false;
    if (/\brevert(?:-layer)?\b/.test(row.value)) return false;
    const key = `${row.property}:${row.value}`;
    if (!validity.has(key)) {
      const match = lexer.matchProperty(row.property, row.value);
      validity.set(key, Boolean(match.matched) || row.value.includes('var('));
    }
    return validity.get(key);
  }
  const later = new Map();
  const removed = [];
  for (const row of [...declarations].reverse()) {
    if (row.start < protectedFrom && !row.property.startsWith('-')) {
      const winners = row.selectors.map(selector => (later.get(`${selector}|${row.property}`) || []).find(candidate =>
        (!row.important || candidate.important) &&
        candidate.conditions.every(condition => row.conditions.includes(condition)) &&
        trustworthy(candidate)
      ));
      if (winners.length && winners.every(Boolean)) {
        removed.push({ ...row, winners: winners.map(winner => ({ line: winner.line, conditions: winner.conditions, value: winner.value, important: winner.important })) });
      }
    }
    for (const selector of row.selectors) {
      const key = `${selector}|${row.property}`;
      const candidates = later.get(key) || [];
      candidates.push(row);
      later.set(key, candidates);
    }
  }
  let cleaned = source;
  for (const row of [...removed].sort((a, b) => b.start - a.start)) {
    const end = source[row.end] === ';' ? row.end + 1 : row.end;
    cleaned = cleaned.slice(0, row.start) + cleaned.slice(end);
  }
  // Empty selector/group shells have no remaining declarations or behavior.
  const empty = [];
  const reparsed = parse(cleaned, { positions: true });
  const pruneBoundary = Number.isFinite(protectedFrom) ? cleaned.length - (source.length - protectedFrom) : Infinity;
  function prune(list) {
    list.forEach(node => {
      if (node.loc.start.offset >= pruneBoundary) return;
      if (node.type === 'Rule' && node.block.children.isEmpty) empty.push([node.loc.start.offset, node.loc.end.offset]);
      else if (node.type === 'Atrule' && node.block?.children && ['media', 'supports'].includes(node.name.toLowerCase())) prune(node.block.children);
    });
  }
  prune(reparsed.children);
  for (const [start, end] of empty.sort((a, b) => b[0] - a[0])) cleaned = cleaned.slice(0, start) + cleaned.slice(end);
  let emptyGroups = 0;
  for (;;) {
    const groups = [];
    const tree = parse(cleaned, { positions: true });
    const groupBoundary = Number.isFinite(protectedFrom) ? cleaned.length - (source.length - protectedFrom) : Infinity;
    function findGroups(list) {
      list.forEach(node => {
        if (node.loc.start.offset >= groupBoundary) return;
        if (node.type !== 'Atrule' || !node.block?.children || !['media', 'supports'].includes(node.name.toLowerCase())) return;
        if (node.block.children.isEmpty) groups.push([node.loc.start.offset, node.loc.end.offset]);
        else findGroups(node.block.children);
      });
    }
    findGroups(tree.children);
    if (!groups.length) break;
    emptyGroups += groups.length;
    for (const [start, end] of groups.sort((a, b) => b[0] - a[0])) cleaned = cleaned.slice(0, start) + cleaned.slice(end);
  }
  if (Number.isFinite(protectedFrom)) {
    const tail = source.slice(protectedFrom);
    cleaned = cleaned.slice(0, cleaned.length - tail.length).replace(/^[\t ]+$/gm, '') + tail;
  } else cleaned = cleaned.replace(/^[\t ]+$/gm, '');
  return { css: cleaned, removed: removed.reverse(), declarations: declarations.length, emptyRules: empty.length, emptyGroups };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = [];
  for (const file of cssSources) {
    const before = fs.readFileSync(file, 'utf8');
    const marker = before.indexOf('/* ASME SHARED DESIGN SYSTEM START */');
    const result = cleanCascade(before, { protectedFrom: marker < 0 ? Infinity : marker });
    if (process.argv.includes('--write')) fs.writeFileSync(file, result.css);
    const summary = { file, declarations: result.declarations, removable: result.removed.length, emptyRules: result.emptyRules, emptyGroups: result.emptyGroups, bytesSaved: Buffer.byteLength(before) - Buffer.byteLength(result.css) };
    console.log(JSON.stringify(summary));
    report.push({ ...summary, removed: result.removed });
  }
  const reportIndex = process.argv.indexOf('--report');
  if (reportIndex >= 0) fs.writeFileSync(process.argv[reportIndex + 1], JSON.stringify(report, null, 2) + '\n');
}
