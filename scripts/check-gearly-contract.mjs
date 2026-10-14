import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export async function checkContract(data, readSource) {
  const errors = [];
  const warnings = [];
  const documents = new Map();
  async function source(file) {
    if (!documents.has(file)) documents.set(file, Promise.resolve().then(() => readSource(file)));
    return documents.get(file);
  }
  const pages = data.pages || [];
  for (const [index, step] of (data.tour?.steps || []).entries()) {
    const page = pages.find(page => page.url === step.page || page.id === step.page);
    if (!page?.sourceFile) {
      errors.push(`Tour step ${index + 1}: page is not registered with a source file (${step.page}).`);
      continue;
    }
    try {
      let html = await source(page.sourceFile);
      // WordPress composes the shared header with each page. Only the two
      // shared navigation targets may be validated against that header source.
      const sharedHeader = /#(?:asme-site-header|site-navigation)\b/.test(step.selector || '');
      if (sharedHeader) html += await source('Header.html');
      const doc = new JSDOM(html).window.document;
      if(sharedHeader){const template=doc.querySelector('#asme-header-template');if(template)doc.body.append(template.content.cloneNode(true));}
      if (!step.selector || !doc.querySelector(step.selector)) errors.push(`Tour step ${index + 1}: selector ${step.selector} is missing from ${page.sourceFile}.`);
    } catch (error) { errors.push(`Tour step ${index + 1}: ${error.message}`); }
  }
  try {
    const integration = await source('Member Points Integration.js');
    const sheet = integration.match(/\b(?:EXPORT_ID|SHEET_ID)\s*=\s*['"]([^'"]+)['"]/);
    if (!data.meta?.sheetID || sheet?.[1] !== data.meta.sheetID) errors.push('meta.sheetID differs from Member Points Integration.js public sheet ID.');
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
  const result = await checkContract(data, file => fs.readFile(path.join(root, file), 'utf8'));
  result.warnings.forEach(warning => console.warn(`Gearly warning: ${warning}`));
  result.errors.forEach(error => console.error(`Gearly contract error: ${error}`));
  if (result.errors.length) process.exitCode = 1;
  else console.log('Gearly source contracts are current.');
}
