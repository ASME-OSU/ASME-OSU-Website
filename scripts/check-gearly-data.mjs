import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root = path.resolve(import.meta.dirname, '..');
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function findMissingSponsors(data, html) {
  const dom = new JSDOM(html);
  dom.window.document.querySelectorAll('script,style,template').forEach(node => node.remove());
  const text = ' ' + normalize(dom.window.document.body.textContent) + ' ';
  const companies = data && data.entities && Array.isArray(data.entities.companies) ? data.entities.companies : [];
  const missing = companies.filter(company => {
    if (!company || typeof company.name !== 'string' || !company.name.trim()) return false;
    const aliases = [company.name].concat(Array.isArray(company.aliases) ? company.aliases : []);
    return !aliases.some(alias => typeof alias === 'string' && normalize(alias) && text.includes(' ' + normalize(alias) + ' '));
  }).map(company => company.name);
  dom.window.close();
  return missing;
}
export function reportSponsorDrift(missing, warn = console.warn) {
  if (!missing.length) return;
  warn('Gearly sponsor data differs from Current Sponsors Page.html. Names referenced by Gearly but missing from the page:\n' + missing.map(name => '  - ' + name).join('\n'));
}
function main() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/gearly/gearly-data.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'Current Sponsors Page.html'), 'utf8');
  reportSponsorDrift(findMissingSponsors(data, html));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
