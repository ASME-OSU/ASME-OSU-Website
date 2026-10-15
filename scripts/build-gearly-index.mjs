import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root = path.resolve(import.meta.dirname, '..');
export const approved = new Set(['Home Page.html','Join Page.html','Calendar Page.html','Leadership Page.html','Member Resources Page.html','Member Points Page.html','Gallery Page.html','About Us Page.html','Current Sponsors Page.html','Sponsor ASME Page.html']);
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
function excerpt(value, limit) {
  const text = clean(value);
  if (text.length <= limit) return text;
  const clipped = text.slice(0, limit + 1).replace(/\s+\S*$/, '').trim();
  return (clipped || text.slice(0, limit - 1)).slice(0, limit - 1) + '…';
}
const headingSelector = 'h1,h2,h3,h4,h5,h6';
const safeAnchor = /^[A-Za-z][A-Za-z0-9_-]*$/;

function excluded(node) {
  if (node.closest('form,input,textarea,select,button,[role="dialog"],[aria-modal="true"]')) return true;
  for (let parent = node; parent; parent = parent.parentElement) {
    if (/modal/i.test(parent.id || '') || /(?:^|[\s_-])modal(?:$|[\s_-])/i.test(parent.className || '')) return true;
  }
  return false;
}
function anchor(node) {
  if (excluded(node)) return null;
  if (safeAnchor.test(node.id)) return '#' + node.id;
  const value = node.getAttribute('data-gearly');
  return value && safeAnchor.test(value) ? "[data-gearly='" + value + "']" : null;
}
function nearbyHeading(node, document) {
  if (node.matches(headingSelector)) return node;
  const labelled = (node.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)).find(element => element && element.matches(headingSelector));
  if (labelled) return labelled;
  const child = node.querySelector(headingSelector);
  if (child) return child;
  const previous = node.previousElementSibling;
  if (previous) {
    if (previous.matches(headingSelector)) return previous;
    const previousHeadings = [...previous.querySelectorAll(headingSelector)];
    if (previousHeadings.length) return previousHeadings[previousHeadings.length - 1];
  }
  const section = node.parentElement && node.parentElement.closest('section,article');
  return section ? section.querySelector(headingSelector) : null;
}
export function buildRecords(pages, readSource) {
  const warnings = [];
  const records = pages.map(page => {
    if (!approved.has(page.sourceFile)) throw new Error('Unapproved search source: ' + page.sourceFile);
    const url = new URL(page.url);
    if (url.origin !== 'https://org.osu.edu' || !url.pathname.startsWith('/asme/') || url.username || url.password) throw new Error('Unapproved route: ' + page.url);
    const dom = new JSDOM(readSource(page.sourceFile));
    const document = dom.window.document;
    const body = document.body;
    body.querySelectorAll('script,style,template,[hidden],[aria-hidden="true"],input,textarea,button,form,nav,header[role="banner"],footer[role="contentinfo"],.asme-status-badge,[aria-busy="true"],.asme-points-feature--loading').forEach(node => node.remove());
    const headingNodes = [...body.querySelectorAll(headingSelector)];
    const headings = headingNodes.map(node => clean(node.textContent));
    const sections = [];
    const selectors = new Set();
    const coveredHeadings = new Set();
    for (const node of body.querySelectorAll('[id],[data-gearly]')) {
      const selector = anchor(node);
      const heading = selector && nearbyHeading(node, document);
      const title = heading && clean(heading.textContent);
      if (!selector || !title || selectors.has(selector)) continue;
      selectors.add(selector);
      coveredHeadings.add(heading);
      const sectionText = node.matches(headingSelector) ? (node.parentElement || node).textContent : node.textContent;
      sections.push({
        id: page.id + ':' + selector,
        pageId: page.id,
        selector,
        title,
        snippet: excerpt(sectionText, 300),
        keywords: Array.from(new Set(title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(word => word.length > 1)))
      });
    }
    const unanchored = headingNodes.filter(node => {
      if (!node.matches('h1,h2') || excluded(node) || coveredHeadings.has(node)) return false;
      if (page.sourceFile === 'Leadership Page.html' && node.closest('.leader-card,.lb-past-years,.lb-year-panel')) return false;
      return true;
    }).map(node => clean(node.textContent)).filter(Boolean);
    if (unanchored.length) warnings.push({pageId: page.id, title: page.title, headings: unanchored});
    const description = [...body.querySelectorAll('p')].map(node => clean(node.textContent)).find(text => text.length > 45) || page.title;
    const record = {id: page.id, title: page.title, url: url.href, description: excerpt(description, 180), keywords: page.keywords, headings, text: clean(body.textContent).slice(0, 14000), sections};
    dom.window.close();
    return record;
  });
  return {version: 2, records, warnings};
}
export function checkContents(output, contents) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== contents) throw new Error('Gearly index is stale: run npm run build:gearly');
}
function main() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/gearly/gearly-data.json'), 'utf8'));
  const built = buildRecords(data.pages, source => fs.readFileSync(path.join(root, source), 'utf8'));
  if (built.warnings.length) {
    console.warn('Gearly headings without anchors (add an id or data-gearly to the heading or its section):');
    for (const warning of built.warnings) console.warn('  ' + warning.title + ':\n' + warning.headings.map(heading => '    - ' + heading).join('\n'));
  }
  const output = path.join(root, 'assets/gearly/gearly-index.json');
  const contents = JSON.stringify({version: built.version, records: built.records}, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    checkContents(output, contents);
    console.log('Gearly public content index matches approved source pages.');
  } else {
    fs.writeFileSync(output, contents);
    console.log('Generated Gearly search index: ' + built.records.length + ' approved pages.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
