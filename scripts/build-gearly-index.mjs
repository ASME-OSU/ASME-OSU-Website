import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const root = path.resolve(import.meta.dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/gearly/gearly-data.json'), 'utf8'));
const approved = new Set(['Home Page.html','Join Page.html','Calendar Page.html','Leadership Page.html','Member Resources Page.html','Member Points Page.html','Gallery Page.html','About Us Page.html','Current Sponsors Page.html','Sponsor ASME Page.html']);
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const records = data.pages.map(page => {
  if (!approved.has(page.sourceFile)) throw new Error('Unapproved search source: ' + page.sourceFile);
  const url = new URL(page.url);
  if (url.origin !== 'https://org.osu.edu' || !url.pathname.startsWith('/asme/')) throw new Error('Unapproved route: ' + page.url);
  const dom = new JSDOM(fs.readFileSync(path.join(root, page.sourceFile), 'utf8'));
  const body = dom.window.document.body;
  body.querySelectorAll('script,style,template,[hidden],input,textarea').forEach(node => node.remove());
  const headings = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(node => clean(node.textContent));
  const description = [...body.querySelectorAll('p')].map(node => clean(node.textContent)).find(text => text.length > 45) || page.title;
  const result = { id: page.id, title: page.title, url: url.href, description: description.slice(0, 180), keywords: page.keywords, headings, text: clean(body.textContent).slice(0, 14000) };
  dom.window.close();
  return result;
});
const output = path.join(root, 'assets/gearly/gearly-index.json');
const contents = JSON.stringify({version:1,records}, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output,'utf8') !== contents) throw new Error('Gearly index is stale: run npm run build:gearly');
  console.log('Gearly public content index matches approved source pages.');
} else { fs.writeFileSync(output, contents); console.log('Generated Gearly search index: ' + records.length + ' approved pages.'); }
