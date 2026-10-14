import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import '../assets/gearly/gearly-site.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sponsors, join, rawData, sponsorship] = await Promise.all([
  fs.readFile(path.join(root, 'Current Sponsors Page.html'), 'utf8'),
  fs.readFile(path.join(root, 'Join Page.html'), 'utf8'),
  fs.readFile(path.join(root, 'assets/gearly/gearly-data.json'), 'utf8'),
  fs.readFile(path.join(root,'Sponsor ASME Page.html'),'utf8')
]);
const data = JSON.parse(rawData);
const parsed = globalThis.GearlySite.parseSponsors(new JSDOM(sponsors).window.document, data.companyAliases);
const faqs = globalThis.GearlySite.parseFAQs(new JSDOM(join).window.document);
if (!parsed.companies.length || !faqs.length) throw new Error('Gearly site sources have no companies or FAQs');
const sponsorshipOptions=globalThis.GearlySite.parseSponsorship(new JSDOM(sponsorship).window.document);
const expected = JSON.stringify({ companies: parsed.companies, tiers: parsed.tiers, faqs, sponsorship:sponsorshipOptions }, null, 2) + '\n';
const output = path.join(root, 'assets/gearly/gearly-site.json');
// Vocabulary remains usable by the offline matcher; names are always derived
// from the page rather than maintained as a second editorial company list.
const entities = parsed.companies.map(({ id, name, aliases }) => ({ id, name, aliases }));
if (process.argv.includes('--check')) {
  const actual = await fs.readFile(output, 'utf8').catch(() => '');
  if (actual !== expected) throw new Error('Gearly site snapshot is stale; run node scripts/build-gearly-site.mjs');
  if (JSON.stringify(data.entities?.companies) !== JSON.stringify(entities)) throw new Error('Gearly generated company entities are stale; run node scripts/build-gearly-site.mjs');
  console.log('Gearly site snapshot is current.');
} else {
  await fs.writeFile(output, expected);
  data.entities = data.entities || {};
  data.entities.companies = entities;
  await fs.writeFile(path.join(root, 'assets/gearly/gearly-data.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${parsed.companies.length} companies and ${faqs.length} FAQs.`);
}
