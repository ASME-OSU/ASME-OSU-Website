import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// A single inventory is shared by local contracts and the read-only live audit.
// Indexed targets are included so newly published section anchors cannot silently drift.
export function registeredTargets(data, index = {records: []}) {
  const pages = data.pages || [], targets = [];
  const add = (page, selector, label, shared = false) => {
    if (selector) targets.push({page, selector, label, shared});
  };
  for (const [i, step] of (data.tour?.steps || []).entries()) {
    add(step.page, step.selector, `Tour step ${i + 1}`, /#(?:asme-site-header|site-navigation)\b/.test(step.selector || ''));
  }
  for (const page of pages) for (const section of page.sections || []) add(page.url, section.selector, `Section ${page.id}/${section.id}`);
  for (const record of index.records || []) for (const section of record.sections || []) add(record.url, section.selector, `Indexed section ${section.id}`);
  for (const intent of data.intents || []) {
    if (intent.source?.section) add(intent.source.page, intent.source.section, `Source ${intent.id}`);
    for (const action of intent.actions || []) {
      add(action.page, action.selector, `Action ${intent.id}`);
      for (const step of action.steps || []) add(step.page || action.page || data.meta?.siteBase || pages[0]?.url, step.selector, `Action step ${intent.id}`, !step.page && !action.page);
    }
  }
  return targets;
}

export async function checkRegisteredTargets(data, index, readSource) {
  const errors = [], docs = new Map();
  async function document(page, shared) {
    const key = page.sourceFile + (shared ? ':shared' : '');
    if (!docs.has(key)) {
      let html = await readSource(page.sourceFile);
      if (shared) html += await readSource('Header.html') + await readSource('Footer.html');
      const dom = new JSDOM(html);
      if (shared) dom.window.document.querySelectorAll('template').forEach(template => template.parentNode.append(template.content.cloneNode(true)));
      docs.set(key, dom);
    }
    return docs.get(key).window.document;
  }
  try {
    for (const target of registeredTargets(data, index)) {
      const page = (data.pages || []).find(page => page.url === target.page || page.id === target.page);
      if (!page?.sourceFile) { errors.push(`${target.label}: page is not registered (${target.page}).`); continue; }
      try {
        const doc = await document(page, target.shared);
        if (!doc.querySelector(target.selector)) errors.push(`${target.label}: selector ${target.selector} is missing from ${page.sourceFile}.`);
      } catch (error) { errors.push(`${target.label}: ${error.message}`); }
    }
    // Only chapter-owned destinations are checked here. Third-party availability is
    // deliberately left out of source validation, rather than making builds flaky.
    const base = new URL(data.meta?.siteBase || 'https://org.osu.edu/asme/');
    const links = (data.intents || []).flatMap(intent => [
      ...(intent.response?.cards || []).map(card => ({url: card.url, label: `Card ${intent.id}`})),
      ...(intent.actions || []).filter(action => action.url).map(action => ({url: action.url, label: `Link ${intent.id}`}))
    ]);
    for (const link of links) {
      let url;
      try { url = new URL(link.url); } catch { errors.push(`${link.label}: invalid URL.`); continue; }
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) continue;
      const page = (data.pages || []).find(page => new URL(page.url).pathname.replace(/\/$/, '') === url.pathname.replace(/\/$/, ''));
      if (!page) { errors.push(`${link.label}: chapter destination is not registered (${url.pathname}).`); continue; }
      if (url.hash) {
        const doc = await document(page, false);
        if (!doc.getElementById(decodeURIComponent(url.hash.slice(1)))) errors.push(`${link.label}: fragment ${url.hash} is missing from ${page.sourceFile}.`);
      }
    }
  } finally { for (const dom of docs.values()) dom.window.close(); }
  return errors;
}

export async function checkContract(data, readSource, index = {records: []}) {
  const errors = [];
  const warnings = [];
  const documents = new Map();
  async function source(file) {
    if (!documents.has(file)) documents.set(file, Promise.resolve().then(() => readSource(file)));
    return documents.get(file);
  }
  errors.push(...await checkRegisteredTargets(data, index, source));
  try {
    const manifest = JSON.parse(await source('data/points-source.json'));
    if (manifest.schemaVersion !== 1 || !data.meta?.sheetID || manifest.exportId !== data.meta.sheetID) errors.push('meta.sheetID differs from the approved points-source.json export ID.');
  } catch (error) { errors.push(`Public sheet contract: ${error.message}`); }
  let join = '';
  let leadership = '';
  let footer = '';
  for (const [file, assign] of [
    ['Join Page.html', text => { join = text; }],
    ['Leadership Page.html', text => { leadership = text; }],
    ['Footer.html', text => { footer = text; }]
  ]) {
    try { assign(await source(file)); } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  const email = data.meta?.contactEmail;
  if (!email || !(join.includes(email) || leadership.includes(email))) errors.push('meta.contactEmail is missing from Join and Leadership sources.');
  const handle = data.meta?.instagramHandle;
  const socialDocs = new JSDOM(join + footer).window.document;
  const instagramHandles = Array.from(socialDocs.querySelectorAll('a[href]')).flatMap(link => {
    try {
      const url = new URL(link.getAttribute('href'));
      return ['instagram.com', 'www.instagram.com'].includes(url.hostname) ? [url.pathname.split('/').filter(Boolean)[0]] : [];
    } catch (_) { return []; }
  });
  if (!handle || !instagramHandles.includes(handle.replace(/^@/, ''))) errors.push('meta.instagramHandle is missing from Footer and Join Instagram links.');
  if ((data.intents || []).some(intent => intent.id === 'dues' && intent.static === true) && /\$\s*\d/.test(new JSDOM(join).window.document.body.textContent)) {
    warnings.push('Joining copy contains a dollar amount while dues is static; review the free-membership fallback.');
  }
  if (data.eventTypes) {
    try {
      const calendar = JSON.parse(await source('data/calendar-events.json'));
      const definitions = Array.isArray(data.eventTypes) ? data.eventTypes : Object.values(data.eventTypes);
      const vocabulary = definitions.flatMap(type => Array.isArray(type) ? type : (type.keywords || type.terms || type.aliases || type.vocabulary || []));
      const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      // Use the adapter's bounded, case-insensitive compilation rules.
      const patterns = Array.isArray(data.eventRules?.nonChapterTitlePatterns)
        ? data.eventRules.nonChapterTitlePatterns.slice(0, 50).map(pattern => {
          try { return typeof pattern === 'string' ? new RegExp(pattern, 'i') : null; }
          catch (_) { return null; }
        }).filter(Boolean)
        : [];
      const companyAliases = (data.entities?.companies || []).flatMap(company =>
        [company.name, company.id, ...(company.aliases || [])].filter(Boolean)
      );
      for (const event of calendar.events || []) {
        if (patterns.some(pattern => pattern.test(event.title || ''))) continue;
        const title = normalize(event.title);
        const companyMatch = companyAliases.some(alias =>
          (' ' + title + ' ').includes(' ' + normalize(alias) + ' ')
        );
        const declaredType = Object.prototype.hasOwnProperty.call(data.eventTypes, event.eventType || '');
        if (!declaredType && !companyMatch && !vocabulary.some(word => title.includes(normalize(word)))) {
          warnings.push(`Calendar event has no configured event type: ${event.title}`);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') warnings.push(`Calendar type check unavailable: ${error.message}`);
    }
  }
  return { errors, warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const data = JSON.parse(await fs.readFile(path.join(root, 'assets/gearly/gearly-data.json'), 'utf8'));
  const index = JSON.parse(await fs.readFile(path.join(root, 'assets/gearly/gearly-index.json'), 'utf8'));
  const result = await checkContract(data, file => fs.readFile(path.join(root, file), 'utf8'), index);
  result.warnings.forEach(warning => console.warn(`Gearly warning: ${warning}`));
  result.errors.forEach(error => console.error(`Gearly contract error: ${error}`));
  if (result.errors.length) process.exitCode = 1;
  else console.log('Gearly source contracts are current.');
}
