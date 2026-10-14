import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import '../assets/gearly/gearly-content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await fs.readFile(path.join(root, 'Leadership Page.html'), 'utf8');
const data = JSON.parse(await fs.readFile(path.join(root, 'assets/gearly/gearly-data.json'), 'utf8'));
const result = globalThis.GearlyContent.parseLeadership(new JSDOM(source).window.document, data.entities.roles);
if (!result.current?.officers.length) throw new Error('Leadership source has no current officers');
const output = path.join(root, 'assets/gearly/gearly-officers.json');
const expected = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const actual = await fs.readFile(output, 'utf8').catch(() => '');
  if (actual !== expected) throw new Error('Gearly officer snapshot is stale; run node scripts/build-gearly-officers.mjs');
  console.log('Gearly officer snapshot is current.');
} else {
  await fs.writeFile(output, expected);
  console.log(`Wrote ${result.current.officers.length} current officers and ${result.past.length} past boards.`);
}
